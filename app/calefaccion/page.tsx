import type { Metadata } from 'next';
import HeatingCompare from '@/components/HeatingCompare';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: '¿Con qué calefacciono?',
  description: 'Aire frío/calor, calefactor a gas o estufa eléctrica: cuánto cuesta calefaccionar tu ambiente con cada uno, con tu tarifa y precios de hoy.',
};

export default function CalefaccionPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6">
        <header className="mt-4 mb-8 max-w-3xl">
          <h1 className="text-3xl font-bold text-sun sm:text-4xl">¿Con qué calefacciono?</h1>
          <p className="mt-3 leading-relaxed text-muted">
            Aire frío/calor, calefactor a gas o estufa eléctrica: para el mismo ambiente, cuánto pagás por el equipo y cuánto de luz o gas, con tu
            tarifa y los precios de hoy.
          </p>
        </header>
        <HeatingCompare />
      </main>
      <SiteFooter />
    </>
  );
}
