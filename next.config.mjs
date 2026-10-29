// Sitio 100% estático: se publica la carpeta `out/` en GitHub Pages, Cloudflare Pages o Netlify.
// Si se publica en un subdirectorio (p. ej. GitHub Pages sin dominio propio: /elegi-eficiente),
// definir NEXT_PUBLIC_BASE_PATH=/elegi-eficiente al compilar.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
