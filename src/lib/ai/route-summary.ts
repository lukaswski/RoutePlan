import type OpenAI from 'openai'

/** Nazwa narzędzia — podsumowanie zawsze w JSON argumentów funkcji. */
export const ROUTE_SUMMARY_TOOL_NAME = 'submit_route_summary' as const

export const ROUTE_SUMMARY_SUBMIT_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: ROUTE_SUMMARY_TOOL_NAME,
    description:
      'Przekaż podsumowanie trasy. Użyj tylko tego narzędzia; treść w polu summary.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Opis trasy: co najwyżej 5 zdań, wyłącznie po polsku.',
        },
      },
      required: ['summary'],
      additionalProperties: false,
    },
  },
}

/** Stały system prompt dla podsumowania trasy (OpenAI + wymuszone narzędzie). */
export const ROUTE_SUMMARY_SYSTEM_PROMPT = [
  'Jesteś ekspertem od oceny tras przejazdu samochodem.',
  'Na podstawie punktu startowego, ewentualnych punktów pośrednich oraz punktu końcowego opisz krótko jakość takiej trasy pod kątem widoków krajobrazowych i atrakcyjności przejazdu.',
  'Odpowiedź musi mieć co najwyżej 5 zdań.',
  'Zawsze pisz wyłącznie po polsku.',
  `Przekaż wynik wyłącznie przez narzędzie ${ROUTE_SUMMARY_TOOL_NAME} (pole summary). Nie dopisuj tekstu poza argumentami funkcji.`,
].join('\n')

export type RouteSummaryPromptPlaces = {
  origin: string
  destination: string
  intermediateWaypoints: string[]
}

export function buildRouteSummaryUserPrompt(places: RouteSummaryPromptPlaces): string {
  const start = places.origin.trim()
  const dest = places.destination.trim()
  const vias = places.intermediateWaypoints.map((s) => s.trim()).filter(Boolean)
  const viasBlock =
    vias.length > 0
      ? vias.map((name, i) => `${i + 1}. ${name}`).join('\n')
      : '— brak (trasa bezpośrednia)'

  return [
    'Dane trasy (kolejność: start → przystanki → cel):',
    '',
    `Punkt startowy: ${start}`,
    '',
    'Punkty pośrednie:',
    viasBlock,
    '',
    `Punkt końcowy: ${dest}`,
    '',
    `Użyj narzędzia ${ROUTE_SUMMARY_TOOL_NAME} i wypełnij pole summary.`,
  ].join('\n')
}

export function parseRouteSummaryToolArgs(
  args: unknown
): { summary: string } | null {
  if (!args || typeof args !== 'object') return null
  const s = (args as { summary?: unknown }).summary
  if (typeof s !== 'string') return null
  const summary = s.trim()
  if (!summary) return null
  return { summary }
}
