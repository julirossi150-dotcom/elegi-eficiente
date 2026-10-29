import type { EnergyLabel } from '@/lib/types';

// Colores de la etiqueta argentina (verde → rojo). Se muestran siempre con la letra: nunca color solo.
const NEW_SCALE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const OLD_SCALE = ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
const COLORS = ['#00a651', '#4cb847', '#bfd730', '#fff200', '#fdb913', '#f37021', '#ed1c24'];

function colorFor(label: EnergyLabel): string {
  if (!label.cls) return '#6f8f8b';
  const scale = label.scale === 'nueva' ? NEW_SCALE : OLD_SCALE;
  const i = scale.indexOf(label.cls);
  if (i < 0) return '#6f8f8b';
  return COLORS[Math.min(COLORS.length - 1, Math.round((i / (scale.length - 1)) * (COLORS.length - 1)))];
}

const SCALE_TEXT: Record<EnergyLabel['scale'], string> = {
  nueva: 'Etiqueta nueva',
  anterior: 'Etiqueta anterior',
  desconocida: 'Escala sin confirmar',
};

export default function LabelBadge({ label, compact = false }: { label: EnergyLabel; compact?: boolean }) {
  const bg = colorFor(label);
  const dark = ['#bfd730', '#fff200', '#fdb913'].includes(bg);
  return (
    <span className="inline-flex items-center gap-2" title={label.raw ? `Texto original: ${label.raw}` : undefined}>
      <span
        className="tabular inline-flex h-7 min-w-11 items-center justify-center rounded-md pr-2.5 pl-2 text-sm font-bold"
        style={{ background: bg, color: dark ? '#0a2627' : '#fff', clipPath: 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)' }}
      >
        {label.cls ?? '?'}
      </span>
      {!compact && <span className="text-xs text-muted">{label.cls ? SCALE_TEXT[label.scale] : 'Sin clase informada'}</span>}
    </span>
  );
}
