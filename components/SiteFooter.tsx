import Link from 'next/link';
import { CATEGORIES, SITE } from '@/lib/site';
import { Logo } from './SiteHeader';

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line/60 bg-ink-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo className="text-sun" />
          <p className="max-w-sm text-sm leading-relaxed text-muted">{SITE.tagline}</p>
          <p className="max-w-sm text-xs leading-relaxed text-faint">
            Los precios y especificaciones se toman de las tiendas una vez por día y pueden cambiar. Verificá siempre la etiqueta del producto
            antes de comprar. Este sitio no vende productos ni cobra comisiones.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-sun">Comparar</h2>
          <ul className="space-y-2 text-sm text-muted">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <Link href={`/comparar/${c.id}/`} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-sun">El proyecto</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li>
              <Link href="/metodologia/" className="hover:text-white">
                Cómo calculamos
              </Link>
            </li>
            <li>
              <Link href="/datos/" className="hover:text-white">
                Datos abiertos (JSON)
              </Link>
            </li>
            {SITE.repoUrl && (
              <li>
                <a href={SITE.repoUrl} className="hover:text-white">
                  Código fuente
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
    </footer>
  );
}
