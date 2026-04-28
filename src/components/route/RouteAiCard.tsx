"use client"

import { ChevronDown, Loader2, Sparkles } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type RouteAiCardProps = {
  className?: string
  /** Gdy true, trasa ma wyznaczone parametry (można podsumować). */
  routeReady: boolean
  origin: string
  destination: string
  intermediateWaypointLabels: string[]
}

export function RouteAiCard({
  className,
  routeReady,
  origin,
  destination,
  intermediateWaypointLabels,
}: RouteAiCardProps) {
  const [panelOpen, setPanelOpen] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [summary, setSummary] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const handleSummarize = React.useCallback(async () => {
    if (!routeReady || !origin.trim() || !destination.trim()) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/summarize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: origin.trim(),
          destination: destination.trim(),
          intermediateWaypoints: intermediateWaypointLabels.map((s) => s.trim()).filter(Boolean),
        }),
      })

      const data = (await res.json()) as { summary?: string; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Nie udało się uzyskać podsumowania.')
        return
      }

      setSummary(data.summary?.trim() ?? '')
    } catch {
      setError('Błąd połączenia z serwerem.')
    } finally {
      setLoading(false)
    }
  }, [destination, intermediateWaypointLabels, origin, routeReady])

  return (
    <Card
      className={cn(
        'app-card-surface border-border/70 !bg-transparent app-surface-elevated text-[13px] leading-relaxed',
        panelOpen
          ? 'gap-4 py-4'
          : cn(
              'gap-0 py-2.5 transition-[box-shadow] duration-200 ease-out',
              'hover:shadow-[0_10px_28px_-12px_oklch(0.54_0.17_305_/_0.48),0_4px_14px_-6px_oklch(0.58_0.19_295_/_0.24)]'
            ),
        className
      )}
    >
      <CardHeader className={cn(panelOpen ? 'pb-3' : 'pb-0')}>
        <button
          type="button"
          id="ai-panel-trigger"
          aria-expanded={panelOpen}
          aria-controls="ai-panel-content"
          className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg text-left outline-none",
            panelOpen ? 'py-0.5' : 'py-2',
            "focus-visible:ring-2 focus-visible:ring-[oklch(0.58_0.2_308)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.17_0.024_262)]"
          )}
          onClick={() => setPanelOpen((o) => !o)}
        >
          <CardTitle className="text-base">AI</CardTitle>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground/80 transition-transform duration-200 ease-out",
              panelOpen ? "rotate-180" : "rotate-0"
            )}
          />
        </button>
      </CardHeader>
      <CardContent
        id="ai-panel-content"
        role="region"
        aria-labelledby="ai-panel-trigger"
        className={cn("space-y-4", !panelOpen && "hidden")}
      >
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Krótkie podsumowanie atrakcyjności trasy (widoki, przejazd) na podstawie punktów — nie jest
          to nawigacja ani ocena dróg.
        </p>

        <Button
          type="button"
          className="app-ai-gradient h-9 w-full !rounded-full border-0 !bg-transparent text-[13px] font-medium disabled:opacity-60"
          disabled={!routeReady || loading}
          onClick={handleSummarize}
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Generowanie…
            </span>
          ) : (
            <>
              <Sparkles className="mr-2 size-3.5 opacity-90" aria-hidden />
              Podsumuj trasę
            </>
          )}
        </Button>

        {error ? (
          <p className="text-[13px] leading-relaxed text-red-400/95" role="alert">
            {error}
          </p>
        ) : null}

        {summary ? (
          <div className="rounded-lg border border-[oklch(0.58_0.14_305_/_0.22)] bg-white/[0.025] px-3 py-2.5 shadow-[inset_0_1px_0_oklch(0.62_0.12_308_/_0.08)]">
            <p className="text-[11px] font-medium tracking-[0.02em] text-muted-foreground/70">
              Podsumowanie
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
              {summary}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
