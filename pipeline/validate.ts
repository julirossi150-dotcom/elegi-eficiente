// Control antes de publicar: que cada categoría tenga datos razonables y que no se haya vaciado de un día para otro.
// Sale con código 1 si algo está mal, así el workflow diario no commitea ni publica datos rotos.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATEGORY_IDS, type CategoryFile, type Meta } from '../lib/types';

const DIR = path.join(process.cwd(), 'public', 'data');
const MIN_PRODUCTS = 20;
const errors: string[] = [];

const meta = JSON.parse(readFileSync(path.join(DIR, 'meta.json'), 'utf8')) as Meta;
if (!meta.stores.some((s) => s.ok)) errors.push('ninguna tienda respondió');

for (const c of CATEGORY_IDS) {
  let file: CategoryFile;
  try {
    file = JSON.parse(readFileSync(path.join(DIR, `${c}.json`), 'utf8')) as CategoryFile;
  } catch (e) {
    errors.push(`${c}: no se pudo leer (${(e as Error).message})`);
    continue;
  }
  if (file.count !== file.products.length) errors.push(`${c}: count (${file.count}) ≠ productos (${file.products.length})`);
  if (file.products.length < MIN_PRODUCTS) errors.push(`${c}: solo ${file.products.length} productos`);
  const ids = new Set<string>();
  for (const p of file.products) {
    if (ids.has(p.id)) errors.push(`${c}: id repetido ${p.id}`);
    ids.add(p.id);
    if (p.priceMin === null || !(p.priceMin > 0)) errors.push(`${c}: ${p.id} sin precio`);
    if (!p.offers.length) errors.push(`${c}: ${p.id} sin ofertas`);
    if (p.offers.some((o) => !o.available)) errors.push(`${c}: ${p.id} publica ofertas sin stock`);
    if (p.offers.length && p.priceMin !== Math.min(...p.offers.map((o) => o.price))) errors.push(`${c}: ${p.id} precio mínimo ≠ mejor oferta`);
  }
  const withConsumption = file.products.filter((p) => p.quality !== 'insuficiente').length;
  if (withConsumption < file.products.length * 0.2) errors.push(`${c}: solo ${withConsumption} productos con consumo`);
  console.log(`${c}: ${file.products.length} productos, ${withConsumption} con consumo`);
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problema(s):\n${errors.slice(0, 30).map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('✓ datos válidos');
