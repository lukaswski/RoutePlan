import { NextResponse } from 'next/server'

import { geocodeSearchPlanToMarkers, type PoiSearchPlan } from '@/lib/waypoint-poi-geocode'

function readBool(v: unknown): boolean {
  return v === true
}

function parseSearchPlanBody(v: unknown): PoiSearchPlan | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const arr = (x: unknown) =>
    Array.isArray(x)
      ? x
          .filter((t): t is string => typeof t === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  return {
    restaurant: arr(o.restaurant),
    sightseeing: arr(o.sightseeing),
    parking: arr(o.parking),
  }
}

/**
 * Mapbox Geocoding → piny na mapie. Konkretne nazwy i współrzędne wyłącznie z API mapy.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>

    const lng = typeof body.lng === 'number' ? body.lng : Number.NaN
    const lat = typeof body.lat === 'number' ? body.lat : Number.NaN
    const placeName = typeof body.placeName === 'string' ? body.placeName.trim() : ''

    const searchPlan = parseSearchPlanBody(body.searchPlan)
    const restaurants = readBool(body.restaurants)
    const sights = readBool(body.sights)
    const parking = readBool(body.parking)

    if (!searchPlan) {
      return NextResponse.json({ error: 'Brak obiektu searchPlan.' }, { status: 400 })
    }

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return NextResponse.json({ error: 'Brak lub niepoprawne współrzędne punktu.' }, { status: 400 })
    }

    if (!restaurants && !sights && !parking) {
      return NextResponse.json(
        { error: 'Wybierz co najmniej jedną opcję (restauracja, miejsca, parking).' },
        { status: 400 }
      )
    }

    const places = await geocodeSearchPlanToMarkers(
      searchPlan,
      { lng, lat },
      placeName,
      { restaurants, sights, parking },
    )

    return NextResponse.json({ places })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Nieznany błąd serwera'
    if (message.includes('NEXT_PUBLIC_MAPBOX') || message.includes('Mapbox')) {
      return NextResponse.json(
        { error: 'Brak lub niepoprawny token Mapbox do geokodowania.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
