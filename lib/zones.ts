// Zonas de entrega: una por provincia, con el Gran Buenos Aires separado del interior bonaerense.
// El pipeline pregunta al carrito de cada tienda si entrega en el código postal de cada zona y guarda el resultado
// en cada oferta (bit i = ZONES[i]). El orden NO se puede cambiar sin regenerar los datos: solo agregar al final.
import type { Offer, Product } from './types';

export interface Zone {
  id: string;
  name: string;
  /** Código postal representativo (capital o ciudad principal) para consultar el carrito */
  postalCode: string;
  /** Código INDEC de la provincia (lo que devuelve la API Georef) */
  provinceId: string;
}

export const ZONES: Zone[] = [
  { id: 'caba', name: 'Ciudad de Buenos Aires', postalCode: '1414', provinceId: '02' },
  { id: 'gba', name: 'Gran Buenos Aires', postalCode: '1636', provinceId: '06' },
  { id: 'bsas', name: 'Buenos Aires (interior)', postalCode: '7600', provinceId: '06' },
  { id: 'catamarca', name: 'Catamarca', postalCode: '4700', provinceId: '10' },
  { id: 'chaco', name: 'Chaco', postalCode: '3500', provinceId: '22' },
  { id: 'chubut', name: 'Chubut', postalCode: '9100', provinceId: '26' },
  { id: 'cordoba', name: 'Córdoba', postalCode: '5000', provinceId: '14' },
  { id: 'corrientes', name: 'Corrientes', postalCode: '3400', provinceId: '18' },
  { id: 'entrerios', name: 'Entre Ríos', postalCode: '3100', provinceId: '30' },
  { id: 'formosa', name: 'Formosa', postalCode: '3600', provinceId: '34' },
  { id: 'jujuy', name: 'Jujuy', postalCode: '4600', provinceId: '38' },
  { id: 'lapampa', name: 'La Pampa', postalCode: '6300', provinceId: '42' },
  { id: 'larioja', name: 'La Rioja', postalCode: '5300', provinceId: '46' },
  { id: 'mendoza', name: 'Mendoza', postalCode: '5500', provinceId: '50' },
  { id: 'misiones', name: 'Misiones', postalCode: '3300', provinceId: '54' },
  { id: 'neuquen', name: 'Neuquén', postalCode: '8300', provinceId: '58' },
  { id: 'rionegro', name: 'Río Negro', postalCode: '8400', provinceId: '62' },
  { id: 'salta', name: 'Salta', postalCode: '4400', provinceId: '66' },
  { id: 'sanjuan', name: 'San Juan', postalCode: '5400', provinceId: '70' },
  { id: 'sanluis', name: 'San Luis', postalCode: '5700', provinceId: '74' },
  { id: 'santacruz', name: 'Santa Cruz', postalCode: '9400', provinceId: '78' },
  { id: 'santafe', name: 'Santa Fe', postalCode: '2000', provinceId: '82' },
  { id: 'sgoestero', name: 'Santiago del Estero', postalCode: '4200', provinceId: '86' },
  { id: 'tdf', name: 'Tierra del Fuego', postalCode: '9410', provinceId: '94' },
  { id: 'tucuman', name: 'Tucumán', postalCode: '4000', provinceId: '90' },
];

/** Partidos del conurbano y alrededores (AMBA): cuentan como Gran Buenos Aires. */
const GBA_PARTIDOS = new Set(
  [
    'Almirante Brown', 'Avellaneda', 'Berazategui', 'Berisso', 'Cañuelas', 'Ensenada', 'Escobar', 'Esteban Echeverría', 'Ezeiza',
    'Florencio Varela', 'General Rodríguez', 'General San Martín', 'Hurlingham', 'Ituzaingó', 'José C. Paz', 'La Matanza', 'La Plata',
    'Lanús', 'Lomas de Zamora', 'Malvinas Argentinas', 'Marcos Paz', 'Merlo', 'Moreno', 'Morón', 'Pilar', 'Presidente Perón', 'Quilmes',
    'San Fernando', 'San Isidro', 'San Miguel', 'San Vicente', 'Tigre', 'Tres de Febrero', 'Vicente López',
  ].map(norm),
);

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Zona según la provincia y el partido que devuelve la API Georef. */
export function zoneFromGeoref(provinceId: string, departamento?: string): Zone | undefined {
  if (provinceId === '06') return ZONES.find((z) => z.id === (departamento && GBA_PARTIDOS.has(norm(departamento)) ? 'gba' : 'bsas'));
  return ZONES.find((z) => z.provinceId === provinceId);
}

export function zoneMask(ids: string[]): number {
  return ids.reduce((m, id) => {
    const i = ZONES.findIndex((z) => z.id === id);
    return i < 0 ? m : m | (1 << i);
  }, 0);
}

/** ¿La oferta se puede comprar con entrega o retiro en esa zona? Sin dato de zonas, se asume que sí. */
export function offerReaches(o: Offer, zoneId: string | null): boolean {
  if (!zoneId || o.zones === undefined) return true;
  const i = ZONES.findIndex((z) => z.id === zoneId);
  return i < 0 || (o.zones & (1 << i)) !== 0;
}

/** Productos con solo las ofertas que llegan a la zona (y su precio mínimo ahí); los que no llegan, afuera. */
export function forZone(products: Product[], zoneId: string | null): Product[] {
  if (!zoneId) return products;
  const out: Product[] = [];
  for (const p of products) {
    const offers = p.offers.filter((o) => o.available && offerReaches(o, zoneId));
    if (!offers.length) continue;
    out.push(offers.length === p.offers.length ? p : { ...p, offers, priceMin: Math.min(...offers.map((o) => o.price)) });
  }
  return out;
}

export const zoneName = (id: string | null) => (id ? ZONES.find((z) => z.id === id)?.name : undefined);
