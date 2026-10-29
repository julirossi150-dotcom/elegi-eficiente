import type { CategoryId, EnergyLabel, EnergySource, Specs } from '../../lib/types';

/** Un producto tal como lo publica UNA tienda, ya normalizado. */
export interface Listing {
  store: string;
  storeProductId: string;
  category: CategoryId;
  name: string;
  brand: string;
  model?: string;
  ean?: string;
  image?: string;
  url: string;
  price: number;
  listPrice?: number;
  available: boolean;
  checkedAt: string;
  energy: EnergySource;
  /** energía deducida (no explícita): se pisa con la de otra tienda si la hay */
  energyGuessed?: boolean;
  label: EnergyLabel;
  specs: Specs;
}
