// Fuentes y reglas de selección de categorías. Para sumar una tienda VTEX basta con agregarla a STORES.
import type { CategoryId } from '../lib/types';

export interface StoreConfig {
  id: string;
  name: string;
  host: string;
  url: string;
  /** tienda oficial de fabricante: para estas marcas sus fichas valen como dato de fabricante y pisan a las demás tiendas */
  manufacturerOf?: string[];
}

export const STORES: StoreConfig[] = [
  { id: 'fravega', name: 'Frávega', host: 'www.fravega.com', url: 'https://www.fravega.com' },
  { id: 'cetrogar', name: 'Cetrogar', host: 'www.cetrogar.com.ar', url: 'https://www.cetrogar.com.ar' },
  { id: 'oncity', name: 'OnCity', host: 'www.oncity.com', url: 'https://www.oncity.com' },
  { id: 'naldo', name: 'Naldo', host: 'www.naldo.com.ar', url: 'https://www.naldo.com.ar' },
  { id: 'carrefour', name: 'Carrefour', host: 'www.carrefour.com.ar', url: 'https://www.carrefour.com.ar' },
  { id: 'jumbo', name: 'Jumbo', host: 'www.jumbo.com.ar', url: 'https://www.jumbo.com.ar' },
  { id: 'easy', name: 'Easy', host: 'www.easy.com.ar', url: 'https://www.easy.com.ar' },
  // tiendas oficiales de fabricantes (también venden, así que suman ofertas)
  { id: 'whirlpool', name: 'Whirlpool (oficial)', host: 'www.whirlpool.com.ar', url: 'https://www.whirlpool.com.ar', manufacturerOf: ['Whirlpool'] },
  { id: 'electrolux', name: 'Electrolux (oficial)', host: 'www.tienda.electrolux.com.ar', url: 'https://www.tienda.electrolux.com.ar', manufacturerOf: ['Electrolux', 'GAFA'] },
  { id: 'bgh', name: 'BGH (oficial)', host: 'www.bgh.com.ar', url: 'https://www.bgh.com.ar', manufacturerOf: ['BGH'] },
];

/**
 * Reglas sobre el árbol de categorías de cada tienda (texto normalizado, sin acentos).
 * Se eligen los nodos cuyo NOMBRE coincide con `node` (y no con `excludeNode`) y cuya RUTA no coincide con `excludePath`;
 * si un nodo elegido tiene descendientes elegidos, se usan solo los descendientes (más específicos).
 */
export const CATEGORY_RULES: Record<CategoryId, { node: RegExp; excludeNode?: RegExp; excludePath: RegExp }> = {
  heladeras: {
    node: /heladera|freezer|congelador/,
    // "cava" solo en el nodo: hay tiendas cuyo padre se llama "Heladeras, Freezers y Cavas"
    excludeNode: /cava|exhibidora|bolsa/,
    excludePath: /comercial|gastronom|no usar|no se usa|instalacion|servicio|accesorio|repuesto/,
  },
  aires: {
    node: /^aires? acondicionados?( split( inverter| on.?off)?| portatiles?| de ventana)?$/,
    excludePath: /instalacion|servicio|accesorio|repuesto|no usar|no se usa/,
  },
  lavarropas: {
    node: /^lava(seca)?rropas/,
    excludePath: /instalacion|servicio|accesorio|repuesto|no usar|no se usa/,
  },
  calefones: {
    node: /calefon/,
    excludePath: /electric|instalacion|servicio|accesorio|repuesto|no usar|no se usa/,
  },
  termotanques: {
    node: /termotanque/,
    excludePath: /solar|instalacion|servicio|accesorio|repuesto|no usar|no se usa/,
  },
  calefactores: {
    node: /calefacci|calefactor|estufa|caloventor|convector|paneles de mica|^radiadores$/,
    excludeNode: /lena|exterior|accesorio|salamandra|ecologic|calefon|termotanque|caldera|climatizacion inteligente/,
    excludePath: /instalacion|servicio|accesorio|repuesto|no usar|no se usa|jardin|pileta|autoparte|compra internacional|outlet|days|lena/,
  },
};

/** Filtro por nombre de producto: debe coincidir `include` y no coincidir `exclude`. */
export const PRODUCT_RULES: Record<CategoryId, { include: RegExp; exclude: RegExp }> = {
  heladeras: {
    include: /heladera|freezer|congelador|refrigerador|frigobar|side by side|french door/,
    exclude:
      /termoelectric|portatil 12|12v|cava|vino|exhibidora|organizador|huevera|repuesto|accesorio|burlete|estante|bandeja|filtro|cubre|funda|manija|kit |conservadora|botella/,
  },
  aires: {
    include: /aire|split|acondicionad/,
    exclude: /soporte|kit|instalacion|filtro|accesorio|cubre|funda|control remoto|caneria|bomba de desagote|ventilador|purificador|deshumidificador|cortina|repuesto/,
  },
  lavarropas: {
    include: /lavarropa|lavasecarropa/,
    exclude: /soporte|base|funda|cubre|repuesto|accesorio|manguera|filtro|pie |patas|kit/,
  },
  calefones: {
    include: /calefon/,
    exclude: /electric|kit|valvula|repuesto|accesorio|flexible|conector|soporte|termocupla|instalacion/,
  },
  termotanques: {
    include: /termotanque/,
    exclude: /solar|kit|valvula|repuesto|accesorio|flexible|conector|soporte|anodo|resistencia para|termostato|instalacion/,
  },
  calefactores: {
    include: /calefactor|estufa|caloventor|convector|panel|radiador|tiro balanceado|calefaccion|infrarroj|catalitic|cuarzo|halogen/,
    exclude:
      /lena|pellet|salamandra|exterior|patio|parrilla|kit|repuesto|accesorio|conector|flexible|termocupla|valvula|regulador|soporte|ventilador|aire acondicionado|split|bolsa|manta|almohad|cobertor|toallero|bioetanol|chimenea|diesel|kerosen|parafina|industrial|canon|calefon|termotanque|pileta|auto|cama|pies|zapat/,
  },
};
