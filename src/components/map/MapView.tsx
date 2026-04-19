"use client"

import "mapbox-gl/dist/mapbox-gl.css"

import type { Feature, LineString } from "geojson"
import mapboxgl from "mapbox-gl"
import { useEffect, useRef } from "react"
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/mapbox"

import { getMapboxAccessToken } from "@/lib/mapbox"
import { cn } from "@/lib/utils"

export type MapViewProps = {
  className?: string
  routeGeometry: Feature<LineString> | null
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

export function MapView({
  className,
  routeGeometry,
  startPoint,
  endPoint,
  viaPoints,
}: MapViewProps) {
  const token = getMapboxAccessToken()
  const mapRef = useRef<MapRef>(null)

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !routeGeometry?.geometry?.coordinates?.length) return

    const coords = routeGeometry.geometry.coordinates
    const bounds = new mapboxgl.LngLatBounds()
    for (const c of coords) {
      bounds.extend(c as [number, number])
    }
    if (startPoint) bounds.extend([startPoint.lng, startPoint.lat])
    if (endPoint) bounds.extend([endPoint.lng, endPoint.lat])
    for (const v of viaPoints) bounds.extend([v.lng, v.lat])

    map.fitBounds(bounds, {
      padding: { top: 72, bottom: 72, left: 72, right: 72 },
      duration: 900,
      maxZoom: 14,
    })
  }, [routeGeometry, startPoint, endPoint, viaPoints])

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
        attributionControl
      >
        <NavigationControl position="top-right" showCompass showZoom />

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
                "line-color": "#3b82f6",
                "line-width": 12,
                "line-opacity": 0.22,
                "line-blur": 2,
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
                "line-color": "#93c5fd",
                "line-width": 4,
                "line-opacity": 0.95,
              }}
            />
          </Source>
        ) : null}

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
      </Map>
    </div>
  )
}
