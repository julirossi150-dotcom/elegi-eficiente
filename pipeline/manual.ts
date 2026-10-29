// Datos cargados a mano (fichas de fabricantes, etiquetas, QR) en pipeline/manual/<categoria>.json.
// Pisan lo que informan las tiendas y quedan marcados con su fuente.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { CategoryId, EnergyLabel, EnergySource, Product, SpecKey, Specs } from '../lib/types';
import { modelKey, normalizeText } from './normalize/parse';

export interface ManualEntry {
  brand: string;
  /** uno o más códigos de modelo (se comparan sin espacios/guiones, y por prefijo si termina en *) */
  models?: string[];
  /** códigos EAN (coincidencia exacta, sin ceros a la izquierda) */
  eans?: string[];
  /** expresión regular sobre el nombre normalizado (sin acentos, minúsculas), para tiendas sin código de modelo */
  match?: string;
  specs?: Specs;
  /** cls: null borra una clase mal cargada por las tiendas */
  label?: { cls: string | null; scale?: EnergyLabel['scale'] };
  energy?: EnergySource;
  origin?: 'fabricante' | 'manual';
  source: string;
  note?: string;
}

const MANUAL_DIR = path.join(process.cwd(), 'pipeline', 'manual');

/**
 * Primero las cargas a mano (pipeline/manual/<categoria>.json), después lo recolectado de los sitios de fabricantes
 * (pipeline/manual/fabricantes/*.json, ver pipeline/harvest/). Gana la primera entrada que coincide.
 */
export function loadManual(category: CategoryId): ManualEntry[] {
  const entries: ManualEntry[] = [];
  const file = path.join(MANUAL_DIR, `${category}.json`);
  if (existsSync(file)) entries.push(...(JSON.parse(readFileSync(file, 'utf8')) as ManualEntry[]));
  const auto = path.join(MANUAL_DIR, 'fabricantes');
  if (existsSync(auto)) {
    for (const f of readdirSync(auto).filter((x) => x.endsWith('.json')).sort()) {
      const list = JSON.parse(readFileSync(path.join(auto, f), 'utf8')) as (ManualEntry & { category: CategoryId })[];
      entries.push(...list.filter((e) => e.category === category));
    }
  }
  return entries;
}

const stripEan = (e: string) => e.replace(/^0+/, '');

function matches(e: ManualEntry, p: Product): boolean {
  if (e.eans?.length && p.ean.some((x) => e.eans!.map(stripEan).includes(stripEan(x)))) return true;
  if (modelKey(e.brand) !== modelKey(p.brand)) return false;
  if (e.match && new RegExp(e.match).test(normalizeText(p.name))) return true;
  if (!p.model || !e.models) return false;
  const pk = modelKey(p.model);
  return e.models.some((m) => (m.endsWith('*') ? pk.startsWith(modelKey(m.slice(0, -1))) : modelKey(m) === pk));
}

export function applyManual(products: Product[], category: CategoryId): number {
  const entries = loadManual(category);
  let applied = 0;
  for (const p of products) {
    const e = entries.find((x) => matches(x, p));
    if (!e) continue;
    applied++;
    const prov = { origin: e.origin ?? 'fabricante', source: e.source, ...(e.note ? { note: e.note } : {}) } as const;
    for (const [k, v] of Object.entries(e.specs ?? {})) {
      (p.specs as Record<string, unknown>)[k] = v;
      p.provenance[k as SpecKey] = prov;
    }
    if (e.label) {
      p.label = e.label.cls ? { cls: e.label.cls, scale: e.label.scale ?? p.label.scale, raw: p.label.raw } : { cls: null, scale: 'desconocida' };
      p.provenance.label = prov;
    }
    if (e.energy) p.energy = e.energy;
  }
  return applied;
}
