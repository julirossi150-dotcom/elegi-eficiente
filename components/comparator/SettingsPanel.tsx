'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { DEFAULT_TARIFFS, TARIFF_SOURCES, USAGE_FIELDS, type Scenario, type Tariffs, type Usage } from '@/lib/cost';
import type { CategoryId } from '@/lib/types';

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  help,
  prefix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  help?: string;
  prefix?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-white">
        {label}
      </label>
      <div className="mt-1.5 flex items-center rounded-xl border border-line bg-ink focus-within:border-sun">
        {prefix && <span className="pl-3 text-sm text-muted">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
          className="tabular w-full min-w-0 bg-transparent px-3 py-2 text-white outline-none"
        />
        {unit && <span className="pr-3 text-sm whitespace-nowrap text-muted">{unit}</span>}
      </div>
      {help && <p className="mt-1 text-xs leading-snug text-faint">{help}</p>}
    </div>
  );
}

export default function SettingsPanel({
  category,
  usage,
  setUsage,
  tariffs,
  setTariffs,
  scenario,
  setScenario,
  usesGas,
  usesElectricity,
}: {
  category: CategoryId;
  usage: Usage;
  setUsage: (u: Usage) => void;
  tariffs: Tariffs;
  setTariffs: (t: Tariffs) => void;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  usesGas: boolean;
  usesElectricity: boolean;
}) {
  const [showBillHelp, setShowBillHelp] = useState(false);
  const fields = USAGE_FIELDS[category].filter((f) => f.key !== 'acHeatingHoursYear' || usage.acUseHeating);

  return (
    <div className="space-y-5">
      {fields.length > 0 && (
        <section className="rounded-3xl bg-ink-2 p-5" aria-labelledby="uso-t">
          <h2 id="uso-t" className="flex items-center gap-2 font-semibold text-sun">
            <Icon name="sliders" size={18} /> Tu casa
          </h2>
          <div className="mt-4 space-y-4">
            {fields.map((f) =>
              f.type === 'toggle' ? (
                <label key={f.key} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-white">
                  {f.label}
                  <input
                    type="checkbox"
                    checked={Boolean(usage[f.key])}
                    onChange={(e) => setUsage({ ...usage, [f.key]: e.target.checked })}
                    className="size-5 accent-amber"
                  />
                </label>
              ) : (
                <NumberField
                  key={f.key}
                  id={`u-${f.key}`}
                  label={f.label}
                  value={usage[f.key] as number}
                  onChange={(v) => setUsage({ ...usage, [f.key]: v })}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  unit={f.unit}
                  help={f.help}
                />
              ),
            )}
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-ink-2 p-5" aria-labelledby="tarifa-t">
        <div className="flex items-center justify-between gap-2">
          <h2 id="tarifa-t" className="flex items-center gap-2 font-semibold text-sun">
            <Icon name="bolt" size={18} /> Tu tarifa
          </h2>
          <button
            type="button"
            onClick={() => setTariffs({ ...DEFAULT_TARIFFS, gasKind: tariffs.gasKind })}
            className="focus-ring rounded text-xs text-muted underline-offset-2 hover:text-white hover:underline"
          >
            Restablecer
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {usesElectricity && (
            <NumberField
              id="t-kwh"
              label="Precio de la luz"
              prefix="$"
              unit="por kWh"
              value={tariffs.electricityPerKwh}
              onChange={(v) => setTariffs({ ...tariffs, electricityPerKwh: v })}
              min={0}
              step={1}
              help={tariffs.electricityPerKwh === DEFAULT_TARIFFS.electricityPerKwh ? `Valor de referencia: ${TARIFF_SOURCES.electricityPerKwh}.` : undefined}
            />
          )}
          {usesGas && (
            <>
              <fieldset>
                <legend className="text-sm text-white">Gas que usás</legend>
                <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-ink p-1 text-sm">
                  {(['natural', 'envasado'] as const).map((k) => (
                    <label
                      key={k}
                      className={`cursor-pointer rounded-lg px-3 py-1.5 text-center ${tariffs.gasKind === k ? 'bg-leaf text-white' : 'text-muted hover:text-white'}`}
                    >
                      <input type="radio" name="gasKind" value={k} checked={tariffs.gasKind === k} onChange={() => setTariffs({ ...tariffs, gasKind: k })} className="sr-only" />
                      {k === 'natural' ? 'De red' : 'Garrafa'}
                    </label>
                  ))}
                </div>
              </fieldset>
              {tariffs.gasKind === 'natural' ? (
                <NumberField
                  id="t-m3"
                  label="Precio del gas"
                  prefix="$"
                  unit="por m³"
                  value={tariffs.gasNaturalPerM3}
                  onChange={(v) => setTariffs({ ...tariffs, gasNaturalPerM3: v })}
                  min={0}
                  help={tariffs.gasNaturalPerM3 === DEFAULT_TARIFFS.gasNaturalPerM3 ? `Valor de referencia: ${TARIFF_SOURCES.gasNaturalPerM3}.` : undefined}
                />
              ) : (
                <NumberField
                  id="t-glp"
                  label="Precio del gas envasado"
                  prefix="$"
                  unit="por kg"
                  value={tariffs.glpPerKg}
                  onChange={(v) => setTariffs({ ...tariffs, glpPerKg: v })}
                  min={0}
                  help="Precio de la garrafa dividido sus kilos (p. ej. garrafa de 10 kg)."
                />
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setShowBillHelp((v) => !v)}
            aria-expanded={showBillHelp}
            className="focus-ring flex items-center gap-1.5 rounded text-xs text-mint hover:underline"
          >
            <Icon name="info" size={14} /> ¿Dónde lo encuentro en mi factura?
          </button>
          {showBillHelp && (
            <div className="rounded-xl bg-ink p-3 text-xs leading-relaxed text-muted">
              <p>
                <strong className="text-white">Luz:</strong> dividí el total a pagar por los kWh consumidos del período. Así incluís cargo fijo,
                impuestos y tasas, que es lo que pagás de verdad por cada kWh extra (si tu consumo es alto, el cargo fijo pesa poco).
              </p>
              <p className="mt-2">
                <strong className="text-white">Gas:</strong> lo mismo con los m³ del período. Para garrafa: precio ÷ kilos.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-ink-2 p-5" aria-labelledby="horizonte-t">
        <h2 id="horizonte-t" className="flex items-center gap-2 font-semibold text-sun">
          <Icon name="calendar" size={18} /> Horizonte
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="s-years" className="flex justify-between text-sm text-white">
              Comparar a <span className="tabular font-semibold">{scenario.years} años</span>
            </label>
            <input
              id="s-years"
              type="range"
              min={1}
              max={15}
              value={scenario.years}
              onChange={(e) => setScenario({ ...scenario, years: Number(e.target.value) })}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <label htmlFor="s-growth" className="flex justify-between text-sm text-white">
              Aumento real de tarifa <span className="tabular font-semibold">{scenario.realTariffGrowthPct}% anual</span>
            </label>
            <input
              id="s-growth"
              type="range"
              min={0}
              max={15}
              value={scenario.realTariffGrowthPct}
              onChange={(e) => setScenario({ ...scenario, realTariffGrowthPct: Number(e.target.value) })}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-xs leading-snug text-faint">
              Cuánto sube la energía por encima de la inflación. 0% = la tarifa acompaña a la inflación.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
