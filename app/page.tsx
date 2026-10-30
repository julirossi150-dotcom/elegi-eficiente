import Link from 'next/link';
import HeroIllustration from '@/components/HeroIllustration';
import Icon from '@/components/Icon';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { readMeta } from '@/lib/data-server';
import { formatDate } from '@/lib/format';
import { CATEGORIES } from '@/lib/site';

const STEPS = [
  {
    icon: 'sliders' as const,
    title: 'Contanos cómo lo usás',
    text: 'Cuántas personas viven en tu casa, cuántas horas prendés el aire, cuántos lavados hacés por semana.',
  },
  {
    icon: 'bolt' as const,
    title: 'Poné tu tarifa',
    text: 'El precio del kWh y del m³ de gas que figura en tu factura. Si no lo tenés a mano usamos un valor de referencia.',
  },
  {
    icon: 'chart' as const,
    title: 'Mirá el costo real',
    text: 'Precio de hoy + lo que vas a pagar de energía durante los años que elijas, y en cuánto tiempo se recupera pagar más por un equipo eficiente.',
  },
];

export default async function Home() {
  const meta = await readMeta();
  const total = meta?.categories.reduce((s, c) => s + c.count, 0) ?? 0;
  const storesOk = meta?.stores.filter((s) => s.ok).length ?? 0;

  return (
    <>
      <section className="relative isolate h-[92svh] max-h-[900px] min-h-[640px] overflow-hidden bg-linear-to-b from-sky-deep via-sky to-sky-light">
        <HeroIllustration className="absolute inset-x-0 bottom-0 -z-20 h-[46%] w-full sm:h-[52%] lg:h-full" />
        <div className="absolute inset-0 -z-10 hidden bg-linear-to-r from-sky-deep/45 via-transparent to-transparent lg:block" />
        <SiteHeader overHero />
        <div className="mx-auto flex h-full max-w-6xl flex-col justify-start px-4 pt-28 sm:px-6 md:pt-36">
          <h1 className="max-w-[34rem] text-[2.3rem] leading-[1.08] font-bold text-white drop-shadow-sm sm:text-5xl md:text-[3.5rem]">
            El aparato que menos te cuesta, hoy y en diez años
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/90 sm:text-lg">
            Compará heladeras, aires, lavarropas, calefones, termotanques y estufas por su precio y por lo que consumen de luz y gas en tu casa.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/comparar/heladeras/"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-navy px-7 py-3.5 text-sm font-medium text-white shadow-lg shadow-navy-dark/30 hover:bg-navy-dark"
            >
              Comparar ahora <Icon name="arrow-right" size={18} />
            </Link>
            <a
              href="#como-funciona"
              className="focus-ring inline-flex items-center rounded-full border border-white/70 px-6 py-3.5 text-sm font-medium text-white hover:bg-white/10"
            >
              Cómo funciona
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className="blob-bg overflow-hidden" aria-labelledby="que-es">
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-10 sm:px-6 md:pt-24">
            <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-end">
              <div>
                <h2 id="que-es" className="text-3xl font-bold text-sun sm:text-[2.6rem]">
                  ¿Qué te conviene comprar?
                </h2>
                <p className="mt-6 max-w-xl leading-relaxed text-muted">
                  La etiqueta de eficiencia dice cuánta energía usa un aparato, pero no cuánta plata. Nosotros juntamos precios de las principales
                  tiendas del país con los datos de cada etiqueta y calculamos cuánto te sale cada opción en tu casa, con tu tarifa.
                </p>
              </div>
              {meta && (
                <dl className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-ink-3/70 px-3 py-4">
                    <dt className="text-xs text-muted">Productos</dt>
                    <dd className="tabular mt-1 text-2xl font-semibold text-white">{total.toLocaleString('es-AR')}</dd>
                  </div>
                  <div className="rounded-2xl bg-ink-3/70 px-3 py-4">
                    <dt className="text-xs text-muted">Tiendas</dt>
                    <dd className="tabular mt-1 text-2xl font-semibold text-white">{storesOk}</dd>
                  </div>
                  <div className="rounded-2xl bg-ink-3/70 px-3 py-4">
                    <dt className="text-xs text-muted">Actualizado</dt>
                    <dd className="mt-1 text-sm font-semibold text-white">{formatDate(meta.generatedAt)}</dd>
                  </div>
                </dl>
              )}
            </div>

            <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {CATEGORIES.map((c, i) => (
                <li key={c.id}>
                  <Link
                    href={`/comparar/${c.id}/`}
                    className={`focus-ring group flex h-full flex-col rounded-3xl p-6 transition ${
                      i === 0 ? 'bg-leaf hover:bg-leaf-2' : 'bg-ink-2/80 hover:bg-ink-3'
                    }`}
                  >
                    <span className="grid size-16 place-items-center rounded-full bg-ink text-amber ring-8 ring-ink/40">
                      <Icon name={c.id} size={30} />
                    </span>
                    <h3 className="mt-6 text-lg leading-snug font-semibold text-white">{c.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">{c.blurb}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm text-white/90 group-hover:text-sun">
                      Comparar <Icon name="arrow-right" size={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/calefaccion/"
              className="focus-ring group mt-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line/70 p-6 hover:border-sun"
            >
              <span className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-amber">
                  <Icon name="flame" size={24} />
                </span>
                <span>
                  <span className="block font-semibold text-white">¿Con qué calefacciono?</span>
                  <span className="mt-1 block text-sm text-white/70">Aire frío/calor, gas o eléctrica: cuánto cuesta calefaccionar tu ambiente con cada uno.</span>
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/90 group-hover:text-sun">
                Comparar <Icon name="arrow-right" size={16} />
              </span>
            </Link>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6" aria-labelledby="como-funciona-t">
          <div className="grid gap-12 md:grid-cols-[1fr_1.6fr]">
            <div>
              <h2 id="como-funciona-t" className="text-3xl leading-tight font-bold text-white sm:text-4xl">
                Cómo
                <br />
                funciona
              </h2>
              <p className="mt-5 max-w-xs leading-relaxed text-muted">
                El más barato en la góndola no siempre es el más barato en tu bolsillo. Un equipo que consume menos puede devolverte la diferencia
                en pocos años.
              </p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-3xl border border-line/70 p-6">
                  <span className="flex items-center gap-3 text-amber">
                    <Icon name={s.icon} size={26} />
                    <span className="text-sm text-faint">0{i + 1}</span>
                  </span>
                  <h3 className="mt-5 font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="ojo-letra">
          <div className="grid gap-10 overflow-hidden rounded-[2rem] bg-ink-2 p-8 md:grid-cols-2 md:p-12">
            <div>
              <p className="text-sm font-medium tracking-wide text-amber uppercase">Ojo con la letra</p>
              <h2 id="ojo-letra" className="mt-3 text-2xl leading-snug font-bold text-sun sm:text-3xl">
                Hoy conviven dos etiquetas distintas en las tiendas
              </h2>
              <p className="mt-5 leading-relaxed text-muted">
                Desde marzo de 2026 rige una etiqueta nueva con una escala de A a G más exigente. Hasta 2028 todavía se pueden vender equipos con la
                etiqueta anterior. Una heladera &ldquo;A+&rdquo; de la escala vieja puede ser una &ldquo;C&rdquo; en la nueva y consumir exactamente
                lo mismo.
              </p>
              <p className="mt-4 leading-relaxed text-muted">
                Por eso no comparamos por letra: comparamos por <strong className="text-white">kWh, m³ de gas y pesos</strong>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-5" aria-hidden="true">
              <MiniLabel title="Etiqueta anterior" rows={['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D']} mark={2} />
              <Icon name="arrow-right" size={28} className="shrink-0 text-faint" />
              <MiniLabel title="Etiqueta nueva" rows={['A', 'B', 'C', 'D', 'E', 'F', 'G']} mark={2} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

const BAR_COLORS = ['#00a651', '#4cb847', '#bfd730', '#fff200', '#fdb913', '#f37021', '#ed1c24'];

function MiniLabel({ title, rows, mark }: { title: string; rows: string[]; mark: number }) {
  return (
    <div className="w-36 rounded-xl bg-white p-3 text-ink shadow-xl sm:w-40">
      <p className="mb-2 text-[10px] font-semibold tracking-wide uppercase">{title}</p>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={r} className="flex items-center gap-1">
            <span
              className="flex h-4 items-center rounded-r-sm pl-1.5 text-[10px] font-bold text-white"
              style={{ width: `${40 + i * 9}%`, background: BAR_COLORS[i], clipPath: 'polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%)' }}
            >
              {r}
            </span>
            {i === mark && <span className="ml-auto rounded bg-ink px-1.5 text-[10px] font-bold text-white">◀</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
