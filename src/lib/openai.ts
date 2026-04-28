import 'server-only'

import OpenAI from 'openai'

/** Klucz API OpenAI — wyłącznie po stronie serwera (bez prefiksu NEXT_PUBLIC_). */
export function getOpenAIApiKey(): string | undefined {
  const k = process.env.OPENAI_API_KEY?.trim()
  return k || undefined
}

let cachedClient: OpenAI | undefined

/** Singleton klienta (lazy). Rzuca, gdy brak OPENAI_API_KEY. */
export function getOpenAIClient(): OpenAI {
  const apiKey = getOpenAIApiKey()
  if (!apiKey) {
    throw new Error('Brak OPENAI_API_KEY w zmiennych środowiskowych.')
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey })
  }
  return cachedClient
}

/** Domyślny model z OPENAI_MODEL lub `gpt-4o`. */
export function getDefaultOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4o'
}

export type CompleteSystemUserParams = {
  /** Stałe instrukcje / kontekst (nie czat — jedna wiadomość systemowa). */
  system: string
  /** Dane z aplikacji (np. lista punktów), budowane jako jeden prompt użytkownika. */
  user: string
  /** Nadpisuje OPENAI_MODEL i domyślny model. */
  model?: string
  temperature?: number
  max_completion_tokens?: number
  /** np. `{ type: 'json_object' }` dla ustrukturyzowanej odpowiedzi. */
  response_format?: OpenAI.Chat.ChatCompletionCreateParams['response_format']
}

export type CompleteSystemUserRequiredToolParams = {
  system: string
  user: string
  model?: string
  temperature?: number
  max_completion_tokens?: number
  /** Jedno narzędzie (JSON Schema); model musi je wywołać — argumenty są parsowane jako JSON. */
  tool: OpenAI.Chat.ChatCompletionTool
  /** Musi zgadzać się z `tool.function.name`. */
  toolName: string
}

function messageContentToString(
  content: OpenAI.Chat.ChatCompletionAssistantMessageParam['content'],
): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  return content
    .map((part) => {
      if (part.type === 'text') return part.text
      return ''
    })
    .join('')
}

/**
 * Jednorazowe wywołanie: system + user (pod konkretne prompty i zmienne w treści user).
 */
export async function completeSystemUser(
  params: CompleteSystemUserParams,
): Promise<{ content: string; completion: OpenAI.Chat.ChatCompletion }> {
  const client = getOpenAIClient()
  const model = params.model ?? getDefaultOpenAIModel()

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params.max_completion_tokens !== undefined
      ? { max_completion_tokens: params.max_completion_tokens }
      : {}),
    ...(params.response_format ? { response_format: params.response_format } : {}),
  })

  const raw = completion.choices[0]?.message?.content
  const content = messageContentToString(raw)

  return { content, completion }
}

/**
 * Wywołanie z jednym narzędziem i `tool_choice` wymuszającym je — stabilna struktura JSON w argumentach funkcji.
 */
export async function completeSystemUserRequiredTool(
  params: CompleteSystemUserRequiredToolParams,
): Promise<{ args: unknown; completion: OpenAI.Chat.ChatCompletion }> {
  const client = getOpenAIClient()
  const model = params.model ?? getDefaultOpenAIModel()

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
    tools: [params.tool],
    tool_choice: { type: 'function', function: { name: params.toolName } },
    parallel_tool_calls: false,
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params.max_completion_tokens !== undefined
      ? { max_completion_tokens: params.max_completion_tokens }
      : {}),
  })

  const msg = completion.choices[0]?.message
  const call = msg?.tool_calls?.[0]
  if (!call || call.type !== 'function') {
    throw new Error('Oczekiwano wywołania narzędzia (OpenAI).')
  }
  if (call.function.name !== params.toolName) {
    throw new Error(`Oczekiwano narzędzia "${params.toolName}", otrzano "${call.function.name}".`)
  }

  let args: unknown
  try {
    args = JSON.parse(call.function.arguments || '{}') as unknown
  } catch {
    throw new Error('Nieprawidłowy JSON w argumentach narzędzia OpenAI.')
  }

  return { args, completion }
}
