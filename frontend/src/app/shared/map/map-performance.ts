import type { MapOptions } from 'maplibre-gl';

type Connection = {saveData?: boolean; effectiveType?: string};
type Environment = {width: number; connection?: Connection; memory?: number; pixelRatio: number};

const SLOW = new Set(['slow-2g', '2g', '3g']);

/** Tryb „lite”: wąski ekran, oszczędzanie danych, wolne łącze albo mało pamięci. */
export function isLite(env: Environment): boolean {
  return env.width < 1024 || !!env.connection?.saveData || SLOW.has(env.connection?.effectiveType ?? '')
    || (env.memory !== undefined && env.memory <= 2);
}

/** Opcje mapy ograniczające liczbę kafelków, pamięć i przerysowania na telefonach. */
export function performanceOptions(env: Environment): Partial<MapOptions> {
  if (!isLite(env)) return {};
  return {
    maxTileCacheSize: 24,
    fadeDuration: 0,
    pixelRatio: Math.min(env.pixelRatio, 2),
    refreshExpiredTiles: false,
  };
}

/** Odczyt środowiska przeglądarki (Network Information API i `deviceMemory` są opcjonalne). */
export function browserEnvironment(): Environment {
  const nav = navigator as Navigator & {connection?: Connection; deviceMemory?: number};
  return {width: window.innerWidth, connection: nav.connection, memory: nav.deviceMemory, pixelRatio: window.devicePixelRatio || 1};
}
