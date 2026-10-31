'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Tariffs } from '@/lib/cost';
import { withBase } from '@/lib/site';
import { loadPref, savePref } from '@/lib/storage';
import { tariffDefaults, tariffOverrides, type OfficialTariffs, type TariffDefaults } from '@/lib/tariffs';

const KEY = 'tariffs-user';
/** Valores por defecto de la versión anterior, que guardaba la tarifa completa: lo que coincide con ellos no lo cambió el visitante */
const LEGACY_DEFAULTS: Tariffs = { electricityPerKwh: 190, gasNaturalPerM3: 700, glpPerKg: 2000, gasKind: 'natural' };

/**
 * Tarifa del visitante = valores por defecto oficiales de su zona + lo que él cambió. Se guardan solo sus cambios,
 * así los valores oficiales se actualizan cada mes sin pisar lo que cargó de su factura.
 */
export function useTariffs(zoneId: string | null): { tariffs: Tariffs; setTariffs: (t: Tariffs) => void; defaults: TariffDefaults } {
  const [official, setOfficial] = useState<OfficialTariffs | null>(null);
  const [overrides, setOverrides] = useState<Partial<Tariffs>>({});

  useEffect(() => {
    let saved = loadPref<Partial<Tariffs>>(KEY, {});
    if (!Object.keys(saved).length) {
      // Preferencia de la versión anterior (tarifa completa): se conservan solo los valores que el visitante había cambiado
      const old = loadPref<Partial<Tariffs>>('tariffs', {});
      saved = Object.keys(old).length ? tariffOverrides({ ...LEGACY_DEFAULTS, ...old }, LEGACY_DEFAULTS) : {};
    }
    setOverrides(saved);
    let alive = true;
    fetch(withBase('/data/tarifas.json'))
      .then((r) => (r.ok ? (r.json() as Promise<OfficialTariffs>) : null))
      .then((o) => alive && setOfficial(o))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const defaults = useMemo(() => tariffDefaults(official, zoneId), [official, zoneId]);
  const tariffs = useMemo(() => ({ ...defaults.values, ...overrides }), [defaults, overrides]);
  const setTariffs = (t: Tariffs) => {
    const o = tariffOverrides(t, defaults.values);
    setOverrides(o);
    savePref(KEY, o);
  };
  return { tariffs, setTariffs, defaults };
}
