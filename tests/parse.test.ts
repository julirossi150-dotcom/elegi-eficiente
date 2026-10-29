import { describe, expect, it } from 'vitest';
import { modelFromName, numberWithUnit, parseClass, toNumber } from '../pipeline/normalize/parse';

describe('toNumber', () => {
  it.each([
    ['336 kWh/año', 336],
    ['1.234,5', 1234.5],
    ['0,85 kWh', 0.85],
    ['1.234', 1234],
    ['3.000 frigorías', 3000],
    ['2.5 kg', 2.5],
    ['1,234.5', 1234.5],
  ])('%s → %s', (raw, n) => expect(toNumber(raw)).toBe(n));
});

describe('numberWithUnit', () => {
  it('encuentra el valor con unidad', () => {
    expect(numberWithUnit('Consumo: 336 kWh/año', /kwh/)).toBe(336);
    expect(numberWithUnit('Capacidad 3.000 frigorías', /frigor/)).toBe(3000);
    expect(numberWithUnit('sin dato', /kwh/)).toBeUndefined();
  });
});

describe('parseClass', () => {
  it.each([
    ['A+', 'A+'],
    ['Clase A++', 'A++'],
    ['a+++', 'A+++'],
    ['C', 'C'],
    ['Eficiencia energética: B', 'B'],
    ['No informa', undefined],
  ])('%s → %s', (raw, cls) => expect(parseClass(raw)).toBe(cls));
});

describe('modelFromName', () => {
  it('toma el token con forma de código', () => {
    expect(modelFromName('Heladera no frost Whirlpool 386l inverter wrm42mbdim blanca', 'Whirlpool')).toBe('wrm42mbdim');
    expect(modelFromName('Heladera No Frost Midea 521L RF-SB18XAR1', 'Midea')).toBe('RF-SB18XAR1');
    expect(modelFromName('Heladera No Frost Hisense 379l Inox', 'Hisense')).toBeUndefined();
  });
});
