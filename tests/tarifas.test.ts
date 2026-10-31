import { describe, expect, it } from 'vitest';
import { DEFAULT_TARIFFS } from '../lib/cost';
import { tariffDefaults, tariffOverrides, type OfficialTariffs } from '../lib/tariffs';
import { parseElectricity, parseGas } from '../pipeline/tariffs';

// Fragmento con la forma del cuadro mensual del ente regulador (valores sin impuestos)
const ENRE_HTML = `<p>Cuadro Tarifario - Período 10/26.</p>
<b>Tarifa 1 - R sin subsidio</b>
<tr><td>R1</td><td>EDENOR</td><td>EDESUR</td></tr>
<tr><td>Cargo Variable</td><td>0-150</td><td>$/kWh</td><td>159.128</td><td>157.116</td></tr>
<tr><td>Cargo Variable</td><td>151-400</td><td>$/kWh</td><td>159.788</td><td>157.692</td></tr>
<b>Tarifa 1 - R con subsidio</b>
<tr><td>Cargo Variable</td><td>151-400</td><td>$/kWh</td><td>61.743</td><td>59.827</td></tr>`;

const row = (over: Record<string, string>) => ({
  EMPRESA: 'MetroGAS S.A.',
  SUBZONA: 'CAPITAL FEDERAL',
  TIPOTARIFA: 'Plenas',
  SERVICIO: 'Residencial',
  CATEGORIA: 'R2 2°',
  CARGOTIPO: 'Cargo Variable ($/m3)',
  CARGO: '324,31',
  VIGENCIADESDE: '01/10/2026',
  ...over,
});

describe('tarifas oficiales', () => {
  it('luz: cargo variable R2 sin subsidio, promedio Edenor/Edesur, con IVA', () => {
    expect(parseElectricity(ENRE_HTML).perKwh).toBeCloseTo(((159.788 + 157.692) / 2) * 1.21, 1);
  });
  it('gas: cargo variable residencial de la subzona de cada zona, con IVA', () => {
    const g = parseGas([
      row({}),
      row({ CATEGORIA: 'R1', CARGO: '999' }),
      row({ SUBZONA: 'CORDOBA', EMPRESA: 'Distribuidora de Gas del Centro S.A.', CARGO: '363,75' }),
      row({ TIPOTARIFA: 'Diferenciales 50%', SUBZONA: 'CORDOBA', EMPRESA: 'Distribuidora de Gas del Centro S.A.', CARGO: '1' }),
    ]);
    expect(g.since).toBe('01/10/2026');
    expect(g.byZone.caba.perM3).toBeCloseTo(324.31 * 1.21, 1);
    expect(g.byZone.cordoba.perM3).toBeCloseTo(363.75 * 1.21, 1);
    expect(g.byZone.misiones).toBeUndefined();
  });
  it('si el formato cambia, falla (y el pipeline conserva el valor anterior)', () => {
    expect(() => parseElectricity('<p>otra cosa</p>')).toThrow();
    expect(() => parseGas([])).toThrow();
  });
});

describe('tarifas por defecto', () => {
  const official: OfficialTariffs = {
    generatedAt: '',
    vat: 0.21,
    electricity: { perKwh: 192.1, period: '10/2026', url: '' },
    gas: { since: '01/10/2026', url: '', byZone: { caba: { perM3: 392.4, distributor: 'MetroGAS', subzone: 'CAPITAL FEDERAL' }, cordoba: { perM3: 440.1, distributor: 'Ecogas', subzone: 'CORDOBA' } } },
  };
  it('usa los valores oficiales de la zona; sin red de gas, garrafa', () => {
    expect(tariffDefaults(official, 'cordoba').values).toMatchObject({ electricityPerKwh: 192.1, gasNaturalPerM3: 440.1, gasKind: 'natural' });
    expect(tariffDefaults(official, 'misiones').values.gasKind).toBe('envasado');
    expect(tariffDefaults(null, 'cordoba').values).toEqual(DEFAULT_TARIFFS);
  });
  it('del visitante se guardan solo sus cambios', () => {
    const d = tariffDefaults(official, 'caba').values;
    expect(tariffOverrides({ ...d, electricityPerKwh: 150 }, d)).toEqual({ electricityPerKwh: 150 });
  });
});
