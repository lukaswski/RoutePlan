"use client"

import "mapbox-gl/dist/mapbox-gl.css"

import type { Feature, LineString } from "geojson"
import { X } from "lucide-react"
import mapboxgl from "mapbox-gl"
import { useEffect, useMemo, useRef } from "react"
import Map, {
  Layer,
  Marker,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/mapbox"

import { Button } from "@/components/ui/button"
import { getMapboxAccessToken } from "@/lib/mapbox"
import { neonAccentByIndex } from "@/lib/neon-accents"
import { cn } from "@/lib/utils"

const ROUTE_NEON = neonAccentByIndex(1)
/** Trasy alternatywne: szarawy odcień, lekko różne dwie warianty gdy Mapbox zwróci 2. */
const ALT_ROUTE_STYLES = [
  { core: "#a1a1aa", glow: "#71717a" },
  { core: "#94a3b8", glow: "#64748b" },
] as const

export type MapClickPickState = {
  lng: number
  lat: number
  placeName: string | null
  loading: boolean
  error?: string | null
}

export type MapViewProps = {
  className?: string
  routeGeometry: Feature<LineString> | null
  /** Do 2 alternatywnych tras (Mapbox), tylko dla A→B. */
  alternativeRouteGeometries: Feature<LineString>[]
  /** Kliknięcie przerywanej trasy — zamiana z trasą główną (indeks zwrócony przez Mapbox). */
  onSelectAlternativeRoute?: (alternativeIndex: number) => void
  /** Kliknięcie w tło mapy (po sprawdzeniu warstw alternatyw). */
  onMapBackgroundClick?: (coords: { lng: number; lat: number }) => void
  mapClickPick?: MapClickPickState | null
  onCloseMapClickPick?: () => void
  onAddMapClickPickAsWaypoint?: () => void
  startPoint: { lng: number; lat: number } | null
  endPoint: { lng: number; lat: number } | null
  /** Punkty pośrednie (przystanki między startem a celem). */
  viaPoints: { lng: number; lat: number }[]
}

/** Środek Polski — widok startowy przed pierwszą trasą. */
const INITIAL_VIEW_STATE = {
  longitude: 19.145,
  latitude: 51.919,
  zoom: 6,
}

/** Mapbox rzuca, jeśli `layers` zawiera id jeszcze nie dodany do stylu (React dodaje warstwy asynchronicznie). */
function existingLayerIds(map: mapboxgl.Map, ids: string[]): string[] {
  return ids.filter((id) => Boolean(map.getLayer(id)))
}

/** Indeks trasy alternatywnej z id warstwy (hit / widoczna linia / poświata). */
function alternativeRouteIndexFromLayerId(layerId: string | undefined): number | null {
  if (!layerId) return null
  const m = /^route-alt-(?:hit|line|glow)-(\d+)$/.exec(layerId)
  if (!m?.[1]) return null
  const idx = Number.parseInt(m[1], 10)
  return Number.isFinite(idx) ? idx : null
}

function pickAlternativeRouteIndexAtPoint(
  map: mapboxgl.Map,
  point: mapboxgl.Point,
  queryLayerIds: string[],
  altCount: number
): number | null {
  const ready = existingLayerIds(map, queryLayerIds)
  if (ready.length > 0) {
    try {
      const feats = map.queryRenderedFeatures(point, { layers: ready })
      for (const f of feats) {
        const idx = alternativeRouteIndexFromLayerId(f.layer?.id)
        if (idx !== null && idx >= 0 && idx < altCount) return idx
      }
    } catch {
      /* spróbuj bez filtra warstw */
    }
  }

  try {
    const all = map.queryRenderedFeatures(point)
    for (const f of all) {
      const idx = alternativeRouteIndexFromLayerId(f.layer?.id)
      if (idx !== null && idx >= 0 && idx < altCount) return idx
    }
  } catch {
    return null
  }
  return null
}

export function MapView({
  className,
  routeGeometry,
  alternativeRouteGeometries,
  onSelectAlternativeRoute,
  onMapBackgroundClick,
  mapClickPick,
  onCloseMapClickPick,
  onAddMapClickPickAsWaypoint,
  startPoint,
  endPoint,
  viaPoints,
}: MapViewProps) {
  const token = getMapboxAccessToken()
  const mapRef = useRef<MapRef>(null)

  /** Klik jest zwykle na widocznej linii (`route-alt-line-*`), nie tylko na niewidocznym obszarze hit. */
  const alternativeRouteQueryLayerIds = useMemo(() => {
    const ids: string[] = []
    for (let i = 0; i < alternativeRouteGeometries.length; i++) {
      ids.push(`route-alt-glow-${i}`, `route-alt-line-${i}`)
      if (onSelectAlternativeRoute) {
        ids.push(`route-alt-hit-${i}`)
      }
    }
    return ids
  }, [alternativeRouteGeometries.length, onSelectAlternativeRoute])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !routeGeometry?.geometry?.coordinates?.length) return

    const coords = routeGeometry.geometry.coordinates
    const bounds = new mapboxgl.LngLatBounds()
    for (const c of coords) {
      bounds.extend(c as [number, number])
    }
    for (const alt of alternativeRouteGeometries) {
      const ac = alt.geometry?.coordinates
      if (!ac) continue
      for (const c of ac) bounds.extend(c as [number, number])
    }
    if (startPoint) bounds.extend([startPoint.lng, startPoint.lat])
    if (endPoint) bounds.extend([endPoint.lng, endPoint.lat])
    for (const v of viaPoints) bounds.extend([v.lng, v.lat])

    map.fitBounds(bounds, {
      padding: { top: 72, bottom: 72, left: 72, right: 72 },
      duration: 900,
      maxZoom: 14,
    })
  }, [alternativeRouteGeometries, routeGeometry, startPoint, endPoint, viaPoints])

  if (!token) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 bg-muted/40 p-6 text-center text-[13px] text-muted-foreground",
          className
        )}
      >
        <p>
          Brak tokenu Mapbox. Dodaj{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">
            NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
          </code>{" "}
          do pliku{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">
            .env.local
          </code>
          .
        </p>
      </div>
    )
  }

  return (
    <div className={cn("relative h-full w-full min-h-[200px]", className)}>
      <Map
        ref={mapRef}
        mapLib={import("mapbox-gl")}
        mapboxAccessToken={token}
        initialViewState={INITIAL_VIEW_STATE}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        attributionControl={false}
        logoPosition="bottom-left"
        onClick={(e) => {
          const map = mapRef.current?.getMap()
          if (!map) return

          if (onSelectAlternativeRoute && alternativeRouteGeometries.length > 0) {
            const picked = pickAlternativeRouteIndexAtPoint(
              map,
              e.point,
              alternativeRouteQueryLayerIds,
              alternativeRouteGeometries.length
            )
            if (picked !== null) {
              onSelectAlternativeRoute(picked)
              return
            }
          }

          onMapBackgroundClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat })
        }}
        onMouseMove={(e) => {
          const map = mapRef.current?.getMap()
          if (!map || alternativeRouteQueryLayerIds.length === 0 || !onSelectAlternativeRoute) {
            return
          }
          const ready = existingLayerIds(map, alternativeRouteQueryLayerIds)
          if (ready.length === 0) {
            map.getCanvas().style.cursor = ""
            return
          }
          let feats: mapboxgl.MapboxGeoJSONFeature[]
          try {
            feats = map.queryRenderedFeatures(e.point, { layers: ready })
          } catch {
            map.getCanvas().style.cursor = ""
            return
          }
          map.getCanvas().style.cursor = feats.length > 0 ? "pointer" : "grab"
        }}
        onMouseLeave={() => {
          const map = mapRef.current?.getMap()
          if (map) map.getCanvas().style.cursor = ""
        }}
      >
        {routeGeometry ? (
          <Source id="route" type="geojson" data={routeGeometry}>
            <Layer
              id="route-glow"
              type="line"
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
              paint={{
                "line-color": ROUTE_NEON.mapGlow,
                "line-width": 12,
                "line-opacity": 0.28,
                "line-blur": 3,
              }}
            />
            <Layer
              id="route-core"
              type="line"
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
              paint={{
                "line-color": ROUTE_NEON.mapCore,
                "line-width": 4,
                "line-opacity": 0.96,
              }}
            />
          </Source>
        ) : null}

        {alternativeRouteGeometries.map((feat, i) => {
          const altStyle = ALT_ROUTE_STYLES[i % ALT_ROUTE_STYLES.length]!
          return (
            <Source key={`route-alt-src-${i}`} id={`route-alt-${i}`} type="geojson" data={feat}>
              <Layer
                id={`route-alt-glow-${i}`}
                type="line"
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
                paint={{
                  "line-color": altStyle.glow,
                  "line-width": 11,
                  "line-opacity": 0.2,
                  "line-blur": 2,
                }}
              />
              <Layer
                id={`route-alt-line-${i}`}
                type="line"
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
                paint={{
                  "line-color": altStyle.core,
                  "line-width": 5,
                  "line-opacity": 0.88,
                  "line-dasharray": i === 0 ? [3, 1.5] : [2, 1.2],
                }}
              />
              {onSelectAlternativeRoute ? (
                <Layer
                  id={`route-alt-hit-${i}`}
                  type="line"
                  layout={{
                    "line-cap": "round",
                    "line-join": "round",
                  }}
                  paint={{
                    "line-color": "#000",
                    "line-opacity": 0,
                    "line-width": 20,
                  }}
                />
              ) : null}
            </Source>
          )
        })}

        {startPoint ? (
          <Marker longitude={startPoint.lng} latitude={startPoint.lat} anchor="center">
            <div
              className="size-3.5 rounded-full border-2 border-white shadow-md ring-2 ring-emerald-400/80"
              style={{ background: "#34d399" }}
              title="Start"
            />
          </Marker>
        ) : null}

        {viaPoints.map((v, i) => (
          <Marker
            key={`via-${v.lng}-${v.lat}-${i}`}
            latitude={v.lat}
            longitude={v.lng}
            anchor="center"
          >
            <div
              className="size-3 rounded-full border-2 border-white shadow-md ring-2 ring-amber-400/90"
              style={{ background: "#fbbf24" }}
              title={`Przystanek ${i + 1}`}
            />
          </Marker>
        ))}

        {endPoint ? (
          <Marker longitude={endPoint.lng} latitude={endPoint.lat} anchor="center">
            <div
              className="size-3.5 rounded-full border-2 border-white shadow-md ring-2 ring-rose-400/80"
              style={{ background: "#fb7185" }}
              title="Cel"
            />
          </Marker>
        ) : null}

        {mapClickPick ? (
          <Popup
            longitude={mapClickPick.lng}
            latitude={mapClickPick.lat}
            anchor="bottom"
            offset={16}
            closeButton={false}
            closeOnClick={false}
            maxWidth="min(320px, 92vw)"
            className="[&_.mapboxgl-popup-content]:!border-0 [&_.mapboxgl-popup-content]:!bg-transparent [&_.mapboxgl-popup-content]:!p-0 [&_.mapboxgl-popup-content]:!shadow-none [&_.mapboxgl-popup-tip]:!border-t-[oklch(0.2_0.02_262)]"
          >
            <div
              className="relative min-w-[220px] max-w-[min(280px,88vw)] overflow-hidden rounded-xl border border-white/[0.12] bg-[oklch(0.17_0.024_262)]/95 px-3.5 pb-3 pt-2.5 shadow-lg ring-1 ring-black/20 backdrop-blur-md"
              onClick={(ev) => ev.stopPropagation()}
              onKeyDown={(ev) => ev.stopPropagation()}
              role="dialog"
              aria-label="Miejsce z mapy"
            >
              {onCloseMapClickPick ? (
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground/80 transition-colors hover:bg-white/[0.08] hover:text-foreground"
                  aria-label="Zamknij"
                  onClick={onCloseMapClickPick}
                >
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              ) : null}
              <p className="pr-8 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/85">
                Wybrane miejsce
              </p>
              {mapClickPick.loading ? (
                <p className="mt-1.5 text-[13px] text-muted-foreground">Szukanie adresu…</p>
              ) : mapClickPick.error ? (
                <p className="mt-1.5 text-[13px] text-red-400/95">{mapClickPick.error}</p>
              ) : (
                <p className="mt-1.5 line-clamp-4 text-[13px] leading-snug text-foreground">
                  {mapClickPick.placeName}
                </p>
              )}
              {!mapClickPick.loading && mapClickPick.placeName && onAddMapClickPickAsWaypoint ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 h-8 w-full !rounded-lg border-0 bg-gradient-to-r from-[oklch(0.48_0.21_258)] to-[oklch(0.56_0.22_262)] text-[12px] font-medium text-white shadow-inner"
                  onClick={onAddMapClickPickAsWaypoint}
                >
                  Dodaj jako punkt pośredni
                </Button>
              ) : null}
            </div>
          </Popup>
        ) : null}
      </Map>
    </div>
  )
}
