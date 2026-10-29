import type { Metadata } from 'next';
import Icon from '@/components/Icon';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { readMeta } from '@/lib/data-server';
import { formatDate } from '@/lib/format';
import { categoryInfo, withBase } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Datos abiertos',
  description: 'Descargá en JSON la base de electrodomésticos con etiqueta de eficiencia, precios y consumos, actualizada todos los días.',
};

const FIELDS: [string, string][] = [
  ['id', 'Identificador estable: categoría:marca:modelo'],
  ['brand, model, ean', 'Marca, código de modelo y códigos de barra encontrados'],
  ['energy', 'electricidad · gas_natural · gas_envasado · multigas'],
  ['label', 'Clase de eficiencia (cls), escala (nueva = Res. 438/2024, anterior, desconocida) y texto original'],
  ['specs', 'Especificaciones normalizadas (kWh/año, litros, frigorías, kg, rendimiento %, etc.)'],
  ['provenance', 'Origen de cada dato: tienda, fabricante, carga manual o estimado'],
  ['offers', 'Precio por tienda, precio de lista, disponibilidad, link y fecha de consulta'],
  ['priceMin', 'Menor precio disponible (ARS)'],
  ['quality', 'completo · estimado · insuficiente (si alcanza para calcular el costo de uso)'],
  ['firstSeen, lastSeen', 'Primera y última vez que vimos el producto'],
];

export default async function DatosPage() {
  const meta = await readMeta();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-sun sm:text-4xl">Datos abiertos</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted">
          En Argentina no existe una base pública con los datos de las etiquetas de eficiencia. Armamos la nuestra todos los días a partir de las
          fichas que publican las tiendas, y la liberamos para que cualquiera la use: organizaciones, periodistas, investigadores u otros sitios.
        </p>

        {meta ? (
          <>
            <p className="mt-6 text-sm text-faint">Última actualización: {formatDate(meta.generatedAt)}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {meta.categories.map((c) => (
                <li key={c.id}>
                  <a
                    href={withBase(`/data/${c.id}.json`)}
                    download
                    className="focus-ring flex items-center justify-between gap-3 rounded-2xl bg-ink-2 p-4 hover:bg-ink-3"
                  >
                    <span className="flex items-center gap-3">
                      <Icon name={c.id} size={22} className="text-amber" />
                      <span>
                        <span className="block font-medium text-white">{categoryInfo(c.id).name}</span>
                        <span className="text-xs text-muted">
                          {c.count} productos · {c.withConsumption} con consumo · {c.withPrice} con precio
                        </span>
                      </span>
                    </span>
                    <Icon name="download" size={18} className="text-muted" />
                  </a>
                </li>
              ))}
              <li>
                <a href={withBase('/data/meta.json')} download className="focus-ring flex items-center justify-between gap-3 rounded-2xl bg-ink-2 p-4 hover:bg-ink-3">
                  <span>
                    <span className="block font-medium text-white">meta.json</span>
                    <span className="text-xs text-muted">Estado de cada fuente y resumen</span>
                  </span>
                  <Icon name="download" size={18} className="text-muted" />
                </a>
              </li>
            </ul>

            <h2 className="mt-12 text-xl font-semibold text-white">Fuentes de hoy</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl bg-ink-2">
              <table className="tabular w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="p-3 font-medium">Tienda</th>
                    <th className="p-3 font-medium">Estado</th>
                    <th className="p-3 font-medium">Publicaciones leídas</th>
                  </tr>
                </thead>
                <tbody>
                  {meta.stores.map((s) => (
                    <tr key={s.id} className="border-t border-line/50">
                      <td className="p-3 text-white">
                        <a href={s.url} className="hover:underline">
                          {s.name}
                        </a>
                      </td>
                      <td className={`p-3 ${s.ok ? 'text-mint' : 'text-coral'}`}>{s.ok ? '✓ OK' : `✗ ${s.error ?? 'Error'}`}</td>
                      <td className="p-3 text-white">{s.products.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-6 rounded-2xl bg-ink-2 p-4 text-muted">Todavía no hay datos generados.</p>
        )}

        <h2 className="mt-12 text-xl font-semibold text-white">Qué trae cada producto</h2>
        <dl className="mt-4 divide-y divide-line/50 rounded-2xl bg-ink-2 text-sm">
          {FIELDS.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr]">
              <dt className="font-mono text-mint">{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm leading-relaxed text-faint">
          Los datos provienen de fichas públicas de comercios y pueden contener errores; verificá siempre la etiqueta del producto. Licencia
          sugerida: CC BY 4.0, citando “{'Elegí Eficiente'}”. Los precios pertenecen a cada comercio y cambian sin aviso.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
