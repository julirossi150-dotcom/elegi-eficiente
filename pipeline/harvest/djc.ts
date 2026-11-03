// Lectura de la "Declaración Jurada de Conformidad" (DJC) de la Res. SIC 438/2024. Cada fabricante la publica por
// modelo con los mismos campos que la etiqueta (clase, consumo, volúmenes o carga), así que es la fuente oficial más completa.
import type { CategoryId, LabelScale, Specs } from '../../lib/types';
import { normalizeText, toNumber } from '../normalize/parse';

export interface DjcRecord {
  category: CategoryId;
  /** pares marca → modelos (una DJC puede cubrir marcas gemelas, p. ej. Drean y Patrick) */
  groups: { brand: string; models: string[] }[];
  cls?: string;
  /** escala de la clase; sin dato, la nueva (A a G de la Res. 438/2024) */
  scale?: LabelScale;
  specs: Specs;
}

/**
 * DJC generada por IRAM (qr.iram.org.ar): todo en un párrafo, "Producto, Marca, modelo y características: Lavarropas,
 * Whirlpool, WWN10AB, 220 V~ …; Índice de Eficiencia Energética: "D"; Consumo de energía: 0,75 kWh; …".
 */
function parseDjcIram(t: string, category: CategoryId): DjcRecord | null {
  const block = t.match(/(?:produc?to, )?marca, modelo y caracter.?.?sticas:\s*([\s\S]*?)\n\s*d\.\s*normas/)?.[1];
  if (!block) return null;
  const flat = block.replace(/\s+/g, ' ');
  const parts = flat.split(/,\s*/);
  const brand = parts[1]?.trim().toUpperCase();
  // los modelos siguen a la marca, separados por ";" (o por comas) hasta las características eléctricas
  const models: string[] = [];
  for (const p of parts.slice(2)) {
    const codes = p.split(';').map((x) => x.trim().toUpperCase());
    if (!codes.every((c) => /^[A-Z0-9][A-Z0-9.-]{2,}$/.test(c) && /\d/.test(c) && /[A-Z]/.test(c))) break;
    models.push(...codes);
  }
  // sin la coma entre producto y marca no se pueden separar: los da el listado de IRAM
  const groups = brand && models.length ? [{ brand, models }] : [];

  const cls = flat.match(/(?:indice|clase) de eficiencia energetica:\s*["“”']?\s*([a-g]\+{0,3})/)?.[1]?.toUpperCase();
  const specs: Specs = {};
  switch (category) {
    case 'heladeras': {
      const kwh = field(flat, /consumo de energia:\s*([\d.,]+)\s*kwh/);
      // "alimentos congelados ( ): 231 L"
      const fresh = field(flat, /alimentos frescos[^:;]*:\s*([\d.,]+)/);
      const frozen = field(flat, /alimentos congelados[^:;]*:\s*([\d.,]+)/);
      if (kwh && kwh > 30 && kwh < 2000) specs.kwhPerYear = kwh;
      if (fresh !== undefined || frozen !== undefined) specs.totalVolumeL = (fresh ?? 0) + (frozen ?? 0);
      if (frozen) specs.freezerVolumeL = frozen;
      break;
    }
    case 'lavarropas': {
      const kwh = field(flat, /consumo de energia:\s*([\d.,]+)\s*kwh/);
      const water = field(flat, /consumo de agua:\s*([\d.,]+)/);
      const kg = field(flat, /capacidad[^:;]*:\s*([\d.,]+)\s*kg/);
      if (kwh && kwh > 0.05 && kwh < 5) specs.kwhPerCycle = kwh;
      if (water && water > 10 && water < 300) specs.waterLPerCycle = water;
      if (kg && kg > 2 && kg < 30) specs.capacityKg = kg;
      break;
    }
    default:
      return null;
  }
  if (!cls && !Object.keys(specs).length) return null;
  const scale: LabelScale = cls?.includes('+') ? 'anterior' : /438\/2024/.test(t) ? 'nueva' : 'desconocida';
  return { category, groups, cls, scale, specs };
}

/**
 * DJC de IRAM en tabla de dos columnas ("Consumo de energía (kWh/año)    385 kWh/año"). Cuando un título ocupa dos
 * renglones los valores quedan corridos respecto de sus títulos, pero no cambian de orden: se leen por unidad y orden
 * (clase, consumo, volumen de frescos, volumen de congelados). La marca y los modelos los da el listado de IRAM.
 */
function parseDjcIramTable(t: string, category: CategoryId): DjcRecord | null {
  const section = t.match(/\n\s*caracter.?.?sticas\s{2,}([\s\S]*?)(?:\n\s*d\.\s*normas|$)/)?.[1];
  if (!section) return null;
  // columna de valores: lo que queda después del último hueco de 2+ espacios en cada renglón
  const values = section.split('\n').map((l) => l.trim().split(/\s{2,}/).pop()!.trim());
  const cls = values.find((v) => /^[a-g]\+{0,3}$/.test(v))?.toUpperCase();
  const specs: Specs = {};
  switch (category) {
    case 'heladeras': {
      const kwhAt = values.findIndex((v) => /^\d[\d.,]*\s*kwh\/ano$/.test(v));
      if (kwhAt < 0) return null;
      const kwh = toNumber(values[kwhAt]);
      const liters = values.slice(kwhAt + 1).filter((v) => /^\d[\d.,]*\s*l$/.test(v))
        .map(toNumber)
        .filter((n): n is number => n !== undefined);
      if (kwh && kwh > 30 && kwh < 2000) specs.kwhPerYear = kwh;
      if (liters.length >= 2) {
        specs.totalVolumeL = liters[0] + liters[1];
        if (liters[1]) specs.freezerVolumeL = liters[1];
      }
      break;
    }
    case 'lavarropas': {
      const kwh = field(section, /(\d[\d.,]*)\s*kwh\b(?!\s*\/)/);
      const water = field(section, /consumo de agua[^\n]*?(\d[\d.,]*)\s*l\b/);
      const kg = field(section, /(\d[\d.,]*)\s*kg\b/);
      if (kwh && kwh > 0.05 && kwh < 5) specs.kwhPerCycle = kwh;
      if (water && water > 10 && water < 300) specs.waterLPerCycle = water;
      if (kg && kg > 2 && kg < 30) specs.capacityKg = kg;
      break;
    }
    default:
      return null;
  }
  if (!cls && !Object.keys(specs).length) return null;
  const scale: LabelScale = cls?.includes('+') ? 'anterior' : /438\/2024/.test(t) ? 'nueva' : 'desconocida';
  return { category, groups: [], cls, scale, specs };
}

/**
 * DJC en forma de tabla (Longvie): "Marca Comercial: LONGVIE", el modelo en la columna "Modelo" de la tabla de normas
 * y las características energéticas como "Clase Energética: A", "Consumo de energía: 0,31kWh", "Capacidad nominal: 10 Kg".
 */
function parseDjcTable(raw: string, t: string, category: CategoryId): DjcRecord | null {
  const brand = t.match(/marca comercial:\s*([^\n]+)/)?.[1]?.trim().toUpperCase();
  const lines = raw.split('\n');
  const header = lines.findIndex((l) => /^\s*Producto\s+Modelo\s+Fabricante/i.test(l));
  if (!brand || header < 0) return null;
  const models = [
    ...new Set(
      lines
        .slice(header + 1, header + 5)
        .flatMap((l) => l.match(/\b[A-Z]{1,5}\d[A-Z0-9]{2,}\b/g) ?? [])
        .filter((m) => !/^(IEC|IRAM|DC|ED|NAG)/.test(m)),
    ),
  ];
  if (!models.length) return null;

  const cls = t.match(/clase energetica:\s*([a-g]\+{0,3})/)?.[1]?.toUpperCase();
  const specs: Specs = {};
  const capacity = field(t, /capacidad nominal:\s*([\d.,]+)/);
  switch (category) {
    case 'lavarropas': {
      const kwh = field(t, /consumo de energia:\s*([\d.,]+)\s*kwh/);
      const water = field(t, /consumo de agua:\s*([\d.,]+)/);
      if (kwh && kwh > 0.05 && kwh < 5) specs.kwhPerCycle = kwh;
      if (water && water > 10 && water < 300) specs.waterLPerCycle = water;
      if (capacity && capacity > 2 && capacity < 30) specs.capacityKg = capacity;
      break;
    }
    case 'termotanques': {
      const kw = field(t, /potencia nominal:\s*([\d.,]+)\s*kw/);
      if (capacity && capacity > 10 && capacity < 500) specs.storageL = capacity;
      if (kw && kw > 0.5 && kw < 10) specs.powerW = kw * 1000;
      break;
    }
    default:
      return null;
  }
  if (!cls && !Object.keys(specs).length) return null;
  // "A+++" es de la escala anterior; una letra sola, sin la escala impresa, no se sabe
  const scale: LabelScale = cls?.includes('+') ? 'anterior' : /\(mas eficiente\) a g/.test(t) ? 'nueva' : 'desconocida';
  return { category, groups: [{ brand, models }], cls, scale, specs };
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
  if (/(?:produc?to, )?marca, modelo y caracter.?.?sticas/.test(t)) return parseDjcIram(t, category);
  // la tabla necesita los espacios originales para separar las columnas
  const columns = normalizeText(raw).replace(/\r/g, '');
  if (/qr\.iram\.org\.ar/.test(t) && /\n[ \t]*modelo[ \t]{2,}/.test(columns)) return parseDjcIramTable(columns, category);
  if (!modelLine) return parseDjcTable(raw, t, category);
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
