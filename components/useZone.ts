'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadPref, savePref } from '@/lib/storage';
import { zoneFromGeoref } from '@/lib/zones';

export type LocateStatus = 'idle' | 'locating' | 'denied' | 'error' | 'outside';

export interface ZoneState {
  /** zona elegida (lib/zones) o null = todo el país */
  zoneId: string | null;
  setZone: (id: string | null) => void;
  status: LocateStatus;
  /** pide la ubicación al navegador y la traduce a zona con la API Georef (datos.gob.ar) */
  detect: () => void;
}

const GEOREF = 'https://apis.datos.gob.ar/georef/api/ubicacion';

/**
 * Zona del visitante, compartida entre páginas (se guarda en el navegador). En la primera visita se pide la ubicación
 * una sola vez; si el visitante no la da, se muestra todo el país y puede elegir la zona a mano.
 */
export function useZone(): ZoneState {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [status, setStatus] = useState<LocateStatus>('idle');

  const setZone = useCallback((id: string | null) => {
    setZoneId(id);
    savePref('zone', { id, asked: true });
  }, []);

  const detect = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('error');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // 2 decimales (~1 km) alcanzan para saber provincia y partido
          const lat = pos.coords.latitude.toFixed(2);
          const lon = pos.coords.longitude.toFixed(2);
          const res = await fetch(`${GEOREF}?lat=${lat}&lon=${lon}`);
          const j = (await res.json()) as { ubicacion?: { provincia?: { id?: string }; departamento?: { nombre?: string } } };
          const prov = j.ubicacion?.provincia?.id;
          const zone = prov ? zoneFromGeoref(prov, j.ubicacion?.departamento?.nombre ?? undefined) : undefined;
          if (!zone) {
            setStatus('outside');
            return;
          }
          setZone(zone.id);
          setStatus('idle');
        } catch {
          setStatus('error');
        }
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { maximumAge: 3_600_000, timeout: 15_000 },
    );
  }, [setZone]);

  useEffect(() => {
    const saved = loadPref<{ id: string | null; asked?: boolean }>('zone', { id: null });
    if (saved.id) setZoneId(saved.id);
    else if (!saved.asked) {
      savePref('zone', { id: null, asked: true });
      detect();
    }
  }, [detect]);

  return { zoneId, setZone, status, detect };
}
