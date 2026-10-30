import type { CategoryUsageFields } from './types';

const hotWater = [
  { key: 'people', label: 'Personas en el hogar', type: 'number', min: 1, max: 10, step: 1 },
  {
    key: 'hotWaterLPerPersonDay',
    label: 'Agua caliente por persona',
    help: 'Una ducha de 8 minutos usa unos 50 L.',
    type: 'number',
    min: 10,
    max: 150,
    step: 5,
    unit: 'L/día',
  },
  { key: 'coldWaterTempC', label: 'Temperatura del agua de red', help: 'Promedio anual: 12–20 °C según la zona.', type: 'number', min: 5, max: 28, step: 1, unit: '°C' },
  { key: 'hotWaterTempC', label: 'Temperatura de uso', type: 'number', min: 35, max: 60, step: 1, unit: '°C' },
] as const;

const room = [
  { key: 'acAreaM2', label: 'Superficie del ambiente', help: 'Con esto calculamos la potencia que necesitás.', type: 'number', min: 4, max: 200, step: 1, unit: 'm²' },
  { key: 'acCeilingM', label: 'Altura del techo', type: 'number', min: 2, max: 6, step: 0.1, unit: 'm' },
] as const;

export const USAGE_FIELDS: CategoryUsageFields = {
  heladeras: [],
  aires: [
    { key: 'acAreaM2', label: 'Superficie del ambiente', help: 'Con esto calculamos las frigorías que necesitás.', type: 'number', min: 4, max: 200, step: 1, unit: 'm²' },
    { key: 'acCeilingM', label: 'Altura del techo', type: 'number', min: 2, max: 6, step: 0.1, unit: 'm' },
    { key: 'acHighLoad', label: 'Mucho sol, último piso o poco aislamiento', type: 'toggle' },
    {
      key: 'acCoolingHoursYear',
      label: 'Horas de frío por año',
      help: 'Ej.: 5 h/día durante 4 meses ≈ 600 h.',
      type: 'number',
      min: 0,
      max: 3000,
      step: 50,
      unit: 'h',
    },
    { key: 'acUseHeating', label: 'También lo uso para calefaccionar', type: 'toggle' },
    { key: 'acHeatingHoursYear', label: 'Horas de calor por año', type: 'number', min: 0, max: 3000, step: 50, unit: 'h' },
  ],
  lavarropas: [{ key: 'washCyclesPerWeek', label: 'Lavados por semana', type: 'number', min: 1, max: 21, step: 1 }],
  calefones: [...hotWater],
  termotanques: [...hotWater],
  calefactores: [
    ...room,
    { key: 'acHighLoad', label: 'Ambiente frío: planta baja, poco aislamiento o muchas ventanas', type: 'toggle' },
    { key: 'heatingDaysYear', label: 'Días con calefacción por año', help: 'Mayo a septiembre ≈ 150 días.', type: 'number', min: 10, max: 365, step: 5 },
    { key: 'heatingHoursDay', label: 'Horas prendida por día', type: 'number', min: 1, max: 24, step: 1, unit: 'h' },
  ],
};
