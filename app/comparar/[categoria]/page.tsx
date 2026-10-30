import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Comparator from '@/components/comparator/Comparator';
import Icon from '@/components/Icon';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { CATEGORIES } from '@/lib/site';
import { CATEGORY_IDS, type CategoryId } from '@/lib/types';

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORY_IDS.map((categoria) => ({ categoria }));
}

type Props = { params: Promise<{ categoria: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categoria } = await params;
  const c = CATEGORIES.find((x) => x.id === categoria);
  return c ? { title: `Comparar ${c.name.toLowerCase()}`, description: `${c.blurb} Compará precio y costo de uso de ${c.name.toLowerCase()} en Argentina.` } : {};
}

export default async function CompararPage({ params }: Props) {
  const { categoria } = await params;
  const c = CATEGORIES.find((x) => x.id === categoria);
  if (!c) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6">
        <nav aria-label="Categorías" className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <ul className="flex gap-2">
            {CATEGORIES.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/comparar/${x.id}/`}
                  aria-current={x.id === c.id ? 'page' : undefined}
                  className={`focus-ring flex items-center gap-2 rounded-full px-4 py-2 text-sm whitespace-nowrap ${
                    x.id === c.id ? 'bg-sun font-semibold text-ink' : 'bg-ink-2 text-muted hover:text-white'
                  }`}
                >
                  <Icon name={x.id} size={18} /> {x.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <header className="mt-8 mb-8 max-w-3xl">
          <h1 className="text-3xl font-bold text-sun sm:text-4xl">{c.name}</h1>
          <p className="mt-3 leading-relaxed text-muted">{c.blurb}</p>
          {(c.id === 'aires' || c.id === 'calefactores') && (
            <Link href="/calefaccion/" className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded text-sm text-mint hover:underline">
              ¿Aire, gas o eléctrica? Compará cuánto cuesta calefaccionar con cada uno <Icon name="arrow-right" size={14} />
            </Link>
          )}
        </header>
        <Comparator category={c.id as CategoryId} />
      </main>
      <SiteFooter />
    </>
  );
}
