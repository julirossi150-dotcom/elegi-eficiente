import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { ASSUMPTIONS, DEFAULT_TARIFFS, DEFAULT_USAGE, EMISSIONS, LIFESPAN_YEARS, PHYSICS, TARIFF_SOURCES } from '@/lib/cost';
import { formatARS } from '@/lib/format';
import { CATEGORIES } from '@/lib/site';
import { METHOD_NOTES, METHOD_SOURCES } from '@/lib/cost/method-notes';

export const metadata: Metadata = {
  title: 'Metodología',
  description: 'Cómo calculamos el consumo y el costo total de cada electrodoméstico: fórmulas, supuestos y fuentes.',
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-line/50 pt-10" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="text-2xl font-bold text-sun">
        {title}
      </h2>
      <div className="mt-4 space-y-4 leading-relaxed text-muted [&_strong]:text-white">{children}</div>
    </section>
  );
}

export default function MetodologiaPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6">
        <header>
          <h1 className="text-3xl font-bold text-sun sm:text-4xl">Cómo calculamos</h1>
          <p className="mt-4 leading-relaxed text-muted">
            Para cada producto sumamos su <strong className="text-white">precio de hoy</strong> y lo que vas a pagar de{' '}
            <strong className="text-white">luz o gas</strong> durante los años que elijas. El consumo sale de los valores de la etiqueta de
            eficiencia energética; tu forma de uso y tu tarifa las ponés vos.
          </p>
        </header>

        <Section id="costo-total" title="Costo total">
          <p className="rounded-2xl bg-ink-2 p-4 font-mono text-sm text-white">
            Costo total = precio + Σ<sub>año 1…N</sub> (energía anual × tarifa × (1 + aumento real)<sup>año − 1</sup>)
          </p>
          <p>
            Todo está en <strong>pesos de hoy</strong>. Si la tarifa sube igual que la inflación, el aumento real es 0%. Si creés que la energía va
            a subir más que el resto de los precios, movés el control de &ldquo;aumento real de tarifa&rdquo;.
          </p>
          <p>
            <strong>Tiempo de recupero:</strong> si un equipo cuesta más pero consume menos, calculamos en cuántos años el ahorro de energía
            compensa la diferencia de precio. Si es más que su vida útil, no conviene por costo.
          </p>
          <p>
            No incluimos financiación en cuotas, instalación, mantenimiento ni el valor de reventa. Si una tienda ofrece cuotas sin interés, el
            costo real de compra en pesos de hoy es menor que el precio de lista.
          </p>
        </Section>

        <Section id="etiquetas" title="Dos etiquetas conviviendo">
          <p>
            Desde el <strong>5 de marzo de 2026</strong> los equipos que se fabrican o importan deben llevar la etiqueta de la Resolución SIC 438/2024,
            con escala A–G reescalada y código QR. Los productos con la etiqueta anterior pueden venderse hasta el 5 de marzo de 2028.
          </p>
          <p>
            Como una misma letra significa cosas distintas en cada escala, <strong>no ordenamos por letra</strong>: comparamos por consumo (kWh,
            m³) y por pesos. Mostramos la escala cuando la podemos determinar: las clases con &ldquo;+&rdquo; (A+, A++, A+++) son siempre de la
            etiqueta anterior; para una letra sola (A–G) indicamos &ldquo;escala sin confirmar&rdquo; si la tienda no lo aclara.
          </p>
        </Section>

        {CATEGORIES.map((c) => (
          <Section key={c.id} id={c.id} title={c.name}>
            {METHOD_NOTES[c.id].map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="text-sm text-faint">Horizonte sugerido (vida útil típica): {LIFESPAN_YEARS[c.id]} años.</p>
          </Section>
        ))}

        <Section id="calefaccion" title="Aire, gas o eléctrica">
          <p>
            En <Link href="/calefaccion/" className="text-mint hover:underline">¿Con qué calefacciono?</Link> usamos el mismo calor para todas las
            tecnologías: el que necesita tu ambiente durante los días y horas que cargaste. A los aires les calculamos solo el modo calor, con su COP;
            a los calefactores y estufas, como en su comparador.
          </p>
          <p>
            De cada tecnología tomamos los equipos con la potencia adecuada para tu ambiente y mostramos el de menor costo total (precio + energía en
            el horizonte) y el más barato de comprar. El gasto de energía por año es la mediana de la tecnología: depende del ambiente y del
            rendimiento, no del tamaño del equipo. No contamos la instalación (un aire o un tiro balanceado la necesitan) ni que el aire también
            enfría en verano.
          </p>
        </Section>

        <Section id="supuestos" title="Valores de referencia">
          <div className="overflow-x-auto rounded-2xl bg-ink-2">
            <table className="tabular w-full min-w-[520px] text-sm">
              <tbody className="[&_td]:p-3 [&_tr]:border-t [&_tr]:border-line/50 [&_tr:first-child]:border-t-0">
                <tr>
                  <td className="text-white">Luz (por defecto)</td>
                  <td>{formatARS(DEFAULT_TARIFFS.electricityPerKwh)}/kWh</td>
                  <td className="text-faint">{TARIFF_SOURCES.electricityPerKwh}</td>
                </tr>
                <tr>
                  <td className="text-white">Gas natural (por defecto)</td>
                  <td>{formatARS(DEFAULT_TARIFFS.gasNaturalPerM3)}/m³</td>
                  <td className="text-faint">{TARIFF_SOURCES.gasNaturalPerM3}</td>
                </tr>
                <tr>
                  <td className="text-white">Gas envasado (por defecto)</td>
                  <td>{formatARS(DEFAULT_TARIFFS.glpPerKg)}/kg</td>
                  <td className="text-faint">{TARIFF_SOURCES.glpPerKg}</td>
                </tr>
                {[...Object.values(PHYSICS), ...Object.values(EMISSIONS)].map((k) => (
                  <tr key={k.label}>
                    <td className="text-white">{k.label}</td>
                    <td>
                      {k.value.toLocaleString('es-AR', { maximumFractionDigits: 4 })} {k.unit}
                    </td>
                    <td className="text-faint">{k.source}</td>
                  </tr>
                ))}
                <tr>
                  <td className="text-white">Carga media de un aire prendido</td>
                  <td>{ASSUMPTIONS.acLoadFactor * 100}% de su capacidad</td>
                  <td className="text-faint">Supuesto del modelo, igual para todos los equipos</td>
                </tr>
                <tr>
                  <td className="text-white">Frigorías que necesita un ambiente</td>
                  <td>
                    {ASSUMPTIONS.acFrigoriasPerM3} por m³ (+{Math.round((ASSUMPTIONS.acHighLoadFactor - 1) * 100)}% con mucho sol o último piso)
                  </td>
                  <td className="text-faint">Regla práctica habitual de dimensionamiento; es aproximada</td>
                </tr>
                <tr>
                  <td className="text-white">Uso por defecto</td>
                  <td colSpan={2}>
                    {DEFAULT_USAGE.people} personas · {DEFAULT_USAGE.hotWaterLPerPersonDay} L de agua caliente por persona y día ·{' '}
                    {DEFAULT_USAGE.washCyclesPerWeek} lavados por semana · {DEFAULT_USAGE.acCoolingHoursYear} h/año de aire en frío en un ambiente de {DEFAULT_USAGE.acAreaM2} m²
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="fuentes" title="Fuentes">
          <p>
            Precios y fichas técnicas: catálogos públicos de las tiendas, consultados una vez por día (ver <Link href="/datos/" className="text-mint hover:underline">datos abiertos</Link>).
            Cuando una tienda no informa un dato de la etiqueta lo dejamos vacío o lo estimamos, y lo marcamos como &ldquo;estimado&rdquo;.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {METHOD_SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} className="text-mint hover:underline" rel="noopener noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
