// Constantes físicas y valores por defecto. Cada valor lleva su fuente para la página de metodología.
// Los valores de tarifa son SOLO de referencia: el usuario carga los de su factura.
import type { CategoryId } from '../types';
import type { Scenario, Tariffs, Usage } from './types';

export interface SourcedConstant {
  value: number;
  unit: string;
  label: string;
  source: string;
  url?: string;
}

export const PHYSICS = {
  /** Poder calorífico superior del gas natural distribuido en Argentina */
  gasNaturalKcalPerM3: { value: 9300, unit: 'kcal/m³', label: 'Poder calorífico del gas natural', source: 'm³ de 9.300 kcal con que se factura (Res. ENARGAS 32/03); base de las etiquetas NAG-313/314', url: 'https://argentina.gob.ar/normativa/319719_res32-03_pdf/archivo' },
  /** Poder calorífico del GLP (butano/propano) */
  glpKcalPerKg: { value: 11948, unit: 'kcal/kg', label: 'Poder calorífico del GLP', source: 'NAG-313/314, gas de la familia 3P (22.486 kcal/m³)' },
  /** Calor específico del agua: 1 kcal por litro por °C */
  waterKcalPerLC: { value: 1, unit: 'kcal/(L·°C)', label: 'Calor específico del agua', source: 'Física' },
  kwhPerKcal: { value: 1 / 860, unit: 'kWh/kcal', label: 'Conversión de energía', source: '1 kWh = 860 kcal' },
  wattsPerFrigoria: { value: 1.163, unit: 'W por frigoría/h', label: 'Frigorías a watts', source: '1 frigoría/h = 1 kcal/h = 1,163 W' },
} satisfies Record<string, SourcedConstant>;

export const EMISSIONS = {
  gridKgCo2PerKwh: { value: 0.4, unit: 'kg CO₂/kWh', label: 'Factor de emisión de la red eléctrica', source: 'Secretaría de Energía, factor de emisión de la red argentina (orden de magnitud)' },
  gasKgCo2PerM3: { value: 1.95, unit: 'kg CO₂/m³', label: 'Gas natural', source: 'IPCC 2006, factor por defecto gas natural' },
  glpKgCo2PerKg: { value: 3.0, unit: 'kg CO₂/kg', label: 'GLP', source: 'IPCC 2006, factor por defecto GLP' },
} satisfies Record<string, SourcedConstant>;

export const DEFAULT_TARIFFS: Tariffs = {
  electricityPerKwh: 190,
  gasNaturalPerM3: 700,
  glpPerKg: 2000,
  gasKind: 'natural',
};

export const TARIFF_SOURCES: Record<keyof Omit<Tariffs, 'gasKind'>, string> = {
  electricityPerKwh: 'Referencia AMBA, tarifa residencial sin subsidio con impuestos (aprox.)',
  gasNaturalPerM3: 'Referencia AMBA, tarifa residencial con impuestos (aprox.)',
  glpPerKg: 'Garrafa de 10 kg, precio de mercado (aprox.)',
};

export const DEFAULT_SCENARIO: Scenario = { years: 10, realTariffGrowthPct: 0 };

export const DEFAULT_USAGE: Usage = {
  people: 3,
  acCoolingHoursYear: 600,
  acHeatingHoursYear: 300,
  acUseHeating: false,
  acAreaM2: 20,
  acCeilingM: 2.6,
  acHighLoad: false,
  washCyclesPerWeek: 4,
  hotWaterLPerPersonDay: 50,
  coldWaterTempC: 17,
  hotWaterTempC: 42,
};

/** Vida útil típica para sugerir el horizonte por categoría */
export const LIFESPAN_YEARS: Record<CategoryId, number> = {
  heladeras: 14,
  aires: 12,
  lavarropas: 12,
  calefones: 12,
  termotanques: 10,
};

/** Supuestos por categoría usados en el cálculo (se muestran en metodología) */
export const ASSUMPTIONS = {
  /** Rendimiento de un termotanque eléctrico para calentar agua (resistencia sumergida) */
  electricHeaterEfficiency: 0.95,
  /** Rendimiento supuesto si un artefacto a gas no informa el suyo (rendimiento medio del parque, ENARGAS 2020) */
  gasHeaterEfficiencyFallback: 0.75,
  /** Consumo típico medido de un piloto encendido (ENARGAS 2020: ≈ 0,5 m³/día) */
  pilotM3PerDayFallback: 0.5,
  /**
   * Carga térmica media mientras el aire está prendido, como fracción de su capacidad nominal.
   * Es la misma para todos los equipos: la ventaja del inverter aparece por su índice estacional (SEER/SCOP).
   */
  acLoadFactor: 0.6,
  /** Dimensionamiento del aire: frigorías por m³ de ambiente (regla práctica habitual en Argentina) */
  acFrigoriasPerM3: 50,
  /** Recargo de carga térmica con mucho sol, último piso o poco aislamiento */
  acHighLoadFactor: 1.2,
  /** Rango de capacidad que se considera adecuado, como fracción de la recomendada */
  acSizeTolerance: [0.95, 1.5] as const,
  /** COP típico de un termotanque bomba de calor si no lo informa */
  heatPumpWaterCopFallback: 3,
};
