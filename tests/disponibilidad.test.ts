import { afterEach, describe, expect, it, vi } from 'vitest';
import { offerReaches, ZONES, zoneFromGeoref, zoneMask } from '../lib/zones';
import { bestOffer, verifyAvailability, type VtexProduct } from '../pipeline/sources/vtex';

function product(itemId: string, qty = 10): VtexProduct {
  return {
    productId: itemId,
    productName: 'X',
    brand: 'B',
    link: `https://tienda/${itemId}/p`,
    categories: [],
    items: [{ itemId, name: 'X', sellers: [{ sellerId: '1', commertialOffer: { Price: 1000, ListPrice: 1000, AvailableQuantity: qty } }] }],
  };
}

type Body = { items: { id: string; seller: string }[]; postalCode: string };

/** Simulador falso: `answer(id, códigoPostal)` da la disponibilidad, o undefined si el carrito no devuelve el ítem. */
function mockSimulation(answer: (id: string, postalCode: string) => string | undefined) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Body;
    const items = body.items.flatMap((i) => {
      const availability = answer(i.id, body.postalCode);
      return availability ? [{ id: i.id, seller: i.seller, availability }] : [];
    });
    return new Response(JSON.stringify({ items }), { status: 200 });
  });
}

const ALL = (1 << ZONES.length) - 1;
const CABA = ZONES.find((z) => z.id === 'caba')!.postalCode;

afterEach(() => vi.restoreAllMocks());

describe('disponibilidad confirmada con el simulador de carrito', () => {
  it('guarda en qué zonas se puede comprar y descarta lo que no se puede comprar en ninguna', async () => {
    mockSimulation((id, pc) =>
      ({ a: 'available', b: 'withoutStock', c: 'cannotBeDelivered', e: pc === CABA ? 'available' : 'cannotBeDelivered' })[id],
    );
    const ps = ['a', 'b', 'c', 'd', 'e'].map((id) => product(id));
    const r = await verifyAvailability('tienda.test', ps, '1', 0);
    expect(r).toEqual({ checked: 4, rejected: 2, failed: false });
    expect(ps.map((p) => bestOffer(p)!.available)).toEqual([true, false, false, true, true]); // d: el carrito no lo devolvió, queda el catálogo
    expect(bestOffer(ps[0])!.zones).toBe(ALL);
    expect(bestOffer(ps[3])!.zones).toBeUndefined();
    expect(bestOffer(ps[4])!.zones).toBe(zoneMask(['caba']));
  });
  it('si el sistema de un vendedor falla, sus ofertas no cuentan y las de los demás vendedores sí', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Body;
      if (body.items.some((i) => i.seller === 'roto')) {
        return new Response('{"error":{"code":"ORD015.4","message":"Seller Roto HTTP error"}}', { status: 500 });
      }
      return new Response(JSON.stringify({ items: body.items.map((i) => ({ ...i, availability: 'available' })) }), { status: 200 });
    });
    const bueno = product('a');
    const malo = product('b');
    malo.items[0].sellers![0].sellerId = 'roto';
    const r = await verifyAvailability('tienda3.test', [bueno, malo], '1', 0);
    expect(r).toEqual({ checked: 2, rejected: 1, failed: false });
    expect([bestOffer(bueno)!.available, bestOffer(malo)!.available]).toEqual([true, false]);
  });
  it('varias heladeras juntas sin envío posible se confirman de a una', async () => {
    // el carrito no encuentra envío para el pedido entero, pero cada una sola sí se entrega
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Body;
      const availability = body.items.length > 1 ? 'cannotBeDelivered' : 'available';
      return new Response(JSON.stringify({ items: body.items.map((i) => ({ ...i, availability })) }), { status: 200 });
    });
    const ps = ['a', 'b', 'c'].map((id) => product(id));
    expect(await verifyAvailability('tienda4.test', ps, '1', 0)).toEqual({ checked: 3, rejected: 0, failed: false });
    expect(ps.map((p) => bestOffer(p)!.zones)).toEqual([ALL, ALL, ALL]);
  });
  it('si el simulador falla, no se toca el stock del catálogo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 404 }));
    const ps = [product('a')];
    expect((await verifyAvailability('tienda2.test', ps, '1', 0)).failed).toBe(true);
    expect(bestOffer(ps[0])!.available).toBe(true);
    expect(bestOffer(ps[0])!.zones).toBeUndefined();
  });
});

describe('zonas', () => {
  const offer = { store: 's', price: 1, url: 'u', available: true, checkedAt: '', zones: zoneMask(['gba', 'cordoba']) };
  it('la ubicación de Georef se traduce en zona (conurbano aparte del interior bonaerense)', () => {
    expect(zoneFromGeoref('06', 'Vicente López')!.id).toBe('gba');
    expect(zoneFromGeoref('06', 'General Pueyrredón')!.id).toBe('bsas');
    expect(zoneFromGeoref('14', 'Capital')!.id).toBe('cordoba');
    expect(zoneFromGeoref('02')!.id).toBe('caba');
  });
  it('una oferta llega solo a sus zonas; sin zona elegida o sin dato, se muestra', () => {
    expect(offerReaches(offer, 'cordoba')).toBe(true);
    expect(offerReaches(offer, 'mendoza')).toBe(false);
    expect(offerReaches(offer, null)).toBe(true);
    expect(offerReaches({ ...offer, zones: undefined }, 'mendoza')).toBe(true);
  });
});
