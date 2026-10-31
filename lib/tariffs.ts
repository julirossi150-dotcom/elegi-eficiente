// Tarifas de referencia oficiales (public/data/tarifas.json), que el pipeline baja cada día de los cuadros tarifarios
// vigentes: luz del ente regulador nacional (AMBA) y gas natural de ENARGAS (todas las distribuidoras). Son los valores
// por defecto; el visitante los reemplaza por los de su factura.
import { DEFAULT_TARIFFS, TARIFF_SOURCES } from './cost/constants';
import type { Tariffs } from './cost/types';

export interface OfficialGasZone {
  /** cargo variable residencial con IVA ($/m³) */
  perM3: number;
  distributor: string;
  subzone: string;
}

export interface OfficialTariffs {
  generatedAt: string;
  /** IVA aplicado a los cargos del cuadro tarifario (que se publican sin impuestos) */
  vat: number;
  electricity: {
    /** cargo variable con IVA ($/kWh), promedio de Edenor y Edesur, residencial sin subsidio R2 (151–400 kWh/mes) */
    perKwh: number;
    /** "10/2026" */
    period: string;
    url: string;
  } | null;
  gas: {
    /** "01/10/2026" */
    since: string;
    url: string;
    /** por zona (lib/zones); sin entrada = la zona no tiene red de gas */
    byZone: Record<string, OfficialGasZone>;
  } | null;
}

export interface TariffDefaults {
  values: Tariffs;
  /** texto corto de dónde sale cada valor por defecto */
  notes: Record<'electricityPerKwh' | 'gasNaturalPerM3' | 'glpPerKg', string>;
}

const FALLBACK_NOTES: TariffDefaults['notes'] = { ...TARIFF_SOURCES };

/** Valores por defecto para la zona: los oficiales si están, y si no los de referencia fijos. */
export function tariffDefaults(official: OfficialTariffs | null, zoneId: string | null): TariffDefaults {
  const values: Tariffs = { ...DEFAULT_TARIFFS };
  const notes = { ...FALLBACK_NOTES };
  const e = official?.electricity;
  if (e) {
    values.electricityPerKwh = e.perKwh;
    notes.electricityPerKwh = `Cuadro tarifario ${e.period} de Edenor y Edesur (ente regulador nacional), residencial sin subsidio, con IVA. Fuera del AMBA puede variar.`;
  }
  const g = official?.gas;
  const gz = g && (g.byZone[zoneId ?? 'caba'] ?? g.byZone.caba);
  if (g && gz) {
    values.gasNaturalPerM3 = gz.perM3;
    notes.gasNaturalPerM3 = `Cuadro tarifario de ENARGAS vigente desde ${g.since}: ${gz.distributor}, ${gz.subzone}, residencial, con IVA.`;
  }
  // Sin red de gas en la zona: por defecto, garrafa
  if (g && zoneId && !g.byZone[zoneId]) values.gasKind = 'envasado';
  return { values, notes };
}

/** Solo los campos que el visitante cambió respecto de los valores por defecto (así los defaults pueden actualizarse). */
export function tariffOverrides(t: Tariffs, defaults: Tariffs): Partial<Tariffs> {
  const out: Partial<Tariffs> = {};
  for (const k of Object.keys(t) as (keyof Tariffs)[]) if (t[k] !== defaults[k]) (out as Record<string, unknown>)[k] = t[k];
  return out;
}
