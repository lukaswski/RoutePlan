/** Kontekst wyszukiwania POI przy polu „Punkt docelowy” (`poiByWaypointId`). */
export const POI_SEARCH_CONTEXT_DESTINATION = "__destination__" as const

export type WaypointPoiKind = "restaurant" | "sightseeing" | "parking"

export type WaypointPoiMarker = {
  id: string
  lng: number
  lat: number
  kind: WaypointPoiKind
  /** Pełniejsza nazwa z geokodu / wyszukiwania. */
  name: string
  /** Okolica z propozycji AI (np. miejscowość) — pod dymek. */
  areaHint?: string
  /** Wyszukiwanie Google Maps po nazwie (+ opcjonalnie okolica). */
  googleMapsUrl?: string
  /** Pin dokładnie na GPS (zapas). */
  googleMapsPinUrl?: string
  /** Strona obiektu w OSM. */
  osmBrowseUrl?: string
  /** Skąd rekord (OSM ma nazwy z bazy społeczności). */
  dataSource?: "osm" | "mapbox"
}

export type WaypointPoiSearchBody = {
  lng: number
  lat: number
  placeName: string
  restaurants: boolean
  sights: boolean
  parking: boolean
}
