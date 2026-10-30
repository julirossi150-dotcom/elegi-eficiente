import { describe, expect, it } from 'vitest';
import { acCapacityRange, acRequiredFrigorias, computeRow, cumulativeEnergy, DEFAULT_USAGE, hotWaterDemandKcalYear, paybackYears, type Tariffs } from '../lib/cost';
import type { Product } from '../lib/types';

const T: Tariffs = { electricityPerKwh: 100, gasNaturalPerM3: 500, glpPerKg: 1000, gasKind: 'natural' };
const S = { years: 10, realTariffGrowthPct: 0 };

function product(over: Partial<Product>): Product {
  return {
    id: 'x',
    category: 'heladeras',
    name: 'X',
    brand: 'B',
    model: 'M',
    ean: [],
    energy: 'electricidad',
    label: { cls: 'A', scale: 'nueva' },
    specs: {},
    provenance: {},
    offers: [],
    priceMin: 1_000_000,
    firstSeen: '2026-10-28',
    lastSeen: '2026-10-28',
    quality: 'completo',
    ...over,
  };
}

describe('heladeras', () => {
  it('usa el consumo de la etiqueta', () => {
    const r = computeRow(product({ specs: { kwhPerYear: 300 } }), DEFAULT_USAGE, T, S);
    expect(r.annualEnergyCost).toBe(30_000);
    expect(r.tco).toBe(1_000_000 + 300_000);
    expect(r.estimate?.basis).toBe('etiqueta');
  });
  it('marca como estimado si el consumo fue estimado', () => {
    const r = computeRow(product({ specs: { kwhPerYear: 300 }, provenance: { kwhPerYear: { origin: 'estimado' } } }), DEFAULT_USAGE, T, S);
    expect(r.estimate?.basis).toBe('estimado');
  });
  it('sin consumo no hay costo total', () => {
    expect(computeRow(product({}), DEFAULT_USAGE, T, S).tco).toBeNull();
  });
});

describe('aires', () => {
  const U = { ...DEFAULT_USAGE, acAreaM2: 20, acCeilingM: 2.6, acHighLoad: false, acCoolingHoursYear: 1000, acUseHeating: false };
  it('frigorías del ambiente: m² × altura × 50, con recargo por sol', () => {
    expect(acRequiredFrigorias(U)).toBe(2600);
    expect(acRequiredFrigorias({ ...U, acHighLoad: true })).toBe(3100);
    expect(acCapacityRange(U)).toEqual([2450, 3900]);
  });
  it('carga del ambiente × horas × carga media ÷ EER', () => {
    const p = product({ category: 'aires', specs: { coolingCapacityW: 3500, eer: 3.5 } });
    const r = computeRow(p, U, T, S);
    // 2600 frigorías × 1,163 W × 1000 h × 0,6 ÷ 3,5
    expect(r.estimate?.kwhYear).toBeCloseTo((2600 * 1.163 * 1000 * 0.6) / 3.5 / 1000, 5);
  });
  it('con la misma eficiencia, un equipo más grande no gasta más', () => {
    const chico = computeRow(product({ category: 'aires', specs: { coolingCapacityW: 3000, eer: 3.5 } }), U, T, S);
    const grande = computeRow(product({ category: 'aires', specs: { coolingCapacityW: 5000, eer: 3.5 } }), U, T, S);
    expect(grande.estimate!.kwhYear).toBeCloseTo(chico.estimate!.kwhYear, 5);
  });
  it('avisa si el equipo queda chico', () => {
    const r = computeRow(product({ category: 'aires', specs: { coolingCapacityW: 2600, eer: 3.5 } }), U, T, S);
    expect(r.estimate!.steps.some((x) => x.includes('queda chico'))).toBe(true);
  });
});

describe('agua caliente', () => {
  it('demanda de agua caliente', () => {
    // 3 × 50 L × 25 °C × 365
    expect(hotWaterDemandKcalYear(DEFAULT_USAGE)).toBe(3 * 50 * 25 * 365);
  });
  it('calefón sin piloto consume solo al calentar', () => {
    const p = product({ category: 'calefones', energy: 'gas_natural', specs: { efficiencyPct: 84, hasPilot: false } });
    const r = computeRow(p, DEFAULT_USAGE, T, S);
    expect(r.estimate?.m3Year).toBeCloseTo((3 * 50 * 25 * 365) / (0.84 * 9300), 5);
  });
  it('el piloto suma consumo diario', () => {
    const conPiloto = computeRow(product({ category: 'calefones', energy: 'gas_natural', specs: { efficiencyPct: 84, hasPilot: true, pilotM3PerDay: 0.3 } }), DEFAULT_USAGE, T, S);
    const sinPiloto = computeRow(product({ category: 'calefones', energy: 'gas_natural', specs: { efficiencyPct: 84, hasPilot: false } }), DEFAULT_USAGE, T, S);
    expect(conPiloto.estimate!.m3Year - sinPiloto.estimate!.m3Year).toBeCloseTo(0.3 * 365, 5);
  });
});

describe('escenario', () => {
  it('acumula con aumento real compuesto', () => {
    expect(cumulativeEnergy(100, { years: 3, realTariffGrowthPct: 10 })).toEqual([100, 210, 331].map((x) => expect.closeTo(x, 6)));
  });
  it('recupero de la diferencia', () => {
    const barato = computeRow(product({ priceMin: 1_000_000, specs: { kwhPerYear: 500 } }), DEFAULT_USAGE, T, S);
    const eficiente = computeRow(product({ priceMin: 1_100_000, specs: { kwhPerYear: 250 } }), DEFAULT_USAGE, T, S);
    // ahorro 250 kWh × $100 = $25.000/año; diferencia $100.000 → 4 años
    expect(paybackYears(barato, eficiente, S)).toBeCloseTo(4, 6);
    expect(paybackYears(eficiente, barato, S)).toBe(0);
  });
});
