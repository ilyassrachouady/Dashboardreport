"use client";
import { WhopPaymentHistory } from "./whop-payment-history";
import { WhopBalance } from "./whop-balance";
import { crmCloserCash } from "../lib/crm-cash";
import { useLivePayments } from "./use-live-payments";
import { matchedContact, reportingPayments } from "../lib/payment-history";
import { RevenueTrend } from "./revenue-trend";
import { SelectControl, DateControl } from "./form-controls";
import { WebinarReports } from "./webinar-performance";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDown,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ChartNoAxesCombined,
  Video,
  Phone,
  Users,
  Database,
  Search,
  SlidersHorizontal,
  Download,
  Plus,
  X,
  Check,
  RefreshCw,
  Link2,
  Command,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  Activity,
  Layers,
  CalendarDays,
  Filter,
  Settings2,
} from "lucide-react";
import type { Dataset, Contact, Dimension, Filters } from "../lib/model";
import { defaultFilters } from "../lib/model";
import {
  selectContacts,
  metrics,
  attribution,
  trend,
  usd,
  percent,
  dimensions,
  touchFor,
  normalize,
  quality,
  csv,
  ratio,
} from "../lib/reporting";
const NAV = [
  ["Overview", LayoutGrid],
  ["Attribution", ChartNoAxesCombined],
  ["Webinars", Video],
  ["Sales", Phone],
  ["Leads", Users],
  ["Data Sources", Database],
] as const;
const COLORS = ["#ff5539", "#27272a", "#85858f", "#bcbcc5", "#e5e5e9"];
const shortDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const label = (s: string) =>
  s === "(not set)"
    ? s
    : s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
function download(rows: Record<string, unknown>[], name: string) {
  const url = URL.createObjectURL(
    new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
function Empty({
  text = "No records match these filters.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Layers size={28} />
      <h3>Nothing here yet</h3>
      <p>{text}</p>
    </div>
  );
}
function Panel({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function DataTable({
  columns,
  rows,
  onRow,
  pageSize = 10,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  onRow?: (row: Record<string, unknown>) => void;
  pageSize?: number;
}) {
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState(""),
    [desc, setDesc] = useState(true),
    [page, setPage] = useState(0);
  const filtered = rows
    .filter((r) =>
      Object.values(r).some((v) =>
        String(v).toLowerCase().includes(query.toLowerCase()),
      ),
    )
    .sort((a, b) => {
      const av = a[sort],
        bv = b[sort];
      return (
        (typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""))) * (desc ? -1 : 1)
      );
    });
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  return (
    <>
      <div className="table-tools">
        <label className="search">
          <Search size={15} />
          <input
            aria-label="Search table"
            placeholder="Search records…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <button
          className="quiet"
          onClick={() =>
            download(
              filtered.map((r) =>
                Object.fromEntries(columns.map((c) => [c.label, r[c.key]])),
              ),
              "creator-society-report",
            )
          }
        >
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>
                  <button
                    onClick={() => {
                      setSort(c.key);
                      setDesc(sort === c.key ? !desc : true);
                    }}
                  >
                    {c.label}
                    {sort === c.key && (
                      <ArrowDown size={11} className={!desc ? "flip" : ""} />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(current * pageSize, (current + 1) * pageSize)
              .map((r, i) => (
                <tr
                  key={String(r.id ?? r.name ?? i)}
                  onClick={() => onRow?.(r)}
                  tabIndex={onRow ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onRow && e.key === "Enter") onRow(r);
                  }}
                  className={onRow ? "clickable" : ""}
                >
                  {columns.map((c, j) => (
                    <td key={c.key} className={j === 0 ? "first-cell" : ""}>
                      {c.key.toLowerCase().includes("cash") ||
                      c.key === "contract" ||
                      c.key === "rpr" ||
                      c.key === "cpc" ||
                      c.key === "initial"
                        ? r[c.key] == null
                          ? "—"
                          : usd(Number(r[c.key]))
                        : c.key === "show" ||
                            c.key === "close" ||
                            c.key === "share"
                          ? percent(r[c.key] as number | null)
                          : String(r[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!filtered.length && <Empty />}
      </div>
      <div className="table-foot">
        <span>
          {filtered.length ? current * pageSize + 1 : 0}–
          {Math.min((current + 1) * pageSize, filtered.length)} of{" "}
          {filtered.length} records
        </span>
        <div>
          <button
            aria-label="Previous page"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <span>{current + 1}</span>
          <button
            aria-label="Next page"
            disabled={(current + 1) * pageSize >= filtered.length}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
export default function Dashboard({
  data: initial,
  demo,
  error,
}: {
  data: Dataset;
  demo: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const [drillIds, setDrillIds] = useState<string[] | null>(null);
  const [localData, setData] = useState(initial),
    [view, setView] = useState("Overview"),
    [filters, setFilters] = useState<Filters>(defaultFilters),
    [advanced, setAdvanced] = useState(false),
    [tab, setTab] = useState("First Touch"),
    [utmTab, setUtmTab] = useState<Dimension>("source"),
    [lead, setLead] = useState<Contact | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mappingOpen, setMappingOpen] = useState(false),
    [mappingDim, setMappingDim] = useState<Dimension>("source"),
    [raw, setRaw] = useState(""),
    [normalized, setNormalized] = useState(""),
    [compare, setCompare] = useState<string[]>([]),
    [qualityFilter, setQualityFilter] = useState<string>("");
  const { data } = useLivePayments(demo ? localData : initial, demo);
  const activeFilters = {
    ...filters,
    model:
      tab === "Last Touch" && view === "Attribution"
        ? ("last" as const)
        : filters.model,
  };
  const contacts = useMemo(
    () => selectContacts(data, activeFilters),
    [data, activeFilters],
  );
  const m = metrics(data, contacts, activeFilters),
    series = trend(data, contacts, activeFilters),
    groups = attribution(data, contacts, activeFilters),
    q = quality({ ...data, contacts });
  function update<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters((f) => ({ ...f, [k]: v }));
    setQualityFilter("");
    setDrillIds(null);
  }
  function drill(source?: string, ids?: string[]) {
    setDrillIds(ids || null);
    if (source) setFilters((f) => ({ ...f, source }));
    setQualityFilter("");
    setView("Leads");
  }
  const filterCount = Object.entries(filters).filter(
    ([k, v]) => k !== "model" && v,
  ).length;
  const sourceOptions = [
    ...new Set(
      data.contacts.map((c) => dimensions(data, c.id, filters).source),
    ),
  ].sort();
  const selectedLeads = qualityFilter
    ? (q[qualityFilter as keyof typeof q] || []).filter((c) =>
        contacts.some((x) => x.id === c.id),
      )
    : drillIds
      ? contacts.filter((c) => drillIds.includes(c.id))
      : contacts;
  const cashAvailable = demo || Boolean(data.whopPayments);
  const unmatchedCash = m.paymentRows
    .filter((p) => !p.contact_id)
    .reduce((sum, p) => sum + p.amount, 0);
  const kpis = [
    {
      name: "USD receipts",
      value: cashAvailable ? usd(m.cash) : "—",
      detail: "Less refunds · includes test payments",
      icon: ArrowUpRight,
      action: () => setView("Sales"),
    },
    {
      name: "Receipts without CRM match",
      value: cashAvailable ? usd(unmatchedCash) : "—",
      detail: "Excluded from source / closer attribution",
      icon: AlertCircle,
      action: () => setView("Sales"),
    },
    {
      name: "Imported registrations",
      value: m.registrants,
      detail: "Individual API records · not Analytics total",
      icon: Users,
      action: () =>
        drill(
          undefined,
          m.regs.map((r) => r.contact_id),
        ),
    },
    {
      name: "Calendar appointments",
      value: m.booked,
      detail: "Selected calendar · cancellations excluded",
      icon: CalendarDays,
      action: () =>
        drill(
          undefined,
          data.appointments
            .filter(
              (a) =>
                !["cancelled", "canceled", "invalid", "deleted"].includes(
                  a.status,
                ) &&
                contacts.some((c) => c.id === a.contact_id) &&
                (!filters.webinar || a.webinar_id === filters.webinar),
            )
            .map((a) => a.contact_id),
        ),
    },
    {
      name: "Known CRM leads",
      value: m.leads,
      detail: "Imported contact records",
      icon: Users,
      action: () => drill(),
    },
    {
      name: "Recorded attended calls",
      value: m.attended,
      detail: "Payment Desk only · incomplete · includes tests",
      icon: Phone,
      action: () =>
        drill(
          undefined,
          m.calls
            .filter((c) => c.attendance === "attended")
            .map((c) => c.contact_id),
        ),
    },
    {
      name: "Recorded agreements",
      value: m.sales,
      detail: "Payment Desk only · includes tests",
      icon: CheckCircle2,
      action: () => setView("Sales"),
    },
    {
      name: "Recorded contract value",
      value: usd(m.contract),
      detail: "Recorded agreements · not cash · includes tests",
      icon: Layers,
      action: () => setView("Sales"),
    },
  ];
  const metricTile = (index: number) => {
    const { name, value, detail, icon: Icon, action } = kpis[index];
    return (
      <button
        key={name}
        className={`kpi ${index === 0 ? "highlight" : ""}`}
        onClick={action}
      >
        <div className="kpi-label">
          {name}
          <Icon size={14} />
        </div>
        <div className="kpi-value">
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
          <ArrowUpRight size={16} />
        </div>
        <div className="kpi-detail">{detail}</div>
      </button>
    );
  };
  const title =
    view === "Overview"
      ? "Revenue overview"
      : view === "Data Sources"
        ? "Integrations & data quality"
        : view === "Attribution"
          ? "Acquisition & attribution"
          : view === "Webinars"
            ? "Webinar performance"
            : view === "Sales"
              ? "Sales & payments"
              : "CRM leads";
  async function sync(source = "ghl") {
    setBusy(true);
    setNotice("");
    try {
      const r = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const result = await r.json();
      setNotice(result.message || result.error);
      if (r.ok && !demo) {
        router.refresh();
        window.location.reload();
      }
    } catch {
      setNotice("Sync could not connect. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function saveMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!raw || !normalized.trim()) return;
    const next = {
      id: crypto.randomUUID(),
      dimension: mappingDim,
      raw_value: raw,
      normalized_value: normalized.trim(),
    };
    if (demo) {
      setData((d) => ({
        ...d,
        mappings: [
          ...d.mappings.filter(
            (m) => !(m.dimension === mappingDim && m.raw_value === raw),
          ),
          next,
        ],
      }));
      setNotice("Demo mapping applied to this session. Raw data preserved.");
    } else {
      const r = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!r.ok) {
        setNotice("Mapping could not be saved.");
        return;
      }
      setData((d) => ({
        ...d,
        mappings: [
          ...d.mappings.filter(
            (m) => !(m.dimension === mappingDim && m.raw_value === raw),
          ),
          next,
        ],
      }));
      setNotice("Mapping saved. Reports recalculated.");
    }
    setRaw("");
    setNormalized("");
  }
  const attrDim: Dimension =
    tab === "Campaign"
      ? "campaign"
      : tab === "Content"
        ? "content"
        : tab === "UTM"
          ? utmTab
          : "source";
  const attrGroups = attribution(
    data,
    contacts,
    activeFilters,
    attrDim,
    tab === "Trakyo" ? "trakyo" : tab === "UTM" ? "utm" : undefined,
  );
  const crmCashSummary=crmCloserCash(data);
  const salesRows = m.saleRows.map((s) => {
    const c = data.contacts.find((c) => c.id === s.contact_id)!;
    const call = data.calls.find((c) => c.id === s.sales_call_id);
    const payments = reportingPayments(data)
      .filter((p) => p.sale_id === s.id && p.status === "succeeded")
      .sort((a, b) => a.paid_at.localeCompare(b.paid_at));
    return {
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      closer: call?.closer || "Unassigned",
      date: shortDate(call?.call_date || s.sold_at),
      attendance: label(call?.attendance || "unknown"),
      outcome: label(call?.outcome || "unknown"),
      offer: s.offer,
      structure: label(s.payment_type),
      contract: s.contract_value,
      initial: payments[0]?.amount || 0,
      cash: payments.reduce((sum, p) => sum + p.amount, 0),
      crmCash:crmCashSummary.entries.find(e=>e.contactId===c.id&&e.callId===call?.id)?.cash??null,
      firstPayment: payments[0] ? shortDate(payments[0].paid_at) : "Pending",
      source: dimensions(data, c.id, filters).source,
      trakyo: touchFor(data, c.id, filters.model, "trakyo")?.source || "—",
      webinar:
        data.webinars.find((w) =>
          data.registrations.some(
            (r) => r.contact_id === c.id && r.webinar_id === w.id,
          ),
        )?.name || "—",
    };
  });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Layers size={19} />
          </span>
          <span>
            the creator society
            <span className="brand-caption">REVENUE INTELLIGENCE</span>
          </span>
        </a>
        <button className="workspace">
          <span className="workspace-icon">CS</span>
          <span>
            Creator Society<small>Internal workspace</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {NAV.map(([name, Icon]) => (
            <button
              key={name}
              aria-label={name}
              className={view === name ? "nav-item active" : "nav-item"}
              onClick={() => {
                setView(name);
                setQualityFilter("");
                setDrillIds(null);
              }}
            >
              <Icon size={17} />
              <span>
                {name === "Webinars"
                  ? "Webinar reports"
                  : name === "Overview"
                    ? "Overview"
                    : name === "Sales"
                      ? "Sales & payments"
                      : name === "Attribution"
                        ? "Acquisition"
                        : name === "Leads"
                          ? "CRM leads"
                          : name === "Data Sources"
                            ? "Integrations"
                            : name}
              </span>
              {name === "Data Sources" && <span className="nav-dot" />}
              {name === view && (
                <ChevronRight className="nav-chevron" size={13} />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-status">
            <span className="status-dot" />
            <span>
              {demo ? "Demo workspace" : "Normalized reporting"}
              <small>
                {demo
                  ? "Sample data, clearly separated"
                  : "Server-side data access"}
              </small>
            </span>
          </div>
          <button
            className="profile"
            onClick={() => {
              setView("Data Sources");
            }}
          >
            <span className="avatar">CS</span>
            <span>
              Creator Society<small>Workspace settings</small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={12} />
            <strong>{view}</strong>
          </div>
          <div className="topbar-right">
            <span className="mode-label">
              <span className="status-dot" />
              {demo ? "Demo mode" : "Live data"}
            </span>
            <span className="top-divider" />
            <button
              className="icon-button"
              aria-label="Open data sources"
              onClick={() => setView("Data Sources")}
            >
              <Database size={16} />
            </button>
            <span className="small-avatar">CS</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p>
                {
                  (
                    {
                      Overview:
                        "Company receipts and recorded sales activity at a glance.",
                      Attribution:
                        "Explore acquisition sources and verified revenue matches.",
                      Webinars:
                        "Review attendance, applications and bookings for each session.",
                      Sales:
                        "Whop transactions and Payment Desk agreements, kept distinct.",
                      Leads:
                        "Search contacts and inspect their recorded journey.",
                      "Data Sources":
                        "Manage connections, matching gaps and reporting coverage.",
                    } as Record<string, string>
                  )[view]
                }
              </p>
            </div>
            <div className="heading-actions" hidden={view === "Webinars"}>
              <button
                className="button"
                onClick={() =>
                  download(
                    contacts.map((c) => ({
                      name: `${c.first_name} ${c.last_name}`,
                      email: c.email,
                      ...dimensions(data, c.id, filters),
                    })),
                    "selected-leads",
                  )
                }
              >
                <Download size={15} /> Export leads
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => sync(view === "Sales" ? "whop" : "ghl")}
              >
                <RefreshCw size={14} className={busy ? "spin" : ""} />
                {busy
                  ? "Syncing…"
                  : view === "Sales"
                    ? "Sync Whop"
                    : "Sync CRM"}
              </button>
            </div>
          </div>
          {demo && (
            <div className="demo-banner">
              <span className="badge">DEMO</span> You’re exploring a sample
              dataset. No live contacts or payments are shown.
              <button onClick={() => setView("Data Sources")}>
                Connect your sources <ArrowRight size={13} />
              </button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={17} />
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="filterbar" hidden={view === "Webinars"}>
            <div className="date-filter">
              <DateControl
                aria-label="From registration date"
                value={filters.from}
                max={filters.to || undefined}
                onValueChange={(value) => update("from", value)}
              />
              <span>–</span>
              <DateControl
                aria-label="To registration date"
                value={filters.to}
                min={filters.from || undefined}
                onValueChange={(value) => update("to", value)}
              />
            </div>
            <SelectControl
              aria-label="Webinar"
              value={filters.webinar}
              onValueChange={(value) => update("webinar", value)}
            >
              <option value="">All webinars</option>
              {data.webinars.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              aria-label="Attribution model"
              value={filters.model}
              onValueChange={(value) =>
                update("model", value as "first" | "last")
              }
            >
              <option value="first">First-touch attribution</option>
              <option value="last">Last-touch attribution</option>
            </SelectControl>
            <button
              className={advanced ? "button filter-active" : "button"}
              onClick={() => setAdvanced(!advanced)}
            >
              <SlidersHorizontal size={14} /> Filters
              {filterCount > 0 && <span className="count">{filterCount}</span>}
            </button>
            {filterCount > 0 && (
              <button
                className="quiet"
                onClick={() => setFilters(defaultFilters)}
              >
                Reset
              </button>
            )}
            <span className="cohort-label">
              Acquisition cohort{" "}
              <span title="Dates select registrations, or lead creation for unregistered leads. With no filters, cash includes all Whop USD receipts. Filtered cohorts include only payments with verified contact matches; offer and closer filters require a linked sale.">
                ⓘ
              </span>
            </span>
          </div>
          {advanced && (
            <div className="advanced-filters">
              {(
                [
                  "source",
                  "medium",
                  "campaign",
                  "content",
                  "trakyoSource",
                  "trakyoCampaign",
                  "closer",
                  "offer",
                ] as const
              ).map((key) => {
                const options =
                  key === "closer"
                    ? [...new Set(data.calls.map((c) => c.closer))]
                    : key === "offer"
                      ? [...new Set(data.sales.map((s) => s.offer))]
                      : key === "trakyoSource" || key === "trakyoCampaign"
                        ? [
                            ...new Set(
                              data.touches
                                .filter((t) => t.provider === "trakyo")
                                .map((t) =>
                                  normalize(
                                    key === "trakyoSource"
                                      ? t.source
                                      : t.campaign,
                                    key === "trakyoSource"
                                      ? "source"
                                      : "campaign",
                                    data,
                                  ),
                                ),
                            ),
                          ]
                        : key === "source"
                          ? sourceOptions
                          : [
                              ...new Set(
                                data.contacts.map(
                                  (c) => dimensions(data, c.id, filters)[key],
                                ),
                              ),
                            ];
                return (
                  <label key={key}>
                    {key.replace("trakyo", "Trakyo ")}
                    <SelectControl
                      value={filters[key]}
                      onValueChange={(value) => update(key, value)}
                    >
                      <option value="">All {key}</option>
                      {options.map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </SelectControl>
                  </label>
                );
              })}
            </div>
          )}
          {view === "Overview" && (
            <div className="executive-overview">
              <WhopBalance data={data} />
              <div className="executive-status">
                <div>
                  <span className="status-dot" />
                  <strong>
                    {data.whopPayments
                      ? "Whop history connected"
                      : "Payment history needs attention"}
                  </strong>
                  <span>USD reporting · test activity included</span>
                </div>
                <button
                  className="quiet"
                  onClick={() => setView("Data Sources")}
                >
                  Review data coverage <ArrowUpRight size={13} />
                </button>
              </div>
              <div className="kpi-grid executive-metrics">
                {[0, 7, 6, 3, 5, 2, 4, 1].map(metricTile)}
              </div>
              {data.whopHistoryError && (
                <p className="error-banner">{data.whopHistoryError}</p>
              )}
              <div className="executive-analysis">
                <RevenueTrend
                  points={series}
                  cashSynced={demo || Boolean(data.whopPayments)}
                  scopeLabel={
                    Object.entries(activeFilters).some(
                      ([key, value]) => key !== "model" && Boolean(value),
                    )
                      ? "selected acquisition cohort"
                      : "company-wide USD receipts"
                  }
                />
                <Panel
                  title="Registration sources"
                  sub="Imported WebinarJam records"
                  action={
                    <button
                      className="quiet"
                      onClick={() => setView("Attribution")}
                    >
                      Explore <ArrowUpRight size={13} />
                    </button>
                  }
                >
                  <div className="executive-sources">
                    {[...groups]
                      .filter((g) => g.registrants > 0)
                      .sort((a, b) => b.registrants - a.registrants)
                      .slice(0, 5)
                      .map((g, i) => (
                        <button key={g.name} onClick={() => drill(g.name)}>
                          <div>
                            <span>
                              <i
                                style={{
                                  background: [
                                    "#ff5539",
                                    "#6f8eaa",
                                    "#8b7fa5",
                                    "#73a08a",
                                    "#baa36e",
                                  ][i],
                                }}
                              />
                              {g.name === "(not set)" ? "Unattributed" : g.name}
                            </span>
                            <strong>{g.registrants.toLocaleString()}</strong>
                          </div>
                          <span className="executive-source-track">
                            <i
                              style={{
                                width: `${m.registrants ? (g.registrants / m.registrants) * 100 : 0}%`,
                              }}
                            />
                          </span>
                        </button>
                      ))}
                  </div>
                  <p className="executive-panel-note">
                    Registration source mix only. Revenue attribution requires a
                    verified CRM match.
                  </p>
                </Panel>
              </div>
              <Panel
                title="Recent Whop payments"
                sub="Latest successful USD payments · company-wide"
                action={
                  <button className="quiet" onClick={() => setView("Sales")}>
                    View all payments <ArrowUpRight size={13} />
                  </button>
                }
              >
                <DataTable
                  columns={[
                    { key: "date", label: "Paid at (UTC)" },
                    { key: "customer", label: "Customer" },
                    { key: "amount", label: "USD received" },
                    { key: "match", label: "CRM match" },
                    { key: "reference", label: "Payment reference" },
                  ]}
                  rows={(data.whopPayments || [])
                    .filter(
                      (p) => p.status === "succeeded" && p.currency === "USD",
                    )
                    .sort((a, b) =>
                      (b.paid_at || b.created_at).localeCompare(
                        a.paid_at || a.created_at,
                      ),
                    )
                    .slice(0, 5)
                    .map((p) => ({
                      id: p.id,
                      date: new Date(p.paid_at || p.created_at).toLocaleString(
                        "en-GB",
                        { timeZone: "UTC" },
                      ),
                      customer: p.customer_name,
                      amount: new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(p.net / 100),
                      match: matchedContact(data, p)
                        ? "Matched"
                        : "Needs matching",
                      reference: p.id,
                    }))}
                  pageSize={5}
                />
              </Panel>
              <div className="executive-footnote">
                <span>
                  Recorded calls and agreements are incomplete. These totals are
                  independent measures, not a conversion funnel.
                </span>
                <button
                  className="quiet"
                  onClick={() => setView("Data Sources")}
                >
                  Reporting definitions <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
          )}
          {view === "Attribution" && (
            <>
              <div className="view-tabs">
                {[
                  "First Touch",
                  "Last Touch",
                  "UTM",
                  "Trakyo",
                  "Campaign",
                  "Content",
                ].map((t) => (
                  <button
                    className={tab === t ? "selected" : ""}
                    key={t}
                    onClick={() => {
                      setTab(t);
                      if (t === "First Touch" || t === "Last Touch")
                        update("model", t === "First Touch" ? "first" : "last");
                    }}
                  >
                    {t}
                  </button>
                ))}
                <button
                  className="mapping-button"
                  onClick={() => setMappingOpen(true)}
                >
                  <ArrowLeftRight size={14} /> Source mappings
                </button>
              </div>
              {tab === "UTM" && (
                <div className="small-tabs">
                  {(
                    ["source", "medium", "campaign", "content"] as Dimension[]
                  ).map((t) => (
                    <button
                      key={t}
                      className={utmTab === t ? "selected" : ""}
                      onClick={() => setUtmTab(t)}
                    >
                      {label(t)}
                    </button>
                  ))}
                </div>
              )}
              <div className="attribution-charts">
                {[
                  {
                    title: "Registrations by source",
                    key: "registrants",
                    color: "#ff856d",
                  },

                  {
                    title: "Matched USD receipts by source",
                    key: "cash",
                    color: "#ff5539",
                  },
                  {
                    title: "Calendar appointments by source",
                    key: "booked",
                    color: "#3b8d69",
                  },
                  {
                    title: "Recorded agreements by source",
                    key: "sales",
                    color: "#52525b",
                  },
                ].map((c) => (
                  <Panel key={c.key} title={c.title}>
                    <div className="small-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attrGroups.slice(0, 5)}>
                          <XAxis
                            dataKey="name"
                            tickLine={false}
                            axisLine={false}
                            fontSize={10}
                            tickFormatter={(s) => String(s).slice(0, 9)}
                          />
                          <Tooltip />
                          <Bar
                            dataKey={c.key}
                            fill={c.color}
                            radius={[4, 4, 0, 0]}
                            onClick={(_d, i) => {
                              if (attrDim === "source" && tab !== "Trakyo")
                                drill(attrGroups[i]?.name);
                              else {
                                if (tab === "Trakyo")
                                  update(
                                    "trakyoSource",
                                    attrGroups[i]?.name || "",
                                  );
                                else update(attrDim, attrGroups[i]?.name || "");
                                setView("Leads");
                              }
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                ))}
              </div>
              <Panel
                title="Verified attribution breakdown"
                sub="Source activity counts are independent, not funnel stages. Recorded calls and agreements include tests and are incomplete. Raw attribution is preserved."
              >
                <DataTable
                  columns={[
                    { key: "name", label: label(attrDim) },
                    { key: "registrants", label: "Registrants" },
                    { key: "booked", label: "Calendar appointments" },
                    { key: "attended", label: "Recorded attended calls" },
                    { key: "sales", label: "Recorded agreements" },
                    { key: "contract", label: "Recorded contract value" },

                    { key: "cash", label: "Matched USD receipts" },
                  ]}
                  rows={attrGroups}
                  onRow={(r) => {
                    if (tab === "Trakyo") {
                      update("trakyoSource", String(r.name));
                      setView("Leads");
                    } else {
                      update(attrDim, String(r.name));
                      setView("Leads");
                    }
                  }}
                />
              </Panel>
            </>
          )}
          {view === "Webinars" && (
            <WebinarReports
              data={data}
              onSource={(source, webinar) => {
                setFilters({ ...defaultFilters, source, webinar });
                setQualityFilter("");
                setDrillIds(null);
                setView("Leads");
              }}
            />
          )}
          {view === "Sales" && (
            <>
              <div id="sales-payments" className="overview-section">
                <WhopPaymentHistory data={data} />
              </div>
              <div id="sales-agreements" className="overview-section">
                <Panel
                  title="Recorded Payment Desk agreements"
                  sub="Incomplete call reporting, including test activity. These records are not total company sales or verified closer performance."
                >
                  <DataTable
                    columns={[
                      { key: "name", label: "Lead" },
                      { key: "closer", label: "Closer" },
                      { key: "date", label: "Call date" },
                      { key: "attendance", label: "Attendance" },
                      { key: "outcome", label: "Outcome" },
                      { key: "offer", label: "Offer" },
                      { key: "structure", label: "Plan" },
                      { key: "contract", label: "Agreed investment" },
                      { key: "initial", label: "Initial payment" },
                      { key: "crmCash", label: "CRM-reported cash (latest call)" },
                      { key: "cash", label: "Matched USD receipts" },
                      { key: "firstPayment", label: "First matched Whop payment" },
                      { key: "source", label: "UTM source" },
                      { key: "trakyo", label: "Trakyo source" },
                      { key: "webinar", label: "Webinar" },
                    ]}
                    rows={salesRows}
                    onRow={(r) =>
                      setLead(data.contacts.find((c) => c.id === r.id) || null)
                    }
                  />
                </Panel>
              </div>
            </>
          )}
          {view === "Leads" && (
            <>
              <div className="section-label">
                <span>
                  {selectedLeads.length} canonical contacts{" "}
                  {qualityFilter && "· data quality filter"}
                </span>
                {qualityFilter && (
                  <button
                    className="quiet"
                    onClick={() => setQualityFilter("")}
                  >
                    Clear quality filter <X size={12} />
                  </button>
                )}
              </div>
              <Panel
                title="Your audience, connected"
                sub="Identity, touchpoints and outcomes in one normalized record"
              >
                <DataTable
                  columns={[
                    { key: "name", label: "Contact" },
                    { key: "email", label: "Email" },
                    { key: "source", label: "Attributed source" },
                    { key: "campaign", label: "Campaign" },
                    { key: "registrants", label: "Registrations" },
                    { key: "booked", label: "Calls booked" },

                    { key: "cash", label: "Matched USD receipts" },
                  ]}
                  rows={selectedLeads.map((c) => ({
                    id: c.id,
                    name: `${c.first_name} ${c.last_name}`,
                    email: c.email || "Missing email",
                    ...dimensions(data, c.id, filters),
                    ...metrics(data, [c], filters),
                  }))}
                  onRow={(r) =>
                    setLead(data.contacts.find((c) => c.id === r.id) || null)
                  }
                />
              </Panel>
            </>
          )}
          {view === "Data Sources" && (
            <>
              <section id="overview-quality" className="overview-section">
                <div className="overview-section-heading">
                  <div>
                    <h2>Revenue matching & reporting coverage</h2>
                    <p>
                      Coverage gaps stay visible without interrupting your main
                      metrics.
                    </p>
                  </div>
                  <button
                    className="quiet"
                    onClick={() => setView("Data Sources")}
                  >
                    Manage sources <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="quality-summary">
                  {metricTile(1)}
                  <div className="quality-context">
                    <strong>Reporting boundaries</strong>
                    <p>
                      Payment Desk call and agreement records are incomplete and
                      include test activity. WebinarJam Analytics and imported
                      registration records have different totals; the session
                      report shows the reconciliation.
                    </p>
                    <button
                      className="quiet"
                      onClick={() => setView("Webinars")}
                    >
                      Review webinar data <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
                {data.whopPayments && (
                  <div className="payment-coverage-note">
                    <strong>Live Whop USD history included.</strong>{" "}
                    {usd(
                      data.whopPayments
                        .filter(
                          (p) =>
                            p.status === "succeeded" &&
                            p.currency === "USD" &&
                            !matchedContact(data, p),
                        )
                        .reduce((sum, p) => sum + p.net, 0),
                    )}{" "}
                    has no verified CRM match and is excluded from source/closer
                    attribution.{" "}
                    {
                      data.whopPayments.filter(
                        (p) => p.status === "succeeded" && p.currency !== "USD",
                      ).length
                    }{" "}
                    non-USD payments are shown separately in Sales → Whop
                    payment history.
                  </div>
                )}
                <details className="coverage-details">
                  <summary>Source definitions & activity breakdown</summary>
                  <Panel
                    title="Activity & reporting coverage"
                    sub="Independent counts, not a conversion funnel. Different systems have different coverage."
                  >
                    <div className="activity-coverage">
                      {[
                        {
                          name: "CRM leads",
                          count: m.leads,
                          source: "Imported GHL / linked contacts",
                        },
                        {
                          name: "Registration records",
                          count: m.registrants,
                          source: "WebinarJam individual API records",
                        },
                        {
                          name: "Active appointments",
                          count: m.booked,
                          source:
                            "Selected GHL calendar · cancellations excluded",
                        },
                        {
                          name: "Recorded attended calls",
                          count: m.attended,
                          source: "Payment Desk · incomplete · includes tests",
                        },
                        {
                          name: "Recorded agreements",
                          count: m.sales,
                          source: "Payment Desk · includes tests",
                        },
                      ].map((row) => (
                        <div key={row.name}>
                          <div>
                            <strong>{row.name}</strong>
                            <small>{row.source}</small>
                          </div>
                          <b>{row.count.toLocaleString()}</b>
                        </div>
                      ))}
                    </div>
                  </Panel>{" "}
                </details>
              </section>

              <div className="source-grid">
                {[
                  {
                    key: "ghl",
                    name: "GoHighLevel",
                    letter: "G",
                    desc: "Contacts & CRM activity",
                    tone: "orange",
                  },
                  {
                    key: "trakyo",
                    name: "Trakyo",
                    letter: "T",
                    desc: "Marketing touchpoints",
                    tone: "purple",
                  },
                  {
                    key: "webinars",
                    name: "WebinarJam",
                    letter: "W",
                    desc: "Webinar registrations",
                    tone: "rose",
                  },
                  {
                    key: "whop",
                    name: "Whop / Payment Desk",
                    letter: "w",
                    desc: "Live Whop payment history + Payment Desk agreements",
                    tone: "gray",
                  },
                ].map((s) => {
                  const run = data.syncRuns
                    .filter((r) => r.source === s.key)
                    .sort((a, b) =>
                      b.started_at.localeCompare(a.started_at),
                    )[0];
                  return (
                    <Panel
                      key={s.key}
                      title={s.name}
                      sub={s.desc}
                      action={
                        <span className={`provider-icon ${s.tone}`}>
                          {s.letter}
                        </span>
                      }
                    >
                      <div className="source-card-body">
                        <span
                          className={`source-pill ${run?.status === "failed" ? "bad" : ""}`}
                        >
                          <span className="status-dot" />
                          {demo
                            ? "Demo dataset"
                            : run?.status
                              ? label(run.status)
                              : "Not connected"}
                        </span>
                        <dl>
                          <div>
                            <dt>Last completed</dt>
                            <dd>
                              {run?.completed_at && !demo
                                ? new Date(run.completed_at).toLocaleString()
                                : "Not synced"}
                            </dd>
                          </div>
                          <div>
                            <dt>Records processed</dt>
                            <dd>{run?.records_processed || 0}</dd>
                          </div>
                          <div>
                            <dt>Failed records</dt>
                            <dd>{run?.records_failed || 0}</dd>
                          </div>
                        </dl>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() => sync(s.key)}
                        >
                          <RefreshCw size={13} />{" "}
                          {run?.status === "failed" ? "Retry sync" : "Sync now"}
                        </button>
                        <p className="source-note">
                          {s.key === "ghl"
                            ? "Contact identity + attribution importer available. Historical call events require an event feed."
                            : s.key === "trakyo"
                              ? "Lead identity and first/last marketing touches. Requires leads:read."
                              : s.key === "webinars"
                                ? "Selected webinar registrations. Peak and pitch attendance are not supplied by this importer."
                                : "Imports live calls, sales and successful receipts from the Payment Desk ledger."}
                        </p>
                      </div>
                    </Panel>
                  );
                })}
              </div>
              <Panel
                title="Contact data quality"
                sub="Resolve gaps before they become reporting blind spots"
              >
                <div className="quality-grid">
                  {[
                    { key: "missingAttribution", name: "Missing attribution" },
                    { key: "missingEmail", name: "Missing email" },
                    { key: "missingGhl", name: "Missing GHL ID" },
                    { key: "duplicates", name: "Duplicate email candidates" },
                    { key: "unmapped", name: "Sources to normalize" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setQualityFilter(item.key);
                        setView("Leads");
                      }}
                    >
                      <AlertCircle size={15} />
                      <span>{item.name}</span>
                      <strong>{q[item.key as keyof typeof q].length}</strong>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
                <div className="info-line">
                  Unmatched registrations and identity conflicts are rejected
                  during ingestion rather than assigned to the wrong person.
                </div>
              </Panel>
              <Panel
                title="Sync history"
                sub="Failed batches remain visible and can be retried safely"
              >
                <DataTable
                  columns={[
                    { key: "source", label: "Source" },
                    { key: "status", label: "Status" },
                    { key: "started_at", label: "Started" },
                    { key: "records_processed", label: "Processed" },
                    { key: "records_failed", label: "Failed" },
                    { key: "error", label: "Details" },
                  ]}
                  rows={data.syncRuns.map((r) => ({ ...r }))}
                />
              </Panel>
            </>
          )}
          <footer>
            <span>
              <Layers size={12} /> Creator Society Revenue Intelligence
            </span>
            <span>
              {demo ? "Demo dataset · USD" : "Normalized data · USD"}{" "}
              <span>•</span> Amounts stored in cents
            </span>
          </footer>
        </main>
      </div>
      {mappingOpen && (
        <div className="overlay" onClick={() => setMappingOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Source normalization mappings"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">NORMALIZATION LAYER</div>
                <h2>Make your sources consistent.</h2>
              </div>
              <button
                aria-label="Close mappings"
                className="icon-button"
                onClick={() => setMappingOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="muted">
              Mappings are exact and case-sensitive. Raw values are always
              preserved.
            </p>
            <form onSubmit={saveMapping} className="mapping-form">
              <SelectControl
                aria-label="Mapping dimension"
                value={mappingDim}
                onValueChange={(value) => setMappingDim(value as Dimension)}
              >
                {["source", "medium", "campaign", "content"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </SelectControl>
              <input
                placeholder="Raw value, e.g. IG"
                aria-label="Raw value"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                required
              />
              <ArrowRight size={15} />
              <input
                placeholder="Normalized value"
                aria-label="Normalized value"
                value={normalized}
                onChange={(e) => setNormalized(e.target.value)}
                required
              />
              <button className="button primary">Save mapping</button>
            </form>
            <DataTable
              columns={[
                { key: "dimension", label: "Dimension" },
                { key: "raw_value", label: "Raw value" },
                { key: "normalized_value", label: "Normalized value" },
              ]}
              rows={data.mappings.map((m) => ({ ...m }))}
            />
          </section>
        </div>
      )}
      {lead && (
        <div className="overlay drawer-overlay" onClick={() => setLead(null)}>
          <aside
            className="lead-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Lead profile"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-top">
              <span>CANONICAL CONTACT</span>
              <button
                className="icon-button"
                aria-label="Close contact"
                onClick={() => setLead(null)}
              >
                <X size={20} />
              </button>
            </div>
            <span className="lead-avatar">
              {lead.first_name[0]}
              {lead.last_name[0]}
            </span>
            <h2>
              {lead.first_name} {lead.last_name}
            </h2>
            <p className="muted">{lead.email || "Email not available"}</p>
            <div className="profile-kpis">
              <span>
                Agreed investment
                <strong>{usd(metrics(data, [lead]).contract)}</strong>
              </span>
              <span>
                Whop-matched receipts<strong>{usd(metrics(data, [lead]).cash)}</strong>
              </span>
            </div>
            <h3>Identity</h3>
            <dl className="profile-details">
              {[
                ["Internal ID", lead.id],
                ["GHL Contact ID", lead.ghl_contact_id],
                ["Phone", lead.phone],
                ["Trakyo lead ID", lead.trakyo_id],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v || "Not available"}</dd>
                </div>
              ))}
            </dl>
            <h3>Attribution history</h3>
            {(["first", "last"] as const).map((model) => {
              const t = touchFor(data, lead.id, model);
              return (
                <div className="touch-card" key={model}>
                  <span>
                    {model === "first" ? "FIRST TOUCH" : "LAST TOUCH"}
                  </span>
                  <strong>
                    {t ? label(normalize(t.source, "source", data)) : "Not set"}
                  </strong>
                  <p>
                    {t
                      ? [t.medium, t.campaign, t.content]
                          .filter(Boolean)
                          .join(" / ")
                      : "No recorded touch"}
                  </p>
                  {t && (
                    <small>
                      Raw source: {t.source} · {t.provider}
                    </small>
                  )}
                </div>
              );
            })}
            <h3>Journey timeline</h3>
            <div className="timeline">
              {[
                {
                  date: lead.created_at,
                  name: "Lead created",
                  detail: "Canonical identity established",
                },
                ...data.registrations
                  .filter((r) => r.contact_id === lead.id)
                  .map((r) => ({
                    date: r.registered_at,
                    name: "Webinar registered",
                    detail:
                      data.webinars.find((w) => w.id === r.webinar_id)?.name ||
                      r.webinar_id,
                  })),
                ...data.appointments
                  .filter((a) => a.contact_id === lead.id)
                  .map((a) => ({
                    date: a.booked_at,
                    name: "Call booked",
                    detail: a.closer,
                  })),
                ...data.calls
                  .filter((c) => c.contact_id === lead.id)
                  .map((c) => ({
                    date: c.call_date,
                    name: label(c.attendance),
                    detail: `${c.closer} · ${label(c.outcome || "No outcome")}`,
                    url: c.recording_url,
                  })),
                ...data.sales
                  .filter((s) => s.contact_id === lead.id)
                  .map((s) => ({
                    date: s.sold_at,
                    name: "Sale agreed",
                    detail: `${s.offer} · ${usd(s.contract_value)}`,
                  })),
                ...reportingPayments(data)
                  .filter((p) => p.contact_id === lead.id)
                  .map((p) => ({
                    date: p.paid_at,
                    name:
                      p.status === "succeeded"
                        ? "Payment received"
                        : label(p.status),
                    detail: `${usd(p.amount)} · ${p.external_payment_id}`,
                  })),
              ]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((event, i) => (
                  <div className="timeline-event" key={i}>
                    <span className="timeline-dot" />
                    <small>{shortDate(event.date)}</small>
                    <strong>{event.name}</strong>
                    <p>{event.detail}</p>
                    {"url" in event &&
                      typeof event.url === "string" &&
                      /^https:\/\//.test(event.url) && (
                        <a href={event.url} target="_blank" rel="noreferrer">
                          Call recording <ExternalLink size={12} />
                        </a>
                      )}
                  </div>
                ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
