import { describe, expect, it } from 'vitest';
import { computeRow, type Tariffs, type Usage } from '../lib/cost';
import type { Product } from '../lib/types';
import { applyEstimates } from '../pipeline/estimate';
import { parseDjc } from '../pipeline/harvest/djc';

// Fragmentos reales (abreviados) de DJC publicadas por Drean
const DJC_LAVARROPAS = `DECLARACION JURADA DE CONFORMIDAD
Res. SIYC N° 438/2024
Producto: LAVARROPAS
Código de identificación único del producto: LCFDR1012SB; LCFDR1012TG
Marca: DREAN
Modelo: LCFDR1012SB; LCFDR1012TG
Características técnicas: 220 V~ - 50 Hz - 1600 W - IPX4 - Clase I
Norma Técnica: IRAM 2141-3:2017
Clase de eficiencia energética – A (más eficiente) a G (menos eficiente): A
Consumo C (kW/kg): 0,033
Consumo de energía por ciclo (kWh): 0,35
Consumo de agua por ciclo (litros): 70
Capacidad del lavarropas (Kg de algodón): 10,5
`;

const DJC_HELADERA = `DECLARACION JURADA DE CONFORMIDAD
Res. SIYC N° 438/2024
Marca: (1) PATRICK, MABE; (2) PATRICK; (3) DREAN: (4) TOP HOUSE
Modelo: (1) HPK135AB00; HPK135AM00; (2) HPK135MA00B01; (3)
HDR280F00B; HDR280F30PB, HDR280F50B (4) HTH135M00B01
Características técnicas: 220V~; 50 Hz; Cl. I
Norma Técnica: IRAM 2404-3:2015
Clase de eficiencia energética – A (más eficiente) a G (menos eficiente): D
Consumo de energía (kWh/Año): 310
Volumen de alimentos frescos (litros): 196
Volúmen de Alimentos congelados (litros): 68
`;

describe('DJC (Res. 438/2024)', () => {
  it('lee un lavarropas', () => {
    const r = parseDjc(DJC_LAVARROPAS)!;
    expect(r.category).toBe('lavarropas');
    expect(r.cls).toBe('A');
    expect(r.specs).toEqual({ kwhPerCycle: 0.35, waterLPerCycle: 70, capacityKg: 10.5 });
    expect(r.groups).toEqual([{ brand: 'DREAN', models: ['LCFDR1012SB', 'LCFDR1012TG'] }]);
  });
  it('lee una heladera con marcas gemelas numeradas', () => {
    const r = parseDjc(DJC_HELADERA)!;
    expect(r.category).toBe('heladeras');
    expect(r.cls).toBe('D');
    expect(r.specs).toEqual({ kwhPerYear: 310, totalVolumeL: 264, freezerVolumeL: 68 });
    expect(r.groups.map((g) => g.brand)).toEqual(['PATRICK', 'MABE', 'PATRICK', 'DREAN', 'TOP HOUSE']);
    expect(r.groups[3].models).toEqual(['HDR280F00B', 'HDR280F30PB', 'HDR280F50B']);
  });
  it('ignora documentos que no son DJC', () => {
    expect(parseDjc('Manual de instrucciones del lavarropas')).toBeNull();
  });
});

describe('consumo de etiqueta ENARGAS', () => {
  // condiciones normalizadas de la etiqueta: 400 L/día de 17 a 42 °C
  const LABEL_USAGE: Usage = { people: 8, hotWaterLPerPersonDay: 50, coldWaterTempC: 17, hotWaterTempC: 42, acCoolingHoursYear: 0, acHeatingHoursYear: 0, acUseHeating: false, washCyclesPerWeek: 0 };
  const T: Tariffs = { electricityPerKwh: 100, gasNaturalPerM3: 1, glpPerKg: 1, gasKind: 'natural' };

  it('un termotanque con etiqueta reproduce su consumo en condiciones normalizadas', () => {
    const p: Product = {
      id: 't', category: 'termotanques', name: 'T', brand: 'Longvie', model: 'T3075PF', ean: [], energy: 'gas_natural',
      label: { cls: 'C', scale: 'nueva' },
      specs: { storageL: 75, gasPowerKcalH: 6400, recoveryLH: 246, labelM3Year: 770 },
      provenance: { labelM3Year: { origin: 'fabricante' } },
      offers: [], priceMin: 1, firstSeen: '', lastSeen: '', quality: 'completo',
    };
    applyEstimates([p]);
    expect(p.specs.efficiencyPct).toBe(77); // 246 L/h × 20 °C ÷ 6400 kcal/h
    const r = computeRow(p, LABEL_USAGE, T, { years: 1, realTariffGrowthPct: 0 });
    expect(r.estimate!.m3Year).toBeCloseTo(770, -1);
    expect(r.estimate!.basis).toBe('etiqueta');
  });
});
