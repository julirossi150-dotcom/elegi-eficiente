import type { CategoryId } from './types';

export const SITE = {
  name: 'Elegí Eficiente',
  tagline: 'Compará electrodomésticos por lo que te cuestan hoy y durante toda su vida útil.',
  description:
    'Comparador gratuito de heladeras, aires acondicionados, lavarropas, calefones y termotanques con etiqueta de eficiencia energética en Argentina. Precio de compra + consumo de luz y gas.',
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL || '',
};

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** Prefija rutas de archivos estáticos (public/) con el basePath de despliegue. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  singular: string;
  blurb: string;
  energyHint: string;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'heladeras',
    name: 'Heladeras y freezers',
    singular: 'heladera',
    blurb: 'Funcionan las 24 horas: es el aparato que más pesa en la factura de luz de casi todos los hogares.',
    energyHint: 'Electricidad',
  },
  {
    id: 'aires',
    name: 'Aires acondicionados',
    singular: 'aire acondicionado',
    blurb: 'Frío y calor. La diferencia entre un equipo inverter eficiente y uno común se nota cada verano.',
    energyHint: 'Electricidad',
  },
  {
    id: 'lavarropas',
    name: 'Lavarropas',
    singular: 'lavarropas',
    blurb: 'Consumo por lavado, agua y capacidad. Ideal para comparar por tamaño de familia.',
    energyHint: 'Electricidad',
  },
  {
    id: 'calefones',
    name: 'Calefones',
    singular: 'calefón',
    blurb: 'El piloto encendido consume gas todo el año aunque no uses agua caliente.',
    energyHint: 'Gas natural o envasado',
  },
  {
    id: 'termotanques',
    name: 'Termotanques',
    singular: 'termotanque',
    blurb: 'A gas o eléctricos: mantener el agua caliente tiene un costo diario que la etiqueta informa.',
    energyHint: 'Gas o electricidad',
  },
];

export function categoryInfo(id: CategoryId): CategoryInfo {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) throw new Error(`Categoría desconocida: ${id}`);
  return c;
}
