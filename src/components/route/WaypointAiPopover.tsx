"use client"

import { Loader2, ParkingSquare, Sparkles, Trees, Utensils } from "lucide-react"
import * as React from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type WaypointPoiSearchOptions = {
  restaurants: boolean
  sights: boolean
  parking: boolean
}

type RowOption = {
  key: keyof WaypointPoiSearchOptions
  icon: typeof Utensils
  title: string
  ariaLabel: string
  iconBg: string
}

const ROWS: RowOption[] = [
  {
    key: "restaurants",
    icon: Utensils,
    title: "Restauracje",
    ariaLabel: "Uwzględnij restauracje w okolicy",
    iconBg:
      "bg-[oklch(0.42_0.14_308)] text-[oklch(0.92_0.06_308)] ring-1 ring-white/12",
  },
  {
    key: "sights",
    icon: Trees,
    title: "Ciekawe miejsca",
    ariaLabel: "Uwzględnij ciekawe miejsca w okolicy",
    iconBg:
      "bg-[oklch(0.38_0.12_165)] text-[oklch(0.92_0.06_165)] ring-1 ring-white/12",
  },
  {
    key: "parking",
    icon: ParkingSquare,
    title: "Parkingi",
    ariaLabel: "Uwzględnij parkingi w okolicy",
    iconBg:
      "bg-[oklch(0.38_0.03_265)] text-[oklch(0.85_0.02_264)] ring-1 ring-white/15",
  },
]

type PanelPos = {
  top: number
  left: number
  width: number
}

function clampPanelToViewport(rect: DOMRect): PanelPos {
  const pad = 10
  const vw = typeof window !== "undefined" ? window.innerWidth : rect.width
  let left = rect.left
  let width = rect.width
  width = Math.min(width, vw - pad * 2)
  left = Math.max(pad, Math.min(left, vw - pad - width))
  const top = rect.bottom + 8
  return { top, left, width }
}

type WaypointAiPopoverProps = {
  coords: { lng: number; lat: number } | null
  placeLabel: string
  loading?: boolean
  /** Tekst pod spinnerem podczas ładowania (np. etap AI / mapa). */
  loadingStatus?: string | null
  disabled?: boolean
  /** Wiersz przystanku (szerokość ≈ kafelek) — do pozycji `fixed` panelu w portalu. */
  getAnchorEl: () => HTMLElement | null
  onSearch: (opts: WaypointPoiSearchOptions) => void | Promise<void>
}

export function WaypointAiPopover({
  coords,
  placeLabel,
  loading = false,
  loadingStatus = null,
  disabled = false,
  getAnchorEl,
  onSearch,
}: WaypointAiPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [opts, setOpts] = React.useState<WaypointPoiSearchOptions>({
    restaurants: false,
    sights: false,
    parking: false,
  })

  const wrapRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  /** Pozycje `fixed` ustawiane imperatywnie — bez setState w efekcie (ESLint). */
  const applyPanelPosition = React.useCallback(() => {
    const el = panelRef.current
    const anchor = getAnchorEl()
    if (!el || !anchor || typeof window === "undefined") return
    const rect = anchor.getBoundingClientRect()
    if (rect.width < 8 || rect.height < 8) return
    const p = clampPanelToViewport(rect)
    el.style.position = "fixed"
    el.style.top = `${p.top}px`
    el.style.left = `${p.left}px`
    el.style.width = `${p.width}px`
    el.style.zIndex = "550"
  }, [getAnchorEl])

  React.useLayoutEffect(() => {
    if (!open) return
    applyPanelPosition()
    const onWin = () => applyPanelPosition()
    window.addEventListener("resize", onWin)
    window.addEventListener("scroll", onWin, true)
    return () => {
      window.removeEventListener("resize", onWin)
      window.removeEventListener("scroll", onWin, true)
    }
  }, [open, applyPanelPosition])

  React.useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  /** Można pokazać panel / wiersz aktywny (bez blokady przez trwające zapytanie). */
  const anchorOk = Boolean(coords) && !disabled
  const anySelected =
    opts.restaurants || opts.sights || opts.parking
  const canSubmit = anchorOk && anySelected && !loading

  const toggle = (key: keyof WaypointPoiSearchOptions) => {
    setOpts((o) => ({ ...o, [key]: !o[key] }))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    await onSearch(opts)
    setOpen(false)
  }

  const panelContent = open && anchorOk ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Znajdź w okolicy"
      aria-busy={loading}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "border border-white/[0.09]",
        "bg-[oklch(0.165_0.026_262)]/96 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.72)]",
        "ring-1 ring-white/[0.06]",
        "backdrop-blur-xl supports-[backdrop-filter]:bg-[oklch(0.165_0.026_262)]/88"
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {loading ? (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[oklch(0.12_0.03_262)]/80 px-5 text-center backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-8 animate-spin text-[oklch(0.72_0.14_285)]" aria-hidden />
          <p className="text-[13px] font-medium leading-snug text-foreground">
            {loadingStatus ?? "Szukam w okolicy…"}
          </p>
        </div>
      ) : null}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
        aria-hidden
      />
      <div className="relative bg-gradient-to-b from-white/[0.07] to-transparent px-4 pb-3 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
          W okolicy
        </p>
        <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight text-foreground">
          {placeLabel || "Przystanek"}
        </p>
      </div>

      <div className="relative border-t border-white/[0.06] px-3 pb-3 pt-2">
        <div className="flex flex-col gap-1.5">
          {ROWS.map((row) => {
            const Icon = row.icon
            const on = opts[row.key]
            return (
              <div
                key={row.key}
                className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
                        row.iconBg
                      )}
                    >
                      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <p className="text-[13px] font-medium leading-tight text-foreground">
                      {row.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={loading}
                    aria-label={row.ariaLabel}
                    className={cn(
                      "relative inline-flex h-[20px] w-[36px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.56_0.22_262)]/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[oklch(0.17_0.024_262)]",
                      on
                        ? "bg-gradient-to-r from-[oklch(0.48_0.21_258)] to-[oklch(0.56_0.22_262)] shadow-[inset_0_1px_0_oklch(1_0_0_/12%)]"
                        : "bg-white/[0.11]",
                      loading
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer active:opacity-95"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(row.key)
                    }}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none block size-4 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.26)] ring-1 ring-black/5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]",
                        on ? "translate-x-[16px]" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-black/[0.12] px-4 py-3">
        <Button
          type="button"
          className="app-ai-gradient h-10 w-full !rounded-full border-0 text-[13px] font-semibold shadow-[0_0_28px_-4px_oklch(0.52_0.17_305/0.5)] disabled:opacity-45"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Szukam…
            </span>
          ) : (
            "Szukaj w okolicy"
          )}
        </Button>
      </div>
    </div>
  ) : null

  return (
    <div className="relative z-[2] shrink-0" ref={wrapRef}>
      <button
        type="button"
        disabled={!anchorOk}
        title={
          coords
            ? "Propozycje miejsc od AI w okolicy przystanku"
            : "Wyznacz trasę, aby ustalić pozycję przystanku na mapie"
        }
        aria-expanded={open}
        aria-busy={loading}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] p-0 text-white shadow-sm outline-none",
          "app-ai-gradient hover:opacity-95 disabled:pointer-events-none disabled:!opacity-40 disabled:!shadow-none",
          "focus-visible:ring-2 focus-visible:ring-[oklch(0.58_0.2_308)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.17_0.024_262)]",
          loading && "animate-pulse"
        )}
        onClick={() => anchorOk && setOpen((o) => !o)}
      >
        <Sparkles className="size-4" aria-hidden />
      </button>

      {typeof document !== "undefined" && panelContent
        ? createPortal(panelContent, document.body)
        : null}
    </div>
  )
}
