"use client";

import {
  EXIT_STATUSES,
  REPORT_DEFAULT_COLUMNS,
  REPORT_EXTRA_COLUMNS,
  REPORT_INFO,
  REPORT_TYPES,
  WORKER_STATUS_LABELS,
  type ReportDto,
  type ReportMetaDto,
  type ReportType,
} from "@xperts/shared";
import { FileSpreadsheet, GripVertical } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, PageHeader } from "@/components/design/primitives";
import { ExportButton } from "@/components/export-button";
import { LoadingText } from "@/components/skeletons";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldControl } from "@/components/ui/field-control";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const ALL = "__all";
const PREVIEW_ROWS = 300;

type Filters = {
  type: ReportType;
  campId: string;
  clientId: string;
  departmentId: string;
  asOf: string;
  from: string;
  to: string;
  exitStatus: string;
  includeVacant: boolean;
  columns: string[] | null;
};

/** Which filters each report uses. */
const FILTERS: Record<ReportType, { camp?: boolean; client?: boolean; division?: boolean; asOf?: boolean; period?: boolean; exitType?: boolean; vacant?: boolean }> = {
  occupancy: { camp: true, client: true, asOf: true, vacant: true },
  workers_by_client: { camp: true, client: true, division: true },
  on_leave: { camp: true, client: true, asOf: true },
  exits: { period: true, exitType: true, camp: true, client: true },
  vacancy: { camp: true, asOf: true },
};

function toQuery(f: Filters, columns: string[]): URLSearchParams {
  const p = new URLSearchParams({ type: f.type });
  const use = FILTERS[f.type];
  if (use.camp && f.campId) p.set("campId", f.campId);
  if (use.client && f.clientId) p.set("clientId", f.clientId);
  if (use.division && f.clientId && f.departmentId) p.set("departmentId", f.departmentId);
  if (use.asOf && f.asOf) p.set("asOf", f.asOf);
  if (use.period && f.from) p.set("from", f.from);
  if (use.period && f.to) p.set("to", f.to);
  if (use.exitType && f.exitStatus) p.set("exitStatus", f.exitStatus);
  if (use.vacant && !f.includeVacant) p.set("includeVacant", "false");
  if (f.type !== "vacancy" && columns.length) p.set("columns", columns.join(","));
  return p;
}

/**
 * Report builder: pick a report, set filters, choose and order columns (built-in + custom fields), check the
 * live preview, then export the full report to Excel. The state lives in the URL so a report can be shared.
 */
export function ReportBuilder({ meta, initial }: { meta: ReportMetaDto; initial: Filters }) {
  const [f, setF] = useState<Filters>(initial);
  const set = (patch: Partial<Filters>) => setF((prev) => ({ ...prev, ...patch }));

  const pickable = useMemo(
    () => [...meta.columns.map(({ key, label }) => ({ key, label })), ...REPORT_EXTRA_COLUMNS[f.type]],
    [meta.columns, f.type],
  );
  const columns = useMemo(() => {
    const allowed = new Set(pickable.map((c) => c.key));
    const chosen = (f.columns ?? REPORT_DEFAULT_COLUMNS[f.type]).filter((k) => allowed.has(k));
    return chosen.length ? chosen : REPORT_DEFAULT_COLUMNS[f.type].filter((k) => allowed.has(k));
  }, [f.columns, f.type, pickable]);

  const qs = toQuery(f, columns).toString();
  const [report, setReport] = useState<ReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live preview: debounced, newest request wins. URL is kept in sync for sharing.
  const latest = useRef(0);
  useEffect(() => {
    window.history.replaceState(null, "", `/reports?${qs}`);
    const id = ++latest.current;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api<ReportDto>(`/reports?${qs}&limit=${PREVIEW_ROWS}`);
        if (id === latest.current) {
          setReport(data);
          setError(null);
        }
      } catch (e) {
        if (id === latest.current) setError(errorMessage(e));
      } finally {
        if (id === latest.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [qs]);

  const departments = meta.clients.find((c) => c.id === f.clientId)?.departments ?? [];
  const use = FILTERS[f.type];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reports"
        subtitle="Pick a report, choose columns and filters, check the preview, then export."
        actions={<ExportButton href={`/api/reports/export.xlsx?${qs}`} fallbackName={`${f.type}.xlsx`} variant="default" disabled={!!error} />}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          {/* 1 · Report */}
          <Step n={1} title="Report">
            <div role="radiogroup" aria-label="Report" className="flex flex-col gap-2">
              {REPORT_TYPES.map((t) => {
                const on = f.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ type: t, columns: null })}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                      on ? "border-primary bg-status-occupied-bg" : "hover:bg-muted/60",
                    )}
                  >
                    <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-input")}>
                      {on && <span className="size-2 rounded-full bg-primary" />}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{REPORT_INFO[t].title}</span>
                      <span className="text-xs text-muted-foreground">{REPORT_INFO[t].description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>

          {/* 2 · Filters */}
          <Step n={2} title="Filters">
            <div className="grid grid-cols-2 gap-3">
              {use.period && (
                <>
                  <Field label="From">
                    <Input type="date" value={f.from} max={meta.today} onChange={(e) => set({ from: e.target.value })} />
                  </Field>
                  <Field label="To">
                    <Input type="date" value={f.to} max={meta.today} onChange={(e) => set({ to: e.target.value })} />
                  </Field>
                  <Field label="Exit type" wide>
                    <Choice
                      value={f.exitStatus}
                      onChange={(v) => set({ exitStatus: v })}
                      allLabel="All exit types"
                      options={EXIT_STATUSES.map((s) => ({ value: s, label: WORKER_STATUS_LABELS[s] }))}
                    />
                  </Field>
                </>
              )}
              {use.camp && (
                <Field label="Camp" wide>
                  <Choice value={f.campId} onChange={(v) => set({ campId: v })} allLabel="All camps" options={meta.camps.map((c) => ({ value: c.id, label: c.name }))} />
                </Field>
              )}
              {use.client && (
                <Field label="Client" wide={!use.asOf}>
                  <Choice
                    value={f.clientId}
                    onChange={(v) => set({ clientId: v, departmentId: "" })}
                    allLabel="All"
                    options={meta.clients.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </Field>
              )}
              {use.asOf && (
                <Field label="As of" wide={!use.client}>
                  <Input type="date" value={f.asOf || meta.today} max={meta.today} onChange={(e) => set({ asOf: e.target.value === meta.today ? "" : e.target.value })} />
                </Field>
              )}
              {use.division && (
                <Field label="Division" wide>
                  <Choice
                    value={f.departmentId}
                    onChange={(v) => set({ departmentId: v })}
                    allLabel={f.clientId ? "All divisions" : "Choose a client first"}
                    disabled={!f.clientId}
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  />
                </Field>
              )}
            </div>
            {use.vacant && (
              <label className="mt-1 flex items-center gap-2.5 text-[13px] font-medium">
                <Checkbox checked={f.includeVacant} onCheckedChange={(on) => set({ includeVacant: on === true })} />
                Include vacant beds as empty rows
              </label>
            )}
            {use.period && !f.from && <p className="text-xs text-muted-foreground">Empty “From” = first day of this month; empty “To” = today.</p>}
          </Step>

          {/* 3 · Columns */}
          <Step n={3} title="Columns" aside={f.type === "vacancy" ? "fixed for this report" : `${columns.length} selected · drag to order`}>
            {f.type === "vacancy" ? (
              <p className="text-[13px] text-muted-foreground">Vacant beds have no worker, so this report always shows camp, room, bed, bed type and how long it has been empty.</p>
            ) : (
              <ColumnPicker pickable={pickable} selected={columns} onChange={(next) => set({ columns: next })} />
            )}
          </Step>
        </div>

        {/* Preview */}
        <section aria-label="Report preview" aria-busy={loading} className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <header className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Preview · {REPORT_INFO[f.type].title}</h2>
              <p className="text-[13px] text-muted-foreground">{report?.type === f.type ? report.subtitle : "…"}</p>
            </div>
            {report && !error && (
              <p className="text-[13px] text-muted-foreground">
                {report.shownRows < report.totalRows
                  ? `Showing ${report.shownRows.toLocaleString()} of ${report.totalRows.toLocaleString()} rows · export has all`
                  : `${report.totalRows.toLocaleString()} row${report.totalRows === 1 ? "" : "s"}`}
              </p>
            )}
          </header>
          <div className={cn("relative transition-opacity", loading && report && "opacity-60")}>
            {error ? (
              <p role="alert" className="p-6 text-sm font-medium text-destructive">
                {error}
              </p>
            ) : !report ? (
              <LoadingText className="p-10">Building report…</LoadingText>
            ) : report.totalRows === 0 ? (
              <div className="p-5">
                <EmptyState icon={<FileSpreadsheet className="size-5" />} title="Nothing to show">
                  No rows match these filters{FILTERS[f.type].asOf ? " on this date" : ""}. Try another camp, client or date.
                </EmptyState>
              </div>
            ) : (
              <ReportTable report={report} />
            )}
            {loading && report && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                <LoadingText className="rounded-full border bg-card px-3 py-1 text-xs shadow-sm">Updating…</LoadingText>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ReportTable({ report }: { report: ReportDto }) {
  return (
    <div className="max-h-[calc(100vh-220px)] overflow-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            {report.columns.map((c) => (
              <th key={c.key} scope="col" className="px-4 py-2.5 text-left text-[12.5px] font-semibold whitespace-nowrap text-muted-foreground">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.groups.map((g, gi) => (
            <GroupRows key={gi} group={g} span={report.columns.length} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ group, span }: { group: ReportDto["groups"][number]; span: number }) {
  return (
    <>
      <tr className="border-y bg-secondary/70">
        <th scope="rowgroup" colSpan={span} className="px-4 py-2 text-left text-[13px] font-bold">
          {group.label}
          <span className="font-normal text-muted-foreground"> · {group.summary}</span>
        </th>
      </tr>
      {group.rows.map((row, ri) => (
        <tr
          key={ri}
          className={cn(
            "border-b last:border-b-0",
            row.tone === "held" && "bg-row-leave",
            row.tone === "exited" && "bg-row-exited text-muted-foreground",
          )}
        >
          {row.cells.map((cell, ci) => (
            <td key={ci} className={cn("px-4 py-2 whitespace-nowrap", ci === 0 && "font-semibold", row.tone === "vacant" && "font-semibold text-status-vacant-fg")}>
              {display(cell)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** ISO dates read better as "3 Oct 2026"; everything else as-is. */
function display(value: string | null): string {
  if (value === null || value === "") return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : value;
}

/** Ticked columns first (draggable, in order), then the rest. Alt+←/→ moves a focused column. */
function ColumnPicker({
  pickable,
  selected,
  onChange,
}: {
  pickable: { key: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const label = new Map(pickable.map((c) => [c.key, c.label]));
  const unselected = pickable.filter((c) => !selected.includes(c.key));
  const [dragging, setDragging] = useState<string | null>(null);

  function move(key: string, to: number) {
    const next = selected.filter((k) => k !== key);
    next.splice(Math.max(0, Math.min(to, next.length)), 0, key);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {selected.map((key, i) => (
        <span
          key={key}
          draggable
          onDragStart={(e) => {
            setDragging(key);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => setDragging(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragging && dragging !== key) move(dragging, i);
          }}
          className={cn(
            "flex h-8 cursor-grab items-center gap-1.5 rounded-lg border border-primary/40 bg-status-occupied-bg pr-2 pl-1 text-[13px] font-semibold active:cursor-grabbing",
            dragging === key && "opacity-50",
          )}
        >
          <GripVertical className="size-3.5 text-muted-foreground" aria-hidden />
          <Checkbox
            checked
            aria-label={`${label.get(key)} — remove column (Alt+arrow keys to move)`}
            disabled={selected.length === 1}
            onCheckedChange={() => onChange(selected.filter((k) => k !== key))}
            onKeyDown={(e) => {
              if (!e.altKey) return;
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(key, i - 1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                move(key, i + 1);
              }
            }}
          />
          {label.get(key)}
        </span>
      ))}
      {unselected.map((c) => (
        <label key={c.key} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-2 text-[13px] font-medium text-muted-foreground hover:bg-muted/60">
          <Checkbox checked={false} onCheckedChange={() => onChange([...selected, c.key])} />
          {c.label}
        </label>
      ))}
    </div>
  );
}

function Step({ n, title, aside, children }: { n: number; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-base font-bold">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
          {title}
        </h2>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <FieldControl>
      {(id) => (
        <div className={cn("flex min-w-0 flex-col gap-1.5", wide && "col-span-2")}>
          <Label htmlFor={id} className="text-[13px]">
            {label}
          </Label>
          {children}
        </div>
      )}
    </FieldControl>
  );
}

function Choice({
  value,
  onChange,
  options,
  allLabel,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
  disabled?: boolean;
}) {
  const items = [{ value: ALL, label: allLabel }, ...options];
  return (
    <Select items={items} value={value || ALL} onValueChange={(v) => onChange(!v || v === ALL ? "" : String(v))} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
