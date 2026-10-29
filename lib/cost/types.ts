import type { CategoryId, Product } from '../types';

/** Tarifas variables que carga el usuario (de su factura). Valores en ARS con impuestos. */
export interface Tariffs {
  electricityPerKwh: number;
  gasNaturalPerM3: number;
  glpPerKg: number;
  /** Qué gas usa el hogar para los artefactos a gas */
  gasKind: 'natural' | 'envasado';
}

export interface Scenario {
  /** Horizonte de comparación en años */
  years: number;
  /** Aumento anual de la tarifa por encima de la inflación (%). 0 = tarifa real constante. */
  realTariffGrowthPct: number;
}

/** Perfil de uso del hogar. Cada categoría usa los campos que le corresponden. */
export interface Usage {
  people: number;
  /** Aires: horas de uso por año en frío y en calor */
  acCoolingHoursYear: number;
  acHeatingHoursYear: number;
  acUseHeating: boolean;
  /** Lavarropas: lavados por semana */
  washCyclesPerWeek: number;
  /** Agua caliente: litros por persona por día (a ~40 °C de uso) y temperaturas */
  hotWaterLPerPersonDay: number;
  coldWaterTempC: number;
  hotWaterTempC: number;
}

export interface EnergyEstimate {
  kwhYear: number;
  m3Year: number;
  kgGlpYear: number;
  waterLYear: number;
  /** "etiqueta" si sale de valores declarados; "estimado" si hubo que suponer algo importante */
  basis: 'etiqueta' | 'estimado';
  /** Explicación corta de cómo se calculó, para mostrar al usuario */
  steps: string[];
}

export interface CostRow {
  product: Product;
  price: number | null;
  estimate: EnergyEstimate | null;
  /** Costo de energía del primer año (ARS) */
  annualEnergyCost: number | null;
  /** Costo de energía acumulado por año: index 0 = fin del año 1 */
  energyByYear: number[];
  /** Precio + energía en el horizonte; null si falta precio o consumo */
  tco: number | null;
  co2KgYear: number | null;
}

export type UsageFieldKey = keyof Usage;

export interface UsageField {
  key: UsageFieldKey;
  label: string;
  help?: string;
  type: 'number' | 'toggle';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export type CategoryUsageFields = Record<CategoryId, UsageField[]>;
