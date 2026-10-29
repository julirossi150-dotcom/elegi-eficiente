import type { CategoryId, Product } from './types';

const n0 = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 0 });
const n1 = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 1 });

export const CAPACITY_UNIT: Record<CategoryId, { label: string; unit: string }> = {
  heladeras: { label: 'Capacidad', unit: 'L' },
  aires: { label: 'Potencia de frío', unit: 'frigorías' },
  lavarropas: { label: 'Carga', unit: 'kg' },
  calefones: { label: 'Caudal', unit: 'L/min' },
  termotanques: { label: 'Capacidad', unit: 'L' },
};

export function frigoriasOf(p: Product): number | undefined {
  const s = p.specs;
  if (s.frigorias) return s.frigorias;
  if (s.coolingCapacityW) return Math.round(s.coolingCapacityW / 1.163);
  return undefined;
}

/** Número principal de tamaño, para filtros y orden. */
export function capacityOf(p: Product): number | undefined {
  const s = p.specs;
  switch (p.category) {
    case 'heladeras':
      return s.totalVolumeL;
    case 'aires':
      return frigoriasOf(p);
    case 'lavarropas':
      return s.capacityKg;
    case 'calefones':
      return s.flowLMin;
    case 'termotanques':
      return s.storageL;
  }
}

const FRIDGE_TYPE: Record<string, string> = {
  heladera: 'Heladera',
  heladera_con_freezer: 'Con freezer',
  freezer: 'Freezer',
  bajo_mesada: 'Bajo mesada',
  side_by_side: 'Side by side',
};

export const ENERGY_LABEL: Record<Product['energy'], string> = {
  electricidad: 'Eléctrico',
  gas_natural: 'Gas natural',
  gas_envasado: 'Gas envasado',
  multigas: 'Multigas',
};

/** Etiquetas cortas de las características principales. */
export function specChips(p: Product): string[] {
  const s = p.specs;
  const cap = capacityOf(p);
  const chips: string[] = [];
  switch (p.category) {
    case 'heladeras':
      if (cap) chips.push(`${n0(cap)} L`);
      if (s.fridgeType) chips.push(FRIDGE_TYPE[s.fridgeType] ?? s.fridgeType);
      if (s.frostFree !== undefined) chips.push(s.frostFree ? 'No Frost' : 'Cíclica');
      break;
    case 'aires':
      if (cap) chips.push(`${n0(cap)} frigorías`);
      if (s.inverter !== undefined) chips.push(s.inverter ? 'Inverter' : 'On/Off');
      if (s.heatPump !== undefined) chips.push(s.heatPump ? 'Frío/calor' : 'Solo frío');
      if (s.acType && s.acType !== 'split') chips.push(s.acType === 'portatil' ? 'Portátil' : s.acType === 'ventana' ? 'Ventana' : 'Otro');
      break;
    case 'lavarropas':
      if (cap) chips.push(`${n1(cap)} kg`);
      if (s.loading) chips.push(s.loading === 'frontal' ? 'Carga frontal' : 'Carga superior');
      if (s.washerType === 'lavasecarropas') chips.push('Lavasecarropas');
      if (s.washerType === 'semiautomatico') chips.push('Semiautomático');
      break;
    case 'calefones':
      if (cap) chips.push(`${n0(cap)} L/min`);
      chips.push(ENERGY_LABEL[p.energy]);
      if (s.hasPilot !== undefined) chips.push(s.hasPilot ? 'Con piloto' : 'Sin piloto');
      break;
    case 'termotanques':
      if (cap) chips.push(`${n0(cap)} L`);
      chips.push(ENERGY_LABEL[p.energy]);
      if (s.heaterType === 'bomba_de_calor') chips.push('Bomba de calor');
      break;
  }
  return chips;
}

/** Tipo/subcategoría para el filtro rápido. */
export function subtypeOf(p: Product): string | undefined {
  const s = p.specs;
  switch (p.category) {
    case 'heladeras':
      return s.fridgeType ? FRIDGE_TYPE[s.fridgeType] : undefined;
    case 'aires':
      return s.inverter === undefined ? undefined : s.inverter ? 'Inverter' : 'On/Off';
    case 'lavarropas':
      return s.loading === 'frontal' ? 'Carga frontal' : s.loading === 'superior' ? 'Carga superior' : undefined;
    case 'calefones':
    case 'termotanques':
      return ENERGY_LABEL[p.energy];
  }
}

/** Filas de especificaciones para la vista de comparación. [etiqueta, valor] */
export function specRows(p: Product): [string, string][] {
  const s = p.specs;
  const rows: [string, string | undefined][] = [];
  const kw = (w?: number) => (w ? `${n0(w)} W` : undefined);
  switch (p.category) {
    case 'heladeras':
      rows.push(['Volumen total', s.totalVolumeL ? `${n0(s.totalVolumeL)} L` : undefined]);
      rows.push(['Volumen freezer', s.freezerVolumeL ? `${n0(s.freezerVolumeL)} L` : undefined]);
      rows.push(['Consumo (etiqueta)', s.kwhPerYear ? `${n0(s.kwhPerYear)} kWh/año` : undefined]);
      break;
    case 'aires':
      rows.push(['Capacidad de frío', s.coolingCapacityW ? `${n0(s.coolingCapacityW)} W (${n0(frigoriasOf(p) ?? 0)} frig.)` : undefined]);
      rows.push(['Capacidad de calor', kw(s.heatingCapacityW)]);
      rows.push(['EER', s.eer ? n1(s.eer) : undefined]);
      rows.push(['SEER', s.seer ? n1(s.seer) : undefined]);
      rows.push(['COP', s.cop ? n1(s.cop) : undefined]);
      break;
    case 'lavarropas':
      rows.push(['Carga', s.capacityKg ? `${n1(s.capacityKg)} kg` : undefined]);
      rows.push(['Energía por lavado', s.kwhPerCycle ? `${s.kwhPerCycle.toLocaleString('es-AR', { maximumFractionDigits: 2 })} kWh` : undefined]);
      rows.push(['Agua por lavado', s.waterLPerCycle ? `${n0(s.waterLPerCycle)} L` : undefined]);
      break;
    case 'calefones':
    case 'termotanques':
      rows.push(['Caudal', s.flowLMin ? `${n0(s.flowLMin)} L/min` : undefined]);
      rows.push(['Capacidad', s.storageL ? `${n0(s.storageL)} L` : undefined]);
      rows.push(['Consumo de etiqueta', s.labelM3Year ? `${n0(s.labelM3Year)} m³/año` : undefined]);
      rows.push(['Rendimiento', s.efficiencyPct ? `${n0(s.efficiencyPct)} %` : undefined]);
      rows.push(['Piloto', s.hasPilot === undefined ? undefined : s.hasPilot ? 'Sí' : 'No']);
      rows.push(['Consumo de mantenimiento', s.maintenanceM3PerDay !== undefined ? `${n1(s.maintenanceM3PerDay)} m³/día` : s.standbyKwhPer24h ? `${n1(s.standbyKwhPer24h)} kWh/día` : undefined]);
      break;
  }
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}
