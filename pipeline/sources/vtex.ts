// Lectura del catálogo público de tiendas VTEX (/api/catalog_system/pub/...).
import { politeFetchJson, politePostJson } from '../lib/http';

export interface VtexOffer {
  Price: number;
  ListPrice: number;
  AvailableQuantity: number;
  IsAvailable?: boolean;
}

export interface VtexItem {
  itemId: string;
  name: string;
  ean?: string;
  referenceId?: { Key: string; Value: string }[];
  images?: { imageUrl: string }[];
  sellers?: { sellerId?: string; sellerDefault?: boolean; commertialOffer: VtexOffer }[];
}

export interface VtexProduct {
  productId: string;
  productName: string;
  brand: string;
  productReference?: string;
  link: string;
  categories: string[];
  allSpecifications?: string[];
  items: VtexItem[];
  [spec: string]: unknown;
}

export interface VtexCategoryNode {
  id: number;
  name: string;
  url: string;
  children: VtexCategoryNode[];
}

/** Categoría del árbol con su ruta de ids (para fq=C:/1/2/3/) y nombres. */
export interface CategoryPath {
  ids: number[];
  names: string[];
}

export async function fetchCategoryTree(host: string, depth = 4): Promise<CategoryPath[]> {
  const { data } = await politeFetchJson<VtexCategoryNode[]>(`https://${host}/api/catalog_system/pub/category/tree/${depth}`);
  const out: CategoryPath[] = [];
  const walk = (n: VtexCategoryNode, ids: number[], names: string[]) => {
    const p = { ids: [...ids, n.id], names: [...names, n.name] };
    out.push(p);
    for (const c of n.children ?? []) walk(c, p.ids, p.names);
  };
  for (const n of data) walk(n, [], []);
  return out;
}

const PAGE = 50;
const MAX_FROM = 2500;

/** Todos los productos de una categoría (fq=C:/ids/), paginando de a 50. */
export async function fetchCategoryProducts(host: string, path: CategoryPath, log: (m: string) => void = () => {}): Promise<VtexProduct[]> {
  const fq = encodeURIComponent(`C:/${path.ids.join('/')}/`);
  const all: VtexProduct[] = [];
  let total = Infinity;
  for (let from = 0; from < Math.min(total, MAX_FROM); from += PAGE) {
    const url = `https://${host}/api/catalog_system/pub/products/search?fq=${fq}&_from=${from}&_to=${from + PAGE - 1}`;
    const { data, headers } = await politeFetchJson<VtexProduct[]>(url);
    const resources = headers.get('resources'); // "0-49/1234"
    const m = resources?.match(/\/(\d+)$/);
    if (m) total = Number(m[1]);
    all.push(...data);
    if (data.length < PAGE) break;
  }
  if (total > MAX_FROM) log(`  ⚠ ${host} ${path.names.join(' > ')}: ${total} productos, VTEX solo deja leer ${MAX_FROM}`);
  return all;
}

/** Respuesta del simulador de carrito: se usa para confirmar que el producto se puede comprar hoy. */
interface SimulationResponse {
  items?: { id: string; seller: string; availability?: string }[];
}

/** Disponibilidades del simulador que significan "está a la venta" (cannotBeDelivered: existe y tiene stock, pero no llega al código postal de prueba). */
const ON_SALE = new Set(['available', 'cannotBeDelivered']);
const SIM_BATCH = 50;
const SIM_POSTAL_CODE = '1414';

/**
 * El catálogo de algunas tiendas informa stock de productos que ya no venden (Frávega mantiene el catálogo VTEX
 * pero su sitio dice "La página no existe"). El simulador de carrito sí refleja lo que se puede comprar:
 * las ofertas que el simulador rechaza se marcan como no disponibles. Si el simulador no responde por un ítem
 * (algunas tiendas no lo devuelven), se deja lo que dice el catálogo.
 */
export async function verifyAvailability(host: string, products: VtexProduct[]): Promise<{ checked: number; rejected: number; failed: boolean }> {
  const offers: { item: VtexItem; seller: string; o: VtexOffer }[] = [];
  for (const p of products)
    for (const item of p.items ?? [])
      for (const s of item.sellers ?? []) {
        const o = s.commertialOffer;
        if (o && o.Price > 0 && (o.AvailableQuantity ?? 0) > 0 && o.IsAvailable !== false && s.sellerId) offers.push({ item, seller: s.sellerId, o });
      }
  let checked = 0;
  let rejected = 0;
  let failedBatches = 0;
  // Un lote por vendedor: si el sistema de un vendedor del marketplace falla, el carrito rechaza el lote entero
  const bySeller = new Map<string, typeof offers>();
  for (const x of offers) bySeller.set(x.seller, [...(bySeller.get(x.seller) ?? []), x]);
  const batches: (typeof offers)[] = [];
  for (const list of bySeller.values()) for (let i = 0; i < list.length; i += SIM_BATCH) batches.push(list.slice(i, i + SIM_BATCH));
  for (const batch of batches) {
    let res: SimulationResponse;
    try {
      ({ data: res } = await politePostJson<SimulationResponse>(`https://${host}/api/checkout/pub/orderForms/simulation?sc=1`, {
        items: batch.map((b) => ({ id: b.item.itemId, quantity: 1, seller: b.seller })),
        country: 'ARG',
        postalCode: SIM_POSTAL_CODE,
      }));
    } catch (err) {
      // El vendedor no responde al carrito: hoy no se le puede comprar
      if (/Seller .* error/i.test(String((err as Error).message))) {
        for (const b of batch) b.o.IsAvailable = false;
        checked += batch.length;
        rejected += batch.length;
      } else failedBatches++;
      continue;
    }
    const byKey = new Map((res.items ?? []).map((it) => [`${it.id}|${it.seller}`, it]));
    for (const b of batch) {
      const it = byKey.get(`${b.item.itemId}|${b.seller}`);
      if (!it?.availability) continue;
      checked++;
      if (!ON_SALE.has(it.availability)) {
        b.o.IsAvailable = false;
        rejected++;
      }
    }
  }
  return { checked, rejected, failed: failedBatches > 0 && failedBatches === batches.length };
}

export function bestOffer(p: VtexProduct): { price: number; listPrice: number; available: boolean; item: VtexItem } | null {
  let best: { price: number; listPrice: number; available: boolean; item: VtexItem } | null = null;
  for (const item of p.items ?? []) {
    for (const s of item.sellers ?? []) {
      const o = s.commertialOffer;
      if (!o || !(o.Price > 0)) continue;
      const available = (o.AvailableQuantity ?? 0) > 0 && o.IsAvailable !== false;
      const cand = { price: o.Price, listPrice: o.ListPrice, available, item };
      if (!best || (available && !best.available) || (available === best.available && o.Price < best.price)) best = cand;
    }
  }
  return best;
}

/** Valor textual de una especificación cuyo nombre coincide con el patrón. */
export function specValue(p: VtexProduct, pattern: RegExp): string | undefined {
  for (const key of p.allSpecifications ?? Object.keys(p)) {
    if (!pattern.test(key)) continue;
    const v = p[key];
    if (Array.isArray(v) && v.length && typeof v[0] === 'string' && v[0].trim()) return v.join(' ').trim();
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Todas las especificaciones como texto plano (para búsquedas de respaldo). */
export function allSpecsText(p: VtexProduct): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of p.allSpecifications ?? []) {
    const v = p[key];
    if (Array.isArray(v)) out[key] = v.join(' ');
  }
  return out;
}
