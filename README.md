# Elegí Eficiente

Comparador gratuito de electrodomésticos con etiqueta de eficiencia energética en Argentina
(heladeras, aires, lavarropas, calefones y termotanques). Muestra el precio de hoy, el gasto de luz o gas
con la tarifa del usuario y el **costo total** a N años, y en cuánto tiempo se recupera pagar más por un equipo eficiente.

## Cómo funciona

```
Tiendas (catálogos VTEX públicos) ──► pipeline/ (todos los días) ──► public/data/*.json ──► sitio estático (Next.js)
```

- **No existe una base pública oficial** de etiquetas: la Res. 438/2024 prevé una, pero no está publicada. Por eso armamos la nuestra.
- `pipeline/fetch.ts` baja Frávega, Cetrogar, OnCity, Naldo, Carrefour, Jumbo y Easy (1 request/seg por tienda, user-agent identificado).
- `pipeline/normalize/` interpreta las fichas de cada tienda (los nombres de campos varían).
- `pipeline/merge.ts` une el mismo producto entre tiendas (por EAN o marca + modelo).
- `pipeline/estimate.ts` completa el consumo que las tiendas no publican, a partir de la clase y la capacidad, con las fórmulas de cada norma. Todo valor estimado queda marcado.
- **Datos de fabricante** (pisan a los de las tiendas y quedan marcados como "fabricante"):
  - Tiendas oficiales VTEX (Whirlpool, Electrolux/Gafa, BGH), que se leen todos los días junto con las demás tiendas.
  - `pipeline/manual/<categoria>.json`: cargas a mano desde etiquetas, fichas y manuales, con su fuente. Coinciden por EAN, por código de modelo (con `*` como comodín) o por una regex sobre el nombre.
  - `pipeline/manual/fabricantes/*.json`: los genera `npx tsx pipeline/harvest/run.ts`, que baja las Declaraciones Juradas de Conformidad (Res. 438/2024) de los sitios de fabricantes (hoy Drean, que incluye Patrick, Mabe y Top House) y las lee con `pdftotext`. No corre a diario: conviene repetirlo cada uno o dos meses.
- `lib/cost/` es el modelo de costos, compartido entre el pipeline y la web.

## Comandos

```bash
npm install
npm run data:update          # baja catálogos y regenera public/data (≈2 min)
npm run dev                  # http://localhost:3000
npm test                     # pruebas del modelo de costos y del parseo
npm run build                # sitio estático en out/
```

Herramientas de diagnóstico: `npx tsx pipeline/run.ts --offline` (reusa lo bajado), `npx tsx pipeline/discover.ts heladeras fravega`
(qué categorías y campos trae una tienda) y `npx tsx pipeline/check-estimates.ts` (error de las estimaciones contra datos reales).

## Publicar gratis (GitHub Pages)

1. Crear un repositorio en GitHub y subir este proyecto.
2. En **Settings → Pages**, elegir **Source: GitHub Actions**.
3. El workflow `.github/workflows/actualizar-y-publicar.yml` actualiza los datos todos los días a las 06:00 (hora argentina),
   commitea `public/data/` y publica el sitio. También se puede correr a mano desde la pestaña **Actions**.

El sitio es 100 % estático: también funciona en Cloudflare Pages o Netlify publicando la carpeta `out/`.

## Límites conocidos

- Solo ~5–10 % de las publicaciones informan kWh; con datos de fabricante sube algo, y el resto se estima por clase (error medio contra datos reales: heladeras ±13 %, lavarropas ±22 %).
- Samsung publica etiquetas en su sitio, pero las que encontramos son de Chile y Colombia (otro ensayo), así que no se usan. Whirlpool solo publica la etiqueta como imagen.
- En la letra sola (A, B) no siempre se sabe si es la etiqueta vieja o la nueva; se resuelve con los datos del resto del catálogo.
- Los artefactos a gas casi nunca traen rendimiento ni consumo de piloto en las tiendas: conviene cargar los modelos más vendidos en `pipeline/manual/`.
- Los precios son los publicados por cada tienda; no incluyen cuotas, envío ni instalación.
