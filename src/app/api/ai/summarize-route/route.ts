import { NextResponse } from 'next/server'

import {
  ROUTE_SUMMARY_SUBMIT_TOOL,
  ROUTE_SUMMARY_SYSTEM_PROMPT,
  ROUTE_SUMMARY_TOOL_NAME,
  buildRouteSummaryUserPrompt,
  parseRouteSummaryToolArgs,
} from '@/lib/ai/route-summary'
import { completeSystemUserRequiredTool } from '@/lib/openai'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown

    const origin =
      typeof body === 'object' &&
      body !== null &&
      'origin' in body &&
      typeof (body as { origin?: unknown }).origin === 'string'
        ? (body as { origin: string }).origin.trim()
        : ''

    const destination =
      typeof body === 'object' &&
      body !== null &&
      'destination' in body &&
      typeof (body as { destination?: unknown }).destination === 'string'
        ? (body as { destination: string }).destination.trim()
        : ''

    let intermediateWaypoints: string[] = []
    if (
      typeof body === 'object' &&
      body !== null &&
      'intermediateWaypoints' in body &&
      Array.isArray((body as { intermediateWaypoints?: unknown }).intermediateWaypoints)
    ) {
      intermediateWaypoints = (body as { intermediateWaypoints: unknown[] })
        .intermediateWaypoints.filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    }

    if (!origin) {
      return NextResponse.json(
        { error: 'Brak punktu startowego.' },
        { status: 400 }
      )
    }

    if (!destination) {
      return NextResponse.json(
        { error: 'Brak punktu docelowego.' },
        { status: 400 }
      )
    }

    const user = buildRouteSummaryUserPrompt({
      origin,
      destination,
      intermediateWaypoints,
    })
    const { args } = await completeSystemUserRequiredTool({
      system: ROUTE_SUMMARY_SYSTEM_PROMPT,
      user,
      max_completion_tokens: 500,
      temperature: 0.55,
      tool: ROUTE_SUMMARY_SUBMIT_TOOL,
      toolName: ROUTE_SUMMARY_TOOL_NAME,
    })

    const parsed = parseRouteSummaryToolArgs(args)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Nieprawidłowa odpowiedź modelu (brak podsumowania).' },
        { status: 502 }
      )
    }

    return NextResponse.json({ summary: parsed.summary })
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
