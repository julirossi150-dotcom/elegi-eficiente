// Paso 3: une las publicaciones del mismo producto en distintas tiendas (por EAN o marca+modelo).
import type { Offer, Product, Provenance, SpecKey, Specs } from '../lib/types';
import { STORES } from './config';
import type { Listing } from './normalize/types';
import { modelKey, normalizeText } from './normalize/parse';

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) i = this.parent[i] = this.parent[this.parent[i]];
    return i;
  }
  union(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b);
  }
}

function slug(s: string) {
  return normalizeText(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Valor más repetido (empate: el de la primera tienda en aparecer). */
function mode<T>(values: { v: T; store: string }[]): { v: T; store: string; agree: number } | undefined {
  const counts = new Map<string, { v: T; store: string; n: number }>();
  for (const x of values) {
    const k = JSON.stringify(x.v);
    const c = counts.get(k);
    if (c) c.n++;
    else counts.set(k, { v: x.v, store: x.store, n: 1 });
  }
  let best: { v: T; store: string; n: number } | undefined;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best && { v: best.v, store: best.store, agree: best.n };
}

const OFFICIAL = new Map(STORES.filter((s) => s.manufacturerOf).map((s) => [s.id, new Set(s.manufacturerOf!.map(modelKey))]));

/** ¿La publicación viene de la tienda oficial del fabricante de esa marca? */
function isOfficial(l: Listing): boolean {
  return OFFICIAL.get(l.store)?.has(modelKey(l.brand)) ?? false;
}

/** El modelo cargado no figura en el nombre, que trae otro código de la misma serie (modelo "IC-02" en un "Caloventor IC-01"). */
export function modelContradictsName(model: string, name: string): boolean {
  const m = modelKey(model).match(/^([A-Z]{2,})(\d+)$/);
  if (!m) return false;
  // el código completo, con puntos y guiones ("TESZ2.0-50")
  const codes = (normalizeText(name).toUpperCase().match(new RegExp(`\\b${m[1]}[ -]?\\d(?:[\\d.-]*\\d)?\\b`, 'g')) ?? []).map(modelKey);
  return codes.length > 0 && !codes.includes(m[0]);
}

/** Claves por las que dos publicaciones se consideran el mismo producto. */
function keysOf(l: Listing): string[] {
  const keys: string[] = [];
  if (l.ean && /^\d{8,14}$/.test(l.ean) && !/^0+$/.test(l.ean)) keys.push(`ean:${l.ean.replace(/^0+/, '')}`);
  if (l.model && !modelContradictsName(l.model, l.name)) keys.push(`model:${l.category}:${modelKey(l.brand)}:${modelKey(l.model)}`);
  return keys;
}

/** Tamaño que distingue modelos de una misma línea: litros, kg, capacidad o potencia. */
function sizeOf(l: Listing): number | undefined {
  const s = l.specs;
  switch (l.category) {
    case 'heladeras':
      return s.totalVolumeL;
    case 'aires':
      return s.coolingCapacityW ?? (s.frigorias ? s.frigorias * 1.163 : undefined);
    case 'lavarropas':
      return s.capacityKg;
    case 'calefones':
      return s.flowLMin;
    case 'termotanques':
      return s.storageL;
    case 'calefactores':
      return s.gasPowerKcalH ?? (s.powerW ? s.powerW * 0.86 : undefined);
  }
}

// diferencia de tamaño que todavía puede ser el mismo producto informado distinto (litros brutos y netos, redondeos)
const SIZE_TOLERANCE = 1.25;

/**
 * Separa un grupo que juntó tamaños distintos: pasa cuando una tienda carga el EAN o el modelo de otro producto
 * de la misma línea (un termotanque de 30 L con el código del de 50 L) y la cadena de coincidencias los une.
 */
function splitBySize(group: Listing[]): Listing[][] {
  const sized = group.filter((l) => sizeOf(l)).sort((a, b) => sizeOf(a)! - sizeOf(b)!);
  if (!sized.length || sizeOf(sized[sized.length - 1])! <= sizeOf(sized[0])! * SIZE_TOLERANCE) return [group];
  const clusters: Listing[][] = [];
  for (const l of sized) {
    const last = clusters[clusters.length - 1];
    if (last && sizeOf(l)! <= sizeOf(last[0])! * SIZE_TOLERANCE) last.push(l);
    else clusters.push([l]);
  }
  // mismo modelo o EAN principal con tamaños distintos es un dato mal cargado en una tienda (el freezer como total),
  // no otro producto; un modelo equivocado en una sola publicación no alcanza para volver a unirlos
  const main = (c: Listing[], prefix: string) => mode(c.flatMap((l) => keysOf(l).filter((k) => k.startsWith(prefix)).map((v) => ({ v, store: l.store }))))?.v;
  const same = (a: Listing[], b: Listing[]) => ['model:', 'ean:'].some((p) => main(a, p) !== undefined && main(a, p) === main(b, p));
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      if (same(clusters[i], clusters[j])) {
        clusters[i].push(...clusters.splice(j, 1)[0]);
        j = i;
      }
    }
  }
  // sin tamaño: con el que comparte su EAN o modelo; si no, con el más grande
  for (const l of group.filter((x) => !sizeOf(x))) {
    const keys = keysOf(l);
    const home = clusters.find((c) => c.some((m) => keysOf(m).some((k) => keys.includes(k)))) ?? clusters.reduce((a, b) => (b.length > a.length ? b : a));
    home.push(l);
  }
  return clusters;
}

export function mergeListings(listings: Listing[], previous: Map<string, Product>, today: string): Product[] {
  const uf = new UnionFind(listings.length);
  const byKey = new Map<string, number>();
  listings.forEach((l, i) => {
    for (const k of keysOf(l)) {
      const j = byKey.get(k);
      if (j === undefined) byKey.set(k, i);
      else uf.union(i, j);
    }
  });

  const groups = new Map<number, Listing[]>();
  listings.forEach((l, i) => {
    const r = uf.find(i);
    const g = groups.get(r);
    if (g) g.push(l);
    else groups.set(r, [l]);
  });

  const products: Product[] = [];
  const usedIds = new Set<string>();
  for (const group of [...groups.values()].flatMap(splitBySize)) {
    // la publicación con más datos manda en nombre/imagen
    const richest = [...group].sort((a, b) => Object.keys(b.specs).length - Object.keys(a.specs).length || (b.label.cls ? 1 : 0) - (a.label.cls ? 1 : 0))[0];
    const brand = mode(group.map((l) => ({ v: l.brand, store: l.store })))!.v;
    const model = mode(group.filter((l) => l.model).map((l) => ({ v: l.model!, store: l.store })))?.v ?? null;

    let id = `${richest.category}:${slug(brand)}:${model ? slug(model) : `${richest.store}-${richest.storeProductId}`}`;
    if (usedIds.has(id)) id = `${id}-${richest.store}-${richest.storeProductId}`;
    usedIds.add(id);

    const specs: Specs = {};
    const provenance: Product['provenance'] = {};
    const specKeys = new Set(group.flatMap((l) => Object.keys(l.specs))) as Set<SpecKey>;
    for (const key of specKeys) {
      const withKey = group.filter((l) => l.specs[key] !== undefined);
      // el dato del fabricante manda; si no lo publica, el más repetido entre tiendas
      const official = withKey.filter(isOfficial);
      const m = mode((official.length ? official : withKey).map((l) => ({ v: l.specs[key], store: l.store })));
      if (!m) continue;
      (specs as Record<string, unknown>)[key] = m.v;
      const prov: Provenance = { origin: official.length ? 'fabricante' : 'tienda', source: m.store };
      if (m.agree > 1) prov.note = `coincide en ${m.agree} tiendas`;
      provenance[key] = prov;
    }

    const anyClass = group.filter((l) => l.label.cls);
    const officialClass = anyClass.filter(isOfficial);
    const withClass = officialClass.length ? officialClass : anyClass;
    const cls = mode(withClass.map((l) => ({ v: l.label.cls!, store: l.store })));
    const scaleVotes = withClass.filter((l) => l.label.cls === cls?.v && l.label.scale !== 'desconocida');
    const scale = mode(scaleVotes.map((l) => ({ v: l.label.scale, store: l.store })))?.v ?? 'desconocida';
    const label = cls ? { cls: cls.v, scale, raw: withClass.find((l) => l.label.cls === cls.v)?.label.raw } : { cls: null, scale: 'desconocida' as const };
    if (cls) provenance.label = { origin: officialClass.length ? 'fabricante' : 'tienda', source: cls.store };

    const explicitEnergy = group.filter((l) => !l.energyGuessed);
    const energy = mode((explicitEnergy.length ? explicitEnergy : group).map((l) => ({ v: l.energy, store: l.store })))!.v;

    // una oferta por tienda: la más barata disponible
    const offersByStore = new Map<string, Offer>();
    for (const l of group) {
      const o: Offer = { store: l.store, price: l.price, listPrice: l.listPrice && l.listPrice > l.price ? l.listPrice : undefined, url: l.url, available: l.available, ...(l.zones !== undefined ? { zones: l.zones } : {}), checkedAt: l.checkedAt };
      const cur = offersByStore.get(l.store);
      if (!cur || (o.available && !cur.available) || (o.available === cur.available && o.price < cur.price)) offersByStore.set(l.store, o);
    }
    const offers = [...offersByStore.values()].sort((a, b) => a.price - b.price);
    const available = offers.filter((o) => o.available);

    const prev = previous.get(id);
    products.push({
      id,
      category: richest.category,
      name: richest.name,
      brand,
      model,
      ean: Array.from(new Set(group.map((l) => l.ean).filter((e): e is string => Boolean(e)))),
      image: richest.image ?? group.find((l) => l.image)?.image,
      energy,
      label,
      specs,
      provenance,
      offers,
      priceMin: available.length ? available[0].price : null,
      firstSeen: prev?.firstSeen ?? today,
      lastSeen: today,
      quality: 'insuficiente',
    });
  }
  return products;
}
