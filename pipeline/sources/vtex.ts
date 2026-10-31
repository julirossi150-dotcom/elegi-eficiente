// Lectura del catálogo público de tiendas VTEX (/api/catalog_system/pub/...).
import { ZONES } from '../../lib/zones';
import { politeFetchJson, politePostJson } from '../lib/http';

export interface VtexOffer {
  Price: number;
  ListPrice: number;
  AvailableQuantity: number;
  IsAvailable?: boolean;
  /** Agregado por verifyAvailability: zonas donde el carrito deja comprarlo (bit i = ZONES[i]) */
  zones?: number;
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

/** Respuesta del simulador de carrito: se usa para confirmar que el producto se puede comprar hoy y dónde. */
interface SimulationResponse {
  items?: { id: string; seller: string; availability?: string }[];
}

// lotes chicos: con muchos artículos pesados juntos el carrito no encuentra envío para el pedido
const SIM_BATCH = 5;

export interface VerifyResult {
  /** ofertas con respuesta del carrito en al menos una zona */
  checked: number;
  /** ofertas que el carrito no deja comprar en ninguna zona */
  rejected: number;
  failed: boolean;
}

/**
 * Confirma cada oferta con el simulador de carrito de la tienda, en el código postal de cada zona (lib/zones).
 * El catálogo informa stock de productos que ya no se venden; el carrito, no. Por cada oferta se guarda en
 * `zones` (bit i = ZONES[i]) dónde se puede comprar con entrega o retiro. Si no se puede comprar en ninguna zona,
 * la oferta queda no disponible. Si el carrito no responde por una oferta en alguna zona, no se toca lo que dice el catálogo.
 */
export async function verifyAvailability(host: string, products: VtexProduct[], salesChannel = '1', minIntervalMs = 500): Promise<VerifyResult> {
  const offers: { item: VtexItem; seller: string; o: VtexOffer; yes: number; no: number; unknown: number }[] = [];
  for (const p of products)
    for (const item of p.items ?? [])
      for (const s of item.sellers ?? []) {
        const o = s.commertialOffer;
        if (o && o.Price > 0 && (o.AvailableQuantity ?? 0) > 0 && o.IsAvailable !== false && s.sellerId) offers.push({ item, seller: s.sellerId, o, yes: 0, no: 0, unknown: 0 });
      }
  // Un lote por vendedor: si el sistema de un vendedor del marketplace falla, el carrito rechaza el lote entero
  const bySeller = new Map<string, typeof offers>();
  for (const x of offers) bySeller.set(x.seller, [...(bySeller.get(x.seller) ?? []), x]);
  const batches: (typeof offers)[] = [];
  for (const list of bySeller.values()) for (let i = 0; i < list.length; i += SIM_BATCH) batches.push(list.slice(i, i + SIM_BATCH));

  let calls = 0;
  let failedCalls = 0;
  // nodeliver: existe y tiene stock, pero el carrito no encuentra entrega ni retiro para ese código postal
  type Answer = 'yes' | 'no' | 'nodeliver' | 'unknown';
  /** Disponibilidad de cada oferta del lote en un código postal. */
  const simulate = async (batch: typeof offers, postalCode: string): Promise<Answer[]> => {
    calls++;
    let res: SimulationResponse;
    try {
      ({ data: res } = await politePostJson<SimulationResponse>(
        `https://${host}/api/checkout/pub/orderForms/simulation?sc=${salesChannel}`,
        { items: batch.map((b) => ({ id: b.item.itemId, quantity: 1, seller: b.seller })), country: 'ARG', postalCode },
        { minIntervalMs },
      ));
    } catch (err) {
      // El vendedor no responde al carrito: hoy no se le puede comprar ahí
      if (/Seller .* error/i.test(String((err as Error).message))) return batch.map(() => 'no');
      failedCalls++;
      return batch.map(() => 'unknown');
    }
    const byKey = new Map((res.items ?? []).map((it) => [`${it.id}|${it.seller}`, it]));
    return batch.map((b) => {
      const a = byKey.get(`${b.item.itemId}|${b.seller}`)?.availability;
      return !a ? 'unknown' : a === 'available' ? 'yes' : a === 'cannotBeDelivered' ? 'nodeliver' : 'no';
    });
  };
  for (const [zi, zone] of ZONES.entries()) {
    for (const batch of batches) {
      let answers = await simulate(batch, zone.postalCode);
      // El carrito calcula el envío del pedido entero: varias heladeras juntas pueden "no entregarse" aunque cada una sí.
      // Si en el lote no salió ninguna disponible, se confirma de a una.
      if (batch.length > 1 && answers.includes('nodeliver') && !answers.includes('yes')) {
        for (const [k, b] of batch.entries()) if (answers[k] === 'nodeliver') answers[k] = (await simulate([b], zone.postalCode))[0];
      }
      batch.forEach((b, k) => {
        const a = answers[k];
        b[a === 'nodeliver' ? 'no' : a]++;
        if (answers[k] === 'yes') b.o.zones = (b.o.zones ?? 0) | (1 << zi);
      });
    }
  }
  let checked = 0;
  let rejected = 0;
  for (const b of offers) {
    if (b.yes + b.no === 0) continue;
    checked++;
    if (b.unknown) delete b.o.zones; // dato incompleto: no se filtra por zona
    if (b.yes === 0 && b.unknown === 0) {
      b.o.IsAvailable = false;
      rejected++;
    }
  }
  return { checked, rejected, failed: calls > 0 && failedCalls === calls };
}

export function bestOffer(p: VtexProduct): { price: number; listPrice: number; available: boolean; zones?: number; item: VtexItem } | null {
  let best: { price: number; listPrice: number; available: boolean; zones?: number; item: VtexItem } | null = null;
  for (const item of p.items ?? []) {
    for (const s of item.sellers ?? []) {
      const o = s.commertialOffer;
      if (!o || !(o.Price > 0)) continue;
      const available = (o.AvailableQuantity ?? 0) > 0 && o.IsAvailable !== false;
      const cand = { price: o.Price, listPrice: o.ListPrice, available, zones: o.zones, item };
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
