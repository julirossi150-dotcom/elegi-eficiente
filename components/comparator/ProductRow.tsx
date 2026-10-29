'use client';

import Icon from '@/components/Icon';
import LabelBadge from '@/components/LabelBadge';
import type { CostRow } from '@/lib/cost';
import { formatARS, formatNum } from '@/lib/format';
import { specChips } from '@/lib/specs';

export function energyText(r: CostRow): string | null {
  const e = r.estimate;
  if (!e) return null;
  const parts: string[] = [];
  if (e.kwhYear > 0) parts.push(`${formatNum(e.kwhYear, 0)} kWh`);
  if (e.m3Year > 0) parts.push(`${formatNum(e.m3Year, 0)} m³`);
  if (e.kgGlpYear > 0) parts.push(`${formatNum(e.kgGlpYear, 0)} kg`);
  return parts.length ? `${parts.join(' + ')} por año` : null;
}

export type RowBadge = 'mas-barato-hoy' | 'menor-costo-total';

export default function ProductRow({
  row,
  years,
  selected,
  onToggle,
  canSelect,
  badges,
  storeNames,
}: {
  row: CostRow;
  years: number;
  selected: boolean;
  onToggle: () => void;
  canSelect: boolean;
  badges: RowBadge[];
  storeNames: Record<string, string>;
}) {
  const p = row.product;
  const offers = p.offers.filter((o) => o.available).sort((a, b) => a.price - b.price);
  const best = offers[0];
  const energy = energyText(row);

  return (
    <li
      className={`grid gap-4 rounded-3xl border p-4 transition sm:grid-cols-[88px_1fr] sm:p-5 lg:grid-cols-[88px_1.5fr_1fr] ${
        selected ? 'border-sun bg-ink-3' : 'border-line/60 bg-ink-2/60 hover:border-line'
      }`}
    >
      <div className="flex items-start gap-3 sm:block">
        <div className="grid size-[88px] shrink-0 place-items-center overflow-hidden rounded-2xl bg-white">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />
          ) : (
            <Icon name={p.category} size={36} className="text-ink-4" />
          )}
        </div>
      </div>

      <div className="min-w-0">
        {badges.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {badges.includes('menor-costo-total') && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sun px-2.5 py-0.5 text-xs font-semibold text-ink">
                <Icon name="check" size={13} strokeWidth={2.5} /> Menor costo a {years} años
              </span>
            )}
            {badges.includes('mas-barato-hoy') && (
              <span className="inline-flex items-center gap-1 rounded-full bg-mint/90 px-2.5 py-0.5 text-xs font-semibold text-ink">
                <Icon name="tag" size={13} strokeWidth={2.2} /> Más barato hoy
              </span>
            )}
          </div>
        )}
        <p className="text-xs tracking-wide text-muted uppercase">
          {p.brand}
          {p.model ? ` · ${p.model}` : ''}
        </p>
        <h3 className="mt-0.5 leading-snug font-medium text-white">{p.name}</h3>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <LabelBadge label={p.label} />
          {specChips(p).map((c) => (
            <span key={c} className="rounded-full bg-ink px-2.5 py-1 text-xs text-muted">
              {c}
            </span>
          ))}
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-sm text-muted">
          <Icon name={p.energy === 'electricidad' ? 'bolt' : 'flame'} size={15} className="text-amber" />
          {energy ? (
            <>
              {energy}
              {row.estimate?.basis === 'estimado' && (
                <span className="rounded bg-coral/15 px-1.5 py-0.5 text-[11px] text-coral" title="Parte del cálculo usa supuestos porque falta un dato de la etiqueta">
                  estimado
                </span>
              )}
            </>
          ) : (
            <span className="text-faint">Sin datos de consumo: no podemos calcular su costo de uso</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-line/50 pt-4 sm:col-span-2 lg:col-span-1 lg:grid-cols-1 lg:gap-2 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
        <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between">
          <span className="text-xs text-muted">Precio hoy</span>
          <span className="tabular font-semibold text-white">{row.price !== null ? formatARS(row.price) : 'Sin stock'}</span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between">
          <span className="text-xs text-muted">Energía por año</span>
          <span className="tabular text-white">{row.annualEnergyCost !== null ? formatARS(row.annualEnergyCost) : '—'}</span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between">
          <span className="text-xs text-muted">Total {years} años</span>
          <span className="tabular text-lg font-bold text-sun">{row.tco !== null ? formatARS(row.tco) : '—'}</span>
        </div>
        <div className="col-span-3 mt-1 flex flex-wrap items-center justify-between gap-2 lg:col-span-1">
          {best ? (
            <a
              href={best.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="focus-ring inline-flex items-center gap-1 rounded text-xs text-mint hover:underline"
            >
              <Icon name="store" size={14} /> {storeNames[best.store] ?? best.store}
              {offers.length > 1 && <span className="text-faint">· {offers.length} tiendas</span>}
            </a>
          ) : (
            <span className="text-xs text-faint">Sin ofertas disponibles</span>
          )}
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              selected ? 'border-sun bg-sun text-ink' : canSelect ? 'border-line text-white hover:border-sun' : 'cursor-not-allowed border-line/50 text-faint'
            }`}
          >
            <input type="checkbox" checked={selected} disabled={!selected && !canSelect} onChange={onToggle} className="sr-only" />
            {selected ? <Icon name="check" size={13} strokeWidth={2.5} /> : null}
            {selected ? 'Comparando' : 'Comparar'}
          </label>
        </div>
      </div>
    </li>
  );
}
