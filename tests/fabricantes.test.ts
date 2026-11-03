import { describe, expect, it } from 'vitest';
import { computeRow, DEFAULT_USAGE, type Tariffs, type Usage } from '../lib/cost';
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
  it('lee una DJC en forma de tabla (Longvie)', () => {
    const r = parseDjc(`DECLARACIÓN JURADA DE CONFORMIDAD (DJC)
• Marca Comercial: LONGVIE
ID Producto      Producto Marca       Modelo           Características   Características
 DC-E-L11-077.1  LAVARROPAS  LONGVIE  L3W46DMB ;
                                                     - 1600 W - IPX4 -   Clase Energética: A+++
                                                           Clase I       Consumo de energía: 0,31kWh
                                                       Carga frontal     Consumo de agua: 69 litros
                                                       Origen CHINA      Capacidad nominal: 10 Kg
   Producto         Modelo        Fabricante        Reglamento/s    Nro. certificado           Normas Técnicas
LAVARROPAS                                           Aplicable/s:                        IEC 60335-2-7 (Ed.8.0): 2019 &
                 L3W46DMB ;    Jinling Electrical     Resolución    DC-E-L11-077.1       IEC 60335-1 (Ed. 5.0): 2010 + A1:
                 L3W46DMBR   Company Limited /                           (IRAM)          2013 + A2: 2016
`)!;
    expect(r).toMatchObject({ category: 'lavarropas', cls: 'A+++', scale: 'anterior', specs: { kwhPerCycle: 0.31, waterLPerCycle: 69, capacityKg: 10 } });
    expect(r.groups).toEqual([{ brand: 'LONGVIE', models: ['L3W46DMB', 'L3W46DMBR'] }]);
  });
  it('lee una DJC de IRAM en un párrafo', () => {
    const r = parseDjc(`DECLARACIÓN JURADA DE CONFORMIDAD
c. Información del producto:
         iii. Produto, marca, modelo y caracteristicas: Congelador vertical, Whirlpool, WVU27D2 ; WVU27K2, 220 V ~
         - 50 Hz - 1,2 A - R134a (120 g) - Clase climática T - Clase I; Volumen de almacenamiento de alimentos frescos:
         0 L; Volumen de almacenamiento de alimentos congelados ( ): 231 L; Clase climática: T; Consumo de energía:
         430 kWh/año; Índice de eficiencia energética: “E”; Nivel de ruido aéreo: 50 dB (A)
d. Normas y evaluación de la conformidad
         i. Reglamentos: Certificación Voluntaria Resolución SIC N° 438/2024 - Etiquetado de Eficiencia Energética
e. Otros datos.
https://qr.iram.org.ar/Certificacion?ID=abc
`)!;
    expect(r).toMatchObject({ category: 'heladeras', cls: 'E', scale: 'nueva', specs: { kwhPerYear: 430, totalVolumeL: 231, freezerVolumeL: 231 } });
    expect(r.groups).toEqual([{ brand: 'WHIRLPOOL', models: ['WVU27D2', 'WVU27K2'] }]);
  });
  it('lee una DJC de IRAM en tabla aunque los valores queden corridos de renglón', () => {
    // la marca del compresor ocupa dos renglones y empuja los valores uno abajo de sus títulos
    const r = parseDjc(`DECLARACIÓN JURADA DE CONFORMIDAD
c. Información del producto:
Producto                                          REFRIGERADOR CON CONGELADOR LIBRE DE ESCARCHA
Modelo                                            WRM56CB ; WRM56CK
Marca                                             Whirlpool
Caracteristicas                                   220 V~ - 50 Hz - 1,5 A - 132 W (Potencia de descongelamiento) -
                                                  R600a (43 g) - Clase climática T - Clase I.
Clase de Eficiencia energética                    Marca compresor: EMBRACO, modelo compresor: VEMX 9C
Indice de eficiencia energética (IEE)             C
Consumo de energía (kWh/año)                      41,7
Volumen de alimentos frescos (litros)             370 kWh/año
Volúmen de alimentos congelados (litros)          355 L
Nivel de ruido aéreo:                             106 L
Clasificación por estrellas del compartimento de  45 dB (A)
d. Normas y evaluación de la conformidad
         i. Reglamentos: Certificación Voluntaria: Resolución SIC Nº 438/2024
e. Otros datos.
https://qr.iram.org.ar/Certificacion?ID=abc
`)!;
    expect(r).toMatchObject({ category: 'heladeras', cls: 'C', scale: 'nueva', specs: { kwhPerYear: 370, totalVolumeL: 461, freezerVolumeL: 106 } });
    // marca y modelos los pone el listado de IRAM
    expect(r.groups).toEqual([]);
  });
});

describe('consumo de etiqueta ENARGAS', () => {
  // condiciones normalizadas de la etiqueta: 400 L/día de 17 a 42 °C
  const LABEL_USAGE: Usage = { ...DEFAULT_USAGE, people: 8, hotWaterLPerPersonDay: 50, coldWaterTempC: 17, hotWaterTempC: 42, acCoolingHoursYear: 0, acHeatingHoursYear: 0, acUseHeating: false, washCyclesPerWeek: 0 };
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
