// Cliente HTTP educado: una request por vez por host, pausa entre requests y reintentos con backoff.

// Identificación honesta del proyecto (sin simular un navegador). Algunas tiendas responden 429 a UAs con "bot".
const UA = `ElegiEficiente/0.1 (+${process.env.REPO_URL || 'https://github.com/elegi-eficiente'}; comparador sin fines de lucro)`;

const lastHit = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchResult<T> {
  data: T;
  headers: Headers;
  status: number;
}

export async function politeFetchJson<T>(
  url: string,
  { minIntervalMs = 1100, retries = 3, timeoutMs = 30_000 }: { minIntervalMs?: number; retries?: number; timeoutMs?: number } = {},
): Promise<FetchResult<T>> {
  const host = new URL(url).host;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const wait = (lastHit.get(host) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok && res.status !== 206) {
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`), { fatal: res.status < 500 });
      }
      return { data: (await res.json()) as T, headers: res.headers, status: res.status };
    } catch (err) {
      lastErr = err;
      if ((err as { fatal?: boolean }).fatal) break;
      await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Igual que politeFetchJson pero devuelve el cuerpo crudo (HTML o PDF). null si el recurso no existe (4xx). */
export async function politeFetchBytes(url: string, { minIntervalMs = 1100, timeoutMs = 30_000 }: { minIntervalMs?: number; timeoutMs?: number } = {}): Promise<Buffer | null> {
  const host = new URL(url).host;
  for (let attempt = 0; attempt <= 2; attempt++) {
    const wait = (lastHit.get(host) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch {
      await sleep(2000 * 2 ** attempt);
    }
  }
  return null;
}
