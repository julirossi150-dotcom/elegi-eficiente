// Explicaciones de cálculo por categoría para la página de metodología.
import type { CategoryId } from '../types';

export const METHOD_NOTES: Record<CategoryId, string[]> = {
  heladeras: [
    'Usamos el consumo anual (kWh/año) de la etiqueta. Es un ensayo de laboratorio de 24 h a 25 °C con puertas cerradas, igual en la etiqueta vieja y en la nueva, así que los kWh de ambas se comparan directamente. En una cocina calurosa o con muchas aperturas de puerta el consumo real es mayor, pero afecta a todos los modelos por igual.',
    'La clase sale del Índice de Eficiencia Energética (IEE = consumo ÷ consumo estándar del tamaño y tipo, IRAM 2404-3:2015). La etiqueta nueva solo cambió las letras: A+++→A, A++→B, A+→C, A→D, B→E, C→F, D→G.',
    'Primero buscamos el dato del fabricante: su tienda oficial (Electrolux/Gafa, Whirlpool, BGH) o la Declaración Jurada de Conformidad de la Res. 438/2024 que publica en su sitio (Drean, Patrick y marcas gemelas), que trae clase, kWh/año y volúmenes. Ese dato pisa al de las tiendas.',
    'Si nadie informa los kWh, los estimamos con el IEE medio de la clase y el consumo estándar según volumen, freezer y No Frost (error medio ±13 % contra 75 modelos con dato real). Cuando la letra es ambigua (A o B pueden ser de cualquiera de las dos escalas) usamos la escala más frecuente entre los productos de la misma clase que sí informan consumo.',
  ],
  aires: [
    'Energía anual = capacidad de frío (W) × horas de uso × 60 % de carga media ÷ índice de eficiencia. Usamos el índice estacional (IEEE) cuando se conoce, si no el EER. Para calefaccionar, capacidad de calor ÷ COP.',
    'La etiqueta informa el consumo para 500 horas a plena carga. Con la clase sola estimamos el IEEE con el punto medio de su rango (Res. 438/2024: A > 8,5; B 5,6–8,5; C 3,6–5,6; D 3,39–3,6…). La escala IRAM 62406:2019 usa los mismos cortes con letras A+++…D.',
  ],
  lavarropas: [
    'Energía anual = kWh por lavado (etiqueta) × lavados por semana × 52. La clase sale de C = kWh por ciclo ÷ kg de carga, con los mismos cortes en las dos escalas (A+++→A, A++→B, A+→C, A→D, B→E).',
    'El kWh por lavado sale, en orden de preferencia, de la DJC del fabricante (Drean), de su tienda oficial o de las tiendas. Sin ese dato lo estimamos con el valor medio de C de la clase × la capacidad (error medio ±22 % contra 29 modelos con dato real). El agua por lavado se informa pero no se suma al costo, porque en la mayoría de los hogares no se factura por consumo. Los semiautomáticos y lavasecarropas no tienen etiqueta obligatoria y no se incluyen.',
  ],
  calefones: [
    'Energía para el agua del hogar: personas × litros por persona × (temperatura de uso − temperatura de red) × 365, dividida por el rendimiento y por el poder calorífico del gas (9.300 kcal/m³ o 11.948 kcal/kg de GLP).',
    'Si tiene piloto le sumamos su consumo de todo el año: típicamente ~0,5 m³ por día, que puede ser casi la mitad del gasto. La clase de ENARGAS (NAG-313) mide la eficiencia global de un día tipo incluyendo el piloto; con ella separamos el consumo del piloto del de calentar.',
    'Piloto, rendimiento y clase los tomamos de las fichas y manuales de los fabricantes cuando están (Escorial, Señorial, Volcán, Longvie). Ojo: algunas tiendas muestran como "clase B" el "Tipo B" de tiraje, que no es una clase de eficiencia.',
  ],
  termotanques: [
    'Igual que el calefón para calentar el agua, más el consumo de mantenimiento: lo que gasta para mantener el tanque caliente aunque no se use (NAG-314). Con la clase y la capacidad lo estimamos con el método de la norma; sin clase usamos el valor típico medido (~0,65 m³/día).',
    'Cuando el fabricante publica la etiqueta (Longvie, Señorial), usamos su "consumo medio en condiciones normalizadas" (m³/año): el rendimiento sale de la recuperación ÷ la potencia del quemador, y el mantenimiento es lo que falta para llegar al consumo de la etiqueta. Así, con el uso de la etiqueta (400 L/día de 17 a 42 °C) el cálculo da exactamente ese consumo.',
    'Para eléctricos usamos 95 % de rendimiento al calentar y las pérdidas diarias (si la tienda no las informa, un valor típico según capacidad).',
  ],
};

export const METHOD_SOURCES: { title: string; url: string }[] = [
  { title: 'Etiquetado en eficiencia energética — argentina.gob.ar', url: 'https://www.argentina.gob.ar/node/169584' },
  { title: 'Resolución SIC 438/2024 (texto actualizado)', url: 'https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-438-2024-406558/actualizacion' },
  { title: 'Res. SE 682/2013 — mínimos de eficiencia para heladeras', url: 'https://www.argentina.gob.ar/normativa/nacional/norma-220745/texto' },
  { title: 'Res. SE 684/2013 — lavarropas', url: 'https://www.argentina.gob.ar/normativa/nacional/norma-220747/texto' },
  { title: 'ENARGAS — Agua caliente sanitaria: modos más asequibles (2020)', url: 'https://www.enargas.gob.ar/secciones/publicaciones/divulgacion-tecnica/pdf/agua-caliente-sanitaria.pdf' },
  { title: 'Reglamento (UE) 1060/2010, Anexo VIII (método del IEE de heladeras)', url: 'https://www.boe.es/doue/2010/314/L00017-00046.pdf' },
  { title: 'JRC108604 — uso de lavarropas en hogares (UE)', url: 'https://publications.jrc.ec.europa.eu/repository/handle/JRC108604' },
  { title: 'Drean — Declaraciones Juradas de Conformidad (Res. 438/2024)', url: 'https://blog.drean.com.ar/certificados/' },
  { title: 'Longvie — etiquetas ENARGAS de termotanques', url: 'https://longvie.com/termotanques' },
  { title: 'Señorial — fichas técnicas de termotanques y calefones', url: 'https://senorial.com.ar/categoria-producto/termotanques/' },
  { title: 'Escorial — folleto y manuales', url: 'https://escorial.com.ar/download/BrochureEscorial.pdf' },
  { title: 'Volcán — fichas de calefones y termotanques', url: 'https://volcan.com.ar/shop/calefones/' },
];
