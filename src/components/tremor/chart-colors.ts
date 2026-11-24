// ============================================================
// Tremor chartColors [v0.1.0] — copied from tremorlabs/tremor.
//
// The Tremor charts source uses these helpers to map a category
// name to a stable Tailwind color class (`bg-violet-500`,
// `fill-blue-500`, …). Tremor's "Raw" distribution is copy-paste
// — there is no `@tremor/raw` npm package — so the canonical
// approach is to vendor the file unchanged and customise locally.
//
// Source: https://github.com/tremorlabs/tremor/blob/main/src/utils/chartColors.ts
// License: Apache 2.0 (Tremor)
// ============================================================

export type ColorUtility = "bg" | "stroke" | "fill" | "text"

export const PARSONA_CHART_SERIES = [
  "#0B3B2E",
  "#8066A8",
  "#8FA99B",
  "#CFC3FF",
  "#D6A85C",
  "#6688B8",
] as const;

export const chartColors = {
  blue: {
    bg: "bg-[#6688B8]",
    stroke: "stroke-[#6688B8]",
    fill: "fill-[#6688B8]",
    text: "text-[#6688B8]",
  },
  emerald: {
    bg: "bg-[#0B3B2E]",
    stroke: "stroke-[#0B3B2E]",
    fill: "fill-[#0B3B2E]",
    text: "text-[#0B3B2E]",
  },
  violet: {
    bg: "bg-[#8066A8]",
    stroke: "stroke-[#8066A8]",
    fill: "fill-[#8066A8]",
    text: "text-[#8066A8]",
  },
  lavender: {
    bg: "bg-[#CFC3FF]",
    stroke: "stroke-[#CFC3FF]",
    fill: "fill-[#CFC3FF]",
    text: "text-[#CFC3FF]",
  },
  sage: {
    bg: "bg-[#8FA99B]",
    stroke: "stroke-[#8FA99B]",
    fill: "fill-[#8FA99B]",
    text: "text-[#8FA99B]",
  },
  amber: {
    bg: "bg-[#D6A85C]",
    stroke: "stroke-[#D6A85C]",
    fill: "fill-[#D6A85C]",
    text: "text-[#D6A85C]",
  },
  gray: {
    bg: "bg-muted",
    stroke: "stroke-muted-foreground",
    fill: "fill-muted-foreground",
    text: "text-muted-foreground",
  },
  cyan: {
    bg: "bg-cyan-500",
    stroke: "stroke-cyan-500",
    fill: "fill-cyan-500",
    text: "text-cyan-500",
  },
  pink: {
    bg: "bg-pink-500",
    stroke: "stroke-pink-500",
    fill: "fill-pink-500",
    text: "text-pink-500",
  },
  lime: {
    bg: "bg-lime-500",
    stroke: "stroke-lime-500",
    fill: "fill-lime-500",
    text: "text-lime-500",
  },
  fuchsia: {
    bg: "bg-fuchsia-500",
    stroke: "stroke-fuchsia-500",
    fill: "fill-fuchsia-500",
    text: "text-fuchsia-500",
  },
  teal: {
    bg: "bg-teal-600",
    stroke: "stroke-teal-600",
    fill: "fill-teal-600",
    text: "text-teal-600",
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string
  }
}

export type AvailableChartColorsKeys = keyof typeof chartColors

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as Array<AvailableChartColorsKeys>

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length])
  })
  return categoryColors
}

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: "bg-muted",
    stroke: "stroke-muted-foreground",
    fill: "fill-muted-foreground",
    text: "text-muted-foreground",
  }
  return chartColors[color]?.[type] ?? fallbackColor[type]
}
