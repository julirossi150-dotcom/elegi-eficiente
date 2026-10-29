'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { formatARS, formatARSShort } from '@/lib/format';

// Paleta categórica validada contra la superficie ink-2 (#0f3133): CVD ΔE ≥ 8,4, contraste ≥ 3:1.
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500'];

export interface CostSeries {
  id: string;
  label: string;
  /** valores acumulados: index 0 = año 0 (solo precio), index n = fin del año n */
  values: number[];
}

const W = 720;
const H = 320;
const M = { top: 16, right: 24, bottom: 36, left: 64 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

export default function CostChart({ series }: { series: CostSeries[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();

  const years = Math.max(0, ...series.map((s) => s.values.length - 1));
  const yMax = useMemo(() => niceMax(Math.max(0, ...series.flatMap((s) => s.values))), [series]);
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (i: number) => M.left + (years === 0 ? 0 : (i / years) * iw);
  const y = (v: number) => M.top + ih - (v / yMax) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
  const xTicks = Array.from({ length: years + 1 }, (_, i) => i).filter((i) => years <= 10 || i % 2 === 0 || i === years);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - M.left) / iw) * years);
    setHover(Math.min(years, Math.max(0, i)));
  }

  if (series.length === 0) return null;

  return (
    <figure className="rounded-3xl bg-ink-2 p-4 sm:p-6" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <figcaption id={titleId}>
          <p className="font-semibold text-white">Costo acumulado: compra + energía</p>
          <p className="text-sm text-muted">Donde las líneas se cruzan, el equipo más caro empieza a convenir.</p>
        </figcaption>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="focus-ring rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-white"
        >
          {showTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        {series.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className="h-0.5 w-5 rounded" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>

      {showTable ? (
        <div className="mt-4 overflow-x-auto">
          <table className="tabular w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2 pr-3 font-medium">Año</th>
                {series.map((s) => (
                  <th key={s.id} className="py-2 pr-3 font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: years + 1 }, (_, i) => (
                <tr key={i} className="border-t border-line/50">
                  <td className="py-1.5 pr-3 text-muted">{i === 0 ? 'Compra' : i}</td>
                  {series.map((s) => (
                    <td key={s.id} className="py-1.5 pr-3 text-white">
                      {s.values[i] !== undefined ? formatARS(s.values[i]) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-none"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label="Gráfico de costo acumulado por año"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#24585a" strokeWidth={1} opacity={t === 0 ? 1 : 0.45} />
                <text x={M.left - 10} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="#a3bdb9">
                  {formatARSShort(t)}
                </text>
              </g>
            ))}
            {xTicks.map((i) => (
              <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize={12} fill="#a3bdb9">
                {i === 0 ? 'Hoy' : `${i}`}
              </text>
            ))}
            <text x={W - M.right} y={H - 12} dx={-2} textAnchor="end" fontSize={11} fill="#6f8f8b" className="hidden">
              años
            </text>

            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="#a3bdb9" strokeWidth={1} />}

            {series.map((s, si) => (
              <g key={s.id}>
                <polyline
                  points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                  fill="none"
                  stroke={SERIES_COLORS[si]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {hover !== null && s.values[hover] !== undefined && (
                  <circle cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={SERIES_COLORS[si]} stroke="#0f3133" strokeWidth={2} />
                )}
              </g>
            ))}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-xl border border-line bg-ink px-3 py-2 text-xs shadow-xl"
              style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > years / 2 ? 'calc(-100% - 12px)' : '12px'})` }}
            >
              <p className="mb-1 text-muted">{hover === 0 ? 'Al comprar' : `Después de ${hover} ${hover === 1 ? 'año' : 'años'}`}</p>
              <ul className="space-y-1">
                {series
                  .map((s, si) => ({ s, si, v: s.values[hover] }))
                  .sort((a, b) => a.v - b.v)
                  .map(({ s, si, v }) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="h-0.5 w-3 rounded" style={{ background: SERIES_COLORS[si] }} />
                      <strong className="tabular font-semibold text-white">{formatARS(v)}</strong>
                      <span className="truncate text-muted">{s.label}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
