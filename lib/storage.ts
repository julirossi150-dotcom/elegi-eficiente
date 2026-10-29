// Preferencias del visitante (tarifa, uso). Solo comodidad: si el navegador bloquea el almacenamiento, se usan los valores por defecto.

export function loadPref<T extends object>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`ee:${key}`);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(`ee:${key}`, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible */
  }
}
