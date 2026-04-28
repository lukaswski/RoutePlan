import "server-only"

import {
  buildGoogleMapsPinUrl,
  buildGoogleMapsPlaceUrl,
  buildOsmBrowseUrl,
} from "@/lib/maps-links"
import type { WaypointPoiKind, WaypointPoiMarker } from "@/lib/waypoint-poi"

const OVERPASS_URL = "https://overpass-api.de/api/interpreter"

type OsmElement = {
  type: "node" | "way" | "relation"
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function inferKind(tags: Record<string, string>): WaypointPoiKind | null {
  const a = tags.amenity
  if (a === "museum") return "sightseeing"
  if (
    a === "restaurant" ||
    a === "fast_food" ||
    a === "cafe" ||
    a === "food_court" ||
    a === "bar"
  ) {
    return "restaurant"
  }
  if (a === "parking") return "parking"
  if (
    tags.tourism === "attraction" ||
    tags.tourism === "museum" ||
    tags.tourism === "viewpoint" ||
    tags.historic ||
    tags.leisure === "park" ||
    tags.natural === "peak"
  ) {
    return "sightseeing"
  }
  return null
}

function displayName(tags: Record<string, string>): string | null {
  const n =
    tags.name?.trim() ||
    tags["name:pl"]?.trim() ||
    tags.brand?.trim() ||
    ""
  return n.length > 0 ? n : null
}

function coordsFromEl(el: OsmElement): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon }
  }
  const c = el.center
  if (c && typeof c.lat === "number" && typeof c.lon === "number") {
    return { lat: c.lat, lng: c.lon }
  }
  return null
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

/**
 * Konkretne POI z bazy OSM (nazwy + GPS) — lepsze niż sam forward geocode pod hasłem.
 */
export async function fetchOsmPoiMarkersNear(params: {
  lat: number
  lng: number
  waypointLabel: string
  want: { restaurants: boolean; sights: boolean; parking: boolean }
  maxPerKind: number
  maxTotal: number
  radiusMeters: number
}): Promise<WaypointPoiMarker[]> {
  const { lat, lng, waypointLabel, want, maxPerKind, maxTotal, radiusMeters } =
    params
  const R = Math.round(radiusMeters)

  const parts: string[] = ["[out:json][timeout:25];", "("]

  if (want.restaurants) {
    parts.push(
      `  node["amenity"~"^(restaurant|fast_food|cafe|bar)$"](around:${R},${lat},${lng});`,
      `  way["amenity"~"^(restaurant|fast_food|cafe|bar)$"](around:${R},${lat},${lng});`,
    )
  }
  if (want.parking) {
    parts.push(
      `  node["amenity"="parking"]["name"](around:${R},${lat},${lng});`,
      `  way["amenity"="parking"]["name"](around:${R},${lat},${lng});`,
    )
  }
  if (want.sights) {
    parts.push(
      `  node["amenity"="museum"]["name"](around:${R},${lat},${lng});`,
      `  way["amenity"="museum"]["name"](around:${R},${lat},${lng});`,
      `  node["tourism"="attraction"](around:${R},${lat},${lng});`,
      `  way["tourism"="attraction"](around:${R},${lat},${lng});`,
      `  node["tourism"="museum"]["name"](around:${R},${lat},${lng});`,
      `  way["tourism"="museum"]["name"](around:${R},${lat},${lng});`,
      `  node["tourism"="viewpoint"]["name"](around:${R},${lat},${lng});`,
      `  node["leisure"="park"]["name"](around:${R},${lat},${lng});`,
      `  way["leisure"="park"]["name"](around:${R},${lat},${lng});`,
    )
  }

  parts.push(");", "out center tags;")

  const overpassQl = parts.join("\n")

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "PlanerTrasy/1.0 (route planner; not a bulk bot)",
    },
    body: `data=${encodeURIComponent(overpassQl)}`,
    signal: AbortSignal.timeout(28_000),
  })

  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}`)
  }

  const data = (await res.json()) as { elements?: OsmElement[] }
  const elements = data.elements ?? []

  const origin = { lat, lng }
  const areaHint = waypointLabel.trim().split(",")[0]?.trim() ?? ""

  type Cand = {
    kind: WaypointPoiKind
    name: string
    lat: number
    lng: number
    d: number
    osmType: string
    osmId: number
  }

  const candidates: Cand[] = []

  for (const el of elements) {
    const tags = el.tags ?? {}
    const kind = inferKind(tags)
    if (!kind) continue
    if (kind === "restaurant" && !want.restaurants) continue
    if (kind === "sightseeing" && !want.sights) continue
    if (kind === "parking" && !want.parking) continue

    const name = displayName(tags)
    if (!name) continue

    const pos = coordsFromEl(el)
    if (!pos) continue

    const d = distanceMeters(origin, pos)
    if (d > radiusMeters) continue

    candidates.push({
      kind,
      name,
      lat: pos.lat,
      lng: pos.lng,
      d,
      osmType: el.type,
      osmId: el.id,
    })
  }

  candidates.sort((a, b) => a.d - b.d)

  const perKind: Record<WaypointPoiKind, number> = {
    restaurant: 0,
    sightseeing: 0,
    parking: 0,
  }
  const coordSeen = new Set<string>()
  const out: WaypointPoiMarker[] = []

  for (const c of candidates) {
    if (out.length >= maxTotal) break
    if (perKind[c.kind] >= maxPerKind) continue
    const ck = `${c.lat.toFixed(5)}_${c.lng.toFixed(5)}`
    if (coordSeen.has(ck)) continue
    coordSeen.add(ck)
    perKind[c.kind] += 1

    const googleMapsUrl = buildGoogleMapsPlaceUrl({
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      areaHint,
    })

    out.push({
      id: crypto.randomUUID(),
      lat: c.lat,
      lng: c.lng,
      kind: c.kind,
      name: c.name,
      areaHint: areaHint || undefined,
      googleMapsUrl,
      googleMapsPinUrl: buildGoogleMapsPinUrl(c.lat, c.lng),
      osmBrowseUrl: buildOsmBrowseUrl(c.osmType, c.osmId),
      dataSource: "osm",
    })
  }

  return out
}
