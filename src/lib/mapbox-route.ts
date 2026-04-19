import type { Feature, LineString } from "geojson"

import { getMapboxAccessToken } from "@/lib/mapbox"

export type GeocodeHit = {
  lng: number
  lat: number
  placeName: string
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

/**
 * Forward geocoding (Mapbox Geocoding API). Uproszczone do pierwszego wyniku, z biasem PL.
 */
export async function geocodeForward(query: string): Promise<GeocodeHit | null> {
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
  url.searchParams.set("proximity", "19.145,51.919")

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

export type FetchDrivingRouteOptions = {
  /** Mapbox zwraca do 2 alternatyw tylko dla trasy A→B (dokładnie 2 punkty). */
  alternatives?: boolean
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
