// Uso: npx tsx pipeline/fetch-cli.ts [tienda,tienda] — solo baja datos crudos (útil para depurar el normalizador).
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchAll, RAW_DIR } from './fetch';

const stores = process.argv[2]?.split(',').filter(Boolean);
const t0 = Date.now();
const report = await fetchAll(undefined, stores);
await writeFile(path.join(RAW_DIR, 'report.json'), JSON.stringify(report, null, 2));
console.log(`Listo en ${Math.round((Date.now() - t0) / 1000)} s`, report);
