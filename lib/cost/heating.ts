// Comparación de calefacción entre tecnologías para un mismo ambiente: aires frío/calor, calefactores a gas y estufas
// eléctricas. Reusa el cálculo de cada categoría; acá solo se arma un uso equivalente y se agrupan los equipos.
import type { Product } from '../types';
import { acCapacityRange, computeRow, heaterCapacityRange, heaterKcalH } from './estimate';
import { PHYSICS } from './constants';
import type { CostRow, Scenario, Tariffs, Usage } from './types';

export type HeatingTechId = 'aire' | 'tiro_balanceado' | 'sin_salida' | 'electrica';

export interface HeatingTech {
  id: HeatingTechId;
  name: string;
  category: 'aires' | 'calefactores';
  /** Qué hay que saber además del costo */
  note: string;
  /** Advertencia de seguridad, si corresponde */
  warning?: string;
  match: (p: Product) => boolean;
}

const isGas = (p: Product) => p.energy !== 'electricidad';
const unvented = new Set(['sin_salida', 'infrarroja', 'catalitica']);

export const HEATING_TECHS: HeatingTech[] = [
  {
    id: 'aire',
    name: 'Aire acondicionado frío/calor',
    category: 'aires',
    note: 'Es una bomba de calor: da 3 a 4 kWh de calor por cada kWh de luz, y en verano también enfría. Rinde menos con heladas fuertes.',
    match: (p) => p.specs.heatPump === true,
  },
  {
    id: 'tiro_balanceado',
    name: 'Calefactor de tiro balanceado',
    category: 'calefactores',
    note: 'Toma y larga el aire afuera: es el único a gas apto para dormitorios. Necesita instalación con salida al exterior.',
    match: (p) => isGas(p) && p.specs.roomHeaterType === 'tiro_balanceado',
  },
  {
    id: 'sin_salida',
    name: 'Estufa a gas sin salida',
    category: 'calefactores',
    note: 'Incluye infrarrojas y catalíticas. Todo el calor queda adentro, pero también los gases de la combustión.',
    warning: 'No es apta para dormitorios ni baños y necesita ventilación permanente.',
    match: (p) => isGas(p) && unvented.has(p.specs.roomHeaterType ?? ''),
  },
  {
    id: 'electrica',
    name: 'Estufa eléctrica',
    category: 'calefactores',
    note: 'Caloventor, convector, panel, radiador, cuarzo: todas convierten 1 kWh de luz en 1 kWh de calor. Baratas de comprar, caras de usar.',
    match: (p) => p.energy === 'electricidad',
  },
];

/** Uso equivalente para un aire: solo calor, las mismas horas que la estufa. */
export function heatingUsageForAc(u: Usage): Usage {
  return { ...u, acUseHeating: true, acCoolingHoursYear: 0, acHeatingHoursYear: u.heatingDaysYear * u.heatingHoursDay };
}

export function gasCompatible(p: Product, kind: Tariffs['gasKind']): boolean {
  if (p.energy === 'electricidad' || p.energy === 'multigas') return true;
  return kind === 'natural' ? p.energy === 'gas_natural' : p.energy === 'gas_envasado';
}

/** ¿El equipo tiene el tamaño adecuado para el ambiente? */
export function fitsRoom(p: Product, u: Usage): boolean {
  if (p.category === 'aires') {
    if (!p.specs.coolingCapacityW) return false;
    const frig = p.specs.coolingCapacityW / PHYSICS.wattsPerFrigoria.value;
    const [lo, hi] = acCapacityRange(u);
    return frig >= lo && frig <= hi;
  }
  const kcal = heaterKcalH(p);
  if (!kcal) return false;
  const [lo, hi] = heaterCapacityRange(u);
  return kcal >= lo && kcal <= hi;
}

export interface HeatingOption {
  tech: HeatingTech;
  /** Menor costo total entre los equipos del tamaño adecuado */
  best: CostRow | null;
  /** Más barato de comprar entre los del tamaño adecuado */
  cheapest: CostRow | null;
  /** Equipos del tamaño adecuado con precio y consumo */
  count: number;
  /**
   * Gasto de energía anual típico (mediana). La energía la define el ambiente, no el tamaño del equipo,
   * así que se calcula con todos los equipos de la tecnología aunque ninguno tenga el tamaño justo.
   */
  annualEnergyCost: number | null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Agrupa los equipos por tecnología, ordenadas de menor a mayor costo total (las sin equipos, al final por gasto anual). */
export function compareHeating(products: Product[], u: Usage, t: Tariffs, s: Scenario): HeatingOption[] {
  const acUsage = heatingUsageForAc(u);
  const options = HEATING_TECHS.map((tech): HeatingOption => {
    const rows = products
      .filter((p) => p.category === tech.category && tech.match(p) && gasCompatible(p, t.gasKind))
      .map((p) => computeRow(p, tech.category === 'aires' ? acUsage : u, t, s));
    const sized = rows.filter((r) => r.tco !== null && fitsRoom(r.product, u));
    const pick = (key: (r: CostRow) => number) => (sized.length ? sized.reduce((a, b) => (key(b) < key(a) ? b : a)) : null);
    return {
      tech,
      best: pick((r) => r.tco!),
      cheapest: pick((r) => r.price!),
      count: sized.length,
      annualEnergyCost: median(rows.map((r) => r.annualEnergyCost).filter((x): x is number => x !== null)),
    };
  });
  const key = (o: HeatingOption) => o.best?.tco ?? Number.POSITIVE_INFINITY;
  return options.sort((a, b) => key(a) - key(b) || (a.annualEnergyCost ?? Infinity) - (b.annualEnergyCost ?? Infinity));
}
