/** Publiczny token Mapbox (pk.…) — dostępny w bundle po prefiksie NEXT_PUBLIC_. */
export function getMapboxAccessToken(): string | undefined {
  const t = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  return t?.trim() || undefined
}
