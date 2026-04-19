/**
 * Paleta neonowa aplikacji (12 akcentów, styl Revolut / poświata).
 * Kolory map (`mapCore`, `mapGlow`) dobrane wizualnie do tokenów OKLCH w `globals.css` (.dark).
 * Przy zmianie odcieni zaktualizuj oba miejsca.
 */

export type NeonAccentIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type NeonAccent = {
  readonly index: NeonAccentIndex
  readonly slug: string
  readonly label: string
  /** Główny kolor linii (Mapbox, SVG, ikony „flat”) */
  readonly mapCore: string
  /** Szersza „poświata” pod linią na mapie */
  readonly mapGlow: string
}

export const NEON_COUNT = 12 as const

export const NEON_ACCENTS: readonly NeonAccent[] = [
  {
    index: 1,
    slug: "electric-blue",
    label: "Elektryczny niebieski",
    mapCore: "#5c9dff",
    mapGlow: "#1d4ed8",
  },
  {
    index: 2,
    slug: "sapphire",
    label: "Szafirowy",
    mapCore: "#7dd3fc",
    mapGlow: "#0ea5e9",
  },
  {
    index: 3,
    slug: "sky-cyan",
    label: "Niebieski cyan",
    mapCore: "#67e8f9",
    mapGlow: "#06b6d4",
  },
  {
    index: 4,
    slug: "aqua",
    label: "Aqua",
    mapCore: "#5eead4",
    mapGlow: "#14b8a6",
  },
  {
    index: 5,
    slug: "sea-mint",
    label: "Mięta",
    mapCore: "#86efac",
    mapGlow: "#22c55e",
  },
  {
    index: 6,
    slug: "lime-neon",
    label: "Limonkowy",
    mapCore: "#bef264",
    mapGlow: "#84cc16",
  },
  {
    index: 7,
    slug: "citron",
    label: "Cytrynowy",
    mapCore: "#fde047",
    mapGlow: "#eab308",
  },
  {
    index: 8,
    slug: "amber-glow",
    label: "Bursztynowy",
    mapCore: "#fcd34d",
    mapGlow: "#f59e0b",
  },
  {
    index: 9,
    slug: "tangerine",
    label: "Mandarynkowy",
    mapCore: "#fdba74",
    mapGlow: "#ea580c",
  },
  {
    index: 10,
    slug: "coral-neon",
    label: "Koralowy",
    mapCore: "#fca5a5",
    mapGlow: "#ef4444",
  },
  {
    index: 11,
    slug: "magenta-neon",
    label: "Magenta",
    mapCore: "#f0abfc",
    mapGlow: "#d946ef",
  },
  {
    index: 12,
    slug: "violet-beam",
    label: "Fiolet",
    mapCore: "#c4b5fd",
    mapGlow: "#8b5cf6",
  },
]

const byIndex = new Map<NeonAccentIndex, NeonAccent>(
  NEON_ACCENTS.map((a) => [a.index, a])
)

export function neonAccentByIndex(index: number): NeonAccent {
  const n = ((((index - 1) % NEON_COUNT) + NEON_COUNT) % NEON_COUNT) + 1
  return byIndex.get(n as NeonAccentIndex) ?? NEON_ACCENTS[0]!
}
