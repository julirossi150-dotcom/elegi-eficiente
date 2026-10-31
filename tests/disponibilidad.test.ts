import { afterEach, describe, expect, it, vi } from 'vitest';
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

function mockSimulation(availability: Record<string, string>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { items: { id: string; seller: string }[] };
    const items = body.items.filter((i) => availability[i.id]).map((i) => ({ id: i.id, seller: i.seller, availability: availability[i.id] }));
    return new Response(JSON.stringify({ items }), { status: 200 });
  });
}

afterEach(() => vi.restoreAllMocks());

describe('disponibilidad confirmada con el simulador de carrito', () => {
  it('lo que el carrito no deja comprar deja de estar disponible', async () => {
    mockSimulation({ a: 'available', b: 'withoutStock', c: 'cannotBeDelivered' });
    const ps = [product('a'), product('b'), product('c'), product('d')];
    const r = await verifyAvailability('tienda.test', ps);
    expect(r).toEqual({ checked: 3, rejected: 1, failed: false });
    expect(ps.map((p) => bestOffer(p)!.available)).toEqual([true, false, true, true]); // d: el carrito no lo devolvió, queda el catálogo
  });
  it('si el sistema de un vendedor falla, sus ofertas no cuentan y las de los demás vendedores sí', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { items: { id: string; seller: string }[] };
      if (body.items.some((i) => i.seller === 'roto')) {
        return new Response('{"error":{"code":"ORD015.4","message":"Seller Roto HTTP error"}}', { status: 500 });
      }
      return new Response(JSON.stringify({ items: body.items.map((i) => ({ ...i, availability: 'available' })) }), { status: 200 });
    });
    const bueno = product('a');
    const malo = product('b');
    malo.items[0].sellers![0].sellerId = 'roto';
    const r = await verifyAvailability('tienda3.test', [bueno, malo]);
    expect(r).toEqual({ checked: 2, rejected: 1, failed: false });
    expect([bestOffer(bueno)!.available, bestOffer(malo)!.available]).toEqual([true, false]);
  });
  it('si el simulador falla, no se toca el stock del catálogo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 404 }));
    const ps = [product('a')];
    expect((await verifyAvailability('tienda2.test', ps)).failed).toBe(true);
    expect(bestOffer(ps[0])!.available).toBe(true);
  });
});
