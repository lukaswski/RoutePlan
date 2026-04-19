"use client"

import type { Feature, LineString } from "geojson"
import dynamic from "next/dynamic"

import type { MapClickPickState } from "@/components/map/MapView"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const MapView = dynamic(
  () => import("./MapView").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[200px] w-full items-center justify-center bg-muted/25 text-[13px] text-muted-foreground">
        Ładowanie mapy…
      </div>
    ),
  }
)

type MapCanvasProps = {
  className?: string
  routeGeometry: Feature<LineString> | null
  alternativeRouteGeometries: Feature<LineString>[]
  onSelectAlternativeRoute?: (alternativeIndex: number) => void
  mapClickPick?: MapClickPickState | null
  onCloseMapClickPick?: () => void
  onAddMapClickPickAsWaypoint?: () => void
  onMapBackgroundClick?: (coords: { lng: number; lat: number }) => void
  startPoint: { lng: number; lat: number } | null
  endPoint: { lng: number; lat: number } | null
  viaPoints: { lng: number; lat: number }[]
}

export function MapCanvas({
  className,
  routeGeometry,
  alternativeRouteGeometries,
  onSelectAlternativeRoute,
  mapClickPick,
  onCloseMapClickPick,
  onAddMapClickPickAsWaypoint,
  onMapBackgroundClick,
  startPoint,
  endPoint,
  viaPoints,
}: MapCanvasProps) {
  return (
    <div
      className={cn(
        "app-map-chrome relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border/70 !bg-transparent app-surface-elevated ring-1 ring-white/[0.08]",
        className
      )}
    >
      <div className="absolute inset-0 z-0 min-h-[200px]">
        <MapView
          className="h-full w-full"
          routeGeometry={routeGeometry}
          alternativeRouteGeometries={alternativeRouteGeometries}
          onSelectAlternativeRoute={onSelectAlternativeRoute}
          mapClickPick={mapClickPick}
          onCloseMapClickPick={onCloseMapClickPick}
          onAddMapClickPickAsWaypoint={onAddMapClickPickAsWaypoint}
          onMapBackgroundClick={onMapBackgroundClick}
          startPoint={startPoint}
          endPoint={endPoint}
          viaPoints={viaPoints}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-28 bg-gradient-to-b from-background/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-44 bg-gradient-to-t from-background/30 to-transparent" />

      {/* Atrybucja poza wbudowanym panelem Mapbox — znak Mapbox na canvas musi zostać (regulamin). */}
      <div className="pointer-events-auto absolute bottom-2 right-2 z-20 max-w-[min(100%,18rem)] rounded-md border border-white/[0.08] bg-background/75 px-2 py-1 text-[9px] leading-snug text-muted-foreground/85 shadow-sm backdrop-blur-sm">
        <a
          href="https://www.mapbox.com/about/maps/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-white/25 underline-offset-2 hover:text-foreground/90"
        >
          © Mapbox
        </a>
        <span aria-hidden className="mx-1 text-muted-foreground/45">
          ·
        </span>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-white/25 underline-offset-2 hover:text-foreground/90"
        >
          © OpenStreetMap
        </a>
      </div>

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col items-start justify-between p-5">
        <div className="flex items-center gap-2.5">
          <Badge className="rounded-full border-white/12 bg-gradient-to-r from-white/[0.12] to-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/90">
            Mapa
          </Badge>
          <span className="text-[13px] text-muted-foreground">
            Przeciągnij, przybliż
          </span>
        </div>
      </div>
    </div>
  )
}
