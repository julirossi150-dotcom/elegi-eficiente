import type { CategoryId } from '@/lib/types';

type IconName =
  | CategoryId
  | 'bolt'
  | 'flame'
  | 'leaf'
  | 'coins'
  | 'chart'
  | 'tag'
  | 'arrow-right'
  | 'arrow-left'
  | 'check'
  | 'info'
  | 'download'
  | 'sliders'
  | 'x'
  | 'store'
  | 'calendar';

const PATHS: Record<IconName, React.ReactNode> = {
  heladeras: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <path d="M6 9.5h12M9 5.5v2M9 12.5v3" />
    </>
  ),
  aires: (
    <>
      <rect x="2.5" y="5" width="19" height="8" rx="2" />
      <path d="M6 10.5h12M7 16.5c0 1.5-1 2-1 3M12 16.5c0 1.5-1 2-1 3M17 16.5c0 1.5-1 2-1 3" />
    </>
  ),
  lavarropas: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <circle cx="12" cy="13.5" r="4.5" />
      <path d="M7 5.5h2M14 5.5h3M10 14.5c1.2 1 2.8 1 4 0" />
    </>
  ),
  calefones: (
    <>
      <rect x="6" y="2.5" width="12" height="15" rx="2" />
      <path d="M12 6.5c1.6 1.8 2 3 2 4a2 2 0 0 1-4 0c0-1 .4-2.2 2-4zM9 17.5v4M15 17.5v4" />
    </>
  ),
  termotanques: (
    <>
      <rect x="6" y="2.5" width="12" height="17" rx="6" />
      <path d="M9 21.5h6M12 8v6M10 12l2 2 2-2" />
    </>
  ),
  calefactores: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M7 9.5v5M10.5 9.5v5M14 9.5v5M17 9.5v5M6 18v2.5M18 18v2.5" />
    </>
  ),
  bolt: <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8z" />,
  flame: <path d="M12 2.5c3.5 4 6 7 6 11a6 6 0 0 1-12 0c0-2.5 1.2-4.5 3-6 .3 2 1.2 3 2.5 3.5C11 8 11.2 5 12 2.5z" />,
  leaf: (
    <>
      <path d="M4 20c0-9 6-15 16-16-1 10-7 16-16 16z" />
      <path d="M4 20 13 11" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.6-2.4-2.9-5.5-3" />
    </>
  ),
  chart: <path d="M3.5 20.5h17M6 17V11M10.5 17V7M15 17v-4M19.5 17V5" />,
  tag: (
    <>
      <path d="M3 12.5V4h8.5l9.5 9.5-8.5 8.5L3 12.5z" />
      <circle cx="7.5" cy="8.5" r="1.5" />
    </>
  ),
  'arrow-right': <path d="M4 12h16M14 6l6 6-6 6" />,
  'arrow-left': <path d="M20 12H4M10 6l-6 6 6 6" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  download: <path d="M12 3.5v12M7 10.5l5 5 5-5M4 20.5h16" />,
  sliders: <path d="M4 6.5h10M18 6.5h2M4 12h4M12 12h8M4 17.5h12M20 17.5h0M16 4.5v4M10 10v4M18 15.5v4" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  store: (
    <>
      <path d="M3.5 9.5 5 4h14l1.5 5.5" />
      <path d="M3.5 9.5a2.8 2.8 0 0 0 5.7 0 2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.7 0M5 12v8.5h14V12M10 20.5v-5h4v5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
};

export default function Icon({
  name,
  size = 24,
  className = '',
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };
