// Tarifas de referencia oficiales, actualizadas cada mes por los entes:
// - Luz: cuadro tarifario mensual de Edenor y Edesur publicado por el ente regulador nacional (ex ENRE).
// - Gas natural: planilla de tarifas vigentes de ENARGAS, con todas las distribuidoras y subzonas del país.
// Los cuadros se publican sin impuestos: se suma el IVA. Si una fuente falla, se conserva el valor anterior.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OfficialGasZone, OfficialTariffs } from '../lib/tariffs';
import { politeFetchBytes } from './lib/http';
import { readSheet } from './lib/xlsx';

const OUT = path.join(process.cwd(), 'public', 'data', 'tarifas.json');
const VAT = 0.21;

const ENRE_BASE = 'https://www.enre.gov.ar';
const ENRE_LIST = `${ENRE_BASE}/web/tarifasd.nsf/todoscuadros?OpenView`;
const ENARGAS_PAGE = 'https://www.enargas.gov.ar/secciones/precios-y-tarifas/cuadros-tarifarios.php';

/** Zona (lib/zones) → distribuidora y subzona tarifaria de ENARGAS de su ciudad de referencia. Misiones no tiene red. */
const GAS_SUBZONE: Record<string, [RegExp, string]> = {
  caba: [/metrogas/i, 'CAPITAL FEDERAL'],
  gba: [/metrogas/i, 'BUENOS AIRES'],
  bsas: [/camuzzi gas pampeana/i, 'PROV BUENOS AIRES'],
  catamarca: [/centro/i, 'LA RIOJA Y CATAMARCA'],
  chaco: [/gasnea/i, 'CHACO'],
  chubut: [/camuzzi gas del sur/i, 'PROV CHUBUT Y RIO NEGRO'],
  cordoba: [/centro/i, 'CORDOBA'],
  corrientes: [/gasnea/i, 'CORRIENTES'],
  entrerios: [/redengas/i, 'ENTRE RIOS, PARANA'],
  formosa: [/gasnea/i, 'FORMOSA'],
  jujuy: [/noa/i, 'SALTA'],
  lapampa: [/camuzzi gas pampeana/i, 'LA PAMPA-NORTE'],
  larioja: [/centro/i, 'LA RIOJA Y CATAMARCA'],
  mendoza: [/cuyana/i, 'MENDOZA'],
  neuquen: [/camuzzi gas del sur/i, 'PROV NEUQUEN'],
  rionegro: [/camuzzi gas del sur/i, 'CORD CHUBUT Y RIO NEGRO'],
  salta: [/noa/i, 'SALTA'],
  sanjuan: [/cuyana/i, 'SAN JUAN'],
  sanluis: [/cuyana/i, 'SAN LUIS'],
  santacruz: [/camuzzi gas del sur/i, 'SANTA CRUZ SUR'],
  santafe: [/litoral/i, 'PROV SANTA FE'],
  sgoestero: [/noa/i, 'TUCUMAN'],
  tdf: [/camuzzi gas del sur/i, 'TIERRA DEL FUEGO'],
  tucuman: [/noa/i, 'TUCUMAN'],
};

const withVat = (v: number) => Math.round(v * (1 + VAT) * 10) / 10;

/** Cargo variable residencial sin subsidio R2 (151–400 kWh) del último cuadro mensual, promedio Edenor/Edesur. */
export async function fetchElectricity(): Promise<OfficialTariffs['electricity']> {
  const list = await politeFetchBytes(ENRE_LIST);
  if (!list) throw new Error('no se pudo leer la lista de cuadros tarifarios');
  const m = list.toString('latin1').match(/href="([^"]+)"[^>]*>\s*Cuadro Tarifario del (\d{2})-(\d{4})/i);
  if (!m) throw new Error('no se encontró el último cuadro tarifario');
  const url = ENRE_BASE + m[1].replace(/\\/g, '/');
  const page = await politeFetchBytes(url);
  if (!page) throw new Error('no se pudo leer el cuadro tarifario');
  return { ...parseElectricity(page.toString('latin1')), period: `${m[2]}/${m[3]}`, url };
}

export function parseElectricity(html: string): { perKwh: number } {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ');
  const section = text.split(/Tarifa 1 - R sin subsidio/i)[1]?.split(/Tarifa 1 - R con subsidio/i)[0];
  const row = section?.match(/Cargo Variable 151-400 \$\/kWh ([\d.,]+) ([\d.,]+)/);
  if (!row) throw new Error('el cuadro tarifario cambió de formato');
  const num = (s: string) => Number(s.replace(/,/g, ''));
  return { perKwh: withVat((num(row[1]) + num(row[2])) / 2) };
}

/** Cargo variable residencial (categoría R2 2°, tarifa plena) por zona, de la planilla vigente de ENARGAS. */
export async function fetchGas(): Promise<OfficialTariffs['gas']> {
  const page = await politeFetchBytes(ENARGAS_PAGE);
  if (!page) throw new Error('no se pudo leer la página de ENARGAS');
  const href = page.toString('utf8').match(/href="\.?\/?(descargas\/tarifas-gn-\d{8}\.xlsx)"/)?.[1];
  if (!href) throw new Error('no se encontró la planilla de gas natural');
  const url = new URL(href, ENARGAS_PAGE).toString();
  const xlsx = await politeFetchBytes(url);
  if (!xlsx) throw new Error('no se pudo bajar la planilla de gas natural');
  return { ...parseGas(readSheet(xlsx)), url };
}

export function parseGas(rows: Record<string, string>[]): { since: string; byZone: Record<string, OfficialGasZone> } {
  const res = rows.filter((r) => r.SERVICIO === 'Residencial' && r.TIPOTARIFA === 'Plenas' && r.CATEGORIA === 'R2 2°' && /^Cargo Variable/.test(r.CARGOTIPO));
  const byZone: Record<string, OfficialGasZone> = {};
  for (const [zone, [company, subzone]] of Object.entries(GAS_SUBZONE)) {
    const r = res.find((x) => company.test(x.EMPRESA) && x.SUBZONA.trim().toUpperCase() === subzone);
    if (!r) continue;
    byZone[zone] = { perM3: withVat(Number(r.CARGO.replace(/\./g, '').replace(',', '.'))), distributor: r.EMPRESA, subzone: r.SUBZONA.trim() };
  }
  if (!byZone.caba) throw new Error('la planilla de gas cambió de formato');
  return { since: res[0]?.VIGENCIADESDE ?? '', byZone };
}

/** Actualiza public/data/tarifas.json. Una fuente que falla conserva su valor anterior. */
export async function updateTariffs(log: (m: string) => void = console.log): Promise<OfficialTariffs> {
  let prev: OfficialTariffs | null = null;
  try {
    prev = JSON.parse(await readFile(OUT, 'utf8')) as OfficialTariffs;
  } catch {
    /* primera vez */
  }
  const out: OfficialTariffs = { generatedAt: new Date().toISOString(), vat: VAT, electricity: prev?.electricity ?? null, gas: prev?.gas ?? null };
  try {
    out.electricity = await fetchElectricity();
    log(`tarifas: luz ${out.electricity!.period} → $${out.electricity!.perKwh}/kWh con IVA`);
  } catch (e) {
    log(`  ⚠ tarifas de luz: ${(e as Error).message}; se conserva el valor anterior`);
  }
  try {
    out.gas = await fetchGas();
    log(`tarifas: gas desde ${out.gas!.since} → ${Object.keys(out.gas!.byZone).length} zonas (CABA $${out.gas!.byZone.caba.perM3}/m³ con IVA)`);
  } catch (e) {
    log(`  ⚠ tarifas de gas: ${(e as Error).message}; se conserva el valor anterior`);
  }
  await writeFile(OUT, JSON.stringify(out, null, 2));
  return out;
}
