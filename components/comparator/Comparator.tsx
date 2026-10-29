'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { computeRow, DEFAULT_SCENARIO, DEFAULT_TARIFFS, DEFAULT_USAGE, LIFESPAN_YEARS, type CostRow, type Scenario, type Tariffs, type Usage } from '@/lib/cost';
import { formatARS, formatDate } from '@/lib/format';
import { withBase } from '@/lib/site';
import { CAPACITY_UNIT, capacityOf, subtypeOf } from '@/lib/specs';
import { loadPref, savePref } from '@/lib/storage';
import type { CategoryFile, CategoryId, Meta, Product } from '@/lib/types';
import CompareView from './CompareView';
import ProductRow, { type RowBadge } from './ProductRow';
import SettingsPanel from './SettingsPanel';

type SortKey = 'tco' | 'price' | 'energy';
const MAX_COMPARE = 4;
/** Rango de tamaño inicial: comparar equipos equivalentes (el usuario lo cambia). */
const DEFAULT_CAPACITY: Record<CategoryId, [string, string]> = {
  heladeras: ['250', '450'],
  aires: ['2500', '3500'],
  lavarropas: ['6', '9'],
  calefones: ['', ''],
  termotanques: ['50', '120'],
};
const PAGE = 30;

function gasCompatible(p: Product, kind: Tariffs['gasKind']) {
  if (p.energy === 'electricidad' || p.energy === 'multigas') return true;
  return kind === 'natural' ? p.energy === 'gas_natural' : p.energy === 'gas_envasado';
}

export default function Comparator({ category }: { category: CategoryId }) {
  const [data, setData] = useState<CategoryFile | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [usage, setUsageState] = useState<Usage>(DEFAULT_USAGE);
  const [tariffs, setTariffsState] = useState<Tariffs>(DEFAULT_TARIFFS);
  const [scenario, setScenarioState] = useState<Scenario>({ ...DEFAULT_SCENARIO, years: LIFESPAN_YEARS[category] });

  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [subtype, setSubtype] = useState(category === 'heladeras' ? 'Con freezer' : '');
  const [capMin, setCapMin] = useState(DEFAULT_CAPACITY[category][0]);
  const [capMax, setCapMax] = useState(DEFAULT_CAPACITY[category][1]);
  const [onlyComplete, setOnlyComplete] = useState(true);
  const [sort, setSort] = useState<SortKey>('tco');
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<string[]>([]);

  // Preferencias guardadas en el navegador (solo comodidad)
  useEffect(() => {
    setUsageState(loadPref('usage', DEFAULT_USAGE));
    setTariffsState(loadPref('tariffs', DEFAULT_TARIFFS));
    setScenarioState(loadPref(`scenario:${category}`, { ...DEFAULT_SCENARIO, years: LIFESPAN_YEARS[category] }));
  }, [category]);
  const setUsage = (u: Usage) => (setUsageState(u), savePref('usage', u));
  const setTariffs = (t: Tariffs) => (setTariffsState(t), savePref('tariffs', t));
  const setScenario = (s: Scenario) => (setScenarioState(s), savePref(`scenario:${category}`, s));

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(withBase(`/data/${category}.json`)).then((r) => (r.ok ? (r.json() as Promise<CategoryFile>) : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch(withBase('/data/meta.json'))
        .then((r) => (r.ok ? (r.json() as Promise<Meta>) : null))
        .catch(() => null),
    ])
      .then(([d, m]) => {
        if (!alive) return;
        setData(d);
        setMeta(m);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [category]);

  const storeNames = useMemo(() => Object.fromEntries((meta?.stores ?? []).map((s) => [s.id, s.name])), [meta]);
  const products = useMemo(() => data?.products ?? [], [data]);
  const usesGas = products.some((p) => p.energy !== 'electricidad');
  const usesElectricity = products.some((p) => p.energy === 'electricidad') || category === 'heladeras' || category === 'aires' || category === 'lavarropas';

  const brands = useMemo(() => Array.from(new Set(products.map((p) => p.brand))).sort((a, b) => a.localeCompare(b, 'es')), [products]);
  const subtypes = useMemo(() => Array.from(new Set(products.map(subtypeOf).filter((x): x is string => Boolean(x)))).sort(), [products]);

  const rows = useMemo(() => products.map((p) => computeRow(p, usage, tariffs, scenario)), [products, usage, tariffs, scenario]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const min = capMin ? Number(capMin) : -Infinity;
    const max = capMax ? Number(capMax) : Infinity;
    return rows.filter((r) => {
      const p = r.product;
      if (!gasCompatible(p, tariffs.gasKind)) return false;
      if (brand && p.brand !== brand) return false;
      if (subtype && subtypeOf(p) !== subtype) return false;
      if (needle && !`${p.name} ${p.brand} ${p.model ?? ''}`.toLowerCase().includes(needle)) return false;
      const cap = capacityOf(p);
      if ((capMin || capMax) && (cap === undefined || cap < min || cap > max)) return false;
      if (onlyComplete && (r.tco === null)) return false;
      return true;
    });
  }, [rows, q, brand, subtype, capMin, capMax, onlyComplete, tariffs.gasKind]);

  const sorted = useMemo(() => {
    const key = (r: CostRow) => (sort === 'tco' ? r.tco : sort === 'price' ? r.price : r.annualEnergyCost) ?? Number.POSITIVE_INFINITY;
    return [...filtered].sort((a, b) => key(a) - key(b));
  }, [filtered, sort]);

  const ranked = sorted.filter((r) => r.tco !== null);
  const bestTco = ranked.length ? ranked.reduce((a, b) => (b.tco! < a.tco! ? b : a)) : undefined;
  const cheapest = ranked.length ? ranked.reduce((a, b) => (b.price! < a.price! ? b : a)) : undefined;
  const hiddenIncomplete = rows.filter((r) => r.tco === null && gasCompatible(r.product, tariffs.gasKind)).length;

  const selectedRows = selected.map((id) => rows.find((r) => r.product.id === id)).filter((r): r is CostRow => Boolean(r));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_COMPARE ? [...s, id] : s));

  const unit = CAPACITY_UNIT[category];

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <SettingsPanel
          category={category}
          usage={usage}
          setUsage={setUsage}
          tariffs={tariffs}
          setTariffs={setTariffs}
          scenario={scenario}
          setScenario={setScenario}
          usesGas={usesGas || category === 'calefones' || category === 'termotanques'}
          usesElectricity={usesElectricity}
        />
      </aside>

      <div className="min-w-0 space-y-6">
        {error && (
          <p className="rounded-2xl bg-coral/15 p-4 text-sm text-coral">
            No pudimos cargar los datos ({error}). Probá recargar la página.
          </p>
        )}
        {!data && !error && <p className="rounded-2xl bg-ink-2 p-6 text-muted">Cargando productos…</p>}

        {data && bestTco && cheapest && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-leaf p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-white/80">
                <Icon name="check" size={16} strokeWidth={2.4} /> Menor costo total a {scenario.years} años
              </p>
              <p className="mt-2 leading-snug font-semibold text-white">{bestTco.product.name}</p>
              <p className="tabular mt-2 text-2xl font-bold text-sun">{formatARS(bestTco.tco!)}</p>
              <p className="tabular mt-1 text-sm text-white/75">
                {formatARS(bestTco.price!)} hoy + {formatARS(bestTco.tco! - bestTco.price!)} de energía
              </p>
            </div>
            <div className="rounded-3xl bg-ink-2 p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-muted">
                <Icon name="tag" size={16} /> Más barato hoy
              </p>
              <p className="mt-2 leading-snug font-semibold text-white">{cheapest.product.name}</p>
              <p className="tabular mt-2 text-2xl font-bold text-white">{formatARS(cheapest.price!)}</p>
              <p className="tabular mt-1 text-sm text-muted">
                {cheapest === bestTco
                  ? 'También es el de menor costo total. ¡Doble conveniencia!'
                  : `A ${scenario.years} años te cuesta ${formatARS(cheapest.tco! - bestTco.tco!)} más que el de menor costo total.`}
              </p>
            </div>
          </div>
        )}

        {selectedRows.length >= 2 && <CompareView rows={selectedRows} scenario={scenario} storeNames={storeNames} onRemove={toggle} />}

        {data && (
          <section aria-labelledby="lista-t" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="lista-t" className="text-lg font-semibold text-white">
                {sorted.length.toLocaleString('es-AR')} productos
                <span className="ml-2 text-sm font-normal text-muted">· precios al {formatDate(data.generatedAt)}</span>
              </h2>
              <label className="flex items-center gap-2 text-sm text-muted">
                Ordenar por
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="focus-ring rounded-xl border border-line bg-ink px-3 py-2 text-white">
                  <option value="tco">Costo total</option>
                  <option value="price">Precio hoy</option>
                  <option value="energy">Gasto de energía</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 rounded-3xl bg-ink-2 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-muted xl:col-span-1">
                Buscar
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Marca, modelo…"
                  className="focus-ring mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-white placeholder:text-faint"
                />
              </label>
              <label className="text-sm text-muted">
                Marca
                <select value={brand} onChange={(e) => setBrand(e.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-white">
                  <option value="">Todas</option>
                  {brands.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
              {subtypes.length > 1 && (
                <label className="text-sm text-muted">
                  Tipo
                  <select value={subtype} onChange={(e) => setSubtype(e.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-white">
                    <option value="">Todos</option>
                    {subtypes.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}
              <fieldset className="text-sm text-muted">
                <legend>
                  {unit.label} que necesitás ({unit.unit})
                </legend>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label="Mínimo"
                    placeholder="desde"
                    value={capMin}
                    onChange={(e) => setCapMin(e.target.value)}
                    className="focus-ring w-full min-w-0 rounded-xl border border-line bg-ink px-3 py-2 text-white placeholder:text-faint"
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label="Máximo"
                    placeholder="hasta"
                    value={capMax}
                    onChange={(e) => setCapMax(e.target.value)}
                    className="focus-ring w-full min-w-0 rounded-xl border border-line bg-ink px-3 py-2 text-white placeholder:text-faint"
                  />
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2 xl:col-span-4">
                <input type="checkbox" checked={onlyComplete} onChange={(e) => setOnlyComplete(e.target.checked)} className="size-4 accent-amber" />
                Solo productos con precio y datos de consumo
                {onlyComplete && hiddenIncomplete > 0 && <span className="text-faint">({hiddenIncomplete} ocultos)</span>}
              </label>
            </div>

            {sorted.length === 0 ? (
              <p className="rounded-2xl bg-ink-2 p-6 text-muted">No hay productos con esos filtros.</p>
            ) : (
              <ul className="space-y-3">
                {sorted.slice(0, limit).map((r) => {
                  const badges: RowBadge[] = [];
                  if (r === bestTco) badges.push('menor-costo-total');
                  if (r === cheapest) badges.push('mas-barato-hoy');
                  return (
                    <ProductRow
                      key={r.product.id}
                      row={r}
                      years={scenario.years}
                      selected={selected.includes(r.product.id)}
                      canSelect={selected.length < MAX_COMPARE}
                      onToggle={() => toggle(r.product.id)}
                      badges={badges}
                      storeNames={storeNames}
                    />
                  );
                })}
              </ul>
            )}
            {sorted.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="focus-ring mx-auto block rounded-full border border-line px-6 py-3 text-sm text-white hover:border-sun"
              >
                Ver más ({sorted.length - limit} restantes)
              </button>
            )}
          </section>
        )}
      </div>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm text-muted">
              {selected.length} de {MAX_COMPARE} para comparar
              {selected.length < 2 && ' · elegí al menos 2'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelected([])} className="focus-ring rounded-full px-4 py-2 text-sm text-muted hover:text-white">
                Limpiar
              </button>
              <a
                href="#comparacion"
                aria-disabled={selected.length < 2}
                className={`focus-ring rounded-full px-5 py-2 text-sm font-medium ${selected.length >= 2 ? 'bg-sun text-ink' : 'pointer-events-none bg-ink-3 text-faint'}`}
              >
                Ver comparación
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
