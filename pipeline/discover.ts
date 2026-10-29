// Herramienta de diagnóstico: muestra qué categorías elige cada tienda y qué especificaciones traen sus productos.
// Uso: npx tsx pipeline/discover.ts [categoria] [tienda]
import { CATEGORY_IDS, type CategoryId } from '../lib/types';
import { STORES } from './config';
import { selectCategories } from './lib/categories';
import { fetchCategoryProducts, fetchCategoryTree } from './sources/vtex';

const [catArg, storeArg] = process.argv.slice(2);
const cats = (catArg ? [catArg] : CATEGORY_IDS) as CategoryId[];
const stores = STORES.filter((s) => !storeArg || s.id === storeArg);

for (const store of stores) {
  const tree = await fetchCategoryTree(store.host);
  for (const cat of cats) {
    const paths = selectCategories(tree, cat);
    console.log(`\n## ${store.id} / ${cat}: ${paths.map((p) => `${p.names.join(' > ')} [C:/${p.ids.join('/')}/]`).join(' | ') || '(ninguna)'}`);
    if (!catArg) continue;
    const freq = new Map<string, { n: number; ex: string }>();
    let total = 0;
    for (const p of paths) {
      const products = await fetchCategoryProducts(store.host, p, console.log);
      total += products.length;
      for (const prod of products) {
        for (const k of prod.allSpecifications ?? []) {
          const v = prod[k];
          const ex = Array.isArray(v) ? v.join(' ') : String(v);
          const f = freq.get(k) ?? { n: 0, ex };
          f.n++;
          freq.set(k, f);
        }
      }
    }
    console.log(`productos: ${total}`);
    for (const [k, f] of [...freq.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 45)) console.log(`  ${String(f.n).padStart(4)}  ${k}: ${f.ex.slice(0, 70)}`);
  }
}
