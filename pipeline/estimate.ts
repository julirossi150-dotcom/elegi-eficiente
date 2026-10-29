// Estimaciones para completar datos que las tiendas no publican. Todo valor estimado queda marcado
// con origin "estimado" y una nota que explica de dónde sale. Fuentes en docs/investigacion.md.
import type { EnergyLabel, Product, SpecKey } from '../lib/types';

function setEstimated(p: Product, key: SpecKey, value: number, note: string) {
  (p.specs as Record<string, unknown>)[key] = value;
  p.provenance[key] = { origin: 'estimado', note };
}

// ---------------------------------------------------------------------------
// Lavarropas — Res. 438/2024 Ap. II Tabla 2: la clase sale de C = kWh/ciclo ÷ kg (mismos umbrales en las dos escalas).
// ---------------------------------------------------------------------------

/** Bandas de C (kWh/kg) en escala nueva, con su valor representativo. */
const WASHER_BANDS: Record<string, { max: number; rep: number }> = {
  A: { max: 0.035, rep: 0.034 },
  B: { max: 0.05, rep: 0.0425 },
  C: { max: 0.07, rep: 0.06 },
  D: { max: 0.1, rep: 0.085 },
  E: { max: 0.18, rep: 0.14 },
};
const WASHER_OLD_TO_NEW: Record<string, string> = { 'A+++': 'A', 'A++': 'B', 'A+': 'C', A: 'D', B: 'E' };

export function washerClassFromC(c: number): string | undefined {
  return Object.entries(WASHER_BANDS).find(([, b]) => c <= b.max)?.[0];
}

/** Determina la escala de una clase de lavarropas y su equivalente en escala nueva. */
export function washerScale(label: EnergyLabel, kwhPerCycle?: number, kg?: number): { scale: EnergyLabel['scale']; newCls?: string } {
  const cls = label.cls;
  if (!cls) return { scale: 'desconocida' };
  if (cls.includes('+')) return { scale: 'anterior', newCls: WASHER_OLD_TO_NEW[cls] };
  if (['C', 'D', 'E', 'F', 'G'].includes(cls)) return { scale: 'nueva', newCls: cls }; // la escala 2017 no tiene letras debajo de B
  // A o B: ambiguo. Si hay consumo y capacidad, la clase calculada decide.
  if (kwhPerCycle && kg) {
    const calc = washerClassFromC(kwhPerCycle / kg);
    if (calc === cls) return { scale: 'nueva', newCls: cls };
    if (calc === WASHER_OLD_TO_NEW[cls]) return { scale: 'anterior', newCls: calc };
  }
  return { scale: 'desconocida' };
}

function sanitizeWasher(p: Product) {
  const s = p.specs;
  if (s.kwhPerCycle && s.capacityKg) {
    const c = s.kwhPerCycle / s.capacityKg;
    if (c < 0.015 || c > 0.25) {
      delete s.kwhPerCycle; // fuera de cualquier clase posible: dato de tienda erróneo
      delete p.provenance.kwhPerCycle;
    }
  }
}

function estimateWasher(p: Product, priors: ScalePriors) {
  sanitizeWasher(p);
  const { scale, newCls } = washerScale(p.label, p.specs.kwhPerCycle, p.specs.capacityKg);
  if (p.label.cls) p.label.scale = scale;
  if (p.specs.kwhPerCycle || !p.specs.capacityKg || !p.label.cls) return;
  const cls = p.label.cls;
  const assumed = newCls ? null : priors[cls] ?? 'anterior';
  const band = newCls ?? (assumed === 'nueva' ? cls : WASHER_OLD_TO_NEW[cls]);
  const b = band ? WASHER_BANDS[band] : undefined;
  if (!b) return;
  const kwh = Math.round(b.rep * p.specs.capacityKg * 100) / 100;
  setEstimated(p, 'kwhPerCycle', kwh, `Clase ${cls}${assumed ? ` (escala sin confirmar; se supone la ${assumed})` : ''} → ~${b.rep} kWh/kg × ${p.specs.capacityKg} kg`);
}

// ---------------------------------------------------------------------------
// Heladeras — IEE de IRAM 2404-3:2015 (misma base en las dos etiquetas; Res. 438 Ap. I Tabla 1 solo cambia letras).
// IEE = consumo anual ÷ consumo estándar (SAEC) × 100. Fórmula de SAEC según Reg. UE 1060/2010 Anexo VIII,
// que reproduce valores declarados en fichas argentinas (ver docs/investigacion.md).
// ---------------------------------------------------------------------------

const FRIDGE_OLD_TO_NEW: Record<string, string> = { 'A+++': 'A', 'A++': 'B', 'A+': 'C', A: 'D', B: 'E', C: 'F', D: 'G' };
/** Límites superiores de IEE por clase nueva y valor medio usado para estimar. */
const FRIDGE_BANDS: Record<string, { max: number; mid: number }> = {
  A: { max: 22, mid: 18 },
  B: { max: 33, mid: 27.5 },
  C: { max: 42, mid: 37.5 },
  D: { max: 55, mid: 48.5 },
  E: { max: 75, mid: 65 },
  F: { max: 90, mid: 82.5 },
  G: { max: Infinity, mid: 95 },
};

export function fridgeClassFromIee(iee: number): string {
  return Object.entries(FRIDGE_BANDS).find(([, b]) => iee < b.max)![0];
}

/** Consumo estándar (kWh/año) según tipo y volúmenes netos. Clase climática T supuesta (CC = 1,2). */
export function fridgeSaec(p: Product): number | undefined {
  const s = p.specs;
  const total = s.totalVolumeL;
  if (!total) return undefined;
  const ff = s.frostFree ? 1.2 : 1;
  const CC = 1.2;
  const name = p.name.toLowerCase();
  if (s.fridgeType === 'freezer') {
    const upright = /vertical|apertura frontal/.test(name);
    const [M, N] = upright ? [0.539, 315] : [0.472, 286];
    return M * Math.round(total * 2.15 * ff * CC) + N;
  }
  if (s.fridgeType === 'heladera' || s.fridgeType === 'bajo_mesada') {
    // sin compartimiento de congelados de 3–4 estrellas
    return 0.233 * Math.round(total * CC) + 245;
  }
  // heladera con freezer (categoría 7). Si no se conoce el freezer se supone el 25 % del volumen.
  const frz = s.freezerVolumeL && s.freezerVolumeL < total ? s.freezerVolumeL : total * 0.25;
  const fresh = total - frz;
  return 0.777 * Math.round((fresh + frz * 2.15 * ff) * CC) + 303;
}

export function fridgeScale(label: EnergyLabel, iee?: number): { scale: EnergyLabel['scale']; newCls?: string } {
  const cls = label.cls;
  if (!cls) return { scale: 'desconocida' };
  if (cls.includes('+')) return { scale: 'anterior', newCls: FRIDGE_OLD_TO_NEW[cls] };
  // E, F, G solo existen en la nueva; C y D viejas están por debajo del mínimo legal (clase B), así que hoy son de la nueva.
  if (['C', 'D', 'E', 'F', 'G'].includes(cls)) return { scale: 'nueva', newCls: cls };
  if (iee !== undefined) {
    const calc = fridgeClassFromIee(iee);
    if (calc === cls) return { scale: 'nueva', newCls: cls };
    if (calc === FRIDGE_OLD_TO_NEW[cls]) return { scale: 'anterior', newCls: calc };
  }
  return { scale: 'desconocida' };
}

function prepareFridge(p: Product) {
  const s = p.specs;
  if (!s.fridgeType && /heladera/i.test(p.name) && !/freezer|congelador/i.test(p.name)) s.fridgeType = 'heladera_con_freezer';
  if (s.fridgeType === 'heladera' && (s.freezerVolumeL ?? 0) > 0) s.fridgeType = 'heladera_con_freezer';
  const saec = fridgeSaec(p);
  if (saec && s.kwhPerYear) {
    const iee = (s.kwhPerYear / saec) * 100;
    if (iee < 12 && (s.kwhPerYear * 12 * 100) / saec >= 12 && (s.kwhPerYear * 12 * 100) / saec <= 130) {
      // la tienda publicó kWh por mes
      s.kwhPerYear = Math.round(s.kwhPerYear * 12);
      p.provenance.kwhPerYear = { ...p.provenance.kwhPerYear!, note: 'La tienda lo publica por mes; se multiplicó por 12' };
    } else if (iee < 12 || iee > 130) {
      delete s.kwhPerYear; // imposible para cualquier clase: dato erróneo
      delete p.provenance.kwhPerYear;
    }
  }
  return saec;
}

function estimateFridge(p: Product, saec: number | undefined, priors: ScalePriors) {
  const s = p.specs;
  const iee = saec && s.kwhPerYear ? (s.kwhPerYear / saec) * 100 : undefined;
  const { scale, newCls } = fridgeScale(p.label, iee);
  if (p.label.cls) p.label.scale = scale;
  if (s.kwhPerYear || !saec || !p.label.cls) return;
  const cls = p.label.cls;
  const assumed = newCls ? null : priors[cls] ?? 'anterior';
  const band = FRIDGE_BANDS[newCls ?? (assumed === 'nueva' ? cls : FRIDGE_OLD_TO_NEW[cls]) ?? ''];
  if (!band) return;
  const kwh = Math.round((saec * band.mid) / 100);
  setEstimated(
    p,
    'kwhPerYear',
    kwh,
    `Clase ${cls}${assumed ? ` (escala sin confirmar; se supone la ${assumed})` : ''} → IEE ~${band.mid} × consumo estándar ${Math.round(saec)} kWh/año (±15–25 %)`,
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Agua caliente a gas — ENARGAS NAG-313 (calefones) y NAG-314 (termotanques). La clase sale de la
// eficiencia global ηEE en un día tipo (400 L de 17 a 42 °C), que incluye piloto / mantenimiento.
// Consumo de etiqueta: calefón 392,5/ηEE m³/año; termotanque 39250/ηEE[%] m³/año.
// ---------------------------------------------------------------------------

/** ηEE representativo por clase (fracción). */
const CALEFON_EE: Record<string, number> = { A: 0.84, B: 0.77, C: 0.71, D: 0.65, E: 0.59, F: 0.55 };
const TERMO_EE: Record<string, number> = { A: 0.62, B: 0.56, C: 0.52, D: 0.48, E: 0.44 };
const CALEFON_ETA_U_DEFAULT = 0.8; // supuesto: entre el mínimo de 75 % y el ≥ 80 % de un clase A sin piloto
const TERMO_N_DEFAULT = 75; // ENARGAS 2020; mínimo NAG-314 2019 = 70 %
const TYPICAL_PILOT_M3_DAY = 0.5; // piloto de calefón medido ≈ 0,5 m³/día
const TYPICAL_TERMO_MAINT_M3_DAY = 0.65; // mantenimiento medido 0,51–0,75 m³/día
const GN_KCAL_M3 = 9300;
/** Energía útil del día tipo de la etiqueta, en m³ de gas natural por año (392,5 = 400 L × 25 °C × 365 ÷ 9300) */
const LABEL_USEFUL_M3_YEAR = 392.5;

/** Rendimiento de calentamiento a partir de la recuperación (L/h a +20 °C) y la potencia del quemador, ambos del fabricante. */
function efficiencyFromRecovery(p: Product) {
  const s = p.specs;
  if (s.efficiencyPct || !s.recoveryLH || !s.gasPowerKcalH) return;
  const pct = Math.round(((s.recoveryLH * 20) / s.gasPowerKcalH) * 100);
  if (pct >= 60 && pct <= 95) setEstimated(p, 'efficiencyPct', pct, `Recuperación ${s.recoveryLH} L/h × 20 °C ÷ ${s.gasPowerKcalH} kcal/h (datos del fabricante)`);
}

/** Consumo pasivo (piloto o mantenimiento, m³/día) que hace cerrar el consumo de etiqueta con el rendimiento al calentar. */
function idleFromLabel(labelM3Year: number, effPct: number): number {
  return Math.round((Math.max(0, labelM3Year - LABEL_USEFUL_M3_YEAR / (effPct / 100)) / 365) * 100) / 100;
}

function estimateCalefon(p: Product) {
  const s = p.specs;
  if (p.energy === 'electricidad') return;
  const cls = p.label.cls;
  if (cls) p.label.scale = 'nueva'; // las etiquetas de gas no cambiaron con la Res. 438 (escala única de ENARGAS)
  if (s.labelM3Year) {
    // con el consumo de etiqueta del fabricante: ηEE exacta = 392,5 ÷ consumo
    const ee = LABEL_USEFUL_M3_YEAR / s.labelM3Year;
    if (s.hasPilot === false) {
      if (!s.efficiencyPct) setEstimated(p, 'efficiencyPct', Math.round(ee * 100), `Sin piloto: rendimiento = 392,5 ÷ ${s.labelM3Year} m³/año de la etiqueta`);
      return;
    }
    const eta = s.efficiencyPct ?? CALEFON_ETA_U_DEFAULT * 100;
    if (!s.efficiencyPct) setEstimated(p, 'efficiencyPct', eta, 'Rendimiento supuesto para calefones con piloto');
    if (s.pilotM3PerDay === undefined) setEstimated(p, 'pilotM3PerDay', idleFromLabel(s.labelM3Year, eta), `Etiqueta: ${s.labelM3Year} m³/año menos el gas para calentar → piloto`);
    return;
  }
  const ee = cls ? CALEFON_EE[cls] : undefined;
  // Sin dato de encendido: un clase A casi seguro no tiene piloto; de B para abajo, casi seguro sí.
  if (s.hasPilot === undefined && ee) {
    (s as Record<string, unknown>).hasPilot = cls !== 'A';
    p.provenance.hasPilot = { origin: 'estimado', note: cls === 'A' ? 'Clase A: se supone sin piloto' : `Clase ${cls}: se supone con piloto` };
  }
  if (!ee) {
    if (s.hasPilot !== false && s.pilotM3PerDay === undefined) setEstimated(p, 'pilotM3PerDay', TYPICAL_PILOT_M3_DAY, 'Consumo típico medido de un piloto (sin clase informada)');
    if (!s.efficiencyPct) setEstimated(p, 'efficiencyPct', 75, 'Rendimiento medio del parque instalado (ENARGAS 2020)');
    return;
  }
  if (s.hasPilot === false) {
    if (!s.efficiencyPct) setEstimated(p, 'efficiencyPct', Math.round(ee * 100), `Clase ${cls} sin piloto: rendimiento ≈ eficiencia de la clase`);
    return;
  }
  const etaU = s.efficiencyPct ? s.efficiencyPct / 100 : CALEFON_ETA_U_DEFAULT;
  if (!s.efficiencyPct) setEstimated(p, 'efficiencyPct', Math.round(etaU * 100), 'Rendimiento supuesto para calefones con piloto');
  if (s.pilotM3PerDay === undefined) {
    const vLabel = 392.5 / ee;
    const vPas = Math.min(200, Math.max(0, vLabel - 392.5 / etaU));
    setEstimated(p, 'pilotM3PerDay', Math.round((vPas / 365) * 100) / 100, `Clase ${cls}: consumo de etiqueta ~${Math.round(vLabel)} m³/año menos el uso → piloto`);
  }
}

function estimateTermoGas(p: Product) {
  const s = p.specs;
  if (p.energy === 'electricidad') {
    // Sin dato de etiqueta IRAM 62410: pérdidas típicas de un tanque eléctrico (≈1,2 kWh/día para 80 L)
    if (s.standbyKwhPer24h === undefined && s.storageL) {
      setEstimated(p, 'standbyKwhPer24h', Math.round((0.3 + 0.012 * s.storageL) * 100) / 100, 'Pérdidas típicas según capacidad (sin dato de etiqueta)');
    }
    return;
  }
  const cls = p.label.cls;
  if (cls) p.label.scale = 'nueva';
  efficiencyFromRecovery(p);
  const N = s.efficiencyPct ?? TERMO_N_DEFAULT;
  if (s.labelM3Year && s.maintenanceM3PerDay === undefined) {
    if (!s.efficiencyPct) setEstimated(p, 'efficiencyPct', N, 'Rendimiento típico (ENARGAS 2020)');
    setEstimated(p, 'maintenanceM3PerDay', idleFromLabel(s.labelM3Year, N), `Etiqueta del fabricante: ${s.labelM3Year} m³/año menos el gas para calentar (rendimiento ${N} %) → mantenimiento`);
    return;
  }
  if (!s.efficiencyPct) setEstimated(p, 'efficiencyPct', N, 'Rendimiento típico (ENARGAS 2020)');
  if (s.maintenanceM3PerDay !== undefined) return;
  const ee = cls ? TERMO_EE[cls] : undefined;
  if (!ee || !s.storageL) {
    setEstimated(p, 'maintenanceM3PerDay', TYPICAL_TERMO_MAINT_M3_DAY, 'Consumo de mantenimiento típico medido (sin clase o capacidad informada)');
    return;
  }
  const qn = s.gasPowerKcalH ?? s.storageL * 50;
  const va = 200 + 0.5 * s.storageL + qn / 50;
  const emKcal = 100 * 25 * va * (1 / (ee * 100) - 1 / N);
  const m3 = Math.max(0, emKcal / GN_KCAL_M3);
  setEstimated(p, 'maintenanceM3PerDay', Math.round(m3 * 100) / 100, `Clase ${cls} (ηEE ~${Math.round(ee * 100)} %), ${s.storageL} L → mantenimiento según NAG-314`);
}

// ---------------------------------------------------------------------------
// Aires — Res. 438/2024 Ap. III: clase según IEEE (índice estacional). IRAM 62406:2019 usa los mismos
// cortes con letras A+++…D. Valor representativo por clase (punto medio; A sin techo → 8,5).
// ---------------------------------------------------------------------------

const AC_IEEE: Record<string, number> = { A: 8.5, B: 7.05, C: 4.6, D: 3.5, E: 3.29, F: 3.08, G: 2.9 };
const AC_OLD_TO_NEW: Record<string, string> = { 'A+++': 'A', 'A++': 'B', 'A+': 'C', A: 'D', B: 'E', C: 'F', D: 'G' };
const AC_COP_DEFAULT = 3.4;

function acClassFromIndex(idx: number): string {
  if (idx > 8.5) return 'A';
  if (idx > 5.6) return 'B';
  if (idx > 3.6) return 'C';
  if (idx > 3.39) return 'D';
  if (idx > 3.18) return 'E';
  if (idx > 2.97) return 'F';
  return 'G';
}

export function acScale(label: EnergyLabel, eer?: number): { scale: EnergyLabel['scale']; newCls?: string } {
  const cls = label.cls;
  if (!cls) return { scale: 'desconocida' };
  if (cls.includes('+')) return { scale: 'anterior', newCls: AC_OLD_TO_NEW[cls] };
  if (['E', 'F', 'G'].includes(cls)) return { scale: 'nueva', newCls: cls };
  if (eer) {
    const calc = acClassFromIndex(eer);
    if (calc === cls) return { scale: 'nueva', newCls: cls };
    if (calc === AC_OLD_TO_NEW[cls]) return { scale: 'anterior', newCls: calc };
  }
  return { scale: 'desconocida' };
}

function estimateAc(p: Product, priors: ScalePriors) {
  const s = p.specs;
  const { scale, newCls } = acScale(p.label, s.seer ?? s.eer);
  if (p.label.cls) p.label.scale = scale;
  if (s.heatPump && !s.cop && !s.scop) setEstimated(p, 'cop', AC_COP_DEFAULT, 'COP típico de equipos frío/calor (no informado)');
  if (s.seer || s.eer || !p.label.cls || !s.coolingCapacityW) return;
  const cls = p.label.cls;
  const assumed = newCls ? null : priors[cls] ?? 'anterior';
  const idx = AC_IEEE[newCls ?? (assumed === 'nueva' ? cls : AC_OLD_TO_NEW[cls]) ?? ''];
  if (!idx) return;
  setEstimated(p, 'seer', idx, `Clase ${cls}${assumed ? ` (escala sin confirmar; se supone la ${assumed})` : ''} → índice estacional ~${idx} (±20 %)`);
}

// ---------------------------------------------------------------------------
// Letras ambiguas (A, B…): cuál escala suponer se aprende de los propios datos. Entre los productos que sí
// informan consumo, se mira en qué escala cae cada letra y se usa la mayoría (sin datos: la anterior,
// que es la interpretación menos eficiente y no exagera ahorros).
// ---------------------------------------------------------------------------

type ScalePriors = Record<string, 'nueva' | 'anterior'>;

function learnPriors(resolved: { cls: string | null; scale: EnergyLabel['scale'] }[]): ScalePriors {
  const votes = new Map<string, { nueva: number; anterior: number }>();
  for (const r of resolved) {
    if (!r.cls || r.cls.includes('+') || r.scale === 'desconocida') continue;
    const v = votes.get(r.cls) ?? { nueva: 0, anterior: 0 };
    v[r.scale]++;
    votes.set(r.cls, v);
  }
  const priors: ScalePriors = {};
  for (const [cls, v] of votes) if (v.nueva + v.anterior >= 3) priors[cls] = v.nueva > v.anterior ? 'nueva' : 'anterior';
  return priors;
}

export function applyEstimates(products: Product[]): void {
  const fridges = products.filter((p) => p.category === 'heladeras');
  const saecs = new Map(fridges.map((p) => [p, prepareFridge(p)]));
  const fridgePriors = learnPriors(
    fridges
      .filter((p) => p.specs.kwhPerYear && saecs.get(p))
      .map((p) => ({ cls: p.label.cls, scale: fridgeScale(p.label, (p.specs.kwhPerYear! / saecs.get(p)!) * 100).scale })),
  );
  for (const p of fridges) estimateFridge(p, saecs.get(p), fridgePriors);

  const washers = products.filter((p) => p.category === 'lavarropas');
  washers.forEach(sanitizeWasher);
  const washerPriors = learnPriors(washers.filter((p) => p.specs.kwhPerCycle).map((p) => ({ cls: p.label.cls, scale: washerScale(p.label, p.specs.kwhPerCycle, p.specs.capacityKg).scale })));
  for (const p of washers) estimateWasher(p, washerPriors);

  const acs = products.filter((p) => p.category === 'aires');
  const acPriors = learnPriors(acs.filter((p) => p.specs.eer).map((p) => ({ cls: p.label.cls, scale: acScale(p.label, p.specs.eer).scale })));
  for (const p of acs) estimateAc(p, acPriors);

  for (const p of products) {
    if (p.category === 'calefones') estimateCalefon(p);
    if (p.category === 'termotanques') estimateTermoGas(p);
  }
}
