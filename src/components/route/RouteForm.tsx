"use client"

import { ChevronDown, Loader2, Plus, X } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { POI_SEARCH_CONTEXT_DESTINATION } from "@/lib/waypoint-poi"

import {
  WaypointAiPopover,
  type WaypointPoiSearchOptions,
} from "./WaypointAiPopover"

export type WaypointField = {
  id: string
  value: string
}

type RouteFormProps = {
  className?: string
  origin: string
  destination: string
  waypoints: WaypointField[]
  showAlternativeRoutes: boolean
  onShowAlternativeRoutesChange: (checked: boolean) => void
  preferUnpavedRoutes: boolean
  onPreferUnpavedRoutesChange: (checked: boolean) => void
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
  /** Współrzędne przystanków (ta sama kolejność co `waypoints`) po wyznaczeniu trasy. */
  viaPoints: { lng: number; lat: number }[]
  /** Pozycja punktu docelowego na mapie po wyznaczeniu trasy (dla AI w okolicy celu). */
  endPoint: { lng: number; lat: number } | null
  waypointAiLoadingId: string | null
  /** Komunikat etapu ładowania (gdy `waypointAiLoadingId` dotyczy wiersza). */
  waypointAiLoadingStatus: string | null
  onWaypointPoiSearch: (waypointId: string, opts: WaypointPoiSearchOptions) => void | Promise<void>
}

export function RouteForm({
  className,
  origin,
  destination,
  waypoints,
  showAlternativeRoutes,
  onShowAlternativeRoutesChange,
  preferUnpavedRoutes,
  onPreferUnpavedRoutesChange,
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
  viaPoints,
  endPoint,
  waypointAiLoadingId,
  waypointAiLoadingStatus,
  onWaypointPoiSearch,
}: RouteFormProps) {
  const [panelOpen, setPanelOpen] = React.useState(true)
  const waypointRowRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const destinationRowRef = React.useRef<HTMLDivElement | null>(null)
  const hasSummary = Boolean(summaryDistance && summaryDuration)
  const prevWpCount = React.useRef(waypoints.length)

  React.useEffect(() => {
    if (waypoints.length > prevWpCount.current && waypoints.length > 0) {
      const last = waypoints[waypoints.length - 1]
      requestAnimationFrame(() => {
        const el = document.getElementById(
          `waypoint-input-${last?.id}`
        ) as HTMLInputElement | null
        el?.focus({ preventScroll: false })
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      })
    }
    prevWpCount.current = waypoints.length
  }, [waypoints])

  return (
    <Card
      className={cn(
        "app-card-surface border-border/70 !bg-transparent app-surface-elevated text-[13px] leading-relaxed",
        panelOpen
          ? "gap-4 py-4"
          : cn(
              "gap-0 py-2.5 transition-[box-shadow] duration-200 ease-out",
              "hover:shadow-[0_10px_28px_-12px_oklch(0.52_0.16_264_/_0.45),0_4px_14px_-6px_oklch(0.56_0.18_258_/_0.2)]"
            ),
        className
      )}
    >
      <CardHeader className={cn(panelOpen ? "pb-3" : "pb-0")}>
        <button
          type="button"
          id="route-panel-trigger"
          aria-expanded={panelOpen}
          aria-controls="route-panel-content"
          className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg text-left outline-none",
            panelOpen ? "py-0.5" : "py-2",
            "focus-visible:ring-2 focus-visible:ring-[oklch(0.56_0.22_262)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.17_0.024_262)]"
          )}
          onClick={() => setPanelOpen((o) => !o)}
        >
          <CardTitle className="text-base">Trasa</CardTitle>
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
        id="route-panel-content"
        role="region"
        aria-labelledby="route-panel-trigger"
        className={cn("space-y-4", !panelOpen && "hidden")}
      >
        {loading ? (
          <div
            className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-black/[0.14] px-3 py-2.5 text-[13px] text-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="size-4 shrink-0 animate-spin text-[oklch(0.72_0.14_285)]" aria-hidden />
            Wyznaczanie trasy…
          </div>
        ) : null}
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
              <div
                key={wp.id}
                ref={(el) => {
                  waypointRowRefs.current[wp.id] = el
                }}
                className="waypoint-row-enter relative w-full"
              >
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`waypoint-input-${wp.id}`}
                    aria-label={`Punkt pośredni ${index + 1}`}
                    autoComplete="street-address"
                    className="app-input-soft h-9 min-w-0 flex-1 rounded-lg border-white/10 !bg-transparent text-[13px] placeholder:text-muted-foreground/80"
                    disabled={loading}
                    onChange={(e) => onWaypointChange(wp.id, e.target.value)}
                    placeholder={`Przystanek ${index + 1}`}
                    value={wp.value}
                  />
                  <WaypointAiPopover
                    coords={viaPoints[index] ?? null}
                    getAnchorEl={() => waypointRowRefs.current[wp.id] ?? null}
                    placeLabel={wp.value.trim() || `Przystanek ${index + 1}`}
                    disabled={loading}
                    loading={waypointAiLoadingId === wp.id}
                    loadingStatus={
                      waypointAiLoadingId === wp.id ? waypointAiLoadingStatus : null
                    }
                    onSearch={(opts) => onWaypointPoiSearch(wp.id, opts)}
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
              </div>
            ))}

            <div className="border-t border-white/[0.06] pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={onAddWaypoint}
                className={cn(
                  "inline-flex w-full items-center justify-start gap-1.5 py-1",
                  "text-[11px] font-medium tracking-[0.02em] text-muted-foreground/70",
                  "transition-colors hover:text-foreground/95",
                  "disabled:opacity-45"
                )}
              >
                <Plus className="size-3 stroke-[2]" aria-hidden />
                <span>Dodaj punkt pośredni</span>
              </button>
            </div>

            <div
              ref={destinationRowRef}
              className="relative flex w-full items-center gap-1.5"
            >
              <Input
                id="destination-input"
                aria-label="Punkt docelowy"
                autoComplete="street-address"
                className="app-input-soft h-9 min-w-0 flex-1 rounded-lg border-white/10 !bg-transparent text-[13px] placeholder:text-muted-foreground/80"
                disabled={loading}
                onChange={(e) => onDestinationChange(e.target.value)}
                placeholder="Punkt docelowy (np. Wągrowiec)"
                value={destination}
              />
              <WaypointAiPopover
                coords={endPoint}
                getAnchorEl={() => destinationRowRef.current}
                placeLabel={destination.trim() || "Punkt docelowy"}
                disabled={loading}
                loading={waypointAiLoadingId === POI_SEARCH_CONTEXT_DESTINATION}
                loadingStatus={
                  waypointAiLoadingId === POI_SEARCH_CONTEXT_DESTINATION
                    ? waypointAiLoadingStatus
                    : null
                }
                onSearch={(opts) =>
                  onWaypointPoiSearch(POI_SEARCH_CONTEXT_DESTINATION, opts)
                }
              />
            </div>
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

        <div className="flex flex-col gap-1.5">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium tracking-[0.02em] text-muted-foreground/70">
                  Trasy alternatywne
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showAlternativeRoutes}
                aria-label="Pokaż trasy alternatywne"
                disabled={loading}
                className={cn(
                  "relative inline-flex h-[20px] w-[36px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 ease-out",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.56_0.22_262)]/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[oklch(0.17_0.024_262)]",
                  showAlternativeRoutes
                    ? "bg-gradient-to-r from-[oklch(0.48_0.21_258)] to-[oklch(0.56_0.22_262)] shadow-[inset_0_1px_0_oklch(1_0_0_/12%)]"
                    : "bg-white/[0.11]",
                  loading ? "cursor-not-allowed opacity-45" : "cursor-pointer active:opacity-95"
                )}
                onClick={() => {
                  if (loading) return
                  onShowAlternativeRoutesChange(!showAlternativeRoutes)
                }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none block size-4 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.26)] ring-1 ring-black/5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]",
                    showAlternativeRoutes ? "translate-x-[16px]" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium tracking-[0.02em] text-muted-foreground/70">
                  Preferuj trasy lokalne
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferUnpavedRoutes}
                aria-label="Preferuj trasy lokalne"
                disabled={loading}
                className={cn(
                  "relative inline-flex h-[20px] w-[36px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 ease-out",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.56_0.22_262)]/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[oklch(0.17_0.024_262)]",
                  preferUnpavedRoutes
                    ? "bg-gradient-to-r from-[oklch(0.48_0.21_258)] to-[oklch(0.56_0.22_262)] shadow-[inset_0_1px_0_oklch(1_0_0_/12%)]"
                    : "bg-white/[0.11]",
                  loading ? "cursor-not-allowed opacity-45" : "cursor-pointer active:opacity-95"
                )}
                onClick={() => {
                  if (loading) return
                  onPreferUnpavedRoutesChange(!preferUnpavedRoutes)
                }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none block size-4 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.26)] ring-1 ring-black/5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]",
                    preferUnpavedRoutes ? "translate-x-[16px]" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        </div>

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
