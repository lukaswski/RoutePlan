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

/**
 * Trasa samochodowa przez dowolną liczbę punktów (Mapbox Directions API).
 */
export async function fetchDrivingRoute(
  points: { lng: number; lat: number }[]
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

  return {
    geometry,
    distanceMeters: r.distance,
    durationSeconds: r.duration,
  }
}
