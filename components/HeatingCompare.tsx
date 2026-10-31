'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import SettingsPanel from '@/components/comparator/SettingsPanel';
import { compareHeating, DEFAULT_SCENARIO, DEFAULT_USAGE, heatRequiredKcalH, type CostRow, type Scenario, type Usage } from '@/lib/cost';
import { formatARS, formatDate } from '@/lib/format';
import { withBase } from '@/lib/site';
import { loadPref, savePref } from '@/lib/storage';
import { forZone, zoneName } from '@/lib/zones';
import { useTariffs } from '@/components/useTariffs';
import { useZone } from '@/components/useZone';
import type { CategoryFile, Meta } from '@/lib/types';

const SCENARIO_KEY = 'scenario:calefaccion';

function fetchCategory(id: string) {
  return fetch(withBase(`/data/${id}.json`)).then((r) => (r.ok ? (r.json() as Promise<CategoryFile>) : Promise.reject(new Error(`HTTP ${r.status}`))));
}

function Equipment({ label, row, storeNames }: { label: string; row: CostRow; storeNames: Record<string, string> }) {
  const offer = row.product.offers.filter((o) => o.available).sort((a, b) => a.price - b.price)[0];
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm leading-snug text-white">{row.product.name}</p>
      <p className="tabular mt-1 text-sm text-white">
        {formatARS(row.price!)}
        {offer && (
          <a href={offer.url} target="_blank" rel="noopener noreferrer nofollow" className="focus-ring ml-2 inline-flex items-center gap-1 rounded text-xs text-mint hover:underline">
            <Icon name="store" size={13} /> {storeNames[offer.store] ?? offer.store}
          </a>
        )}
      </p>
    </div>
  );
}

export default function HeatingCompare() {
  const [products, setProducts] = useState<CategoryFile['products'] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [usage, setUsageState] = useState<Usage>(DEFAULT_USAGE);
  const [scenario, setScenarioState] = useState<Scenario>(DEFAULT_SCENARIO);
  const zone = useZone();
  // tarifa oficial de la zona por defecto, con los cambios del visitante encima
  const { tariffs, setTariffs, defaults: tariffDefaults } = useTariffs(zone.zoneId);

  // Mismas preferencias que el comparador: el ambiente y la tarifa que cargaste allá valen acá
  useEffect(() => {
    setUsageState(loadPref('usage', DEFAULT_USAGE));
    setScenarioState(loadPref(SCENARIO_KEY, DEFAULT_SCENARIO));
  }, []);
  const setUsage = (u: Usage) => (setUsageState(u), savePref('usage', u));
  const setScenario = (s: Scenario) => (setScenarioState(s), savePref(SCENARIO_KEY, s));

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchCategory('aires'),
      fetchCategory('calefactores'),
      fetch(withBase('/data/meta.json'))
        .then((r) => (r.ok ? (r.json() as Promise<Meta>) : null))
        .catch(() => null),
    ])
      .then(([a, c, m]) => {
        if (!alive) return;
        setProducts([...a.products, ...c.products]);
        setGeneratedAt(c.generatedAt);
        setMeta(m);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const storeNames = useMemo(() => Object.fromEntries((meta?.stores ?? []).map((s) => [s.id, s.name])), [meta]);
  const options = useMemo(
    () => (products ? compareHeating(forZone(products, zone.zoneId), usage, tariffs, scenario) : []),
    [products, zone.zoneId, usage, tariffs, scenario],
  );
  const maxAnnual = Math.max(1, ...options.map((o) => o.annualEnergyCost ?? 0));
  const need = heatRequiredKcalH(usage);

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <aside id="ajustes" className="order-2 scroll-mt-4 lg:order-none lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <SettingsPanel
          category="calefactores"
          usage={usage}
          setUsage={setUsage}
          tariffs={tariffs}
          setTariffs={setTariffs}
          scenario={scenario}
          setScenario={setScenario}
          usesGas
          usesElectricity
          zone={zone}
          tariffDefaults={tariffDefaults}
        />
      </aside>

      {/* En el celular primero la respuesta; los datos se ajustan abajo */}
      <div className="order-1 min-w-0 space-y-6 lg:order-none">
        {error && (
          <p className="rounded-2xl bg-coral/15 p-4 text-sm text-coral">
            No pudimos cargar los datos ({error}). Probá recargar la página.
          </p>
        )}
        {!products && !error && <p className="rounded-2xl bg-ink-2 p-6 text-muted">Cargando equipos…</p>}

        {products && (
          <>
            <section aria-labelledby="gasto-t" className="rounded-3xl bg-ink-2 p-5">
              <h2 id="gasto-t" className="font-semibold text-white">
                Gasto de energía por año
              </h2>
              <p className="mt-1 text-sm text-muted">
                Para dar ~{need.toLocaleString('es-AR')} kcal/h en tu ambiente, {usage.heatingDaysYear} días × {usage.heatingHoursDay} h, con{' '}
                {tariffs.gasKind === 'natural' ? 'gas de red' : 'garrafa'}
                {zone.zoneId && `, con tiendas que llegan a ${zoneName(zone.zoneId)}`}.{' '}
                <a href="#ajustes" className="focus-ring rounded text-mint hover:underline lg:hidden">
                  Cambiar mis datos
                </a>
              </p>
              <ul className="mt-5 space-y-4">
                {options.map((o) => (
                  <li key={o.tech.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-white">{o.tech.name}</span>
                      <span className="tabular font-semibold whitespace-nowrap text-white">{o.annualEnergyCost !== null ? formatARS(o.annualEnergyCost) : '—'}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 rounded-full bg-ink">
                      <div
                        className="h-full rounded-full bg-amber"
                        style={{ width: `${o.annualEnergyCost !== null ? Math.max(2, (o.annualEnergyCost / maxAnnual) * 100) : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="equipos-t" className="space-y-4">
              <h2 id="equipos-t" className="text-lg font-semibold text-white">
                Equipo + energía a {scenario.years} años
                {generatedAt && <span className="ml-2 text-sm font-normal text-muted">· precios al {formatDate(generatedAt)}</span>}
              </h2>
              <ol className="space-y-3">
                {options.map((o, i) => (
                  <li key={o.tech.id} className={`rounded-3xl p-5 ${i === 0 && o.best ? 'bg-leaf' : 'bg-ink-2'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="flex items-center gap-2 font-semibold text-white">
                          <Icon name={o.tech.category} size={20} /> {o.tech.name}
                        </h3>
                        {i === 0 && o.best && <p className="mt-1 text-sm text-white/80">Menor costo total para tu ambiente</p>}
                      </div>
                      {o.best && (
                        <div className="text-right">
                          <p className="tabular text-2xl font-bold text-sun">{formatARS(o.best.tco!)}</p>
                          <p className="tabular text-xs text-white/70">
                            {formatARS(o.best.price!)} + {formatARS(o.best.tco! - o.best.price!)} de energía
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-white/80">{o.tech.note}</p>
                    {o.tech.warning && (
                      <p className="mt-2 flex items-start gap-2 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
                        <Icon name="info" size={16} /> {o.tech.warning}
                      </p>
                    )}
                    {o.best ? (
                      <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
                        <Equipment label="Menor costo total" row={o.best} storeNames={storeNames} />
                        {o.cheapest && o.cheapest !== o.best && <Equipment label="Más barato de comprar" row={o.cheapest} storeNames={storeNames} />}
                      </div>
                    ) : (
                      <p className="mt-4 border-t border-white/10 pt-4 text-sm text-muted">
                        No encontramos equipos de este tipo con precio y potencia para tu ambiente
                        {o.tech.id === 'electrica' && ` (harían falta unos ${Math.round((need / 860) * 1000).toLocaleString('es-AR')} W)`}.
                      </p>
                    )}
                    <Link href={`/comparar/${o.tech.category}/`} className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded text-sm text-mint hover:underline">
                      Ver {o.count > 0 ? `los ${o.count} equipos` : 'todos'} <Icon name="arrow-right" size={14} />
                    </Link>
                  </li>
                ))}
              </ol>
              <p className="text-xs leading-relaxed text-faint">
                Comparamos solo el calor: el aire además enfría en verano. Elegimos, dentro de cada tecnología, los equipos con la potencia adecuada
                para tu ambiente. El gasto de energía es el típico de cada tecnología; el detalle de cada equipo está en su comparador.{' '}
                <Link href="/metodologia/#calefaccion" className="text-mint hover:underline">
                  Cómo calculamos
                </Link>
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
