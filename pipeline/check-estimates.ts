// Diagnóstico: compara la estimación por clase contra el consumo real en los productos que lo informan.
// Uso: npx tsx pipeline/check-estimates.ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CategoryFile, Product } from '../lib/types';
import { applyEstimates } from './estimate';

for (const [cat, key] of [
  ['heladeras', 'kwhPerYear'],
  ['lavarropas', 'kwhPerCycle'],
] as const) {
  const data = JSON.parse(await readFile(path.join(process.cwd(), 'public', 'data', `${cat}.json`), 'utf8')) as CategoryFile;
  const withReal = data.products.filter((p) => p.specs[key] && p.provenance[key]?.origin !== 'estimado' && p.label.cls);
  const errors: number[] = [];
  for (const p of withReal) {
    const real = p.specs[key] as number;
    // se estima con todo el catálogo (las letras ambiguas usan lo aprendido del resto), sin el dato real de este producto
    const all: Product[] = JSON.parse(JSON.stringify(data.products));
    const copy = all.find((x) => x.id === p.id)!;
    delete copy.specs[key];
    delete copy.provenance[key];
    copy.label.scale = 'desconocida';
    applyEstimates(all);
    const est = copy.specs[key] as number | undefined;
    if (!est) continue;
    const err = (est - real) / real;
    errors.push(err);
    console.log(`${cat} ${p.label.cls}(${p.label.scale}) real ${real} est ${est} → ${(err * 100).toFixed(0)}%  ${p.name.slice(0, 50)}`);
  }
  errors.sort((a, b) => a - b);
  const med = errors[Math.floor(errors.length / 2)];
  const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
  console.log(`\n${cat}: n=${errors.length}, mediana ${(med * 100).toFixed(0)}%, error absoluto medio ${(mae * 100).toFixed(0)}%\n`);
}
