// Pasos 2–5: normaliza el caché crudo, une productos, aplica datos manuales y estimaciones, y escribe public/data/.
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_TARIFFS, DEFAULT_USAGE, estimateEnergy } from '../lib/cost';
import { CATEGORY_IDS, type CategoryFile, type CategoryId, type Meta, type Product, type StoreStatus } from '../lib/types';
import { STORES } from './config';
import { applyEstimates } from './estimate';
import type { FetchReport, RawFile } from './fetch';
import { RAW_DIR } from './fetch';
import { applyManual } from './manual';
import { mergeListings } from './merge';
import { toListing } from './normalize';
import type { Listing } from './normalize/types';

export const OUT_DIR = path.join(process.cwd(), 'public', 'data');
const HISTORY_DIR = path.join(process.cwd(), 'pipeline', 'history');
const STALE_DAYS = 3;
const HISTORY_DAYS = 400;

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function computeQuality(p: Product): Product['quality'] {
  const e = estimateEnergy(p, DEFAULT_USAGE, p.energy === 'gas_envasado' ? 'envasado' : DEFAULT_TARIFFS.gasKind);
  if (!e) return 'insuficiente';
  return e.basis === 'etiqueta' ? 'completo' : 'estimado';
}

/** Si una tienda falló hoy, se conservan sus ofertas de los últimos días para no "vaciar" el comparador. */
function carryOverStale(products: Product[], previous: Product[], failedStores: Set<string>, now: Date): number {
  if (!failedStores.size) return 0;
  const byId = new Map(products.map((p) => [p.id, p]));
  let carried = 0;
  for (const prev of previous) {
    const stale = prev.offers.filter((o) => failedStores.has(o.store) && (now.getTime() - new Date(o.checkedAt).getTime()) / 86_400_000 <= STALE_DAYS);
    if (!stale.length) continue;
    const cur = byId.get(prev.id);
    if (cur) {
      for (const o of stale) if (!cur.offers.some((x) => x.store === o.store)) cur.offers.push(o);
    } else {
      const copy = { ...prev, offers: stale };
      products.push(copy);
      byId.set(copy.id, copy);
    }
    carried += stale.length;
  }
  for (const p of products) {
    p.offers.sort((a, b) => a.price - b.price);
    const av = p.offers.filter((o) => o.available);
    p.priceMin = av.length ? av[0].price : null;
  }
  return carried;
}

/** Descarta ofertas con precios imposibles (placeholders tipo $99.999): < 25 % de la mediana de $/capacidad de la categoría. */
function dropImplausiblePrices(products: Product[]): number {
  const cap = (p: Product) => p.specs.totalVolumeL ?? p.specs.coolingCapacityW ?? p.specs.capacityKg ?? p.specs.storageL ?? p.specs.flowLMin;
  const ratios = products.flatMap((p) => (cap(p) ? p.offers.map((o) => o.price / cap(p)!) : [])).sort((a, b) => a - b);
  if (ratios.length < 20) return 0;
  const floor = ratios[Math.floor(ratios.length / 2)] * 0.25;
  let dropped = 0;
  for (const p of products) {
    const c = cap(p);
    if (!c) continue;
    const before = p.offers.length;
    p.offers = p.offers.filter((o) => o.price / c >= floor);
    dropped += before - p.offers.length;
    const av = p.offers.filter((o) => o.available);
    p.priceMin = av.length ? av[0].price : null;
  }
  return dropped;
}

async function updateHistory(category: CategoryId, products: Product[], today: string) {
  await mkdir(HISTORY_DIR, { recursive: true });
  const file = path.join(HISTORY_DIR, `${category}.json`);
  const hist = (await readJson<Record<string, [string, number][]>>(file)) ?? {};
  const cutoff = new Date(Date.parse(today) - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const p of products) {
    if (p.priceMin === null) continue;
    const h = (hist[p.id] ??= []);
    const last = h.at(-1);
    if (last?.[0] === today) last[1] = p.priceMin;
    else if (!last || last[1] !== p.priceMin) h.push([today, p.priceMin]); // solo se guarda cuando cambia
  }
  for (const id of Object.keys(hist)) {
    hist[id] = hist[id].filter(([d], i, arr) => d >= cutoff || i === arr.length - 1);
  }
  await writeFile(file, JSON.stringify(hist));
}

export async function build(report: FetchReport[] | null, log: (m: string) => void = console.log): Promise<Meta> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  await mkdir(OUT_DIR, { recursive: true });
  const failed = new Set((report ?? []).filter((r) => !r.ok).map((r) => r.store));
  const storeDirs = existsSync(RAW_DIR) ? (await readdir(RAW_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name) : [];

  const metaCats: Meta['categories'] = [];
  const listingsPerStore = new Map<string, number>();

  for (const category of CATEGORY_IDS) {
    const listings: Listing[] = [];
    for (const store of storeDirs) {
      if (failed.has(store)) continue;
      const raw = await readJson<RawFile>(path.join(RAW_DIR, store, `${category}.json`));
      if (!raw) continue;
      let n = 0;
      for (const p of raw.products) {
        const l = toListing(p, store, category, raw.fetchedAt);
        if (l) {
          listings.push(l);
          n++;
        }
      }
      listingsPerStore.set(store, (listingsPerStore.get(store) ?? 0) + n);
    }

    const prevFile = await readJson<CategoryFile>(path.join(OUT_DIR, `${category}.json`));
    const previous = prevFile?.products ?? [];
    let products = mergeListings(listings, new Map(previous.map((p) => [p.id, p])), today);
    const carried = carryOverStale(products, previous, failed, now);

    applyManual(products, category);
    applyEstimates(products);
    const dropped = dropImplausiblePrices(products);
    if (dropped) log(`  ${category}: ${dropped} ofertas descartadas por precio implausible`);
    for (const p of products) p.quality = computeQuality(p);

    // Solo se publican productos con alguna oferta disponible (los discontinuados quedan en el historial).
    products = products.filter((p) => p.priceMin !== null).sort((a, b) => a.brand.localeCompare(b.brand, 'es') || a.name.localeCompare(b.name, 'es'));

    const file: CategoryFile = { category, generatedAt: now.toISOString(), count: products.length, products };
    await writeFile(path.join(OUT_DIR, `${category}.json`), JSON.stringify(file));
    await updateHistory(category, products, today);

    const withConsumption = products.filter((p) => p.quality !== 'insuficiente').length;
    metaCats.push({ id: category, count: products.length, withConsumption, withPrice: products.length });
    log(
      `${category}: ${listings.length} publicaciones → ${products.length} productos (${withConsumption} con consumo, ${products.filter((p) => p.quality === 'completo').length} de etiqueta)${carried ? `, ${carried} ofertas arrastradas` : ''}`,
    );
  }

  const stores: StoreStatus[] = STORES.map((s) => {
    const r = report?.find((x) => x.store === s.id);
    return {
      id: s.id,
      name: s.name,
      url: s.url,
      ok: r ? r.ok : storeDirs.includes(s.id),
      products: listingsPerStore.get(s.id) ?? 0,
      ...(r?.error ? { error: r.error } : {}),
    };
  });
  const meta: Meta = { schemaVersion: 1, generatedAt: now.toISOString(), categories: metaCats, stores };
  await writeFile(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}
