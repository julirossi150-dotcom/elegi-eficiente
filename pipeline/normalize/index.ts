// Paso 2: convierte una publicación cruda de VTEX en un Listing normalizado.
import type { CategoryId, EnergyLabel, EnergySource, Specs } from '../../lib/types';
import { PRODUCT_RULES } from '../config';
import { bestOffer, type VtexProduct } from '../sources/vtex';
import { inRange, modelFromName, normalizeBrand, normalizeText, numberWithUnit, parseClass, toNumber, yesNo } from './parse';
import { isRange, reader, type SpecReader } from './read';
import type { Listing } from './types';

const W_PER_FRIG = 1.163;

function num(v: string | undefined, min: number, max: number): number | undefined {
  if (!v || isRange(v)) return undefined;
  return inRange(toNumber(v), min, max);
}

/** Número con unidad en el valor ("327 kWh") o número solo si la unidad está en el nombre de la spec ("Consumo anual (en kwts)": "327"). */
function valueWithUnit(key: string, value: string, unit: RegExp): number | undefined {
  const t = normalizeText(value);
  const v = numberWithUnit(t, unit);
  if (v !== undefined) return v;
  return unit.test(normalizeText(key)) && /^\s*\d[\d.,]*\s*$/.test(t) ? toNumber(t) : undefined;
}

/** "Frío: 3650 W - Calor: 3700 W" → { frio: 3650, calor: 3700 } */
function frioCalor(v: string | undefined): { frio?: number; calor?: number } {
  const t = normalizeText(v ?? '');
  const get = (re: RegExp) => {
    const m = t.match(re);
    return m ? toNumber(m[1]) : undefined;
  };
  return { frio: get(/frio:?\s*(\d[\d.,]*)\s*w/), calor: get(/calor:?\s*(\d[\d.,]*)\s*w/) };
}

// ---------- etiqueta ----------

function parseLabel(r: SpecReader, category: CategoryId): EnergyLabel {
  const patterns = [/^eficiencia energetica( frio)?$/, /^clasificacion energetica( frio)?$/, /eficiencia energetica|clasificacion energetica/];
  const reject = category === 'aires' ? /calor|anterior/ : /anterior/;
  let raw: string | undefined;
  for (const p of patterns) {
    raw = r.get(p, reject);
    if (raw) break;
  }
  // Electrolux publica las dos: "Clasificación Energética" (nueva) y "Clasificación Energética Anterior"
  const previous = parseClass(r.get(/(eficiencia|clasificacion) energetica anterior/));
  if (previous) {
    const cls = parseClass(raw);
    if (cls && cls !== previous) return { cls, scale: 'nueva', raw };
    if (!cls) return { cls: previous, scale: 'anterior', raw: r.get(/(eficiencia|clasificacion) energetica anterior/) };
  }
  // Carrefour a veces pone la clase dentro de "Consumo": "C (Eficiencia Energetica)"
  if (!raw) {
    const c = r.get(/^consumo/);
    if (c && /eficien/i.test(c)) raw = c;
  }
  // Easy: "5.9 Clase B Frio / 3.95 Clase A Calor"
  if (raw && /clase\s+[a-g]/i.test(raw)) raw = raw.match(/clase\s+[a-g]\+*/i)![0];
  const cls = parseClass(raw);
  if (!cls) return { cls: null, scale: 'desconocida' };
  return { cls, scale: cls.includes('+') ? 'anterior' : 'desconocida', raw };
}

// ---------- modelo ----------

function parseModel(p: VtexProduct, r: SpecReader, brand: string, ean?: string): string | undefined {
  const fromSpec = r.get(/^modelo$/) ?? r.get(/^modelo\b/, /origen|tarjeta/);
  const clean = (m: string) => m.replace(/\s+/g, ' ').trim();
  if (fromSpec && fromSpec.length >= 3 && fromSpec.length <= 40 && /\d/.test(fromSpec)) return clean(fromSpec);
  const ref = p.items?.[0]?.referenceId?.find((x) => /refid/i.test(x.Key))?.Value;
  const fromName = modelFromName(p.productName, brand);
  if (fromName) return fromName;
  if (ref && ref !== ean && /[a-z]/i.test(ref) && /\d/.test(ref) && ref.length >= 5 && ref.length <= 30) return ref;
  if (fromSpec && fromSpec.length >= 3 && fromSpec.length <= 40) return clean(fromSpec);
  return undefined;
}

// ---------- por categoría ----------

function litersFromName(name: string): number | undefined {
  const m = name.match(/(\d{2,4})\s*(?:l|lts?|litros)\b/);
  return m ? Number(m[1]) : undefined;
}

function heladera(r: SpecReader): Specs {
  const s: Specs = {};
  const vol =
    num(r.get(/capacidad (total )?util|capacidad neta|volumen neto|capacidad util total|capacidad de litros total/), 20, 1200) ??
    num(r.get(/^capacidad total$|^capacidad$|^capacidad litros$|^capacidad de litros$|^capacidad en litros$/), 20, 1200) ??
    num(r.get(/capacidad bruta|volumen bruto/), 20, 1200) ??
    inRange(litersFromName(r.name), 20, 1200);
  if (vol) s.totalVolumeL = vol;
  const fz = num(r.get(/(capacidad|litros).*(freezer|congelador)/, /ubicacion|tipo/), 5, 600);
  if (fz) s.freezerVolumeL = fz;

  const frostText = normalizeText(r.get(/sistema de refrigeracion|tipo de enfriamiento|tipo de frio|tipo de deshielo|tipo de motor/) ?? '');
  const nf = yesNo(r.get(/^no frost$/));
  if (nf !== undefined) s.frostFree = nf;
  else if (/no ?frost|frost free/.test(frostText) || /no ?frost/.test(r.name)) s.frostFree = true;
  else if (/ciclic|convencional|manual/.test(frostText) || /ciclic/.test(r.name)) s.frostFree = false;

  const kwh = (() => {
    for (const { key, value } of r.all(/consumo/)) {
      const v = valueWithUnit(key, value, /kw ?h|kw/);
      if (v !== undefined) return inRange(v, 40, 2000);
    }
    return undefined;
  })();
  if (kwh) s.kwhPerYear = kwh;

  const tipo = normalizeText(r.get(/tipo de (producto|heladera)|^tipo$/) ?? '');
  const n = r.name;
  if (/side ?by ?side|french door/.test(n)) s.fridgeType = 'side_by_side';
  else if ((/^freezer|freezer (horizontal|vertical)|^congelador/.test(n) || /^freezer/.test(tipo)) && !/heladera/.test(n)) s.fridgeType = 'freezer';
  else if (/bajo mesada|frigobar|minibar/.test(n + tipo)) s.fridgeType = 'bajo_mesada';
  else if (/sin freezer/.test(n + tipo)) s.fridgeType = 'heladera';
  else if (/con freezer|freezer superior|freezer inferior|bottom freezer|top mount|no ?frost|2 puertas|dos puertas/.test(n + tipo) || (s.freezerVolumeL ?? 0) > 0)
    s.fridgeType = 'heladera_con_freezer';
  else if (/monopuerta|1 puerta|una puerta|sin congelador/.test(n + tipo)) s.fridgeType = 'heladera';
  // si no se sabe, queda sin tipo: la estimación supone heladera con freezer (lo más común)
  return s;
}

function aire(r: SpecReader): Specs {
  const s: Specs = {};
  const n = r.name;
  // frigorías: spec explícita o en el nombre ("3000 frigorías", "3000F", "3000 fg")
  let frig = num(r.get(/frigorias?( frio)?$|potencia frigorias|capacidad (en |de )?frigorias|capacidad de refrigeracion$|^frigorias \(frio\)$/, /calor|rango/), 1000, 20000);
  if (!frig) {
    const m = n.match(/(\d[\d.]{2,5})\s*(?:frigorias|frig\b|fg\b|f\b|fc\b|fs\b)/);
    if (m) frig = inRange(toNumber(m[1]), 1000, 20000);
  }
  let capW = num(r.get(/potencia frio|potencia \(frio\)|capacidad watts|capacidad de refrigeracion \(watts\)|^capacidad$|potencia de refrigeracion$/, /calor/), 1200, 25000);
  if (capW && capW < 1500 && !frig) capW = undefined; // probablemente consumo eléctrico, no capacidad
  // BGH: "Capacidad: Frío: 3650 W - Calor: 3700 W" y "Potencia: Frío: 1125 W - Calor: 948 W"
  const capFC = frioCalor(r.get(/^capacidad$/));
  const powFC = frioCalor(r.get(/^potencia$/));
  if (capFC.frio && inRange(capFC.frio, 1200, 25000)) capW = capFC.frio;
  if (!capW && frig) capW = Math.round(frig * W_PER_FRIG);
  if (capW) s.coolingCapacityW = capW;
  if (frig) s.frigorias = frig;
  else if (capW) s.frigorias = Math.round(capW / W_PER_FRIG);

  // potencia eléctrica en frío (para EER = capacidad / potencia)
  const inWSpec = (() => {
    const v = r.get(/consumo (energetico )?(en )?frio|potencia electrica frio|consumo electrico/);
    if (!v) return undefined;
    const t = normalizeText(v);
    const kw = numberWithUnit(t, /kw\b/);
    if (kw !== undefined && kw < 10) return kw * 1000;
    return numberWithUnit(t, /w\b|watts?/);
  })();
  const inW = inWSpec ?? powFC.frio;
  if (inW && capW && inW > 250 && inW < capW) {
    s.coolingPowerW = inW;
    const eer = capW / inW;
    if (eer > 1.8 && eer < 8) s.eer = Math.round(eer * 100) / 100;
  }
  // consumo anual declarado ("268 Kw/H Anual")
  for (const { value } of r.all(/consumo de energia/)) {
    const t = normalizeText(value);
    if (/anual|ano/.test(t)) {
      const v = numberWithUnit(t, /kw/);
      if (v && v > 50 && v < 5000) s.labelCoolingKwh = v;
    }
  }

  const inv = yesNo(r.get(/inverter|tipo de tecnologia/)) ?? (/inverter/.test(normalizeText(r.get(/tipo de (tecnologia|motor|equipo|producto)/) ?? '')) ? true : undefined);
  if (inv !== undefined) s.inverter = inv;
  else if (/inverter/.test(n)) s.inverter = true;
  else if (/tradicional|on.?off/.test(normalizeText(r.get(/tipo de tecnologia/) ?? ''))) s.inverter = false;

  const fc = normalizeText(r.get(/frio ?\/ ?calor|tipo de climatizacion/) ?? '');
  if (/^s[ií]/.test(fc) || /calor/.test(fc) || /frio ?\/? ?calor|f\/c\b|frio-calor/.test(n)) s.heatPump = true;
  else if (/^no$|^frio$|solo frio/.test(fc) || /solo frio/.test(n)) s.heatPump = false;

  const heatW = num(r.get(/potencia calor|capacidad de calefaccion \(watts\)/), 1200, 25000) ?? inRange(capFC.calor, 1200, 25000);
  if (heatW) s.heatingCapacityW = heatW;
  if (heatW && powFC.calor && powFC.calor > 250 && powFC.calor < heatW) {
    s.heatingPowerW = powFC.calor;
    const cop = heatW / powFC.calor;
    if (cop > 1.8 && cop < 8) s.cop = Math.round(cop * 100) / 100;
  }

  const tipo = normalizeText(`${r.get(/tipo de (aire|equipo|producto)/) ?? ''} ${n}`);
  s.acType = /portatil/.test(tipo) ? 'portatil' : /ventana/.test(tipo) ? 'ventana' : /piso.?techo|cassette|baja silueta/.test(tipo) ? 'piso_techo' : /split/.test(tipo) ? 'split' : 'otro';
  return s;
}

function lavarropas(r: SpecReader): Specs {
  const s: Specs = {};
  const kg =
    num(r.get(/capacidad (de )?(lavado|carga)$|^capacidad$|carga maxima|capacidad total|capacidad de carga$/, /secado/), 2, 30) ??
    (() => {
      const m = r.name.match(/(\d{1,2}(?:[.,]\d)?)\s*kg/);
      return m ? inRange(toNumber(m[1]), 2, 30) : undefined;
    })();
  if (kg) s.capacityKg = kg;
  for (const { key, value } of r.all(/consumo de energia|consumo energetico|^consumo \(kw/)) {
    const v = valueWithUnit(key, value, /kw/);
    if (v && v > 0.05 && v < 5) s.kwhPerCycle = v;
  }
  const agua = r.get(/consumo de agua/);
  const l = agua ? inRange(toNumber(agua), 20, 300) : undefined;
  if (l) s.waterLPerCycle = l;
  const carga = normalizeText(`${r.get(/tipo de carga/) ?? ''} ${r.get(/tipo de (producto|lavarropas)/) ?? ''} ${r.name}`);
  if (/frontal/.test(carga)) s.loading = 'frontal';
  else if (/superior/.test(carga)) s.loading = 'superior';
  if (/lavasecarropa/.test(carga)) s.washerType = 'lavasecarropas';
  else if (/semi.?automatico/.test(carga)) s.washerType = 'semiautomatico';
  else s.washerType = 'automatico';
  return s;
}

function gasKindFrom(text: string): EnergySource | undefined {
  const t = normalizeText(text);
  if (/multigas|mixta|gn ?\/ ?glp|natural.*(envasado|licuado|glp)|(envasado|licuado|glp).*natural/.test(t)) return 'multigas';
  if (/envasado|glp|licuado|garrafa|\bge\b/.test(t)) return 'gas_envasado';
  if (/natural|\bgn\b|\bg\/n\b/.test(t)) return 'gas_natural';
  return undefined;
}

function aguaCaliente(r: SpecReader, category: 'calefones' | 'termotanques'): { specs: Specs; energy: EnergySource; guessed: boolean } {
  const s: Specs = {};
  const typeText = `${r.get(/tipo de (gas|energia|producto)|fuente de energia/) ?? ''} ${r.name}`;
  const t = normalizeText(typeText);
  let energy: EnergySource;
  let guessed = false;
  if (/electric/.test(t) && !/gas/.test(normalizeText(r.get(/tipo de gas/) ?? 'x'))) energy = 'electricidad';
  else {
    const g = gasKindFrom(typeText);
    if (g) energy = g;
    else {
      energy = 'gas_natural';
      guessed = true;
    }
  }
  if (/bomba de calor/.test(t)) s.heaterType = 'bomba_de_calor';
  else s.heaterType = category === 'calefones' ? 'calefon' : 'termotanque';

  if (category === 'calefones') {
    const cap = r.get(/^capacidad|caudal/);
    const flow = (cap && inRange(toNumber(cap), 4, 40)) ?? (() => {
      const m = r.name.match(/(\d{1,2})\s*(?:l|lts?|litros)\b/);
      return m ? inRange(Number(m[1]), 4, 40) : undefined;
    })();
    if (flow) s.flowLMin = flow;
  } else {
    const cap = num(r.get(/^capacidad( \(litros\))?$|^capacidad (en )?litros/), 10, 500) ?? inRange(litersFromName(r.name), 10, 500);
    if (cap) s.storageL = cap;
  }

  if (energy !== 'electricidad') {
    const enc = normalizeText(`${r.get(/encendido/) ?? ''} ${r.name}`);
    if (/sin (llama )?piloto|s\/ ?llama piloto|pilotless|electronico|automatico|a pilas|bateria|tiro balanceado electronico/.test(enc) && !/piezo|manual/.test(enc)) s.hasPilot = false;
    else if (/piezo|manual|con piloto|piloto/.test(enc)) s.hasPilot = true;
    const rend = r.get(/rendimiento/);
    const pct = rend ? inRange(toNumber(rend), 50, 110) : undefined;
    if (pct) s.efficiencyPct = pct;
    const kcal = numberWithUnit(normalizeText(r.get(/potencia|consumo/) ?? ''), /kcal/);
    if (kcal && kcal > 1000 && kcal < 60000) s.gasPowerKcalH = kcal;
  } else {
    const w = numberWithUnit(normalizeText(r.get(/potencia/) ?? ''), /w\b|watts?/);
    if (w && w > 300 && w < 10000) s.powerW = w;
  }
  return { specs: s, energy, guessed };
}

/** Estufas y calefactores: tipo, energía, potencia (kcal/h a gas, W eléctrica), encendido y rendimiento. */
function calefactor(r: SpecReader): { specs: Specs; energy: EnergySource; guessed: boolean } {
  const s: Specs = {};
  const typeText = normalizeText(`${r.get(/tipo de (producto|gas|energia|estufa|calefactor)|fuente de energia|tiro/) ?? ''} ${r.name}`);
  const t = ` ${typeText} `;
  if (/tiro balanceado|\btb ?u?\b|balanceado/.test(t)) s.roomHeaterType = 'tiro_balanceado';
  else if (/catalitic/.test(t)) s.roomHeaterType = 'catalitica';
  else if (/caloventor|termoventilador/.test(t)) s.roomHeaterType = 'caloventor';
  else if (/cuarzo/.test(t)) s.roomHeaterType = 'cuarzo';
  else if (/halogen/.test(t)) s.roomHeaterType = 'halogena';
  else if (/radiador|oleo|aceite/.test(t)) s.roomHeaterType = 'radiador';
  else if (/panel|mica|vitroconvector|placa/.test(t)) s.roomHeaterType = 'panel';
  else if (/convector|conveccion/.test(t)) s.roomHeaterType = 'convector';
  else if (/infrarroj|garrafer|pantalla|radiante/.test(t)) s.roomHeaterType = 'infrarroja';
  else if (/sin salida|tiro natural|\bsss?\b/.test(t)) s.roomHeaterType = 'sin_salida';

  const gasTypes = ['tiro_balanceado', 'catalitica', 'infrarroja', 'sin_salida'];
  const elecTypes = ['caloventor', 'cuarzo', 'halogena', 'radiador', 'panel', 'convector'];
  const gasWord = /\bgas\b|garraf|envasado|gas natural|multigas|\bglp\b|tiro|balanceado|kcal/.test(t);
  const elecWord = /(?<!piezo)electric|\d\s*w(atts?)?\b/.test(t);
  let energy: EnergySource = 'electricidad';
  let guessed = false;
  if (s.roomHeaterType && gasTypes.includes(s.roomHeaterType)) energy = gasKindFrom(typeText) ?? (s.roomHeaterType === 'infrarroja' && /garraf/.test(t) ? 'gas_envasado' : 'gas_natural');
  else if (s.roomHeaterType && elecTypes.includes(s.roomHeaterType)) energy = 'electricidad';
  else if (gasWord && !elecWord) energy = gasKindFrom(typeText) ?? 'gas_natural';
  if (energy !== 'electricidad' && !gasKindFrom(typeText)) guessed = true;
  // infrarrojas eléctricas existen: si dice watts y no gas, es eléctrica
  if (s.roomHeaterType === 'infrarroja' && elecWord && !gasWord) energy = 'electricidad';
  if (s.roomHeaterType === 'convector' && gasWord && !elecWord) energy = gasKindFrom(typeText) ?? 'gas_natural';
  // la potencia en kcal sin watts en el nombre es de un artefacto a gas (las eléctricas se venden por watts)
  if (energy === 'electricidad' && /\d\s*k ?\/? ?cal/.test(r.name) && !/\d\s*w(atts?)?\b/.test(r.name) && !elecTypes.includes(s.roomHeaterType ?? '')) {
    energy = gasKindFrom(typeText) ?? 'gas_natural';
    guessed = !gasKindFrom(typeText);
  }
  // sin indicios claros de electricidad, que decida otra tienda con más datos
  if (energy === 'electricidad' && !elecWord && !elecTypes.includes(s.roomHeaterType ?? '')) guessed = true;
  if (!s.roomHeaterType) s.roomHeaterType = energy === 'electricidad' ? 'otro' : 'sin_salida';

  const specText = normalizeText([r.get(/calorias|kcal|capacidad calorifica|potencia|capacidad de calefaccion|consumo de energia/) ?? '', r.name].join(' '));
  if (energy === 'electricidad') {
    const w =
      valueWithUnit('potencia', r.get(/potencia maxima|capacidad de calefaccion|^potencia/) ?? '', /w\b|watts?/) ??
      numberWithUnit(specText, /w\b|watts?/);
    const kw = numberWithUnit(specText, /kw\b/);
    const watts = w ?? (kw ? kw * 1000 : undefined);
    if (watts && watts >= 300 && watts <= 5000) s.powerW = watts;
  } else {
    const kcal =
      numberWithUnit(normalizeText(r.get(/calorias$|capacidad calorifica|^potencia/) ?? ''), /kcal|k ?cal/) ??
      num(r.get(/capacidad calorifica/), 1000, 15000) ??
      numberWithUnit(specText, /kcal|k ?cal|cal\b/);
    if (kcal && kcal >= 1000 && kcal <= 15000) s.gasPowerKcalH = kcal;
    const enc = normalizeText(`${r.get(/encendido/) ?? ''} ${r.name}`);
    if (/sin piloto|electronico|automatico/.test(enc) && !/piezo|manual/.test(enc)) s.hasPilot = false;
    else if (/piezo|manual|piloto/.test(enc)) s.hasPilot = true;
    const rend = r.get(/rendimiento/);
    const pct = rend ? inRange(toNumber(rend), 40, 110) : undefined;
    if (pct) s.efficiencyPct = pct;
  }
  return { specs: s, energy, guessed };
}

// ---------- entrada ----------

export function toListing(p: VtexProduct, store: string, category: CategoryId, checkedAt: string): Listing | null {
  const name = (p.productName ?? '').trim();
  const nn = normalizeText(name);
  const rule = PRODUCT_RULES[category];
  if (!rule.include.test(nn) || rule.exclude.test(nn)) return null;
  const offer = bestOffer(p);
  if (!offer || offer.price < 20_000) return null; // accesorios o errores de carga

  const r = reader(p);
  const brand = normalizeBrand(p.brand || 'Sin marca');
  const ean = offer.item.ean?.trim() || undefined;
  let specs: Specs;
  let energy: EnergySource = 'electricidad';
  let energyGuessed = false;
  switch (category) {
    case 'heladeras':
      specs = heladera(r);
      break;
    case 'aires':
      specs = aire(r);
      break;
    case 'lavarropas':
      specs = lavarropas(r);
      // Semiautomáticos y lavasecarropas están excluidos del etiquetado argentino (Res. 438/2024 Ap. II Art. 2°)
      if (specs.washerType !== 'automatico') return null;
      break;
    case 'calefones':
    case 'termotanques': {
      const res = aguaCaliente(r, category);
      specs = res.specs;
      energy = res.energy;
      energyGuessed = res.guessed;
      if (category === 'calefones' && energy === 'electricidad') return null;
      break;
    }
    case 'calefactores': {
      const res = calefactor(r);
      specs = res.specs;
      energy = res.energy;
      energyGuessed = res.guessed;
      break;
    }
  }

  const image = offer.item.images?.[0]?.imageUrl?.replace(/^http:/, 'https:');
  return {
    store,
    storeProductId: p.productId,
    category,
    name,
    brand,
    model: parseModel(p, r, brand, ean),
    ean,
    image,
    url: p.link,
    price: Math.round(offer.price),
    listPrice: offer.listPrice ? Math.round(offer.listPrice) : undefined,
    available: offer.available,
    zones: offer.zones,
    checkedAt,
    energy,
    energyGuessed,
    label: parseLabel(r, category),
    specs,
  };
}
