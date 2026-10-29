const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const num0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export const formatARS = (v: number) => ars.format(Math.round(v));
export const formatNum = (v: number, digits = 1) =>
  digits === 0 ? num0.format(v) : new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(v);
export const formatNum1 = (v: number) => num.format(v);

/** $1,2 M / $850 mil para espacios chicos */
export function formatARSShort(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${num.format(v / 1_000_000)} M`;
  if (a >= 10_000) return `$${num0.format(v / 1000)} mil`;
  return formatARS(v);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
}

export function formatYears(y: number): string {
  if (!Number.isFinite(y)) return 'nunca';
  if (y < 1) {
    const m = Math.max(1, Math.round(y * 12));
    return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  }
  const r = Math.round(y * 10) / 10;
  return `${num.format(r)} ${r === 1 ? 'año' : 'años'}`;
}
