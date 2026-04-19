/** Dystans do czytelnego tekstu PL. */
export function formatDistanceMeters(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

/** Czas jazdy z sekund (API Mapbox). */
export function formatDurationSeconds(seconds: number): string {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) {
    return m > 0 ? `${h} godz. ${m} min` : `${h} godz.`
  }
  return `${m} min`
}
