/** Link wyszukania miejsca po nazwie (Google dopasowuje lokalnie). */
export function buildGoogleMapsPlaceUrl(params: {
  name: string
  lat: number
  lng: number
  areaHint?: string
}): string {
  const parts = [params.name, params.areaHint].filter(Boolean)
  const q = parts.join(", ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** Pin dokładnie na współrzędnych. */
export function buildGoogleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=17`
}

export function buildOsmBrowseUrl(type: string, id: number): string {
  return `https://www.openstreetmap.org/${type}/${id}`
}
