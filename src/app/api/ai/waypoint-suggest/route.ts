import { NextResponse } from 'next/server'

import { fetchWaypointSearchPlanFromOpenAI } from '@/lib/ai/waypoint-pois-llm'

function readBool(v: unknown): boolean {
  return v === true
}

/** OpenAI zwraca tylko kreatywne hasła pod Mapbox — bez współrzędnych i nazw z LLM. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>

    const lng = typeof body.lng === 'number' ? body.lng : Number.NaN
    const lat = typeof body.lat === 'number' ? body.lat : Number.NaN
    const placeName = typeof body.placeName === 'string' ? body.placeName.trim() : ''

    const restaurants = readBool(body.restaurants)
    const sights = readBool(body.sights)
    const parking = readBool(body.parking)

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return NextResponse.json({ error: 'Brak lub niepoprawne współrzędne punktu.' }, { status: 400 })
    }

    if (!restaurants && !sights && !parking) {
      return NextResponse.json(
        { error: 'Wybierz co najmniej jedną opcję (restauracja, miejsca, parking).' },
        { status: 400 }
      )
    }

    let searchPlan: Awaited<ReturnType<typeof fetchWaypointSearchPlanFromOpenAI>>
    try {
      searchPlan = await fetchWaypointSearchPlanFromOpenAI({
        lat,
        lng,
        placeName,
        restaurants,
        sights,
        parking,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg && (msg.includes('JSON') || msg.includes('parse') || msg.includes('Unexpected'))) {
        return NextResponse.json(
          { error: 'Nie udało się sparsować odpowiedzi modelu. Spróbuj ponownie.' },
          { status: 502 }
        )
      }
      throw e
    }

    return NextResponse.json({ searchPlan })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Nieznany błąd serwera'
    if (message.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'Brak skonfigurowanego klucza OpenAI (OPENAI_API_KEY).' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
