import { describe, expect, it } from 'vitest';
import type { CategoryId } from '../lib/types';
import { mergeListings, modelContradictsName } from '../pipeline/merge';
import { toListing } from '../pipeline/normalize';
import type { VtexProduct } from '../pipeline/sources/vtex';

let n = 0;
function listing(category: CategoryId, store: string, name: string, brand: string, ean?: string, model?: string) {
  n++;
  const p: VtexProduct = {
    productId: String(n),
    productName: name,
    brand,
    productReference: model,
    link: `https://${store}/${n}/p`,
    categories: [],
    items: [{ itemId: String(n), name, ean, sellers: [{ sellerId: '1', commertialOffer: { Price: 100000 + n, ListPrice: 100000 + n, AvailableQuantity: 5 } }] }],
  };
  const l = toListing(p, store, category, '2026-11-02T00:00:00Z');
  if (!l) throw new Error(`no entra: ${name}`);
  return l;
}

describe('agrupación de publicaciones', () => {
  it('separa tamaños distintos que una tienda unió con el código de otro modelo', () => {
    const ls = [
      listing('termotanques', 'a', 'Termotanque Eléctrico Señorial 30 Lts TESZ2.0-30', 'Señorial', '7796825009030', 'TESZ2.0-30'),
      listing('termotanques', 'b', 'Termotanque Eléctrico Señorial 30 Lts TESZ2.0-30', 'Señorial', '7796825009030', 'TESZ2.0-30'),
      // EAN del de 50 L con el modelo del de 30 L
      listing('termotanques', 'c', 'Termotanque eléctrico Señorial Zafiro inferior 50 lts', 'Señorial', '7796825009047', 'TESZ2.0-30'),
      listing('termotanques', 'a', 'Termotanque Eléctrico Señorial 50 Lts TESZ2.0-50', 'Señorial', '7796825009047', 'TESZ2.0-50'),
      listing('termotanques', 'b', 'Termotanque Eléctrico Señorial 50 Lts TESZ2.0-50', 'Señorial', '7796825009047', 'TESZ2.0-50'),
    ];
    const ps = mergeListings(ls, new Map(), '2026-11-02');
    expect(ps.map((p) => [p.specs.storageL, p.offers.length]).sort()).toEqual([
      [30, 2],
      [50, 3],
    ]);
  });
  it('un tamaño mal cargado en una tienda no parte el producto', () => {
    const ls = [
      listing('heladeras', 'a', 'Heladera Electrolux No Frost 527L IB7B', 'Electrolux', '7909569490001', 'IB7B'),
      listing('heladeras', 'b', 'Heladera Electrolux No Frost 527L IB7B', 'Electrolux', '7909569490001', 'IB7B'),
      listing('heladeras', 'c', 'Heladera Electrolux No Frost 194L IB7B', 'Electrolux', '7909569490001', 'IB7B'),
    ];
    expect(mergeListings(ls, new Map(), '2026-11-02')).toHaveLength(1);
  });
  it('no usa un modelo que contradice el nombre', () => {
    expect(modelContradictsName('IC-02', 'Caloventor Ic-01 Azul 1800 W Indelplas')).toBe(true);
    expect(modelContradictsName('TESZ2.0-50', 'Termotanque Señorial TESZ2.0-50 50 L')).toBe(false);
    expect(modelContradictsName('IC-02', 'Caloventor Indelplas 1800 W')).toBe(false);
  });
});

describe('calefactores', () => {
  const heater = (name: string, brand = 'Caldén') => listing('calefactores', 'a', name, brand);
  it('lee la potencia de "K/cal" y de las series "Tiro Balanceado 3.0"', () => {
    expect(heater('Calefactor Caldén 3000 K/cal Sin Salida con Termostato Smart').specs.gasPowerKcalH).toBe(3000);
    expect(heater('Calefactor Caldén Tiro Balanceado 3.0 Gas Natural').specs.gasPowerKcalH).toBe(3000);
    expect(heater('Calefactor Caldén Tiro Balanceado U (TBU) 5.0 Gas Envasado').specs.gasPowerKcalH).toBe(5000);
    expect(heater('Calefactor Tiro Natural Calden Tn 6.0 Gn Negro').specs.gasPowerKcalH).toBe(6000);
  });
  it('torres y vitrocerámicos tienen tipo; las estufas a leña quedan fuera', () => {
    expect(heater('TURBOCALEFACTOR LILIANA TORRE TC40 TURBOPOWER 1000/2000W', 'Liliana').specs).toMatchObject({ roomHeaterType: 'caloventor', powerW: 2000 });
    expect(heater('Calefactor Vitrocerámico Alpaca Glass Heat 1800W Negro', 'Alpaca').specs.roomHeaterType).toBe('panel');
    const p = { productId: 'x', productName: 'Calefactor Metavila Tango 700EXT Doble combustión', brand: 'Metavila', link: 'u', categories: [], items: [{ itemId: 'x', name: 'x', sellers: [{ sellerId: '1', commertialOffer: { Price: 1e6, ListPrice: 1e6, AvailableQuantity: 1 } }] }] };
    expect(toListing(p, 'a', 'calefactores', '')).toBeNull();
  });
});
