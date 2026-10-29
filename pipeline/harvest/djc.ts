// Lectura de la "Declaración Jurada de Conformidad" (DJC) de la Res. SIC 438/2024. Cada fabricante la publica por
// modelo con los mismos campos que la etiqueta (clase, consumo, volúmenes o carga), así que es la fuente oficial más completa.
import type { CategoryId, Specs } from '../../lib/types';
import { normalizeText, toNumber } from '../normalize/parse';

export interface DjcRecord {
  category: CategoryId;
  /** pares marca → modelos (una DJC puede cubrir marcas gemelas, p. ej. Drean y Patrick) */
  groups: { brand: string; models: string[] }[];
  cls?: string;
  specs: Specs;
}

function field(t: string, re: RegExp): number | undefined {
  const m = t.match(re);
  return m ? toNumber(m[1]) : undefined;
}

function categoryOf(t: string): CategoryId | undefined {
  if (/iram 2404|refrigerador|congelador/.test(t)) return 'heladeras';
  if (/iram 2141|lavarropas/.test(t)) return 'lavarropas';
  if (/iram 62406|acondicionador/.test(t)) return 'aires';
  if (/iram 62410|termotanque/.test(t)) return 'termotanques';
  return undefined;
}

/** "1) A; B; 2) C" o "(1) A, B (2) C" → [[A, B], [C]] ; sin numeración → [[A, B]] */
function numbered(s: string): string[][] {
  const parts = s.split(/\s*\(?\b\d\)\s*/).filter((x) => x.trim());
  return parts.map((p) =>
    p
      .split(/[;,:/]|\s+y\s+/)
      .map((x) => x.replace(/[^a-z0-9 .-]/gi, '').trim())
      .filter((x) => x.length >= 2),
  );
}

export function parseDjc(raw: string): DjcRecord | null {
  // texto plano en minúsculas sin acentos; los saltos de línea se conservan para cortar los campos
  const t = normalizeText(raw).replace(/[ \t]+/g, ' ');
  if (!/declaracion jurada de conformidad/.test(t) && !/438\/2024/.test(t)) return null;
  const category = categoryOf(t);
  if (!category) return null;

  const modelLine = t.match(/modelo(?:s)?:\s*([\s\S]*?)\n\s*(?:caracteristicas|fabricante|origen|marca)/)?.[1] ?? t.match(/codigo de identificacion unico del producto:?\s*([\s\S]*?)\n\s*marca/)?.[1];
  const brandLine = t.match(/\bmarca(?:s)?:\s*([^\n]*)/)?.[1] ?? '';
  if (!modelLine) return null;
  const modelGroups = numbered(modelLine.replace(/\n/g, ' '));
  const brandGroups = numbered(brandLine);
  // cada grupo de modelos va con su grupo de marcas (si hay una sola marca, vale para todos)
  const groups = modelGroups.flatMap((models, i) => {
    const clean = models.map((m) => m.toUpperCase().replace(/\s+/g, '')).filter((m) => /\d/.test(m) && /[A-Z]/.test(m));
    const brands = brandGroups[modelGroups.length === brandGroups.length ? i : 0] ?? [];
    return clean.length ? brands.map((b) => ({ brand: b.toUpperCase(), models: clean })) : [];
  });
  if (!groups.length) return null;

  const cls = t.match(/clase de eficiencia energetica[^:\n]*:\s*([a-g])\b/)?.[1]?.toUpperCase();
  const specs: Specs = {};
  switch (category) {
    case 'heladeras': {
      const kwh = field(t, /consumo de energia \(kwh\/ano\):\s*([\d.,]+)/);
      const fresh = field(t, /volumen de alimentos frescos \(litros\):\s*([\d.,]+)/);
      const frozen = field(t, /volumen de alimentos congelados \(litros\):\s*([\d.,]+)/);
      if (kwh && kwh > 30 && kwh < 2000) specs.kwhPerYear = kwh;
      if (fresh !== undefined || frozen !== undefined) specs.totalVolumeL = (fresh ?? 0) + (frozen ?? 0);
      if (frozen) specs.freezerVolumeL = frozen;
      break;
    }
    case 'lavarropas': {
      const kwh = field(t, /consumo de energia por ciclo \(kwh\):\s*([\d.,]+)/);
      const water = field(t, /consumo de agua por ciclo \(litros\):\s*([\d.,]+)/);
      const kg = field(t, /capacidad[^:\n]*\(kg[^:\n]*:\s*([\d.,]+)/);
      if (kwh && kwh > 0.05 && kwh < 5) specs.kwhPerCycle = kwh;
      if (water && water > 10 && water < 300) specs.waterLPerCycle = water;
      if (kg && kg > 2 && kg < 30) specs.capacityKg = kg;
      break;
    }
    case 'aires': {
      const cap = field(t, /capacidad de refrigeracion[^:\n]*:\s*([\d.,]+)/);
      const ieee = field(t, /(?:ieee|indice de eficiencia energetica estacional|seer)[^:\n]*:\s*([\d.,]+)/);
      const eer = field(t, /\beer[^:\n]*:\s*([\d.,]+)/);
      if (cap && cap > 1000 && cap < 30000) specs.coolingCapacityW = cap;
      if (ieee && ieee > 2 && ieee < 12) specs.seer = ieee;
      if (eer && eer > 1.8 && eer < 8) specs.eer = eer;
      break;
    }
    case 'termotanques': {
      const standby = field(t, /(?:mantenimiento|perdidas)[^:\n]*\(kwh[^:\n]*:\s*([\d.,]+)/);
      const liters = field(t, /capacidad[^:\n]*\(l(?:itros)?\)[^:\n]*:\s*([\d.,]+)/);
      if (standby && standby > 0.1 && standby < 10) specs.standbyKwhPer24h = standby;
      if (liters && liters > 10 && liters < 500) specs.storageL = liters;
      break;
    }
  }
  if (!cls && !Object.keys(specs).length) return null;
  return { category, groups, cls, specs };
}
