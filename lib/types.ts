// Contrato de datos compartido entre el pipeline (pipeline/) y la web (app/).
// Los archivos generados viven en public/data/ y son el "JSON público descargable".

export const CATEGORY_IDS = ['heladeras', 'aires', 'lavarropas', 'calefones', 'termotanques', 'calefactores'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export type EnergySource = 'electricidad' | 'gas_natural' | 'gas_envasado' | 'multigas';

/** Escala de la etiqueta: "nueva" = Res. SIC 438/2024 (A–G reescalada, vigente desde 5/3/2026); "anterior" = esquemas IRAM/ENARGAS previos. */
export type LabelScale = 'nueva' | 'anterior' | 'desconocida';

/** De dónde sale cada dato. Se muestra en la web junto al valor. */
export type DataOrigin =
  | 'tienda' // ficha técnica publicada por el comercio
  | 'fabricante' // ficha o etiqueta del fabricante (QR, PDF)
  | 'manual' // cargado a mano por el equipo, con fuente
  | 'estimado'; // calculado por nosotros (p. ej. a partir de clase + capacidad)

export interface Provenance {
  origin: DataOrigin;
  /** id de tienda (ver Meta.stores) o URL de la fuente */
  source?: string;
  note?: string;
}

export interface EnergyLabel {
  /** Clase tal como figura: "A", "B", "A+", "A+++"… null si no se conoce */
  cls: string | null;
  scale: LabelScale;
  /** Texto original encontrado, para auditoría */
  raw?: string;
}

/** Especificaciones normalizadas. Todas opcionales: cada categoría usa las suyas. */
export interface Specs {
  powerW?: number;

  // Heladeras / freezers
  fridgeType?: 'heladera' | 'heladera_con_freezer' | 'freezer' | 'bajo_mesada' | 'side_by_side';
  totalVolumeL?: number;
  freezerVolumeL?: number;
  frostFree?: boolean;
  /** Consumo anual declarado en etiqueta (kWh/año) */
  kwhPerYear?: number;

  // Aires acondicionados
  acType?: 'split' | 'portatil' | 'ventana' | 'piso_techo' | 'otro';
  inverter?: boolean;
  heatPump?: boolean;
  coolingCapacityW?: number;
  heatingCapacityW?: number;
  frigorias?: number;
  coolingPowerW?: number;
  heatingPowerW?: number;
  eer?: number;
  cop?: number;
  /** Índices estacionales si la etiqueta los informa (equipos inverter) */
  seer?: number;
  scop?: number;
  /** Consumo de energía informado en la etiqueta para refrigeración (kWh) y horas que supone */
  labelCoolingKwh?: number;
  labelCoolingHours?: number;

  // Lavarropas
  washerType?: 'automatico' | 'semiautomatico' | 'lavasecarropas';
  loading?: 'frontal' | 'superior';
  capacityKg?: number;
  kwhPerCycle?: number;
  waterLPerCycle?: number;

  // Agua caliente (calefones y termotanques)
  heaterType?: 'calefon' | 'termotanque' | 'bomba_de_calor';
  flowLMin?: number;
  storageL?: number;
  /** Rendimiento térmico declarado (%) para gas */
  efficiencyPct?: number;
  hasPilot?: boolean;
  /** Consumo de piloto / pasivo (m³/día de gas natural) */
  pilotM3PerDay?: number;
  /** Consumo de mantenimiento de termotanques a gas (m³/día) o pérdidas eléctricas (kWh/24 h) */
  maintenanceM3PerDay?: number;
  standbyKwhPer24h?: number;
  gasPowerKcalH?: number;
  /** Recuperación declarada (L/h calentados 20 °C) de termotanques a gas */
  recoveryLH?: number;
  /** "Consumo medio en condiciones normalizadas" de la etiqueta ENARGAS (m³/año de gas natural) */
  labelM3Year?: number;

  // Calefactores y estufas (la potencia a gas va en gasPowerKcalH, la eléctrica en powerW)
  roomHeaterType?: 'tiro_balanceado' | 'sin_salida' | 'infrarroja' | 'catalitica' | 'caloventor' | 'convector' | 'cuarzo' | 'halogena' | 'panel' | 'radiador' | 'otro';
}
export type SpecKey = keyof Specs;

export interface Offer {
  /** id de tienda, p. ej. "fravega" */
  store: string;
  price: number;
  listPrice?: number;
  url: string;
  available: boolean;
  /** ISO 8601 */
  checkedAt: string;
}

export interface Product {
  /** estable: `${categoria}:${marca}:${modelo}` normalizado */
  id: string;
  category: CategoryId;
  name: string;
  brand: string;
  model: string | null;
  ean: string[];
  image?: string;
  energy: EnergySource;
  label: EnergyLabel;
  specs: Specs;
  /** Origen de cada especificación y de la etiqueta */
  provenance: Partial<Record<SpecKey | 'label', Provenance>>;
  offers: Offer[];
  /** Menor precio entre ofertas disponibles (ARS), null si no hay stock */
  priceMin: number | null;
  /** ISO date (YYYY-MM-DD) */
  firstSeen: string;
  lastSeen: string;
  /**
   * completo: hay datos de etiqueta suficientes para calcular consumo;
   * estimado: el consumo se estima (p. ej. desde clase + capacidad);
   * insuficiente: no se puede calcular el costo de uso.
   */
  quality: 'completo' | 'estimado' | 'insuficiente';
}

export interface CategoryFile {
  category: CategoryId;
  generatedAt: string;
  count: number;
  products: Product[];
}

export interface StoreStatus {
  id: string;
  name: string;
  url: string;
  ok: boolean;
  products: number;
  error?: string;
}

export interface Meta {
  schemaVersion: 1;
  generatedAt: string;
  categories: { id: CategoryId; count: number; withConsumption: number; withPrice: number }[];
  stores: StoreStatus[];
}
