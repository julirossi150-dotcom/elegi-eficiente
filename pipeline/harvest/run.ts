// Recolecta datos de fabricante (DJC de la Res. 438/2024) y los guarda en pipeline/manual/fabricantes/<fuente>.json.
// No corre todos los días: las DJC cambian poco. Uso: npx tsx pipeline/harvest/run.ts [fuente...]
// Requiere `pdftotext` (poppler) en el PATH.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CATEGORY_IDS, type CategoryFile } from '../../lib/types';
import { politeFetchBytes } from '../lib/http';
import type { ManualEntry } from '../manual';
import { normalizeBrand } from '../normalize/parse';
import { parseDjc } from './djc';

const PDF_CACHE = path.join(process.cwd(), 'pipeline', '.cache', 'pdf');
export const HARVEST_DIR = path.join(process.cwd(), 'pipeline', 'manual', 'fabricantes');

interface PdfRef {
  url: string;
  /** página pública del producto (el link al PDF puede llevar un token que vence) */
  page: string;
}

interface Source {
  id: string;
  /** marcas del catálogo cuyos modelos se buscan en el sitio del fabricante */
  brands: string[];
  find(models: string[], log: (m: string) => void): AsyncGenerator<PdfRef>;
}

const SOURCES: Source[] = [
  {
    id: 'drean',
    brands: ['Drean', 'Patrick'],
    // SAP Hybris: /es_AR/p/<código> muestra la ficha, con un link firmado a la DJC ("…-eficienciaenergetica.pdf")
    async *find(models, log) {
      for (const m of models) {
        const page = `https://drean.com.ar/es_AR/p/${encodeURIComponent(m)}`;
        const html = (await politeFetchBytes(page))?.toString('utf8');
        const href = html?.match(/\/medias\/[^"']*eficienciaenergetica\.pdf\?context=[^"']+/i)?.[0];
        if (href) yield { url: `https://drean.com.ar${href.replace(/&amp;/g, '&')}`, page };
        else log(`  drean ${m}: sin DJC`);
      }
    },
  },
];

async function pdfText(url: string): Promise<string | null> {
  await mkdir(PDF_CACHE, { recursive: true });
  const file = path.join(PDF_CACHE, `${createHash('sha1').update(url.split('?')[0]).digest('hex')}.pdf`);
  if (!existsSync(file)) {
    const buf = await politeFetchBytes(url);
    if (!buf || !buf.subarray(0, 5).toString().startsWith('%PDF')) return null;
    await writeFile(file, buf);
  }
  try {
    return execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

async function catalogModels(brands: string[]): Promise<string[]> {
  const out = new Set<string>();
  for (const c of CATEGORY_IDS) {
    const file = path.join(process.cwd(), 'public', 'data', `${c}.json`);
    if (!existsSync(file)) continue;
    const data = JSON.parse(await readFile(file, 'utf8')) as CategoryFile;
    for (const p of data.products) {
      if (!brands.includes(p.brand) || !p.model) continue;
      const m = p.model.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (/^[A-Z]{2,}\d/.test(m) && !/SELLER/.test(m)) out.add(m);
    }
  }
  return [...out].sort();
}

async function harvest(src: Source, log: (m: string) => void) {
  const models = await catalogModels(src.brands);
  log(`${src.id}: ${models.length} modelos del catálogo`);
  const entries: (ManualEntry & { category: string })[] = [];
  const seen = new Set<string>();
  for await (const ref of src.find(models, log)) {
    const key = ref.url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const text = await pdfText(ref.url);
    const rec = text ? parseDjc(text) : null;
    if (!rec) {
      log(`  ${src.id}: no se pudo leer ${key}`);
      continue;
    }
    for (const g of rec.groups) {
      entries.push({
        category: rec.category,
        brand: normalizeBrand(g.brand),
        // los códigos de la DJC no siempre traen el sufijo de versión que usan las tiendas (…TG vs …TG0)
        models: g.models.map((m) => `${m}*`),
        specs: rec.specs,
        ...(rec.cls ? { label: { cls: rec.cls, scale: 'nueva' as const } } : {}),
        origin: 'fabricante',
        source: ref.page,
        note: 'Declaración Jurada de Conformidad (Res. SIC 438/2024) publicada por el fabricante',
      });
    }
  }
  await mkdir(HARVEST_DIR, { recursive: true });
  await writeFile(path.join(HARVEST_DIR, `${src.id}.json`), JSON.stringify(entries, null, 1));
  log(`${src.id}: ${entries.length} entradas de ${seen.size} DJC`);
}

const only = process.argv.slice(2);
for (const src of SOURCES.filter((s) => !only.length || only.includes(s.id))) await harvest(src, console.log);
