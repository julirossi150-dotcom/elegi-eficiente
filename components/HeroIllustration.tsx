// Ilustración original del hero: cielo, Andes, molinos, casas con paneles y vegetación.
// SVG puro (sin JS); los molinos giran con CSS y se detienen con prefers-reduced-motion.

function Turbine({ x, y, h, slow = false }: { x: number; y: number; h: number; slow?: boolean }) {
  const blade = h * 0.52;
  const hubY = y - h;
  const bladePath = `M0,0 C${blade * 0.05},${-blade * 0.15} ${blade * 0.055},${-blade * 0.6} ${blade * 0.012},${-blade} L${-blade * 0.012},${-blade} C${-blade * 0.03},${-blade * 0.6} ${-blade * 0.04},${-blade * 0.15} 0,0 Z`;
  return (
    <g>
      <path d={`M${x - h * 0.018},${y} L${x - h * 0.007},${hubY} L${x + h * 0.007},${hubY} L${x + h * 0.018},${y} Z`} fill="#eef6fb" />
      <path d={`M${x + h * 0.004},${y} L${x + h * 0.007},${hubY} L${x + h * 0.018},${y} Z`} fill="#c9dbe8" />
      <g className={`turbine-blades${slow ? ' slow' : ''}`} style={{ transformOrigin: `${x}px ${hubY}px` }}>
        {[0, 120, 240].map((a) => (
          <path key={a} d={bladePath} transform={`translate(${x} ${hubY}) rotate(${a})`} fill="#f7fbfd" />
        ))}
      </g>
      <circle cx={x} cy={hubY} r={h * 0.022} fill="#dfeaf2" />
    </g>
  );
}

function House({ x, y, w, h, roof = '#2c4f8f' }: { x: number; y: number; w: number; h: number; roof?: string }) {
  const rh = h * 0.42;
  const panels = 4;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#f3e6ee" />
      <rect x={x + w * 0.62} y={y} width={w * 0.38} height={h} fill="#d9c6d6" />
      <path d={`M${x - w * 0.04},${y} L${x + w * 0.1},${y - rh} L${x + w * 1.04},${y - rh} L${x + w * 1.04},${y} Z`} fill={roof} />
      {Array.from({ length: panels }).map((_, i) => (
        <path
          key={i}
          d={`M${x + w * (0.12 + i * 0.22)},${y - rh * 0.12} L${x + w * (0.2 + i * 0.22)},${y - rh * 0.88} L${x + w * (0.38 + i * 0.22)},${y - rh * 0.88} L${x + w * (0.3 + i * 0.22)},${y - rh * 0.12} Z`}
          fill="#3d6fc0"
          stroke="#9cc3f0"
          strokeWidth={1}
          opacity={0.9}
        />
      ))}
      <rect x={x + w * 0.14} y={y + h * 0.3} width={w * 0.14} height={h * 0.22} fill="#f6c343" />
      <rect x={x + w * 0.38} y={y + h * 0.3} width={w * 0.14} height={h * 0.22} fill="#f3d27a" />
      <rect x={x + w * 0.72} y={y + h * 0.3} width={w * 0.12} height={h * 0.22} fill="#b9a2b8" />
      <rect x={x + w * 0.42} y={y + h * 0.62} width={w * 0.12} height={h * 0.38} fill="#8e7a92" />
    </g>
  );
}

function Flower({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-11} rx={8} ry={12} fill="#f6efe4" transform={`rotate(${a})`} />
      ))}
      <circle r={6} fill="#f6a93b" />
    </g>
  );
}

export default function HeroIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMaxYMax slice"
      className={className}
      role="img"
      aria-label="Paisaje con molinos de viento, casas con paneles solares y la cordillera de fondo"
    >
      <defs>
        <linearGradient id="fadeInk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a2627" stopOpacity="0" />
          <stop offset="1" stopColor="#0a2627" />
        </linearGradient>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      {/* el cielo lo pinta el contenedor (bg degradé) para que no haya cortes cuando el SVG ocupa solo la parte de abajo */}
      {/* nubes suaves */}
      <g fill="#ffffff" opacity="0.14">
        <ellipse cx="420" cy="120" rx="260" ry="34" />
        <ellipse cx="1180" cy="90" rx="200" ry="26" />
        <ellipse cx="900" cy="210" rx="320" ry="30" />
      </g>

      {/* ciudad lejana con obelisco */}
      <g fill="#5fb0e3" opacity="0.75">
        <rect x="900" y="250" width="70" height="300" />
        <rect x="985" y="320" width="55" height="230" />
        <rect x="1055" y="210" width="90" height="340" />
        <rect x="1160" y="290" width="60" height="260" />
        <rect x="1235" y="350" width="80" height="200" />
        <path d="M1340,550 L1346,250 L1352,232 L1358,250 L1364,550 Z" />
        <rect x="1390" y="300" width="64" height="250" />
      </g>
      <g fill="#4c9fd6" opacity="0.6">
        <rect x="1070" y="240" width="14" height="300" />
        <rect x="1100" y="240" width="14" height="300" />
      </g>

      {/* cordillera */}
      <path d="M0,560 L160,420 L260,470 L420,330 L560,450 L700,380 L860,500 L1000,410 L1180,520 L1320,430 L1480,500 L1600,440 L1600,700 L0,700 Z" fill="#3f64a0" />
      <path d="M420,330 L470,372 L440,368 L415,390 L395,352 Z M1000,410 L1040,440 L1012,436 L995,452 L980,430 Z" fill="#e8f2fb" opacity="0.8" />
      <path d="M0,610 C220,520 420,560 640,500 C840,446 1040,540 1240,500 C1400,470 1500,520 1600,500 L1600,760 L0,760 Z" fill="#2c4a80" />

      {/* molinos sobre la loma */}
      <Turbine x={980} y={548} h={230} />
      <Turbine x={1150} y={540} h={290} slow />
      <Turbine x={1310} y={548} h={220} />
      <Turbine x={1470} y={536} h={270} slow />

      {/* campo dorado */}
      <path d="M0,700 C260,600 520,640 760,610 C1000,580 1220,640 1600,590 L1600,820 L0,820 Z" fill="#c8b443" />
      <path d="M0,740 C300,660 640,700 900,670 C1180,640 1400,690 1600,660 L1600,840 L0,840 Z" fill="#a7a33c" />

      {/* tendido eléctrico */}
      <g stroke="#2b3b3a" strokeWidth="3" fill="none" opacity="0.8">
        {[520, 760, 1000, 1240, 1480].map((x) => (
          <g key={x}>
            <line x1={x} y1={690} x2={x} y2={608} />
            <line x1={x - 12} y1={616} x2={x + 12} y2={616} />
          </g>
        ))}
        <path d="M520,617 Q640,640 760,617 Q880,640 1000,617 Q1120,640 1240,617 Q1360,640 1480,617" strokeWidth="1.5" />
      </g>

      {/* casas */}
      <House x={780} y={640} w={100} h={60} />
      <House x={920} y={620} w={130} h={74} roof="#23447d" />
      <House x={1110} y={630} w={115} h={68} />
      <House x={1290} y={612} w={145} h={82} roof="#23447d" />

      {/* arbustos */}
      <g fill="#24603f">
        <ellipse cx="610" cy="708" rx="60" ry="22" />
        <ellipse cx="960" cy="702" rx="70" ry="20" />
        <ellipse cx="1180" cy="704" rx="50" ry="18" />
        <ellipse cx="1420" cy="694" rx="80" ry="24" />
      </g>

      {/* primer plano */}
      <path d="M0,780 C220,730 480,760 700,740 C980,714 1240,760 1600,730 L1600,900 L0,900 Z" fill="#164d3a" />
      <path d="M0,830 C260,790 560,820 820,800 C1100,780 1360,820 1600,800 L1600,900 L0,900 Z" fill="#0f3b2e" />
      <g fill="#0c2f26">
        {[80, 260, 470, 1080, 1290, 1500].map((x, i) => (
          <path key={x} d={`M${x},900 C${x - 30},${820 - (i % 3) * 20} ${x - 10},${760 - (i % 2) * 30} ${x + 10},${740 - (i % 3) * 15} C${x + 20},${790} ${x + 36},${830} ${x + 40},900 Z`} />
        ))}
      </g>
      <Flower x={150} y={820} s={1.4} />
      <Flower x={330} y={850} s={1} />
      <Flower x={1140} y={840} s={1.2} />
      <Flower x={1460} y={812} s={1.5} />
      <g fill="#f6efe4">
        {[[200, 860], [380, 820], [1180, 870], [1520, 860], [1400, 850]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={4} />
        ))}
      </g>

      {/* grano y fundido hacia la sección siguiente */}
      <rect width="1600" height="900" filter="url(#grain)" opacity="0.07" />
      <rect y="760" width="1600" height="140" fill="url(#fadeInk)" />
    </svg>
  );
}
