import {
  geocodeBboxAroundPoint,
  geocodeForwardFeatures,
  type GeocodeFeatureHit,
} from "@/lib/mapbox-route"
import { buildGoogleMapsPinUrl, buildGoogleMapsPlaceUrl } from "@/lib/maps-links"
import { fetchOsmPoiMarkersNear } from "@/lib/osm-overpass-nearby"
import type { WaypointPoiKind, WaypointPoiMarker } from "@/lib/waypoint-poi"

/** Frazy wyszukiwania do Mapbox (LLM + domyślne) per kategoria. */
export type PoiSearchPlan = {
  restaurant: string[]
  sightseeing: string[]
  parking: string[]
}

const MAX_PER_QUERY = 10
const MAX_PER_CATEGORY = 5
const MAX_MARKERS_TOTAL = 12
/** Domyślne hasła muszą zajść pierwsze — LLM jako uzupełnienie. */
const MAX_QUERIES_PER_CATEGORY = 6
/** Zgodnie z założeniem okolicy przystanku (~10 km). */
const MAX_KM = 11
/** Bias prostokąta okolicy ok. ~18 km od środka (margines przy filtrze MAX_KM). */
const BBOX_RADIUS_KM = 18

const DEFAULT_QUERIES: Record<WaypointPoiKind, string[]> = {
  restaurant: ["restauracja", "jedzenie", "bistro", "pizza"],
  sightseeing: ["muzeum", "park", "zamek"],
  parking: ["parking", "P+R"],
}

function distanceKm(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

function hitKeyFromParts(
  lng: number,
  lat: number,
  mapboxId?: string,
): string {
  if (mapboxId) return mapboxId
  return `${lng.toFixed(4)}_${lat.toFixed(4)}`
}

function hitKey(h: GeocodeFeatureHit): string {
  return hitKeyFromParts(h.lng, h.lat, h.mapboxId)
}

/**
 * Bez nazwy przystanku nie doklejamy „Polska” — wtedy Mapbox szuka kraju zamiast okolicy.
 */
function expandQuery(phrase: string, placeName: string): string {
  const t = phrase.trim()
  if (!t) return ""
  const city = placeName.trim().split(",")[0]?.trim()
  if (city) return `${t}, ${city}, Polska`
  return t
}

function areaHintFromPlaceTitle(
  placeTitle: string,
  waypointLabel: string,
): string {
  const w = waypointLabel.trim()
  if (w) return w.split(",")[0]!.trim()
  const parts = placeTitle
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return parts[parts.length - 2] ?? parts[0]!
  }
  return parts[0] ?? ""
}

/**
 * Najpierw sprawdzone domyślne hasła Mapbox, potem propozycje LLM — żeby nie zajmowały slotów puste frazy modelu.
 */
export function mergeSearchQueries(
  kind: WaypointPoiKind,
  fromLlm: string[],
): string[] {
  const def = DEFAULT_QUERIES[kind]
  const seen = new Set<string>()
  const out: string[] = []
  const llm = Array.isArray(fromLlm) ? fromLlm : []
  for (const s of [...def, ...llm]) {
    const k = s.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(s.trim())
    if (out.length >= MAX_QUERIES_PER_CATEGORY) break
  }
  return out
}

async function fetchHitsForPhrase(
  query: string,
  proximity: { lng: number; lat: number },
): Promise<GeocodeFeatureHit[]> {
  const bbox = geocodeBboxAroundPoint(
    proximity.lng,
    proximity.lat,
    BBOX_RADIUS_KM,
  )

  let hits = await geocodeForwardFeatures(query, {
    proximity,
    limit: MAX_PER_QUERY,
    bbox,
    types: "poi,address",
  })

  if (hits.length === 0) {
    hits = await geocodeForwardFeatures(query, {
      proximity,
      limit: MAX_PER_QUERY,
      types: "poi,address,locality,place,neighborhood",
    })
  }

  return hits
}

function countMarkersByKind(
  list: WaypointPoiMarker[],
): Record<WaypointPoiKind, number> {
  const n: Record<WaypointPoiKind, number> = {
    restaurant: 0,
    sightseeing: 0,
    parking: 0,
  }
  for (const m of list) n[m.kind] += 1
  return n
}

/**
 * Najpierw konkretne POI z OSM (nazwy + linki), potem uzupełnienie Mapbox Geocoding.
 */
export async function geocodeSearchPlanToMarkers(
  plan: PoiSearchPlan,
  proximity: { lng: number; lat: number },
  waypointPlaceName: string,
  want: {
    restaurants: boolean
    sights: boolean
    parking: boolean
  },
): Promise<WaypointPoiMarker[]> {
  let osmMarkers: WaypointPoiMarker[] = []
  try {
    osmMarkers = await fetchOsmPoiMarkersNear({
      lat: proximity.lat,
      lng: proximity.lng,
      waypointLabel: waypointPlaceName,
      want,
      maxPerKind: MAX_PER_CATEGORY,
      maxTotal: MAX_MARKERS_TOTAL,
      radiusMeters: Math.round(MAX_KM * 1000),
    })
  } catch {
    osmMarkers = []
  }

  const markers: WaypointPoiMarker[] = [...osmMarkers]
  const seenKeys = new Set<string>()
  for (const m of markers) {
    seenKeys.add(hitKeyFromParts(m.lng, m.lat))
  }

  const perKindCount = countMarkersByKind(markers)

  const order: { key: keyof typeof want; kind: WaypointPoiKind }[] = [
    { key: "restaurants", kind: "restaurant" },
    { key: "sights", kind: "sightseeing" },
    { key: "parking", kind: "parking" },
  ]

  for (const { key, kind } of order) {
    if (!want[key]) continue

    const llmQueries = plan[kind] ?? []
    const queries = mergeSearchQueries(kind, llmQueries)

    for (const phrase of queries) {
      if (perKindCount[kind] >= MAX_PER_CATEGORY) break
      const q = expandQuery(phrase, waypointPlaceName)
      if (!q) continue

      let hits: GeocodeFeatureHit[]
      try {
        hits = await fetchHitsForPhrase(q, proximity)
      } catch {
        continue
      }

      hits.sort((a, b) => {
        const da = distanceKm(proximity, a)
        const db = distanceKm(proximity, b)
        if (da !== db) return da - db
        return b.relevance - a.relevance
      })

      for (const h of hits) {
        if (perKindCount[kind] >= MAX_PER_CATEGORY) break
        if (distanceKm(proximity, h) > MAX_KM) continue
        const hk = hitKey(h)
        if (seenKeys.has(hk)) continue

        seenKeys.add(hk)
        perKindCount[kind] += 1

        const ah = areaHintFromPlaceTitle(h.placeName, waypointPlaceName)
        markers.push({
          id: crypto.randomUUID(),
          lng: h.lng,
          lat: h.lat,
          kind,
          name: h.placeName,
          areaHint: ah,
          googleMapsUrl: buildGoogleMapsPlaceUrl({
            name: h.placeName,
            lat: h.lat,
            lng: h.lng,
            areaHint: ah,
          }),
          googleMapsPinUrl: buildGoogleMapsPinUrl(h.lat, h.lng),
          dataSource: "mapbox",
        })

        if (markers.length >= MAX_MARKERS_TOTAL) {
          return markers
        }
      }
    }
  }

  return markers
}
