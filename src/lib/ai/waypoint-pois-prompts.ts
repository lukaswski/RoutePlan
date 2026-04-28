import type OpenAI from "openai"

import type { PoiSearchPlan } from "@/lib/waypoint-poi-geocode"

/** Narzędzie: wyłącznie kreatywne frazy pod wyszukiwarkę Mapbox — bez nazw konkretnych lokali. */
export const WAYPOINT_POI_SEARCH_TOOL_NAME = "submit_map_search_queries" as const

export const WAYPOINT_POI_SEARCH_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: WAYPOINT_POI_SEARCH_TOOL_NAME,
    description:
      "Podaj krótkie polskie frazy do forward geocoding Mapbox (typ POI). Konkretne adresy i nazwy pojawią się dopiero z API mapy.",
    parameters: {
      type: "object",
      properties: {
        restaurant: {
          type: "array",
          description:
            "Hasła szukane w bibliotece Mapbox (np. „pierogi”, „kebab”, „lokalna kuchnia”). Max 5. Puste gdy użytkownik nie wybrał restauracji.",
          items: { type: "string" },
          maxItems: 5,
        },
        sightseeing: {
          type: "array",
          description:
            "Np. „zabytek”, „punkt widokowy”, „spacer”, „ruiny”. Max 5. Puste bez atrakcji.",
          items: { type: "string" },
          maxItems: 5,
        },
        parking: {
          type: "array",
          description:
            "Np. „Parking Park&Ride”, „parking podziemny”, „miejski parking”. Max 5. Puste bez parkingów.",
          items: { type: "string" },
          maxItems: 5,
        },
      },
      required: ["restaurant", "sightseeing", "parking"],
      additionalProperties: false,
    },
  },
}

export const WAYPOINT_POI_SEARCH_SYSTEM_PROMPT = [
  "Przygotowujesz wyłącznie HASŁA DO WYSZUKIWARKI MAPY MAPBOX dla punktu na trasie w Polsce.",
  "Konkretne nazwy lokali i współrzędne NIE pochodzą od Ciebie — serwer pobierze je z API Mapbox Forward Geocoding wg Twoich haseł + bias współrzędnych przystanku.",
  "Twoje frazy mają być krótkie (1–4 słowa), po polsku, dopasowane tematycznie i do regionu/zakresu przystanku (~5–10 km). Mogą być typy kuchni, rodzaje obiektów, slang turystyczny.",
  "Nie wpisuj zmyślonych marek lokali ani pełnych adresów — Mapbox znajdzie rzeczywiste POI po haśle.",
  "Dobre przykłady hasła „do mapy”: „obiad domowy”, „sushi”, „wieża widokowa”, „bulwary”, „fort”, „Parking P+R”.",
  `Użyj narzędzia ${WAYPOINT_POI_SEARCH_TOOL_NAME}: tablice restaurant / sightseeing / parking — puste tam, gdzie użytkownik wyłączył kategorię (serwer sprawdzi flagi). Bez tekstu w czacie.`,
].join("\n")

export function buildWaypointSearchUserPrompt(input: {
  lat: number
  lng: number
  placeName: string
  want: { restaurant: boolean; sightseeing: boolean; parking: boolean }
}): string {
  const lines: string[] = [
    `Przystanek (punkt dodatkowy): ${input.placeName || "(bez nazwy)"}`,
    `Współrzędne dla bias mapy: ${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`,
    "",
    "Zaproponuj osobno hasła pod geokodowanie Mapbox — tylko dla zaznaczonych:",
  ]
  if (input.want.restaurant) {
    lines.push("- restaurant — hasła dotyczące jedzenia / lokali gastronomicznych.")
  }
  if (input.want.sightseeing) {
    lines.push("- sightseeing — hasła dotyczące atrakcji i zwiedzania.")
  }
  if (input.want.parking) {
    lines.push("- parking — hasła dotyczące parkingów / pozostawiania auta.")
  }
  lines.push("", `Narzędzie: ${WAYPOINT_POI_SEARCH_TOOL_NAME}`)
  return lines.join("\n")
}

/** Parsuje argumenty narzędzia → plan zapytań (uzupełnia brakujące tablice). */
export function normalizeSearchPlanArgs(
  data: unknown,
  want: {
    restaurant: boolean
    sightseeing: boolean
    parking: boolean
  },
): PoiSearchPlan {
  const empty: PoiSearchPlan = {
    restaurant: [],
    sightseeing: [],
    parking: [],
  }

  if (!data || typeof data !== "object") return empty

  const r = data as Record<string, unknown>
  const take = (key: keyof PoiSearchPlan): string[] => {
    const v = r[key]
    if (!Array.isArray(v)) return []
    return v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5)
  }

  return {
    restaurant: want.restaurant ? take("restaurant") : [],
    sightseeing: want.sightseeing ? take("sightseeing") : [],
    parking: want.parking ? take("parking") : [],
  }
}
