"use client"

import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export type WaypointField = {
  id: string
  value: string
}

type RouteFormProps = {
  className?: string
  origin: string
  destination: string
  waypoints: WaypointField[]
  onOriginChange: (v: string) => void
  onDestinationChange: (v: string) => void
  onWaypointChange: (id: string, value: string) => void
  onAddWaypoint: () => void
  onRemoveWaypoint: (id: string) => void
  onSubmit: () => void
  onClear: () => void
  loading?: boolean
  error?: string | null
  summaryDistance?: string | null
  summaryDuration?: string | null
}

export function RouteForm({
  className,
  origin,
  destination,
  waypoints,
  onOriginChange,
  onDestinationChange,
  onWaypointChange,
  onAddWaypoint,
  onRemoveWaypoint,
  onSubmit,
  onClear,
  loading = false,
  error = null,
  summaryDistance,
  summaryDuration,
}: RouteFormProps) {
  const hasSummary = Boolean(summaryDistance && summaryDuration)

  return (
    <Card
      className={cn(
        "app-card-surface border-border/70 !bg-transparent app-surface-elevated text-[13px] leading-relaxed",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Trasa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <div className="grid gap-2">
            <Input
              aria-label="Punkt startowy"
              autoComplete="street-address"
              className="app-input-soft h-9 rounded-lg border-white/10 !bg-transparent text-[13px] placeholder:text-muted-foreground/80"
              disabled={loading}
              onChange={(e) => onOriginChange(e.target.value)}
              placeholder="Punkt startowy (np. Gniezno)"
              value={origin}
            />

            {waypoints.map((wp, index) => (
              <div key={wp.id} className="flex gap-1.5">
                <Input
                  aria-label={`Punkt pośredni ${index + 1}`}
                  autoComplete="street-address"
                  className="app-input-soft h-9 min-w-0 flex-1 rounded-lg border-white/10 !bg-transparent text-[13px] placeholder:text-muted-foreground/80"
                  disabled={loading}
                  onChange={(e) => onWaypointChange(wp.id, e.target.value)}
                  placeholder={`Przystanek ${index + 1}`}
                  value={wp.value}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-lg text-muted-foreground/65 hover:bg-white/[0.05] hover:text-foreground"
                  disabled={loading}
                  aria-label={`Usuń przystanek ${index + 1}`}
                  onClick={() => onRemoveWaypoint(wp.id)}
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </Button>
              </div>
            ))}

            <div className="border-t border-white/[0.06] pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={onAddWaypoint}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-1.5 py-1",
                  "text-[11px] font-medium tracking-[0.02em] text-muted-foreground/70",
                  "transition-colors hover:text-foreground/95",
                  "disabled:opacity-45"
                )}
              >
                <Plus className="size-3 stroke-[2]" aria-hidden />
                <span>Dodaj punkt pośredni</span>
              </button>
            </div>

            <Input
              aria-label="Punkt docelowy"
              autoComplete="street-address"
              className="app-input-soft h-9 rounded-lg border-white/10 !bg-transparent text-[13px] placeholder:text-muted-foreground/80"
              disabled={loading}
              onChange={(e) => onDestinationChange(e.target.value)}
              placeholder="Punkt docelowy (np. Wągrowiec)"
              value={destination}
            />
          </div>
          {error ? (
            <p className="text-[13px] leading-relaxed text-red-400/95" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="app-primary-gradient h-9 !rounded-full border-0 !bg-transparent text-[13px] font-medium disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Wyznaczanie…" : "Wyznacz"}
            </Button>
            <Button
              disabled={loading}
              type="button"
              variant="outline"
              className="app-outline-soft h-9 rounded-full border-white/12 !bg-transparent text-[13px] font-medium dark:hover:!bg-white/10"
              onClick={onClear}
            >
              Wyczyść
            </Button>
          </div>
        </form>
        {hasSummary ? (
          <>
            <Separator />
            <dl className="grid gap-2 text-[13px] leading-relaxed">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Dystans</dt>
                <dd className="font-medium tabular-nums text-foreground">{summaryDistance}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Szacowany czas</dt>
                <dd className="font-medium tabular-nums text-foreground">{summaryDuration}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
