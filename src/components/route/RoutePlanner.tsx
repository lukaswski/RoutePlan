"use client"

import type { Feature, LineString } from "geojson"
import * as React from "react"

import { MapCanvas } from "@/components/map/MapCanvas"
import { RouteForm, type WaypointField } from "@/components/route/RouteForm"
import { formatDistanceMeters, formatDurationSeconds } from "@/lib/format-route"
import {
  fetchDrivingRoute,
  geocodeForward,
  type GeocodeHit,
} from "@/lib/mapbox-route"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function RoutePlanner() {
  const [origin, setOrigin] = React.useState("")
  const [destination, setDestination] = React.useState("")
  const [waypoints, setWaypoints] = React.useState<WaypointField[]>([])

  const [routeGeometry, setRouteGeometry] =
    React.useState<Feature<LineString> | null>(null)
  const [startPoint, setStartPoint] = React.useState<{
    lng: number
    lat: number
  } | null>(null)
  const [endPoint, setEndPoint] = React.useState<{
    lng: number
    lat: number
  } | null>(null)
  const [viaPoints, setViaPoints] = React.useState<{ lng: number; lat: number }[]>([])

  const [summary, setSummary] = React.useState<{
    distanceMeters: number
    durationSeconds: number
  } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleAddWaypoint = React.useCallback(() => {
    setWaypoints((w) => [...w, { id: crypto.randomUUID(), value: "" }])
  }, [])

  const handleWaypointChange = React.useCallback((id: string, value: string) => {
    setWaypoints((rows) => rows.map((row) => (row.id === id ? { ...row, value } : row)))
  }, [])

  const handleRemoveWaypoint = React.useCallback((id: string) => {
    setWaypoints((rows) => rows.filter((row) => row.id !== id))
  }, [])

  const handleClear = React.useCallback(() => {
    setOrigin("")
    setDestination("")
    setWaypoints([])
    setRouteGeometry(null)
    setStartPoint(null)
    setEndPoint(null)
    setViaPoints([])
    setSummary(null)
    setError(null)
  }, [])

  const handlePlanRoute = React.useCallback(async () => {
    setError(null)
    const o = origin.trim()
    const d = destination.trim()
    if (!o || !d) {
      setError("Podaj punkt startowy i docelowy.")
      return
    }

    for (const wp of waypoints) {
      if (!wp.value.trim()) {
        setError("Uzupełnij wszystkie punkty pośrednie lub usuń puste pola.")
        return
      }
    }

    const mids = waypoints.map((w) => w.value.trim())

    setLoading(true)
    setSummary(null)
    setRouteGeometry(null)
    setStartPoint(null)
    setEndPoint(null)
    setViaPoints([])

    const queries = [o, ...mids, d]

    try {
      const hits = await Promise.all(queries.map((q) => geocodeForward(q)))
      const resolved: GeocodeHit[] = []

      for (let i = 0; i < hits.length; i++) {
        const h = hits[i]
        if (!h) {
          setError(`Nie znaleziono miejsca: „${queries[i] ?? ""}”.`)
          return
        }
        resolved.push(h)
      }

      const coords = resolved.map((h) => ({ lng: h.lng, lat: h.lat }))

      setStartPoint(coords[0] ?? null)
      setEndPoint(coords[coords.length - 1] ?? null)
      setViaPoints(coords.slice(1, -1))

      setOrigin(resolved[0]!.placeName)
      setDestination(resolved[resolved.length - 1]!.placeName)
      setWaypoints((prev) =>
        resolved.slice(1, -1).map((h, i) => ({
          id: prev[i]?.id ?? crypto.randomUUID(),
          value: h.placeName,
        }))
      )

      const route = await fetchDrivingRoute(coords)

      if (!route) {
        setError("Nie udało się wyznaczyć trasy między tymi punktami.")
        return
      }

      setRouteGeometry(route.geometry)
      setSummary({
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił nieznany błąd.")
    } finally {
      setLoading(false)
    }
  }, [destination, origin, waypoints])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background dark:bg-transparent">
      <header className="app-header-surface sticky top-0 z-40 shrink-0 border-b backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-5 md:h-16 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.58_0.21_252)] to-[oklch(0.45_0.18_262)] shadow-[0_8px_24px_-8px_oklch(0.58_0.21_252_/0.55)] md:size-10">
              <span className="text-[13px] font-semibold tracking-tight text-white">PT</span>
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-semibold tracking-tight text-foreground">Planer Trasy</span>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Zaplanuj przejazd na mapie
              </span>
            </div>
            <Badge
              variant="outline"
              className="hidden border-white/15 bg-gradient-to-r from-white/[0.09] to-white/[0.04] text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline-flex"
            >
              beta
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="app-outline-soft hidden rounded-full border-white/15 !bg-transparent dark:hover:!bg-white/10 sm:inline-flex md:h-9 md:px-4"
              onClick={handleClear}
            >
              Nowa trasa
            </Button>
            <Button
              type="button"
              size="sm"
              className="app-primary-gradient !rounded-full border-0 !bg-transparent md:h-9 md:px-5"
              disabled
            >
              Zapisz
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-5 py-5 md:gap-6 md:px-8 md:py-6 lg:flex-row lg:gap-8">
        <section className="flex min-h-[52vh] flex-1 flex-col lg:min-h-0">
          <MapCanvas
            className="min-h-[52vh] lg:min-h-[calc(100vh-8rem)]"
            routeGeometry={routeGeometry}
            startPoint={startPoint}
            endPoint={endPoint}
            viaPoints={viaPoints}
          />
        </section>

        <aside className="flex w-full shrink-0 flex-col lg:max-w-[380px] lg:overflow-y-auto lg:pb-2">
          <RouteForm
            destination={destination}
            error={error}
            loading={loading}
            onAddWaypoint={handleAddWaypoint}
            onClear={handleClear}
            onDestinationChange={setDestination}
            onOriginChange={setOrigin}
            onRemoveWaypoint={handleRemoveWaypoint}
            onSubmit={handlePlanRoute}
            onWaypointChange={handleWaypointChange}
            origin={origin}
            summaryDistance={summary ? formatDistanceMeters(summary.distanceMeters) : null}
            summaryDuration={summary ? formatDurationSeconds(summary.durationSeconds) : null}
            waypoints={waypoints}
          />
        </aside>
      </main>
    </div>
  )
}
