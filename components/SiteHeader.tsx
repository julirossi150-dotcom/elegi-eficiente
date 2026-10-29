import Link from 'next/link';
import { SITE } from '@/lib/site';

const NAV = [
  { href: '/comparar/heladeras/', label: 'Comparar' },
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/metodologia/', label: 'Metodología' },
  { href: '/datos/', label: 'Datos abiertos' },
];

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`focus-ring flex items-center gap-2.5 rounded-full ${className}`}>
      <span className="grid size-9 place-items-center rounded-full border-2 border-current">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
          <path d="M5 19l6-6M12 9.5l-1.5 3h3L12 15.5" />
        </svg>
      </span>
      <span className="text-[15px] font-medium tracking-[0.14em] uppercase">{SITE.name}</span>
    </Link>
  );
}

export default function SiteHeader({ overHero = false }: { overHero?: boolean }) {
  return (
    <header className={`${overHero ? 'absolute inset-x-0 top-0 z-20' : 'border-b border-line/60 bg-ink'} `}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Logo className="text-white" />
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm font-medium text-white/95">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="focus-ring rounded px-1 py-1 hover:text-sun">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <details className="relative md:hidden">
          <summary className="focus-ring list-none rounded-full border border-white/40 px-4 py-2 text-sm text-white [&::-webkit-details-marker]:hidden">
            Menú
          </summary>
          <ul className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border border-line bg-ink-2 p-2 text-sm shadow-xl">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded-xl px-3 py-2.5 hover:bg-ink-3">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </header>
  );
}
