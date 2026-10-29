// Parseo tolerante de textos de fichas técnicas argentinas ("1.234,5 kWh/año", "A+", "Sí").

/** Convierte "1.234,5" / "1234.5" / "1,2" a número. */
export function toNumber(raw: string): number | undefined {
  const m = raw.match(/-?\d[\d.,]*/);
  if (!m) return undefined;
  let s = m[0];
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // el último separador es el decimal
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // en Argentina la coma es decimal ("0,85 kWh")
    s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ''); // 1.234 = mil doscientos
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Busca un número seguido de una unidad (regex de unidad sin anclas). */
export function numberWithUnit(text: string | undefined, unit: RegExp): number | undefined {
  if (!text) return undefined;
  const re = new RegExp(`(\\d[\\d.,]*)\\s*(?:${unit.source})`, 'i');
  const m = text.match(re);
  return m ? toNumber(m[1]) : undefined;
}

export function inRange(v: number | undefined, min: number, max: number): number | undefined {
  return v !== undefined && v >= min && v <= max ? v : undefined;
}

export function yesNo(text: string | undefined): boolean | undefined {
  if (!text) return undefined;
  const t = text.trim().toLowerCase();
  if (/^(s[ií]|yes|true|con)\b/.test(t)) return true;
  if (/^(no|false|sin)\b/.test(t)) return false;
  return undefined;
}

const CLASS_RE = /\b([A-G])\s*(\+{1,3})?(?![a-z])/i;

/** Clase de eficiencia a partir de un texto ("A+", "Clase B", "a++"). */
export function parseClass(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/clase|eficiencia|energ[eé]tica|:/gi, ' ');
  const m = cleaned.match(CLASS_RE);
  if (!m) return undefined;
  return m[1].toUpperCase() + (m[2] ?? '');
}

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Clave de modelo comparable entre tiendas: mayúsculas, sin espacios ni guiones. */
export function modelKey(model: string): string {
  return normalizeText(model).replace(/[^a-z0-9]/g, '').toUpperCase();
}

const BRAND_ALIASES: Record<string, string> = {
  'B.G.H': 'BGH',
  'B.G.H.': 'BGH',
  'SANTA ANA': 'Santa Ana',
  'LG ELECTRONICS': 'LG',
};

export function normalizeBrand(brand: string): string {
  const b = brand.trim().replace(/\s+/g, ' ');
  const up = b.toUpperCase();
  if (BRAND_ALIASES[up]) return BRAND_ALIASES[up];
  if (b.length <= 4) return up;
  return b
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Intenta extraer el código de modelo del nombre del producto: el token más "de código"
 * (mezcla letras y números, ≥ 5 caracteres) que no sea una medida (267l, 3000w, 220v).
 */
export function modelFromName(name: string, brand: string): string | undefined {
  const b = normalizeText(brand);
  const tokens = name.split(/[\s,()/|]+/).filter(Boolean);
  const cands = tokens.filter((t) => {
    const n = normalizeText(t);
    if (n === b || n.length < 5) return false;
    if (!/[a-z]/i.test(t) || !/\d/.test(t)) return false;
    if (/^\d+([.,]\d+)?(l|lts?|kg|w|v|hz|frig|fg|lt|litros|cm|mm|kcal|btu|pulgadas)$/i.test(t)) return false;
    return true;
  });
  if (!cands.length) return undefined;
  return cands.sort((x, y) => y.length - x.length)[0].replace(/[.,;:]+$/, '');
}
