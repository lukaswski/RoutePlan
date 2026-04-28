import 'server-only'

import {
  WAYPOINT_POI_SEARCH_SYSTEM_PROMPT,
  WAYPOINT_POI_SEARCH_TOOL,
  WAYPOINT_POI_SEARCH_TOOL_NAME,
  buildWaypointSearchUserPrompt,
  normalizeSearchPlanArgs,
} from '@/lib/ai/waypoint-pois-prompts'
import type { PoiSearchPlan } from '@/lib/waypoint-poi-geocode'
import { completeSystemUserRequiredTool } from '@/lib/openai'

/** Wyłącznie wywołanie OpenAI — zwraca plan haseł pod Mapbox (bez współrzędnych). */
export async function fetchWaypointSearchPlanFromOpenAI(params: {
  lat: number
  lng: number
  placeName: string
  restaurants: boolean
  sights: boolean
  parking: boolean
}): Promise<PoiSearchPlan> {
  const user = buildWaypointSearchUserPrompt({
    lat: params.lat,
    lng: params.lng,
    placeName: params.placeName,
    want: {
      restaurant: params.restaurants,
      sightseeing: params.sights,
      parking: params.parking,
    },
  })

  const { args } = await completeSystemUserRequiredTool({
    system: WAYPOINT_POI_SEARCH_SYSTEM_PROMPT,
    user,
    temperature: 0.55,
    max_completion_tokens: 900,
    tool: WAYPOINT_POI_SEARCH_TOOL,
    toolName: WAYPOINT_POI_SEARCH_TOOL_NAME,
  })

  return normalizeSearchPlanArgs(args, {
    restaurant: params.restaurants,
    sightseeing: params.sights,
    parking: params.parking,
  })
}
