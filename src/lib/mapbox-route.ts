import type { Feature, LineString } from "geojson"

import { getMapboxAccessToken } from "@/lib/mapbox"

export type GeocodeHit = {
  lng: number
  lat: number
  placeName: string
}

/** Wynik forward geocode z metadanymi (wielowynikowe wyszukiwanie POI). */
export type GeocodeFeatureHit = GeocodeHit & {
  relevance: number
  /** Id obiektu Mapbox (stabilniejsze niż dedup po współrzędnych). */
  mapboxId?: string
}

export type DrivingRouteResult = {
  geometry: Feature<LineString>
  distanceMeters: number
  durationSeconds: number
  /** Do 2 tras od Mapbox (routes[1], routes[2]); puste bez `alternatives` lub przy >2 punktach. */
  alternativeGeometries: Feature<LineString>[]
  /** Ta sama kolejność co `alternativeGeometries` (metryki z Directions API). */
  alternativeMetrics: { distanceMeters: number; durationSeconds: number }[]
}

export type GeocodeForwardOpts = {
  /** Preferuj wyniki blisko tego punktu (np. po podpowiedzi LLM). */
  proximity?: { lng: number; lat: number }
}

/**
 * Przybliżony prostokąt wokół punktu (km od środka do rogu ~ sqrt(2)*r).
 * Format Mapbox Geocoding `bbox`: minLon,minLat,maxLon,maxLat.
 */
export function geocodeBboxAroundPoint(
  lng: number,
  lat: number,
  radiusKm: number,
): string {
  const r = Math.max(radiusKm, 2)
  const dLat = r / 111
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const dLng = r / (111 * Math.max(cosLat, 0.15))
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`
}

export type GeocodeForwardFeaturesOpts = GeocodeForwardOpts & {
  /** Domyślnie 8; Mapbox typowo do 10. */
  limit?: number
  /**
   * Domyślnie `poi,address` — samo `poi` często zwraca puste wyniki dla ogólnych haseł.
   * @see https://docs.mapbox.com/api/search/geocoding/
   */
  types?: string
  /** `minLon,minLat,maxLon,maxLat` — ogranicza wyniki do okolicy (współrzędne WGS84). */
  bbox?: string
}

/**
 * Forward geocoding (Mapbox Geocoding API). Uproszczone do pierwszego wyniku, z biasem PL.
 */
export async function geocodeForward(
  query: string,
  opts?: GeocodeForwardOpts
): Promise<GeocodeHit | null> {
  const token = getMapboxAccessToken()
  if (!token?.trim()) {
    throw new Error("Brak tokenu Mapbox (NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN).")
  }

  const q = query.trim()
  if (!q) return null

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
  )
  url.searchParams.set("access_token", token)
  url.searchParams.set("limit", "1")
  url.searchParams.set("country", "pl")
  url.searchParams.set("language", "pl")
  url.searchParams.set("types", "place,locality,neighborhood,address,poi")
  const px = opts?.proximity
  url.searchParams.set(
    "proximity",
    px ? `${px.lng},${px.lat}` : "19.145,51.919"
  )

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Geokodowanie nie powiodło się (HTTP ${res.status}).`)
  }

  const data = (await res.json()) as {
    features?: { center?: [number, number]; place_name?: string }[]
  }
  const f = data.features?.[0]
  if (!f?.center || f.center.length < 2) return null

  return {
    lng: f.center[0],
    lat: f.center[1],
    placeName: f.place_name ?? q,
  }
}

/**
 * Forward geocoding — wiele wyników (np. pod hasła typu „restauracja”, „muzeum” przy `proximity`).
 */
export async function geocodeForwardFeatures(
  query: string,
  opts?: GeocodeForwardFeaturesOpts,
): Promise<GeocodeFeatureHit[]> {
  const token = getMapboxAccessToken()
  if (!token?.trim()) {
    throw new Error("Brak tokenu Mapbox (NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN).")
  }

  const q = query.trim()
  if (!q) return []

  const limit = Math.min(Math.max(opts?.limit ?? 8, 1), 10)
  const types = opts?.types ?? "poi,address"

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
  )
  url.searchParams.set("access_token", token)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("country", "pl")
  url.searchParams.set("language", "pl")
  url.searchParams.set("types", types)
  const px = opts?.proximity
  url.searchParams.set(
    "proximity",
    px ? `${px.lng},${px.lat}` : "19.145,51.919",
  )
  if (opts?.bbox?.trim()) {
    url.searchParams.set("bbox", opts.bbox.trim())
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Geokodowanie nie powiodło się (HTTP ${res.status}).`)
  }

  const data = (await res.json()) as {
    features?: Array<{
      id?: string
      center?: [number, number]
      place_name?: string
      relevance?: number
    }>
  }

  const out: GeocodeFeatureHit[] = []
  for (const f of data.features ?? []) {
    if (!f?.center || f.center.length < 2) continue
    const relevance = typeof f.relevance === "number" ? f.relevance : 0
    out.push({
      lng: f.center[0],
      lat: f.center[1],
      placeName: f.place_name ?? q,
      relevance,
      mapboxId: typeof f.id === "string" ? f.id : undefined,
    })
  }
  return out
}

/**
 * Reverse geocoding — adres z współrzędnych (Mapbox Geocoding API).
 */
export async function geocodeReverse(
  lng: number,
  lat: number,
  opts?: { signal?: AbortSignal }
): Promise<GeocodeHit | null> {
  const token = getMapboxAccessToken()
  if (!token?.trim()) {
    throw new Error("Brak tokenu Mapbox (NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN).")
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${lng},${lat}`)}.json`
  )
  url.searchParams.set("access_token", token)
  url.searchParams.set("limit", "1")
  url.searchParams.set("language", "pl")
  url.searchParams.set("country", "pl")

  const res = await fetch(url.toString(), { signal: opts?.signal })
  if (!res.ok) {
    throw new Error(`Odwrotne geokodowanie nie powiodło się (HTTP ${res.status}).`)
  }

  const data = (await res.json()) as {
    features?: { center?: [number, number]; place_name?: string }[]
  }
  const f = data.features?.[0]
  if (!f?.center || f.center.length < 2) return null

  return {
    lng: f.center[0],
    lat: f.center[1],
    placeName: f.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  }
}

export type FetchDrivingRouteOptions = {
  /** Mapbox zwraca do 2 alternatyw tylko dla trasy A→B (dokładnie 2 punkty). */
  alternatives?: boolean
  /** Preferuj trasy lokalne: `exclude=motorway,toll,ferry` w Directions API. */
  preferUnpaved?: boolean
}

/**
 * Trasa samochodowa przez dowolną liczbę punktów (Mapbox Directions API).
 */
export async function fetchDrivingRoute(
  points: { lng: number; lat: number }[],
  options?: FetchDrivingRouteOptions
): Promise<DrivingRouteResult | null> {
  const token = getMapboxAccessToken()
  if (!token?.trim()) {
    throw new Error("Brak tokenu Mapbox (NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN).")
  }

  if (points.length < 2) return null

  const path = points.map((p) => `${p.lng},${p.lat}`).join(";")
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${path}`)
  url.searchParams.set("access_token", token)
  url.searchParams.set("geometries", "geojson")
  url.searchParams.set("overview", "full")

  const wantAlternatives = Boolean(options?.alternatives && points.length === 2)
  if (wantAlternatives) {
    url.searchParams.set("alternatives", "true")
  }

  if (options?.preferUnpaved) {
    url.searchParams.set("exclude", "motorway,toll,ferry")
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Nie udało się pobrać trasy (HTTP ${res.status}).`)
  }

  const data = (await res.json()) as {
    code?: string
    routes?: { geometry: LineString; distance: number; duration: number }[]
  }

  if (data.code !== "Ok" || !data.routes?.[0]?.geometry) {
    return null
  }

  const r = data.routes[0]
  const geometry: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: r.geometry,
  }

  const alternativeGeometries: Feature<LineString>[] = []
  const alternativeMetrics: { distanceMeters: number; durationSeconds: number }[] = []
  if (wantAlternatives && data.routes.length > 1) {
    for (let i = 1; i < Math.min(data.routes.length, 3); i++) {
      const alt = data.routes[i]
      if (alt?.geometry?.coordinates?.length) {
        alternativeGeometries.push({
          type: "Feature",
          properties: {},
          geometry: alt.geometry,
        })
        alternativeMetrics.push({
          distanceMeters: alt.distance,
          durationSeconds: alt.duration,
        })
      }
    }
  }

  return {
    geometry,
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    alternativeGeometries,
    alternativeMetrics,
  }
}
