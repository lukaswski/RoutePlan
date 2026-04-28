"use client"

import type { Feature, LineString } from "geojson"
import * as React from "react"

import type { MapClickPickState } from "@/components/map/MapView"
import { MapCanvas } from "@/components/map/MapCanvas"
import { RouteAiCard } from "@/components/route/RouteAiCard"
import { RouteForm, type WaypointField } from "@/components/route/RouteForm"
import { formatDistanceMeters, formatDurationSeconds } from "@/lib/format-route"
import {
  fetchDrivingRoute,
  geocodeForward,
  geocodeReverse,
  type GeocodeHit,
} from "@/lib/mapbox-route"
import {
  POI_SEARCH_CONTEXT_DESTINATION,
  type WaypointPoiMarker,
} from "@/lib/waypoint-poi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function RoutePlanner() {
  const [origin, setOrigin] = React.useState("")
  const [destination, setDestination] = React.useState("")
  const [waypoints, setWaypoints] = React.useState<WaypointField[]>([])
  const [showAlternativeRoutes, setShowAlternativeRoutes] = React.useState(false)
  const [preferUnpavedRoutes, setPreferUnpavedRoutes] = React.useState(false)
  const [alternativeGeometries, setAlternativeGeometries] = React.useState<
    Feature<LineString>[]
  >([])
  const [alternativeMetrics, setAlternativeMetrics] = React.useState<
    { distanceMeters: number; durationSeconds: number }[]
  >([])
  /** Współrzędne ostatnio pomyślnie zgeokodowanej trasy (ref = aktualna wartość przy kliknięciu przełącznika). */
  const plannedCoordsRef = React.useRef<{ lng: number; lat: number }[] | null>(null)

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
  const [mapClickPick, setMapClickPick] = React.useState<MapClickPickState | null>(null)
  const reverseGeocodeAbortRef = React.useRef<AbortController | null>(null)

  const [summary, setSummary] = React.useState<{
    distanceMeters: number
    durationSeconds: number
  } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  /** POI z AI per punkt pośredni (klucz = id pola przystanku). */
  const [poiByWaypointId, setPoiByWaypointId] = React.useState<
    Record<string, WaypointPoiMarker[]>
  >({})
  const [waypointAiLoadingId, setWaypointAiLoadingId] = React.useState<string | null>(null)
  const [waypointAiLoadingStatus, setWaypointAiLoadingStatus] = React.useState<string | null>(
    null
  )

  const routeGeometryRef = React.useRef(routeGeometry)
  routeGeometryRef.current = routeGeometry
  const alternativeGeometriesRef = React.useRef(alternativeGeometries)
  alternativeGeometriesRef.current = alternativeGeometries
  const alternativeMetricsRef = React.useRef(alternativeMetrics)
  alternativeMetricsRef.current = alternativeMetrics
  const summaryRef = React.useRef(summary)
  summaryRef.current = summary
  const preferUnpavedRef = React.useRef(preferUnpavedRoutes)
  preferUnpavedRef.current = preferUnpavedRoutes
  const showAlternativeRoutesRef = React.useRef(showAlternativeRoutes)
  showAlternativeRoutesRef.current = showAlternativeRoutes

  const handleAddWaypoint = React.useCallback(() => {
    setWaypoints((w) => [...w, { id: crypto.randomUUID(), value: "" }])
  }, [])

  const handleWaypointChange = React.useCallback((id: string, value: string) => {
    setWaypoints((rows) => rows.map((row) => (row.id === id ? { ...row, value } : row)))
  }, [])

  const handleRemoveWaypoint = React.useCallback((id: string) => {
    setWaypoints((rows) => rows.filter((row) => row.id !== id))
    setPoiByWaypointId((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const handleSelectAlternativeRoute = React.useCallback((altIndex: number) => {
    const primary = routeGeometryRef.current
    const alts = alternativeGeometriesRef.current
    const metrics = alternativeMetricsRef.current
    const sum = summaryRef.current
    if (
      !primary ||
      !sum ||
      altIndex < 0 ||
      altIndex >= alts.length ||
      metrics.length !== alts.length
    ) {
      return
    }

    const pickedGeo = alts[altIndex]
    const pickedMetric = metrics[altIndex]
    if (!pickedGeo?.geometry?.coordinates?.length || !pickedMetric) return

    const newAlts: Feature<LineString>[] = []
    const newMetrics: { distanceMeters: number; durationSeconds: number }[] = []

    newAlts.push(primary)
    newMetrics.push({
      distanceMeters: sum.distanceMeters,
      durationSeconds: sum.durationSeconds,
    })

    for (let i = 0; i < alts.length; i++) {
      if (i === altIndex) continue
      const g = alts[i]
      const m = metrics[i]
      if (g && m) {
        newAlts.push(g)
        newMetrics.push(m)
      }
    }

    setRouteGeometry(pickedGeo)
    setAlternativeGeometries(newAlts)
    setAlternativeMetrics(newMetrics)
    setSummary(pickedMetric)
  }, [])

  /** Ponowne wyznaczenie trasy z aktualnymi przełącznikami (współrzędne z ostatniego „Wyznacz”). */
  const refetchStoredRoute = React.useCallback(
    async (opts: { preferUnpaved: boolean; alternatives: boolean }) => {
      const coords = plannedCoordsRef.current
      if (!coords || coords.length < 2) return

      setError(null)
      setLoading(true)
      try {
        if (coords.length === 2) {
          const route = await fetchDrivingRoute(coords, {
            alternatives: opts.alternatives,
            preferUnpaved: opts.preferUnpaved,
          })
          if (!route) {
            setError("Nie udało się wyznaczyć trasy między tymi punktami.")
            return
          }
          setRouteGeometry(route.geometry)
          setAlternativeGeometries(route.alternativeGeometries ?? [])
          setAlternativeMetrics(route.alternativeMetrics ?? [])
          setSummary({
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
          })
        } else {
          const route = await fetchDrivingRoute(coords, {
            alternatives: false,
            preferUnpaved: opts.preferUnpaved,
          })
          if (!route) {
            setError("Nie udało się wyznaczyć trasy między tymi punktami.")
            return
          }
          setRouteGeometry(route.geometry)
          setSummary({
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
          })
          if (opts.alternatives) {
            try {
              const altBundle = await fetchDrivingRoute(
                [coords[0]!, coords[coords.length - 1]!],
                {
                  alternatives: true,
                  preferUnpaved: opts.preferUnpaved,
                }
              )
              setAlternativeGeometries(altBundle?.alternativeGeometries ?? [])
              setAlternativeMetrics(altBundle?.alternativeMetrics ?? [])
            } catch {
              setAlternativeGeometries([])
              setAlternativeMetrics([])
            }
          } else {
            setAlternativeGeometries([])
            setAlternativeMetrics([])
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Wystąpił nieznany błąd.")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const handlePreferUnpavedRoutesChange = React.useCallback(
    async (checked: boolean) => {
      setPreferUnpavedRoutes(checked)
      const pts = plannedCoordsRef.current
      if (!pts || pts.length < 2) return
      await refetchStoredRoute({
        preferUnpaved: checked,
        alternatives: showAlternativeRoutesRef.current,
      })
    },
    [refetchStoredRoute]
  )

  /**
   * Przełącznik = preferencja. Dla A→B: pełne alternatywy w jednym żądaniu. Dla wielu punktów: główna trasa z waypointami,
   * a alternatywy to warianty odcinka start → cel (osobne API), główne podsumowanie = trasa z przystankami.
   */
  const handleShowAlternativeRoutesChange = React.useCallback(async (checked: boolean) => {
    if (!checked) {
      setShowAlternativeRoutes(false)
      setAlternativeGeometries([])
      setAlternativeMetrics([])
      return
    }

    setShowAlternativeRoutes(true)

    const pts = plannedCoordsRef.current
    if (!pts || pts.length < 2) return

    setError(null)
    try {
      const endpoints =
        pts.length === 2 ? pts : [pts[0]!, pts[pts.length - 1]!]
      const res = await fetchDrivingRoute(endpoints, {
        alternatives: true,
        preferUnpaved: preferUnpavedRef.current,
      })
      setAlternativeGeometries(res?.alternativeGeometries ?? [])
      setAlternativeMetrics(res?.alternativeMetrics ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się pobrać tras alternatywnych.")
      setAlternativeGeometries([])
      setAlternativeMetrics([])
    }
  }, [])

  const routeAiRevisionKey = React.useMemo(() => {
    if (!summary) return null
    return [
      summary.distanceMeters,
      summary.durationSeconds,
      origin,
      destination,
      ...waypoints.map((w) => w.value),
    ].join("|")
  }, [destination, origin, summary, waypoints])

  const waypointPoisOnMap = React.useMemo(() => {
    const list: WaypointPoiMarker[] = []
    for (const arr of Object.values(poiByWaypointId)) list.push(...arr)
    return list
  }, [poiByWaypointId])

  const handleWaypointPoiSearch = React.useCallback(
    async (
      waypointId: string,
      opts: { restaurants: boolean; sights: boolean; parking: boolean }
    ) => {
      let coord: { lng: number; lat: number } | undefined
      let placeName = ""

      if (waypointId === POI_SEARCH_CONTEXT_DESTINATION) {
        coord = endPoint ?? undefined
        placeName = destination.trim()
      } else {
        const idx = waypoints.findIndex((w) => w.id === waypointId)
        coord = idx >= 0 ? viaPoints[idx] : undefined
        placeName = idx >= 0 ? waypoints[idx]?.value?.trim() ?? "" : ""
      }

      if (!coord) {
        setError(
          waypointId === POI_SEARCH_CONTEXT_DESTINATION
            ? "Brak pozycji celu na mapie — wyznacz trasę ponownie."
            : "Brak pozycji przystanku na mapie — wyznacz trasę ponownie."
        )
        return
      }

      setWaypointAiLoadingId(waypointId)
      setWaypointAiLoadingStatus("Przygotowuję wyszukiwanie (AI)…")
      setError(null)
      try {
        const resSuggest = await fetch("/api/ai/waypoint-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lng: coord.lng,
            lat: coord.lat,
            placeName,
            restaurants: opts.restaurants,
            sights: opts.sights,
            parking: opts.parking,
          }),
        })
        const dataSuggest = (await resSuggest.json()) as {
          searchPlan?: unknown
          error?: string
        }
        if (!resSuggest.ok) {
          setError(dataSuggest.error ?? "Nie udało się przygotować haseł wyszukiwania.")
          return
        }

        setWaypointAiLoadingStatus("Szukam miejsc w Mapbox…")
        const resMap = await fetch("/api/geo/waypoint-pois-resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            searchPlan: dataSuggest.searchPlan ?? {
              restaurant: [],
              sightseeing: [],
              parking: [],
            },
            lng: coord.lng,
            lat: coord.lat,
            placeName,
            restaurants: opts.restaurants,
            sights: opts.sights,
            parking: opts.parking,
          }),
        })
        const dataMap = (await resMap.json()) as { places?: WaypointPoiMarker[]; error?: string }
        if (!resMap.ok) {
          setError(dataMap.error ?? "Nie udało się umieścić miejsc na mapie.")
          return
        }
        const list = dataMap.places ?? []
        setPoiByWaypointId((prev) => ({
          ...prev,
          [waypointId]: list,
        }))
        if (list.length === 0) {
          setError(
            "Brak punktów w okolicy (~10 km) — Mapbox nie znalazł POI przy tych hasłach. Uzupełnij przystanek nazwą miejscowości i spróbuj ponownie."
          )
        }
      } catch {
        setError("Błąd połączenia przy wyszukiwaniu miejsc.")
      } finally {
        setWaypointAiLoadingId(null)
        setWaypointAiLoadingStatus(null)
      }
    },
    [destination, endPoint, viaPoints, waypoints]
  )

  const handleClear = React.useCallback(() => {
    reverseGeocodeAbortRef.current?.abort()
    reverseGeocodeAbortRef.current = null
    setMapClickPick(null)
    setOrigin("")
    setDestination("")
    setWaypoints([])
    setShowAlternativeRoutes(false)
    setPreferUnpavedRoutes(false)
    setAlternativeGeometries([])
    setAlternativeMetrics([])
    plannedCoordsRef.current = null
    setRouteGeometry(null)
    setStartPoint(null)
    setEndPoint(null)
    setViaPoints([])
    setSummary(null)
    setError(null)
    setPoiByWaypointId({})
    setWaypointAiLoadingId(null)
    setWaypointAiLoadingStatus(null)
  }, [])

  const handleMapBackgroundClick = React.useCallback(
    async (coords: { lng: number; lat: number }) => {
      reverseGeocodeAbortRef.current?.abort()
      const ac = new AbortController()
      reverseGeocodeAbortRef.current = ac

      setMapClickPick({
        lng: coords.lng,
        lat: coords.lat,
        placeName: null,
        loading: true,
        error: null,
      })

      try {
        const hit = await geocodeReverse(coords.lng, coords.lat, { signal: ac.signal })
        if (ac.signal.aborted) return
        if (!hit) {
          setMapClickPick({
            lng: coords.lng,
            lat: coords.lat,
            placeName: null,
            loading: false,
            error: "Nie udało się rozpoznać adresu w tym miejscu.",
          })
          return
        }
        setMapClickPick({
          lng: coords.lng,
          lat: coords.lat,
          placeName: hit.placeName,
          loading: false,
          error: null,
        })
      } catch (e) {
        if (ac.signal.aborted) return
        if (e instanceof DOMException && e.name === "AbortError") return
        setMapClickPick({
          lng: coords.lng,
          lat: coords.lat,
          placeName: null,
          loading: false,
          error: e instanceof Error ? e.message : "Błąd pobierania adresu.",
        })
      }
    },
    []
  )

  const handleCloseMapClickPick = React.useCallback(() => {
    reverseGeocodeAbortRef.current?.abort()
    reverseGeocodeAbortRef.current = null
    setMapClickPick(null)
  }, [])

  const handleAddMapClickPickAsWaypoint = React.useCallback(async () => {
    const pick = mapClickPick
    if (!pick?.placeName || pick.loading) return

    const hit: GeocodeHit = {
      lng: pick.lng,
      lat: pick.lat,
      placeName: pick.placeName,
    }

    reverseGeocodeAbortRef.current?.abort()
    reverseGeocodeAbortRef.current = null
    setMapClickPick(null)

    setWaypoints((w) => [...w, { id: crypto.randomUUID(), value: hit.placeName }])

    const pts = plannedCoordsRef.current
    if (!pts || pts.length < 2) return

    const newCoords = [...pts.slice(0, -1), { lng: hit.lng, lat: hit.lat }, pts[pts.length - 1]!]
    plannedCoordsRef.current = newCoords

    setStartPoint(newCoords[0]!)
    setEndPoint(newCoords[newCoords.length - 1]!)
    setViaPoints(newCoords.slice(1, -1))

    setLoading(true)
    setError(null)
    try {
      if (newCoords.length === 2) {
        const route = await fetchDrivingRoute(newCoords, {
          alternatives: showAlternativeRoutesRef.current,
          preferUnpaved: preferUnpavedRef.current,
        })
        if (!route) {
          setError("Nie udało się wyznaczyć trasy między tymi punktami.")
          return
        }
        setRouteGeometry(route.geometry)
        setAlternativeGeometries(route.alternativeGeometries ?? [])
        setAlternativeMetrics(route.alternativeMetrics ?? [])
        setSummary({
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
        })
      } else {
        const route = await fetchDrivingRoute(newCoords, {
          alternatives: false,
          preferUnpaved: preferUnpavedRef.current,
        })
        if (!route) {
          setError("Nie udało się wyznaczyć trasy między tymi punktami.")
          return
        }
        setRouteGeometry(route.geometry)
        setSummary({
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
        })
        if (showAlternativeRoutesRef.current) {
          try {
            const ends = [newCoords[0]!, newCoords[newCoords.length - 1]!]
            const altBundle = await fetchDrivingRoute(ends, {
              alternatives: true,
              preferUnpaved: preferUnpavedRef.current,
            })
            setAlternativeGeometries(altBundle?.alternativeGeometries ?? [])
            setAlternativeMetrics(altBundle?.alternativeMetrics ?? [])
          } catch {
            setAlternativeGeometries([])
            setAlternativeMetrics([])
          }
        } else {
          setAlternativeGeometries([])
          setAlternativeMetrics([])
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił nieznany błąd.")
    } finally {
      setLoading(false)
    }
  }, [mapClickPick])

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
    setAlternativeGeometries([])
    setAlternativeMetrics([])
    plannedCoordsRef.current = null
    setStartPoint(null)
    setEndPoint(null)
    setViaPoints([])
    setPoiByWaypointId({})

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
      plannedCoordsRef.current = coords

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

      if (coords.length === 2) {
        const route = await fetchDrivingRoute(coords, {
          alternatives: showAlternativeRoutes,
          preferUnpaved: preferUnpavedRoutes,
        })

        if (!route) {
          setError("Nie udało się wyznaczyć trasy między tymi punktami.")
          return
        }

        setRouteGeometry(route.geometry)
        setAlternativeGeometries(route.alternativeGeometries ?? [])
        setAlternativeMetrics(route.alternativeMetrics ?? [])
        setSummary({
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
        })
      } else {
        const route = await fetchDrivingRoute(coords, {
          alternatives: false,
          preferUnpaved: preferUnpavedRoutes,
        })

        if (!route) {
          setError("Nie udało się wyznaczyć trasy między tymi punktami.")
          return
        }

        setRouteGeometry(route.geometry)
        setSummary({
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
        })

        if (showAlternativeRoutes) {
          try {
            const ends = [coords[0]!, coords[coords.length - 1]!]
            const altBundle = await fetchDrivingRoute(ends, {
              alternatives: true,
              preferUnpaved: preferUnpavedRoutes,
            })
            setAlternativeGeometries(altBundle?.alternativeGeometries ?? [])
            setAlternativeMetrics(altBundle?.alternativeMetrics ?? [])
          } catch {
            setAlternativeGeometries([])
            setAlternativeMetrics([])
          }
        } else {
          setAlternativeGeometries([])
          setAlternativeMetrics([])
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił nieznany błąd.")
    } finally {
      setLoading(false)
    }
  }, [destination, origin, preferUnpavedRoutes, showAlternativeRoutes, waypoints])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background dark:bg-transparent">
      <header className="app-header-surface sticky top-0 z-40 shrink-0 border-b backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-5 md:h-16 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.56_0.22_262)] to-[oklch(0.44_0.19_266)] shadow-[0_8px_24px_-8px_oklch(0.56_0.22_262_/0.55)] md:size-10">
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

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-5 py-5 md:gap-5 md:px-8 md:py-6 lg:flex-row lg:gap-4">
        <section className="flex min-h-[52vh] flex-1 flex-col lg:min-h-0">
          <MapCanvas
            className="min-h-[52vh] lg:min-h-[calc(100vh-8rem)]"
            routeGeometry={routeGeometry}
            alternativeRouteGeometries={alternativeGeometries}
            onSelectAlternativeRoute={
              alternativeGeometries.length > 0 && viaPoints.length === 0
                ? handleSelectAlternativeRoute
                : undefined
            }
            mapClickPick={mapClickPick}
            onCloseMapClickPick={handleCloseMapClickPick}
            onAddMapClickPickAsWaypoint={handleAddMapClickPickAsWaypoint}
            onMapBackgroundClick={handleMapBackgroundClick}
            startPoint={startPoint}
            endPoint={endPoint}
            viaPoints={viaPoints}
            waypointPois={waypointPoisOnMap}
          />
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-3 lg:max-w-[380px] lg:overflow-visible lg:pb-2">
          <div className="flex min-h-0 flex-col gap-3 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overflow-x-visible lg:pr-0.5">
          <RouteForm
            destination={destination}
            error={error}
            loading={loading}
            onAddWaypoint={handleAddWaypoint}
            onClear={handleClear}
            onDestinationChange={setDestination}
            onOriginChange={setOrigin}
            onRemoveWaypoint={handleRemoveWaypoint}
            onPreferUnpavedRoutesChange={handlePreferUnpavedRoutesChange}
            onShowAlternativeRoutesChange={handleShowAlternativeRoutesChange}
            onSubmit={handlePlanRoute}
            onWaypointChange={handleWaypointChange}
            origin={origin}
            preferUnpavedRoutes={preferUnpavedRoutes}
            showAlternativeRoutes={showAlternativeRoutes}
            summaryDistance={summary ? formatDistanceMeters(summary.distanceMeters) : null}
            summaryDuration={summary ? formatDurationSeconds(summary.durationSeconds) : null}
            viaPoints={viaPoints}
            endPoint={endPoint}
            waypointAiLoadingId={waypointAiLoadingId}
            waypointAiLoadingStatus={waypointAiLoadingStatus}
            onWaypointPoiSearch={handleWaypointPoiSearch}
            waypoints={waypoints}
          />
          <RouteAiCard
            key={routeAiRevisionKey ?? "no-route"}
            destination={destination}
            intermediateWaypointLabels={waypoints.map((w) => w.value)}
            origin={origin}
            routeReady={Boolean(summary)}
          />
          </div>
        </aside>
      </main>
    </div>
  )
}
