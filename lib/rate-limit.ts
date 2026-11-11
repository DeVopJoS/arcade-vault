// Rate limit en memoria (best-effort): se reinicia con el servidor y no se
// comparte entre instancias serverless. Ver SPEC 03, Decisiones.

const WINDOW_MS = 60 * 60 * 1000; // 1 hora
const MAX_HITS = 3;

const hits = new Map<string, number[]>();

/** Registra un intento para `key`. Devuelve `false` si excede el límite. */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_HITS) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}
