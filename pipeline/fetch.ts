// Paso 1: baja los productos crudos de cada tienda y categoría a pipeline/.cache/raw/<tienda>/<categoria>.json
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CATEGORY_IDS, type CategoryId } from '../lib/types';
import { STORES, type StoreConfig } from './config';
import { selectCategories } from './lib/categories';
import { fetchCategoryProducts, fetchCategoryTree, type VtexProduct } from './sources/vtex';

export const RAW_DIR = path.join(process.cwd(), 'pipeline', '.cache', 'raw');

export interface RawFile {
  store: string;
  category: CategoryId;
  fetchedAt: string;
  sourceCategories: string[];
  products: VtexProduct[];
}

export interface FetchReport {
  store: string;
  ok: boolean;
  products: number;
  error?: string;
}

async function fetchStore(store: StoreConfig, cats: readonly CategoryId[], log: (m: string) => void): Promise<FetchReport> {
  let count = 0;
  try {
    const tree = await fetchCategoryTree(store.host);
    for (const cat of cats) {
      const paths = selectCategories(tree, cat);
      if (!paths.length) log(`  ⚠ ${store.id}/${cat}: no se encontró la categoría en el árbol`);
      const seen = new Set<string>();
      const products: VtexProduct[] = [];
      for (const p of paths) {
        for (const prod of await fetchCategoryProducts(store.host, p, log)) {
          if (seen.has(prod.productId)) continue;
          seen.add(prod.productId);
          products.push(prod);
        }
      }
      const file: RawFile = {
        store: store.id,
        category: cat,
        fetchedAt: new Date().toISOString(),
        sourceCategories: paths.map((p) => p.names.join(' > ')),
        products,
      };
      await mkdir(path.join(RAW_DIR, store.id), { recursive: true });
      await writeFile(path.join(RAW_DIR, store.id, `${cat}.json`), JSON.stringify(file));
      count += products.length;
      log(`  ${store.id}/${cat}: ${products.length} productos`);
    }
    return { store: store.id, ok: true, products: count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`  ✗ ${store.id}: ${msg}`);
    return { store: store.id, ok: false, products: count, error: msg };
  }
}

/** Las tiendas van en paralelo (hosts distintos); dentro de cada una, una request por vez. */
export async function fetchAll(cats: readonly CategoryId[] = CATEGORY_IDS, onlyStores?: string[], log: (m: string) => void = console.log): Promise<FetchReport[]> {
  const stores = STORES.filter((s) => !onlyStores?.length || onlyStores.includes(s.id));
  return Promise.all(stores.map((s) => fetchStore(s, cats, log)));
}
