// Lectura de especificaciones VTEX con nombres variables entre tiendas.
import type { VtexProduct } from '../sources/vtex';
import { normalizeText } from './parse';

export interface SpecReader {
  /** primer valor cuyo nombre de spec (normalizado, sin acentos) coincide; ignora valores vacíos o basura */
  get(pattern: RegExp, reject?: RegExp): string | undefined;
  all(pattern: RegExp): { key: string; value: string }[];
  /** nombre + specs relevantes en un solo texto normalizado (para búsquedas de respaldo) */
  haystack: string;
  name: string;
}

const JUNK = /^(no aclara|no informa|n\/a|na|-|no especifica|sin datos?)$/i;

export function reader(p: VtexProduct): SpecReader {
  const entries: { key: string; norm: string; value: string }[] = [];
  for (const key of p.allSpecifications ?? []) {
    const raw = p[key];
    const value = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').join(' | ').trim() : typeof raw === 'string' ? raw.trim() : '';
    // algunas tiendas repiten el nombre de la spec como valor ("Tipo de Mascota: Tipo de Mascota")
    if (!value || JUNK.test(value) || normalizeText(value) === normalizeText(key)) continue;
    entries.push({ key, norm: normalizeText(key), value });
  }
  const name = normalizeText(p.productName ?? '');
  return {
    get(pattern, reject) {
      return entries.find((e) => pattern.test(e.norm) && !(reject && reject.test(e.norm)))?.value;
    },
    all(pattern) {
      return entries.filter((e) => pattern.test(e.norm)).map(({ key, value }) => ({ key, value }));
    },
    haystack: `${name} ${entries.map((e) => `${e.norm}: ${normalizeText(e.value)}`).join(' ; ')}`,
    name,
  };
}

/** ¿El texto describe un rango ("De 200 a 299", "300 - 399", "Más de 5000")? Esos valores no sirven como dato exacto. */
export function isRange(v: string): boolean {
  const t = normalizeText(v);
  return /\bde\s*\d[\d.,]*\s*a\s*\d/.test(t) || /\d\s*-\s*\d/.test(t) || /\b(mas de|hasta|menos de)\b/.test(t) || /\d\s+a\s+\d/.test(t);
}
