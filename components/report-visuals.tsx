"use client";
import { SelectControl } from "./form-controls";
import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ArrowUpRight, Users, ChartNoAxesCombined } from "lucide-react";
import type { Dataset, Webinar } from "../lib/model";
import { dimensions } from "../lib/reporting";
import { defaultFilters } from "../lib/model";
const PALETTE = [
  "#ff603e",
  "#4b8cbe",
  "#54a894",
  "#8e7bb9",
  "#dfb15b",
  "#b1b6c0",
];
export function ReportVisuals({
  data,
  webinar: w,
  onSource,
}: {
  data: Dataset;
  webinar: Webinar;
  onSource?: (source: string) => void;
}) {
  const [format, setFormat] = useState("Area");
  const registrations = data.registrations.filter((r) => r.webinar_id === w.id);
  const ids = new Set(registrations.map((r) => r.contact_id));
  const days = new Map<string, number>();
  for (const r of registrations) {
    const day = r.registered_at.slice(0, 10);
    days.set(day, (days.get(day) || 0) + 1);
  }
  const orderedDays = [...days.keys()].sort();
  if (orderedDays.length) {
    const first = new Date(orderedDays[0] + "T00:00:00Z");
    const last = new Date(orderedDays[orderedDays.length - 1] + "T00:00:00Z");
    // Include zero-signup days so a calendar gap cannot be mistaken for an omitted interval.
    if ((+last - +first) / 86400000 < 3660) {
      for (let day = +first; day <= +last; day += 86400000) {
        const key = new Date(day).toISOString().slice(0, 10);
        if (!days.has(key)) days.set(key, 0);
      }
    }
  }
  const timeline = [...days]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({
      date,
      count,
      label: new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
    }));
  const sources = new Map<string, number>();
  for (const c of data.contacts) {
    if (!ids.has(c.id)) continue;
    const name = dimensions(data, c.id, {
      ...defaultFilters,
      webinar: w.id,
    }).source;
    sources.set(name, (sources.get(name) || 0) + 1);
  }
  const sorted = [...sources].sort((a, b) => b[1] - a[1]);
  const mix = sorted.slice(0, 5).map(([source, value]) => ({
    source,
    name: source === "(not set)" ? "Unattributed" : source,
    value,
  }));
  if (sorted.length > 5)
    mix.push({
      source: "__other",
      name: "Other sources",
      value: sorted.slice(5).reduce((n, s) => n + s[1], 0),
    });
  const known = ids.size - (sources.get("(not set)") || 0);
  const coverage = ids.size ? known / ids.size : null;
  const grid = (
    <CartesianGrid vertical={false} stroke="#eeeeF1" strokeDasharray="3 4" />
  );
  const x = (
    <XAxis
      dataKey="label"
      axisLine={false}
      tickLine={false}
      tick={{ fontSize: 10, fill: "#85858f" }}
      minTickGap={20}
      dy={8}
    />
  );
  const y = (
    <YAxis
      allowDecimals={false}
      axisLine={false}
      tickLine={false}
      tick={{ fontSize: 10, fill: "#85858f" }}
      width={28}
    />
  );
  const tip = (
    <Tooltip
      contentStyle={{
        border: "1px solid #e5e5e9",
        borderRadius: 5,
        fontSize: 12,
        boxShadow: "0 4px 18px #00000008",
      }}
      formatter={(value) => [value, "Registrations"]}
      cursor={{ stroke: "#dadade" }}
    />
  );
  return (
    <div className="visual-widget-grid">
      <section className="panel registration-widget">
        <div className="panel-head">
          <div>
            <span className="widget-eyebrow">AUDIENCE GROWTH</span>
            <h2>Registration activity</h2>
          </div>
          <SelectControl
            aria-label="Registration chart format"
            value={format}
            onValueChange={(value) => setFormat(value)}
          >
            <option>Area</option>
            <option>Bars</option>
            <option>Line</option>
          </SelectControl>
        </div>
        <div className="widget-headline">
          <strong>{ids.size.toLocaleString()}</strong>
          <span>
            unique registrants
            <ChartNoAxesCombined size={14} />
          </span>
        </div>
        <div
          className="registration-plot"
          role="group"
          aria-label="Webinar registrations by day"
        >
          {timeline.length ? (
            <ResponsiveContainer width="100%" height="100%">
              {format === "Bars" ? (
                <BarChart
                  data={timeline}
                  margin={{ top: 10, right: 15, bottom: 10, left: 0 }}
                >
                  {grid}
                  {x}
                  {y}
                  {tip}
                  <Bar
                    dataKey="count"
                    fill="#ff603e"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={34}
                  />
                </BarChart>
              ) : format === "Line" ? (
                <LineChart
                  data={timeline}
                  margin={{ top: 10, right: 15, bottom: 10, left: 0 }}
                >
                  {grid}
                  {x}
                  {y}
                  {tip}
                  <Line
                    dataKey="count"
                    stroke="#ff603e"
                    strokeWidth={2.4}
                    dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              ) : (
                <AreaChart
                  data={timeline}
                  margin={{ top: 10, right: 15, bottom: 10, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id={`registrations-${w.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#ff603e"
                        stopOpacity={0.24}
                      />
                      <stop
                        offset="100%"
                        stopColor="#ff603e"
                        stopOpacity={0.015}
                      />
                    </linearGradient>
                  </defs>
                  {grid}
                  {x}
                  {y}
                  {tip}
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#ff603e"
                    strokeWidth={2.4}
                    fill={`url(#registrations-${w.id})`}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          ) : (
            <p className="visual-no-data">
              No registration history for this session.
            </p>
          )}
        </div>
        <div className="widget-bottom">
          <span>
            <i />
            Registrations by signup date
          </span>
          <small>UTC</small>
        </div>
      </section>
      <section className="panel source-donut-widget">
        <div className="panel-head">
          <div>
            <span className="widget-eyebrow">ACQUISITION</span>
            <h2>Source mix</h2>
          </div>
          <Users size={16} />
        </div>
        <div className="source-donut-plot">
          {mix.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mix}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="66%"
                  outerRadius="90%"
                  paddingAngle={3}
                  stroke="none"
                  onClick={(_, index) => {
                    const source = mix[index]?.source;
                    if (source && source !== "__other") onSource?.(source);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {mix.map((s, i) => (
                    <Cell key={s.source} fill={PALETTE[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 5,
                    border: "1px solid #e5e5e9",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="source-donut-center">
            <strong>{sources.size}</strong>
            <span>sources</span>
          </div>
        </div>
        <div className="donut-source-legend">
          {mix.map((s, i) => (
            <button
              key={s.source}
              disabled={s.source === "__other"}
              onClick={() => onSource?.(s.source)}
            >
              <span>
                <i style={{ background: PALETTE[i] }} />
                {s.name}
              </span>
              <strong>
                {ids.size ? Math.round((s.value / ids.size) * 100) : 0}%
              </strong>
            </button>
          ))}
        </div>
      </section>
      <section className="panel coverage-widget">
        <div className="panel-head">
          <div>
            <span className="widget-eyebrow">DATA CONFIDENCE</span>
            <h2>Attribution coverage</h2>
          </div>
          <ArrowUpRight size={16} />
        </div>
        <div className="coverage-gauge">
          <svg
            viewBox="0 0 240 145"
            role="img"
            aria-label={
              coverage === null
                ? "Attribution coverage unavailable"
                : `${Math.round(coverage * 100)} percent attribution coverage`
            }
          >
            <path
              d="M 25 120 A 95 95 0 0 1 215 120"
              fill="none"
              stroke="#f0f1f3"
              strokeWidth="20"
              pathLength="100"
              strokeDasharray="2.7 1.3"
            />
            {coverage !== null && (
              <path
                d="M 25 120 A 95 95 0 0 1 215 120"
                fill="none"
                stroke="#54a894"
                strokeWidth="20"
                pathLength="100"
                strokeDasharray={`${coverage * 100} 100`}
              />
            )}
            <text
              x="120"
              y="101"
              textAnchor="middle"
              fontSize="35"
              fontWeight="700"
              fill="#18181b"
              letterSpacing="-1.4"
            >
              {coverage === null ? "—" : `${Math.round(coverage * 100)}%`}
            </text>
            <text
              x="120"
              y="124"
              textAnchor="middle"
              fontSize="11"
              fill="#71717a"
            >
              Known source
            </text>
          </svg>
        </div>
        <div className="coverage-split">
          <div>
            <span>Attributed</span>
            <strong>{known}</strong>
            <small>Known first touch</small>
          </div>
          <div>
            <span>Unattributed</span>
            <strong>{ids.size - known}</strong>
            <small>Needs source data</small>
          </div>
        </div>
        <p className="coverage-caption">
          Measured from this session’s registrants. Tracking coverage, not a
          conversion rate.
        </p>
      </section>
    </div>
  );
}

export function SessionComparisonChart({
  data,
  webinars,
}: {
  data: Dataset;
  webinars: Webinar[];
}) {
  const rows = webinars.map((w) => ({
    name: new Date(w.webinar_date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
    registrants: new Set(
      data.registrations
        .filter((r) => r.webinar_id === w.id)
        .map((r) => r.contact_id),
    ).size,
    peak: w.peak_attendees,
    pitch: w.pitch_attendees,
  }));
  return (
    <div className="comparison-chart-block">
      <div className="comparison-chart-legend">
        <span>
          <i style={{ background: "#ff603e" }} />
          Registrants
        </span>
        <span>
          <i style={{ background: "#4b8cbe" }} />
          Peak audience
        </span>
        <span>
          <i style={{ background: "#54a894" }} />
          People at pitch
        </span>
      </div>
      <div className="comparison-chart-plot">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 10, right: 25, bottom: 10, left: 5 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#eeeeF1"
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#71717a" }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#85858f" }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                border: "1px solid #e5e5e9",
                borderRadius: 5,
              }}
            />
            <Bar
              name="Registrants"
              dataKey="registrants"
              fill="#ff603e"
              maxBarSize={35}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              name="Peak audience"
              dataKey="peak"
              fill="#4b8cbe"
              maxBarSize={35}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              name="People at pitch"
              dataKey="pitch"
              fill="#54a894"
              maxBarSize={35}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p>
        Unknown counts are omitted. Additional sessions appear as they are
        synced.
      </p>
    </div>
  );
}
