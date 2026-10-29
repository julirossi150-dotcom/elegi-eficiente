// Pipeline diario: npm run data:update  (opciones: --offline para reusar el caché crudo, --stores=fravega,naldo)
import { build } from './build';
import { fetchAll } from './fetch';

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const stores = args.find((a) => a.startsWith('--stores='))?.slice('--stores='.length).split(',');

const t0 = Date.now();
const report = offline ? null : await fetchAll(undefined, stores);
if (report) {
  const ok = report.filter((r) => r.ok).length;
  console.log(`Tiendas OK: ${ok}/${report.length}`);
  if (ok === 0) {
    console.error('Ninguna tienda respondió: no se actualizan los datos.');
    process.exit(1);
  }
}
const meta = await build(report);
console.log(`Listo en ${Math.round((Date.now() - t0) / 1000)} s — ${meta.categories.reduce((s, c) => s + c.count, 0)} productos.`);
