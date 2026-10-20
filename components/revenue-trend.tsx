"use client";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SelectControl } from "./form-controls";
type Point = {
  date: string;
  cash: number;
  sales: number;
  registrations: number;
};
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
export function RevenueTrend({
  points,
  cashSynced,
  scopeLabel,
}: {
  points: Point[];
  cashSynced: boolean;
  scopeLabel: string;
}) {
  const [metric, setMetric] = useState("cash"),
    [format, setFormat] = useState("Bars"),
    [period, setPeriod] = useState("day");
  const labels: Record<string, string> = {
    cash: "Cash collected",
    sales: "Recorded agreements",
    registrations: "Registrations",
  };
  const data = useMemo(() => {
    if (!points.length) return [];
    const source = new Map(points.map((p) => [p.date, p]));
    const start = new Date(`${points[0].date}T00:00:00Z`),
      end = new Date(`${points.at(-1)!.date}T00:00:00Z`);
    const buckets = new Map<string, Point>();
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.toISOString().slice(0, 10),
        row = source.get(day) || {
          date: day,
          cash: 0,
          sales: 0,
          registrations: 0,
        };
      const bucket = new Date(d);
      if (period === "week")
        bucket.setUTCDate(bucket.getUTCDate() - ((bucket.getUTCDay() + 6) % 7));
      if (period === "month") bucket.setUTCDate(1);
      const key = bucket.toISOString().slice(0, 10),
        current = buckets.get(key) || {
          date: key,
          cash: 0,
          sales: 0,
          registrations: 0,
        };
      for (const k of ["cash", "sales", "registrations"] as const)
        current[k] += row[k];
      buckets.set(key, current);
    }
    return [...buckets.values()];
  }, [points, period]);
  const key = metric as "cash" | "sales" | "registrations",
    total = data.reduce((sum, p) => sum + p[key], 0),
    isCash = metric === "cash";
  const color = isCash ? "#ff5539" : metric === "sales" ? "#3b8d69" : "#6366a3";
  const chartChildren = (
    <>
      <CartesianGrid stroke="#eeeef2" vertical={false} />
      <XAxis
        dataKey="date"
        tickFormatter={dateLabel}
        tickLine={false}
        axisLine={false}
        fontSize={11}
        minTickGap={32}
        tickMargin={10}
      />
      <YAxis
        allowDecimals={false}
        domain={[0, "auto"]}
        tickFormatter={(n) => (isCash ? money(Number(n)) : String(n))}
        tickLine={false}
        axisLine={false}
        fontSize={11}
        width={isCash ? 70 : 38}
      />
      <Tooltip
        cursor={{ fill: "#f5f5f7", stroke: "#e5e5e9" }}
        labelFormatter={(v) => dateLabel(String(v))}
        formatter={(v) => [
          isCash
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(Number(v))
            : Number(v),
          labels[metric],
        ]}
        contentStyle={{
          border: "1px solid #e5e5e9",
          borderRadius: 5,
          fontSize: 12,
          boxShadow: "0 8px 24px #18181b12",
        }}
      />
    </>
  );
  return (
    <section className="panel revenue-trend">
      <div className="panel-head">
        <div>
          <h2>Performance over time</h2>
          <p>
            One metric, one scale.{" "}
            {isCash
              ? "Successful USD payments, less refunds, before fees."
              : metric === "sales"
                ? "Payment Desk agreements only; incomplete and includes tests."
                : "Registration events by signup date."}
          </p>
        </div>
        <div className="revenue-trend-controls">
          <SelectControl
            aria-label="Trend metric"
            value={metric}
            onValueChange={setMetric}
          >
            <option value="cash">Cash collected</option>
            <option value="sales">Recorded agreements</option>
            <option value="registrations">Registrations</option>
          </SelectControl>
          <SelectControl
            aria-label="Trend interval"
            value={period}
            onValueChange={setPeriod}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </SelectControl>
          <SelectControl
            aria-label="Trend chart format"
            value={format}
            onValueChange={setFormat}
          >
            <option>Bars</option>
            <option>Area</option>
          </SelectControl>
        </div>
      </div>
      <div className="revenue-trend-summary">
        <strong>
          {isCash && !cashSynced
            ? "—"
            : isCash
              ? money(total)
              : total.toLocaleString()}
        </strong>
        <span>
          {labels[metric].toLowerCase()} ·{" "}
          {isCash ? scopeLabel : "selected acquisition cohort"}
        </span>
      </div>
      {isCash && !cashSynced ? (
        <div className="revenue-trend-empty">
          <strong>Whop payment history has not been synced yet</strong>
          <span>Sync Whop in Data Sources to load actual payments.</span>
        </div>
      ) : !data.length || !total ? (
        <div className="revenue-trend-empty">
          <strong>
            {isCash
              ? "No successful USD payments in this cohort"
              : `No ${labels[metric].toLowerCase()} in this cohort`}
          </strong>
          <span>Choose another metric or adjust your filters.</span>
        </div>
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            {format === "Bars" ? (
              <BarChart
                data={data}
                margin={{ left: 0, right: 16, top: 8, bottom: 5 }}
              >
                {chartChildren}
                <Bar
                  dataKey={key}
                  fill={color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={false}
                />
              </BarChart>
            ) : (
              <AreaChart
                data={data}
                margin={{ left: 0, right: 16, top: 8, bottom: 5 }}
              >
                {chartChildren}
                <Area
                  dataKey={key}
                  type="linear"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      <div className="revenue-trend-note">
        UTC · Zero-activity dates included · Revenue and audience counts use
        separate views
      </div>
    </section>
  );
}
