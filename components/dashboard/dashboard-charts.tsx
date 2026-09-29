"use client"

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { DashboardData } from "@/lib/business/dashboard"
import { formatCompactCurrency, formatCurrency, METHOD_LABELS } from "@/lib/format"

const seriesConfig = {
  collected: { label: "Encaissé", color: "var(--chart-1)" },
  expected: { label: "Attendu", color: "var(--chart-2)" },
  cumulativeCollected: { label: "Encaissé cumulé", color: "var(--chart-1)" },
  cumulativeExpected: { label: "Attendu cumulé", color: "var(--chart-2)" },
  amount: { label: "Encaissé", color: "var(--chart-1)" },
} satisfies ChartConfig

const moneyTooltip = (
  <ChartTooltipContent
    formatter={(value, name, item) => (
      <div className="flex w-full items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2.5 rounded-[3px]" style={{ background: item.color ?? item.payload?.fill }} />
          {seriesConfig[name as keyof typeof seriesConfig]?.label ?? name}
        </span>
        <span className="tabular font-medium text-foreground">{formatCurrency(Number(value))}</span>
      </div>
    )}
  />
)

/** Barres groupées encaissé vs attendu par tranche. */
export function CollectedVsExpectedChart({ series }: { series: DashboardData["series"] }) {
  return (
    <ChartContainer config={seriesConfig} className="aspect-auto h-64 w-full">
      <BarChart data={series} barGap={2} margin={{ left: 4, right: 4, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => formatCompactCurrency(value)}
        />
        <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={moneyTooltip} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="collected" fill="var(--color-collected)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expected" fill="var(--color-expected)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  )
}

/** Courbes cumulées encaissé / attendu. */
export function CumulativeChart({ series }: { series: DashboardData["series"] }) {
  return (
    <ChartContainer config={seriesConfig} className="aspect-auto h-64 w-full">
      <LineChart data={series} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => formatCompactCurrency(value)}
        />
        <ChartTooltip content={moneyTooltip} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          animationDuration={500}
          dataKey="cumulativeCollected"
          type="monotone"
          stroke="var(--color-cumulativeCollected)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          animationDuration={500}
          dataKey="cumulativeExpected"
          type="monotone"
          stroke="var(--color-cumulativeExpected)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 3 }}
        />
      </LineChart>
    </ChartContainer>
  )
}

const METHOD_COLORS = { virement: "var(--chart-1)", cheque: "var(--chart-2)", cash: "var(--chart-3)" } as const
const methodConfig = {
  virement: { label: METHOD_LABELS.virement, color: METHOD_COLORS.virement },
  cheque: { label: METHOD_LABELS.cheque, color: METHOD_COLORS.cheque },
  cash: { label: METHOD_LABELS.cash, color: METHOD_COLORS.cash },
} satisfies ChartConfig

/** Répartition des encaissements par moyen de paiement (anneau + légende chiffrée). */
export function MethodChart({ data }: { data: DashboardData["byMethod"] }) {
  const total = data.reduce((sum, entry) => sum + entry.amount, 0)
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ChartContainer config={methodConfig} className="aspect-square h-44 shrink-0">
        <PieChart accessibilityLayer>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                nameKey="method"
                formatter={(value, _name, item) => (
                  <div className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">
                      {METHOD_LABELS[item.payload.method as keyof typeof METHOD_LABELS]}
                    </span>
                    <span className="tabular font-medium">{formatCurrency(Number(value))}</span>
                  </div>
                )}
              />
            }
          />
          <Pie
            data={data}
            dataKey="amount"
            nameKey="method"
            innerRadius="58%"
            outerRadius="95%"
            stroke="var(--card)"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.method} fill={METHOD_COLORS[entry.method]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="w-full space-y-2 text-sm">
        {data.map((entry) => (
          <li key={entry.method} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: METHOD_COLORS[entry.method] }}
              aria-hidden
            />
            <span className="flex-1">{METHOD_LABELS[entry.method]}</span>
            <span className="tabular text-muted-foreground">
              {total ? Math.round((entry.amount / total) * 100) : 0} %
            </span>
            <span className="tabular w-24 text-right font-medium">{formatCurrency(entry.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const propertyConfig = { amount: { label: "Encaissé", color: "var(--chart-1)" } } satisfies ChartConfig

/** Revenus encaissés par bien (barres horizontales, une seule couleur). */
export function PropertyRevenueChart({ data }: { data: DashboardData["byProperty"] }) {
  const rows = data.slice(0, 8)
  return (
    <ChartContainer
      config={propertyConfig}
      className="aspect-auto w-full"
      style={{ height: Math.max(120, rows.length * 44 + 16) }}
    >
      <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 72 }} accessibilityLayer>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={moneyTooltip} />
        <Bar
          dataKey="amount"
          fill="var(--color-amount)"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          label={{
            position: "right",
            fill: "var(--foreground)",
            fontSize: 12,
            formatter: (value: unknown) => formatCurrency(Number(value)),
          }}
        />
      </BarChart>
    </ChartContainer>
  )
}
