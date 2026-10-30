import type { Product } from '../types';
import { ASSUMPTIONS, EMISSIONS, PHYSICS } from './constants';
import type { CostRow, EnergyEstimate, Scenario, Tariffs, Usage } from './types';

const fmt = (v: number, d = 0) => v.toLocaleString('es-AR', { maximumFractionDigits: d });

function isEstimated(p: Product, key: keyof Product['specs']): boolean {
  return p.provenance[key]?.origin === 'estimado';
}

/** Energía anual para calentar el agua del hogar (kcal/año). */
export function hotWaterDemandKcalYear(u: Usage): number {
  const dT = Math.max(0, u.hotWaterTempC - u.coldWaterTempC);
  return u.people * u.hotWaterLPerPersonDay * dT * PHYSICS.waterKcalPerLC.value * 365;
}

/** Frigorías que necesita el ambiente: volumen × frigorías por m³, con recargo si tiene mucho sol o es último piso. */
export function acRequiredFrigorias(u: Usage): number {
  const f = u.acAreaM2 * u.acCeilingM * ASSUMPTIONS.acFrigoriasPerM3 * (u.acHighLoad ? ASSUMPTIONS.acHighLoadFactor : 1);
  return Math.round(f / 50) * 50;
}

/** Rango de frigorías adecuado para el ambiente [mínimo, máximo], redondeado a 50. */
export function acCapacityRange(u: Usage): [number, number] {
  const need = acRequiredFrigorias(u);
  const [lo, hi] = ASSUMPTIONS.acSizeTolerance;
  return [Math.floor((need * lo) / 50) * 50, Math.ceil((need * hi) / 50) * 50];
}

/** kcal/h que necesita el ambiente para calefaccionarlo. */
export function heatRequiredKcalH(u: Usage): number {
  const f = u.acAreaM2 * u.acCeilingM * ASSUMPTIONS.heatKcalPerM3 * (u.acHighLoad ? ASSUMPTIONS.acHighLoadFactor : 1);
  return Math.round(f / 50) * 50;
}

/** Rango de potencia (kcal/h) adecuado para una estufa en ese ambiente. */
export function heaterCapacityRange(u: Usage): [number, number] {
  const need = heatRequiredKcalH(u);
  const [lo, hi] = ASSUMPTIONS.heaterSizeTolerance;
  return [Math.floor((need * lo) / 100) * 100, Math.ceil((need * hi) / 100) * 100];
}

/** Calor que entrega una estufa (kcal/h): la potencia a gas tal como se vende, o los watts eléctricos × 0,86. */
export function heaterKcalH(p: Product): number | undefined {
  if (p.specs.gasPowerKcalH) return p.specs.gasPowerKcalH;
  if (p.specs.powerW) return Math.round(p.specs.powerW / (PHYSICS.kwhPerKcal.value * 1000));
  return undefined;
}

function empty(basis: EnergyEstimate['basis'], steps: string[]): EnergyEstimate {
  return { kwhYear: 0, m3Year: 0, kgGlpYear: 0, waterLYear: 0, basis, steps };
}

export function estimateEnergy(p: Product, u: Usage, gasKind: Tariffs['gasKind']): EnergyEstimate | null {
  const s = p.specs;
  switch (p.category) {
    case 'heladeras': {
      if (!s.kwhPerYear) return null;
      const est = isEstimated(p, 'kwhPerYear');
      return {
        ...empty(est ? 'estimado' : 'etiqueta', [
          est
            ? `Consumo estimado en ${fmt(s.kwhPerYear)} kWh/año a partir de su clase y volumen (la tienda no informa el consumo).`
            : `Consumo declarado en la etiqueta: ${fmt(s.kwhPerYear)} kWh/año.`,
        ]),
        kwhYear: s.kwhPerYear,
      };
    }

    case 'aires': {
      // La energía depende del ambiente (su carga térmica), no del tamaño del equipo: el equipo solo define con qué
      // eficiencia la entrega. Así dos equipos adecuados se comparan por su índice y no "gasta más" el más grande.
      const lf = ASSUMPTIONS.acLoadFactor;
      const steps: string[] = [];
      let kwh = 0;
      let basis: EnergyEstimate['basis'] = 'etiqueta';
      const coolEff = s.seer ?? s.eer ?? (s.coolingCapacityW && s.coolingPowerW ? s.coolingCapacityW / s.coolingPowerW : undefined);
      if (!s.coolingCapacityW || !coolEff) return null;
      if (isEstimated(p, s.seer ? 'seer' : 'eer') || isEstimated(p, 'coolingCapacityW')) basis = 'estimado';
      const needFrig = acRequiredFrigorias(u);
      const needW = needFrig * PHYSICS.wattsPerFrigoria.value;
      steps.push(
        `Tu ambiente: ${fmt(u.acAreaM2)} m² × ${fmt(u.acCeilingM, 1)} m × ${ASSUMPTIONS.acFrigoriasPerM3} frigorías/m³${u.acHighLoad ? ` × ${fmt(ASSUMPTIONS.acHighLoadFactor, 1)} (sol o último piso)` : ''} = ${fmt(needFrig)} frigorías (${fmt(needW)} W).`,
      );
      const capFrig = s.coolingCapacityW / PHYSICS.wattsPerFrigoria.value;
      if (capFrig < needFrig * ASSUMPTIONS.acSizeTolerance[0]) {
        steps.push(`Ojo: con ${fmt(capFrig)} frigorías este equipo queda chico para tu ambiente y no llegaría a la temperatura en los días más exigentes.`);
      }
      const coolKwh = (needW * u.acCoolingHoursYear * lf) / coolEff / 1000;
      kwh += coolKwh;
      steps.push(
        `Frío: ${fmt(needW)} W × ${fmt(u.acCoolingHoursYear)} h/año × ${fmt(lf * 100)}% de carga media ÷ ${s.seer ? 'SEER' : 'EER'} ${fmt(coolEff, 2)} = ${fmt(coolKwh)} kWh/año.`,
      );
      if (u.acUseHeating && s.heatPump !== false) {
        const heatEff = s.scop ?? s.cop ?? coolEff;
        if ((!s.cop && !s.scop) || isEstimated(p, 'cop')) basis = 'estimado';
        const heatKwh = (needW * u.acHeatingHoursYear * lf) / heatEff / 1000;
        kwh += heatKwh;
        steps.push(`Calor: ${fmt(needW)} W × ${fmt(u.acHeatingHoursYear)} h/año × ${fmt(lf * 100)}% ÷ ${s.scop ? 'SCOP' : 'COP'} ${fmt(heatEff, 2)} = ${fmt(heatKwh)} kWh/año.`);
      }
      return { ...empty(basis, steps), kwhYear: kwh };
    }

    case 'lavarropas': {
      if (!s.kwhPerCycle) return null;
      const cycles = u.washCyclesPerWeek * 52;
      const kwh = s.kwhPerCycle * cycles;
      const water = (s.waterLPerCycle ?? 0) * cycles;
      return {
        ...empty(isEstimated(p, 'kwhPerCycle') ? 'estimado' : 'etiqueta', [
          `${fmt(s.kwhPerCycle, 2)} kWh por lavado × ${fmt(cycles)} lavados/año = ${fmt(kwh)} kWh/año.`,
          ...(s.waterLPerCycle ? [`Agua: ${fmt(s.waterLPerCycle)} L por lavado → ${fmt(water / 1000, 1)} m³/año.`] : []),
        ]),
        kwhYear: kwh,
        waterLYear: water,
      };
    }

    case 'calefactores': {
      // Igual que en aires: la energía la define el ambiente; el equipo define cuánto de su gas o su luz se vuelve calor.
      const need = heatRequiredKcalH(u);
      const hours = u.heatingDaysYear * u.heatingHoursDay;
      const lf = ASSUMPTIONS.acLoadFactor;
      const heat = need * hours * lf;
      const steps = [
        `Tu ambiente: ${fmt(u.acAreaM2)} m² × ${fmt(u.acCeilingM, 1)} m × ${ASSUMPTIONS.heatKcalPerM3} kcal/h por m³${u.acHighLoad ? ` × ${fmt(ASSUMPTIONS.acHighLoadFactor, 1)}` : ''} = ${fmt(need)} kcal/h.`,
        `Calor por año: ${fmt(need)} kcal/h × ${fmt(hours)} h (${u.heatingDaysYear} días × ${u.heatingHoursDay} h) × ${fmt(lf * 100)}% de carga media = ${fmt(heat / 1000)} mil kcal.`,
      ];
      const cap = heaterKcalH(p);
      if (cap && cap < need * ASSUMPTIONS.heaterSizeTolerance[0]) {
        steps.push(`Ojo: con ${fmt(cap)} kcal/h este equipo queda chico para tu ambiente.`);
      }
      if (p.energy === 'electricidad') {
        const kwh = heat * PHYSICS.kwhPerKcal.value;
        steps.push(`Eléctrica: toda la electricidad se vuelve calor (100 %), así que todas las estufas eléctricas gastan lo mismo para el mismo calor: ${fmt(kwh)} kWh/año.`);
        return { ...empty('etiqueta', steps), kwhYear: kwh };
      }
      let basis: EnergyEstimate['basis'] = 'etiqueta';
      const vented = s.roomHeaterType === 'tiro_balanceado';
      const effPct = s.efficiencyPct;
      const eff = effPct ? effPct / 100 : vented ? ASSUMPTIONS.balancedFlueEfficiencyFallback : 1;
      if (vented && (!effPct || isEstimated(p, 'efficiencyPct'))) basis = 'estimado';
      const pc = gasKind === 'envasado' ? PHYSICS.glpKcalPerKg.value : PHYSICS.gasNaturalKcalPerM3.value;
      const unit = gasKind === 'envasado' ? 'kg' : 'm³';
      const heatUnits = heat / (eff * pc);
      steps.push(
        vented
          ? `Tiro balanceado: ÷ rendimiento ${fmt(eff * 100)}%${effPct ? '' : ' (supuesto)'} (el resto sale por el tiro) = ${fmt(heatUnits)} ${unit}/año.`
          : `Sin salida al exterior: todo el calor queda en el ambiente = ${fmt(heatUnits)} ${unit}/año. Necesita ventilación permanente: no es apta para dormitorios ni baños.`,
      );
      let idle = 0;
      if (s.hasPilot !== false) {
        const m3Day = s.pilotM3PerDay ?? ASSUMPTIONS.heaterPilotM3PerDay;
        if (s.hasPilot === undefined || s.pilotM3PerDay === undefined) basis = 'estimado';
        const perDay = gasKind === 'envasado' ? (m3Day * PHYSICS.gasNaturalKcalPerM3.value) / PHYSICS.glpKcalPerKg.value : m3Day;
        idle = perDay * u.heatingDaysYear;
        steps.push(`Piloto encendido toda la temporada${s.hasPilot === undefined ? ' (supuesto)' : ''}: ${fmt(perDay, 2)} ${unit}/día × ${u.heatingDaysYear} días = ${fmt(idle)} ${unit}/año.`);
      } else {
        steps.push('Sin piloto: no consume gas cuando está apagado.');
      }
      const total = heatUnits + idle;
      return { ...empty(basis, steps), m3Year: gasKind === 'natural' ? total : 0, kgGlpYear: gasKind === 'envasado' ? total : 0 };
    }

    case 'calefones':
    case 'termotanques': {
      const demand = hotWaterDemandKcalYear(u);
      const steps = [
        `Agua caliente: ${u.people} personas × ${u.hotWaterLPerPersonDay} L/día × ${u.hotWaterTempC - u.coldWaterTempC} °C × 365 = ${fmt(demand / 1000)} mil kcal/año.`,
      ];
      if (p.energy === 'electricidad') {
        const isHeatPump = s.heaterType === 'bomba_de_calor';
        const eff = isHeatPump ? (s.cop ?? ASSUMPTIONS.heatPumpWaterCopFallback) : ASSUMPTIONS.electricHeaterEfficiency;
        const heatKwh = (demand * PHYSICS.kwhPerKcal.value) / eff;
        const standby = (s.standbyKwhPer24h ?? 0) * 365;
        steps.push(`Calentar: ${fmt(heatKwh)} kWh/año (${isHeatPump ? `COP ${fmt(eff, 1)}` : `rendimiento ${fmt(eff * 100)}%`}).`);
        if (s.standbyKwhPer24h) steps.push(`Mantener caliente: ${fmt(s.standbyKwhPer24h, 2)} kWh/día × 365 = ${fmt(standby)} kWh/año.`);
        const basis = (s.standbyKwhPer24h && !isEstimated(p, 'standbyKwhPer24h')) || p.category === 'calefones' ? 'etiqueta' : 'estimado';
        return { ...empty(basis, steps), kwhYear: heatKwh + standby };
      }
      // Gas
      let basis: EnergyEstimate['basis'] = 'etiqueta';
      const effPct = s.efficiencyPct;
      const eff = effPct ? effPct / 100 : ASSUMPTIONS.gasHeaterEfficiencyFallback;
      if (!effPct || isEstimated(p, 'efficiencyPct')) basis = 'estimado';
      const pc = gasKind === 'envasado' ? PHYSICS.glpKcalPerKg.value : PHYSICS.gasNaturalKcalPerM3.value;
      const heatUnits = demand / (eff * pc);
      let idleM3Day = 0;
      if (s.maintenanceM3PerDay !== undefined) {
        idleM3Day = s.maintenanceM3PerDay;
        if (isEstimated(p, 'maintenanceM3PerDay')) basis = 'estimado';
      } else if (s.hasPilot !== false) {
        idleM3Day = s.pilotM3PerDay ?? ASSUMPTIONS.pilotM3PerDayFallback;
        if (s.pilotM3PerDay === undefined || isEstimated(p, 'pilotM3PerDay') || isEstimated(p, 'hasPilot')) basis = 'estimado';
      }
      // el consumo pasivo viene en m³ de gas natural; se pasa a kg de GLP por energía equivalente
      const idleUnits = gasKind === 'envasado' ? (idleM3Day * PHYSICS.gasNaturalKcalPerM3.value) / PHYSICS.glpKcalPerKg.value : idleM3Day;
      const unit = gasKind === 'envasado' ? 'kg' : 'm³';
      steps.push(`Calentar: ÷ rendimiento ${fmt(eff * 100)}%${effPct ? '' : ' (supuesto)'} = ${fmt(heatUnits)} ${unit}/año.`);
      if (idleM3Day > 0) {
        steps.push(
          `${s.maintenanceM3PerDay !== undefined ? 'Consumo de mantenimiento' : 'Piloto encendido'}: ${fmt(idleUnits, 2)} ${unit}/día × 365 = ${fmt(idleUnits * 365)} ${unit}/año.`,
        );
      } else {
        steps.push('Sin piloto: no consume gas cuando no se usa.');
      }
      // con el consumo de etiqueta del fabricante, rendimiento y consumo pasivo se derivan de él: el total a uso normalizado es exacto
      if (s.labelM3Year && !isEstimated(p, 'labelM3Year')) {
        basis = 'etiqueta';
        steps.push(`Calibrado con la etiqueta ENARGAS: ${fmt(s.labelM3Year)} m³/año de gas natural en condiciones normalizadas.`);
      }
      const total = heatUnits + idleUnits * 365;
      return {
        ...empty(basis, steps),
        m3Year: gasKind === 'natural' ? total : 0,
        kgGlpYear: gasKind === 'envasado' ? total : 0,
      };
    }
  }
}

export function annualCost(e: EnergyEstimate, t: Tariffs): number {
  return e.kwhYear * t.electricityPerKwh + e.m3Year * t.gasNaturalPerM3 + e.kgGlpYear * t.glpPerKg;
}

export function co2KgYear(e: EnergyEstimate): number {
  return e.kwhYear * EMISSIONS.gridKgCo2PerKwh.value + e.m3Year * EMISSIONS.gasKgCo2PerM3.value + e.kgGlpYear * EMISSIONS.glpKgCo2PerKg.value;
}

/** Energía acumulada al final de cada año, con aumento real de tarifa compuesto. */
export function cumulativeEnergy(firstYear: number, s: Scenario): number[] {
  const g = s.realTariffGrowthPct / 100;
  const out: number[] = [];
  let acc = 0;
  for (let k = 0; k < s.years; k++) {
    acc += firstYear * (1 + g) ** k;
    out.push(acc);
  }
  return out;
}

export function computeRow(p: Product, u: Usage, t: Tariffs, s: Scenario): CostRow {
  const estimate = estimateEnergy(p, u, t.gasKind);
  const annual = estimate ? annualCost(estimate, t) : null;
  const energyByYear = annual !== null ? cumulativeEnergy(annual, s) : [];
  const price = p.priceMin;
  return {
    product: p,
    price,
    estimate,
    annualEnergyCost: annual,
    energyByYear,
    tco: price !== null && annual !== null ? price + (energyByYear.at(-1) ?? 0) : null,
    co2KgYear: estimate ? co2KgYear(estimate) : null,
  };
}

/** Serie de costo acumulado [compra, fin año 1, …, fin año N]. */
export function cumulativeTotal(r: CostRow): number[] {
  if (r.price === null) return [];
  return [r.price, ...r.energyByYear.map((e) => r.price! + e)];
}

/**
 * Años hasta que el equipo más caro de comprar (b) iguala el costo total del más barato (a).
 * Devuelve 0 si b ya es más barato o igual de entrada, Infinity si nunca lo alcanza (en 50 años).
 */
export function paybackYears(a: CostRow, b: CostRow, s: Scenario): number {
  if (a.price === null || b.price === null || a.annualEnergyCost === null || b.annualEnergyCost === null) return Number.NaN;
  const extra = b.price - a.price;
  if (extra <= 0) return 0;
  const saving = a.annualEnergyCost - b.annualEnergyCost;
  if (saving <= 0) return Number.POSITIVE_INFINITY;
  const g = s.realTariffGrowthPct / 100;
  let acc = 0;
  for (let k = 0; k < 50; k++) {
    const yearSaving = saving * (1 + g) ** k;
    if (acc + yearSaving >= extra) return k + (extra - acc) / yearSaving;
    acc += yearSaving;
  }
  return Number.POSITIVE_INFINITY;
}
