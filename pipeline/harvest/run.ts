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
  /** qué identifica al documento (para el caché): por defecto el URL sin la consulta, que en algunos sitios es un token que vence */
  key?: string;
  /** marca y modelos tal como los lista el sitio, cuando son más confiables que el texto del PDF */
  groups?: { brand: string; models: string[] }[];
}

interface Source {
  id: string;
  /** marcas del catálogo cuyos modelos se buscan en el sitio del fabricante */
  brands: string[];
  find(models: string[], log: (m: string) => void): AsyncGenerator<PdfRef>;
}

/** Empresas certificadas por IRAM: el link sale del QR de una etiqueta suya (ver README). */
interface IramCompany {
  empresa: string;
  url: string;
  /** de qué etiqueta se sacó el QR */
  origen: string;
}

const IRAM_COMPANIES = path.join(process.cwd(), 'pipeline', 'harvest', 'iram-empresas.json');
const IRAM_PRODUCTS = /refrigerador|congelador|lavarropas|acondicionador|termotanque|calentador de agua/i;

function htmlDecode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

const SOURCES: Source[] = [
  {
    id: 'iram',
    brands: [],
    // qr.iram.org.ar: el QR de la etiqueta abre la página de la empresa con todos sus certificados; cada certificado
    // de eficiencia enlaza la DJC ("Ver DDJJ del titular"). No hay listado de empresas: se cargan en iram-empresas.json.
    async *find(_models, log) {
      const companies = JSON.parse(await readFile(IRAM_COMPANIES, 'utf8')) as IramCompany[];
      for (const c of companies) {
        const html = (await politeFetchBytes(c.url))?.toString('utf8') ?? '';
        const certs = [...html.matchAll(/<div class="cert-item[\s\S]*?<\/div>/g)].map((m) => m[0]);
        const wanted = certs.filter((h) => /data-ddjj="1"/.test(h) && /data-tramite="[^"]*Eficiencia/i.test(htmlDecode(h)) && IRAM_PRODUCTS.test(htmlDecode(h.match(/data-producto="([^"]*)"/)?.[1] ?? '')));
        log(`  iram ${c.empresa}: ${certs.length} certificados, ${wanted.length} de eficiencia con DJC`);
        for (const h of wanted) {
          const href = h.match(/href="(\/Certificacion\/Index\/[^"]+)"/)?.[1];
          if (!href) continue;
          const page = `https://qr.iram.org.ar${href}`;
          const ddjj = (await politeFetchBytes(page))?.toString('utf8').match(/href="(\/Certificacion\/DDJJ\?id=[^"]+)"/)?.[1];
          if (!ddjj) {
            log(`  iram ${page}: sin DDJJ`);
            continue;
          }
          // el listado trae marca y modelos bien escritos; algunos PDF tienen los acentos rotos ("Eslab�n")
          const brand = htmlDecode(h.match(/data-marca="([^"]*)"/)?.[1] ?? '').trim();
          const models = htmlDecode(h.match(/data-modelo="([^"]*)"/)?.[1] ?? '')
            .split(/\s*[;,]\s*/)
            .map((m) => m.trim().toUpperCase().replace(/\s+/g, ''))
            .filter((m) => /\d/.test(m));
          // el id de la DJC va en la consulta
          const url = `https://qr.iram.org.ar${htmlDecode(ddjj)}`;
          yield { url, page, key: url, ...(brand && models.length ? { groups: [{ brand, models }] } : {}) };
        }
      }
    },
  },
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
  {
    id: 'longvie',
    brands: ['Longvie'],
    // Tiendanube: cada ficha enlaza "DJC + CERTIFICADOS … .pdf"; se recorren las categorías con DJC de la Res. 438/2024
    async *find(_models, log) {
      const pages = new Set<string>();
      for (const cat of ['lavado', 'termotanques']) {
        for (let n = 1; n <= 10; n++) {
          const html = (await politeFetchBytes(`https://www.longvie.com/${cat}/?page=${n}`))?.toString('utf8');
          const found = [...(html ?? '').matchAll(/(\/productos\/[a-z0-9-]+\/)/g)].map((m) => `https://www.longvie.com${m[1]}`);
          const before = pages.size;
          for (const p of found) pages.add(p);
          if (pages.size === before) break;
        }
      }
      for (const page of pages) {
        const html = (await politeFetchBytes(page))?.toString('utf8') ?? '';
        const pdfs = [...new Set([...html.matchAll(/https:\/\/[^"'\s]+?\.pdf/gi)].map((m) => m[0]).filter((u) => /djc/i.test(decodeURIComponent(u))))];
        if (!pdfs.length) log(`  longvie ${page}: sin DJC`);
        for (const url of pdfs) yield { url, page };
      }
    },
  },
];

async function pdfText(url: string, key: string): Promise<string | null> {
  await mkdir(PDF_CACHE, { recursive: true });
  const file = path.join(PDF_CACHE, `${createHash('sha1').update(key).digest('hex')}.pdf`);
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
    const key = ref.key ?? ref.url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const text = await pdfText(ref.url, key);
    const rec = text ? parseDjc(text) : null;
    if (!rec) {
      log(`  ${src.id}: no se pudo leer ${key}`);
      continue;
    }
    for (const g of ref.groups ?? rec.groups) {
      entries.push({
        category: rec.category,
        brand: normalizeBrand(g.brand),
        // los códigos de la DJC no siempre traen el sufijo de versión que usan las tiendas (…TG vs …TG0)
        models: g.models.map((m) => `${m}*`),
        specs: rec.specs,
        ...(rec.cls ? { label: { cls: rec.cls, scale: rec.scale ?? 'nueva' } } : {}),
        origin: 'fabricante',
        source: ref.page,
        note: 'Declaración Jurada de Conformidad (Res. SIC 438/2024) publicada por el fabricante',
      });
    }
  }
  // un mismo modelo con DJC distintas (p. ej. versiones de 1,5 y 2 kW con el mismo código): no se sabe cuál venden las tiendas
  const facts = (e: ManualEntry) => JSON.stringify([e.specs, e.label]);
  const byModel = new Map<string, Set<string>>();
  for (const e of entries) for (const m of e.models ?? []) byModel.set(`${e.brand}|${m}`, (byModel.get(`${e.brand}|${m}`) ?? new Set()).add(facts(e)));
  const ambiguous = new Set([...byModel].filter(([, f]) => f.size > 1).map(([k]) => k));
  for (const k of ambiguous) log(`  ${src.id}: ${k.replace('|', ' ')} tiene DJC distintas, se descarta`);
  const kept = entries.filter((e) => !(e.models ?? []).some((m) => ambiguous.has(`${e.brand}|${m}`)));
  await mkdir(HARVEST_DIR, { recursive: true });
  await writeFile(path.join(HARVEST_DIR, `${src.id}.json`), JSON.stringify(kept, null, 1));
  log(`${src.id}: ${kept.length} entradas de ${seen.size} DJC`);
}

const only = process.argv.slice(2);
for (const src of SOURCES.filter((s) => !only.length || only.includes(s.id))) await harvest(src, console.log);
