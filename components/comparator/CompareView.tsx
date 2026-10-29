'use client';

import CostChart, { SERIES_COLORS } from '@/components/CostChart';
import Icon from '@/components/Icon';
import LabelBadge from '@/components/LabelBadge';
import { cumulativeTotal, paybackYears, type CostRow, type Scenario } from '@/lib/cost';
import { formatARS, formatDate, formatNum, formatYears } from '@/lib/format';
import { specRows } from '@/lib/specs';
import { energyText } from './ProductRow';

function shortName(r: CostRow) {
  return `${r.product.brand} ${r.product.model ?? r.product.name.slice(0, 24)}`.trim();
}

export default function CompareView({
  rows,
  scenario,
  storeNames,
  onRemove,
}: {
  rows: CostRow[];
  scenario: Scenario;
  storeNames: Record<string, string>;
  onRemove: (id: string) => void;
}) {
  const priced = rows.filter((r) => r.tco !== null);
  const cheapestToday = [...priced].sort((a, b) => a.price! - b.price!)[0];
  const insights = priced
    .filter((r) => r !== cheapestToday)
    .map((r) => ({ r, payback: paybackYears(cheapestToday, r, scenario), diffTco: r.tco! - cheapestToday.tco! }));

  return (
    <section id="comparacion" className="scroll-mt-6 space-y-5" aria-labelledby="comp-t">
      <h2 id="comp-t" className="text-2xl font-bold text-sun">
        Comparación
      </h2>

      {cheapestToday && insights.length > 0 && (
        <ul className="space-y-2">
          {insights.map(({ r, payback, diffTco }) => (
            <li key={r.product.id} className="flex gap-3 rounded-2xl bg-ink-2 p-4 text-sm leading-relaxed text-muted">
              <Icon name={diffTco < 0 ? 'leaf' : 'info'} size={20} className={`mt-0.5 shrink-0 ${diffTco < 0 ? 'text-mint' : 'text-faint'}`} />
              <p>
                <strong className="text-white">{shortName(r)}</strong> cuesta {formatARS(r.price! - cheapestToday.price!)} más hoy que{' '}
                <strong className="text-white">{shortName(cheapestToday)}</strong>
                {Number.isFinite(payback) && payback > 0 ? (
                  <>
                    {' '}
                    y recupera esa diferencia en <strong className="text-white">{formatYears(payback)}</strong> por consumir menos.
                  </>
                ) : (
                  <> y no recupera la diferencia con el ahorro de energía.</>
                )}{' '}
                A {scenario.years} años {diffTco < 0 ? 'te ahorra' : 'te cuesta'}{' '}
                <strong className={diffTco < 0 ? 'text-mint' : 'text-coral'}>{formatARS(Math.abs(diffTco))}</strong>
                {diffTco < 0 ? ' en total.' : ' más en total.'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {priced.length > 0 && (
        <CostChart series={priced.map((r) => ({ id: r.product.id, label: shortName(r), values: cumulativeTotal(r) }))} />
      )}

      <div className="overflow-x-auto rounded-3xl bg-ink-2">
        <table className="tabular w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="w-44 p-4 text-left align-bottom font-medium text-muted">Producto</th>
              {rows.map((r) => {
                const si = priced.indexOf(r);
                return (
                  <th key={r.product.id} className="p-4 text-left align-top font-normal">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-2">
                        {si >= 0 && <span className="h-0.5 w-4 shrink-0 rounded" style={{ background: SERIES_COLORS[si] }} aria-hidden="true" />}
                        <span className="font-semibold text-white">{shortName(r)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemove(r.product.id)}
                        aria-label={`Quitar ${shortName(r)} de la comparación`}
                        className="focus-ring rounded-full p-1 text-faint hover:bg-ink hover:text-white"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                    <p className="mt-1 text-xs leading-snug text-muted">{r.product.name}</p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="[&_td]:p-4 [&_td]:align-top [&_th]:p-4 [&_th]:text-left [&_th]:font-normal [&_th]:text-muted [&_tr]:border-t [&_tr]:border-line/50">
            <tr>
              <th scope="row">Etiqueta</th>
              {rows.map((r) => (
                <td key={r.product.id}>
                  <LabelBadge label={r.product.label} />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Precio hoy</th>
              {rows.map((r) => (
                <td key={r.product.id} className="font-semibold text-white">
                  {r.price !== null ? formatARS(r.price) : 'Sin stock'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Consumo</th>
              {rows.map((r) => (
                <td key={r.product.id} className="text-white">
                  {energyText(r) ?? '—'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Energía por año</th>
              {rows.map((r) => (
                <td key={r.product.id} className="text-white">
                  {r.annualEnergyCost !== null ? formatARS(r.annualEnergyCost) : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Total a {scenario.years} años</th>
              {rows.map((r) => (
                <td key={r.product.id} className="text-lg font-bold text-sun">
                  {r.tco !== null ? formatARS(r.tco) : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">CO₂ por año</th>
              {rows.map((r) => (
                <td key={r.product.id} className="text-white">
                  {r.co2KgYear !== null ? `${formatNum(r.co2KgYear, 0)} kg` : '—'}
                </td>
              ))}
            </tr>
            {Array.from(new Set(rows.flatMap((r) => specRows(r.product).map(([k]) => k)))).map((k) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                {rows.map((r) => (
                  <td key={r.product.id} className="text-white">
                    {specRows(r.product).find(([kk]) => kk === k)?.[1] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Cómo lo calculamos</th>
              {rows.map((r) => (
                <td key={r.product.id} className="text-xs leading-relaxed text-muted">
                  {r.estimate ? (
                    <ul className="list-disc space-y-1 pl-4">
                      {r.estimate.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    'Faltan datos de la etiqueta.'
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Dónde comprar</th>
              {rows.map((r) => (
                <td key={r.product.id}>
                  <ul className="space-y-1.5">
                    {[...r.product.offers]
                      .sort((a, b) => Number(b.available) - Number(a.available) || a.price - b.price)
                      .map((o) => (
                        <li key={o.store + o.url}>
                          <a
                            href={o.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className={`focus-ring flex justify-between gap-3 rounded text-xs hover:underline ${o.available ? 'text-mint' : 'text-faint line-through'}`}
                          >
                            <span>{storeNames[o.store] ?? o.store}</span>
                            <span>{formatARS(o.price)}</span>
                          </a>
                        </li>
                      ))}
                  </ul>
                  {r.product.offers[0] && <p className="mt-2 text-[11px] text-faint">Precios al {formatDate(r.product.offers[0].checkedAt)}</p>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
