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
      const lf = ASSUMPTIONS.acLoadFactor;
      const steps: string[] = [];
      let kwh = 0;
      let basis: EnergyEstimate['basis'] = 'etiqueta';
      const coolEff = s.seer ?? s.eer ?? (s.coolingCapacityW && s.coolingPowerW ? s.coolingCapacityW / s.coolingPowerW : undefined);
      if (!s.coolingCapacityW || !coolEff) return null;
      if (isEstimated(p, s.seer ? 'seer' : 'eer') || isEstimated(p, 'coolingCapacityW')) basis = 'estimado';
      const coolKwh = (s.coolingCapacityW * u.acCoolingHoursYear * lf) / coolEff / 1000;
      kwh += coolKwh;
      steps.push(
        `Frío: ${fmt(s.coolingCapacityW)} W de capacidad × ${fmt(u.acCoolingHoursYear)} h/año × ${fmt(lf * 100)}% de carga media ÷ ${s.seer ? 'SEER' : 'EER'} ${fmt(coolEff, 2)} = ${fmt(coolKwh)} kWh/año.`,
      );
      if (u.acUseHeating && s.heatPump !== false && (s.heatingCapacityW || s.coolingCapacityW)) {
        const cap = s.heatingCapacityW ?? s.coolingCapacityW;
        const heatEff = s.scop ?? s.cop ?? coolEff;
        if ((!s.cop && !s.scop) || isEstimated(p, 'cop')) basis = 'estimado';
        const heatKwh = (cap * u.acHeatingHoursYear * lf) / heatEff / 1000;
        kwh += heatKwh;
        steps.push(`Calor: ${fmt(cap)} W × ${fmt(u.acHeatingHoursYear)} h/año × ${fmt(lf * 100)}% ÷ ${s.scop ? 'SCOP' : 'COP'} ${fmt(heatEff, 2)} = ${fmt(heatKwh)} kWh/año.`);
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
