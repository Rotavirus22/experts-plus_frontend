"use client";

import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS, type AuditAction, type AuditEntryDto, type AuditMetaDto, type AuditPageDto } from "@xperts/shared";
import { ChevronRight, History, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Pill } from "@/components/design/primitives";
import { ExportButton } from "@/components/export-button";
import { LoadingText } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { FieldControl } from "@/components/ui/field-control";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { auditQueryString, defaultAuditFilters, type AuditFilters } from "./audit-filters";

const ALL = "__all";
type Tone = "muted" | "primary" | "warning" | "success" | "danger" | "info" | "accent";
const TONE: Record<string, Tone> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "danger",
  HIDE: "muted",
  UNHIDE: "muted",
  INVALIDATE: "muted",
  ASSIGN: "info",
  MOVE: "info",
  EXIT: "danger",
  LEAVE_START: "warning",
  LEAVE_RETURN: "success",
  PASSWORD_CHANGE: "accent",
};

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "long", day: "numeric", month: "short", year: "numeric" });
const timeLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Audit log: every change, who made it and what it was before. Filters apply as you change them. */
export function AuditView({ meta, initial }: { meta: AuditMetaDto; initial: AuditPageDto }) {
  const [filters, setFilters] = useState<AuditFilters>(() => defaultAuditFilters(meta.today));
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<AuditEntryDto[]>(initial.entries);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set(initial.entries[0] ? [initial.entries[0].id] : []));
  const set = (patch: Partial<AuditFilters>) => setFilters((f) => ({ ...f, ...patch }));

  // Debounced search box.
  useEffect(() => {
    const t = window.setTimeout(() => set({ q: search.trim() }), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  // Reload the first page whenever filters change (skip the very first render: the server sent it).
  const qs = auditQueryString(filters);
  const first = useRef(true);
  const latest = useRef(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = ++latest.current;
    setLoading(true);
    api<AuditPageDto>(`/audit?${qs}`)
      .then((page) => {
        if (id !== latest.current) return;
        setEntries(page.entries);
        setCursor(page.nextCursor);
      })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => id === latest.current && setLoading(false));
  }, [qs]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api<AuditPageDto>(`/audit?${auditQueryString(filters, cursor)}`);
      setEntries((prev) => [...prev, ...page.entries]);
      setCursor(page.nextCursor);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  const days = useMemo(() => {
    const groups: { key: string; label: string; entries: AuditEntryDto[] }[] = [];
    for (const e of entries) {
      const key = dayKey.format(new Date(e.at));
      let g = groups.at(-1);
      if (!g || g.key !== key) {
        g = { key, label: relativeDay(key, meta.today, dayLabel.format(new Date(e.at))), entries: [] };
        groups.push(g);
      }
      g.entries.push(e);
    }
    return groups;
  }, [entries, meta.today]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Audit log"
        subtitle="Every change, who made it and what it was before. Times in Dubai (GST)."
        actions={<ExportButton href={`/api/audit/export.xlsx?${qs}`} fallbackName="audit-log.xlsx" />}
      />

      <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-sm md:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.6fr)]">
        <Filter label="From">
          <Input type="date" value={filters.from} max={filters.to || meta.today} onChange={(e) => set({ from: e.target.value })} />
        </Filter>
        <Filter label="To">
          <Input type="date" value={filters.to} min={filters.from} max={meta.today} onChange={(e) => set({ to: e.target.value })} />
        </Filter>
        <Filter label="User">
          <Choice value={filters.actorId} onChange={(v) => set({ actorId: v })} allLabel="Anyone" options={meta.users.map((u) => ({ value: u.id, label: u.name }))} />
        </Filter>
        <Filter label="Action">
          <Choice value={filters.action} onChange={(v) => set({ action: v })} allLabel="All" options={AUDIT_ACTIONS.map((a) => ({ value: a, label: AUDIT_ACTION_LABELS[a] }))} />
        </Filter>
        <Filter label="Entity">
          <Choice value={filters.entityType} onChange={(v) => set({ entityType: v })} allLabel="All" options={meta.entityTypes} />
        </Filter>
        <Filter label="Search" wide>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Worker, Emp No, camp or room" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </Filter>
      </div>

      <section aria-label="Audit entries" aria-busy={loading} className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm transition-opacity", loading && "opacity-60")}>
        {entries.length === 0 ? (
          loading ? (
            <LoadingText className="p-10">Loading…</LoadingText>
          ) : (
            <div className="p-5">
              <EmptyState icon={<History className="size-5" />} title="No changes match">
                Try a wider date range or clear the filters.
              </EmptyState>
            </div>
          )
        ) : (
          <>
            {days.map((day) => (
              <div key={day.key}>
                <h2 className="border-y bg-muted px-5 py-2 text-[11.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase first:border-t-0">{day.label}</h2>
                <ul className="divide-y">
                  {day.entries.map((e) => (
                    <Entry key={e.id} entry={e} open={open.has(e.id)} onToggle={() => toggle(e.id)} />
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex justify-center border-t p-4">
              {cursor ? (
                <Button variant="outline" onClick={loadMore} loading={loadingMore}>
                  {loadingMore ? "Loading…" : "Load older entries"}
                </Button>
              ) : (
                <p className="text-[13px] text-muted-foreground">That’s everything for these filters.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Entry({ entry: e, open, onToggle }: { entry: AuditEntryDto; open: boolean; onToggle: () => void }) {
  const expandable = e.changes.length > 0;
  return (
    <li className={cn(open && expandable && "bg-muted/30")}>
      <div className="grid grid-cols-[52px_1fr_auto] items-start gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[52px_minmax(0,170px)_150px_minmax(0,1fr)_28px] md:items-center">
        <time dateTime={e.at} className="font-mono text-[13px] text-muted-foreground">
          {timeLabel.format(new Date(e.at))}
        </time>
        <span className="truncate text-sm font-semibold">{e.actorName}</span>
        <span className="row-start-2 md:row-start-auto">
          <Pill tone={TONE[e.action] ?? "muted"}>{AUDIT_ACTION_LABELS[e.action as AuditAction] ?? e.action}</Pill>
        </span>
        <p className="col-span-2 min-w-0 text-sm md:col-span-1">
          {e.href ? (
            <Link href={e.href} className="font-semibold underline-offset-2 hover:underline">
              {e.subject}
            </Link>
          ) : (
            <span className="font-semibold">{e.subject}</span>
          )}
          <span className="text-muted-foreground"> · {e.detail}</span>
        </p>
        {expandable ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? "Hide changes" : "Show changes"}
            className="col-start-3 row-start-1 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:col-start-auto md:row-start-auto"
          >
            <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <span />
        )}
      </div>
      {open && expandable && (
        <div className="px-5 pb-4 md:pl-[88px]">
          <table className="w-full overflow-hidden rounded-lg border text-[13px]">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th scope="col" className="w-1/5 px-3 py-1.5 font-semibold">
                  Field
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold">
                  Before
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold">
                  After
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {e.changes.map((c, i) => (
                <tr key={i}>
                  <th scope="row" className="px-3 py-1.5 text-left font-semibold">
                    {c.field}
                  </th>
                  <td className="bg-[color-mix(in_oklab,var(--destructive)_7%,var(--card))] px-3 py-1.5 text-muted-foreground">
                    {c.before === null ? "—" : <span className="line-through decoration-1">{c.before}</span>}
                  </td>
                  <td className="bg-[color-mix(in_oklab,var(--status-vacant)_9%,var(--card))] px-3 py-1.5">{c.after ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

function relativeDay(key: string, today: string, label: string): string {
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (key === today) return `Today · ${label}`;
  if (key === yesterday) return `Yesterday · ${label}`;
  return label;
}

function Filter({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <FieldControl>
      {(id) => (
        <div className={cn("flex min-w-0 flex-col gap-1.5", wide && "col-span-2 md:col-span-3 lg:col-span-1")}>
          <Label htmlFor={id} className="text-[13px]">
            {label}
          </Label>
          {children}
        </div>
      )}
    </FieldControl>
  );
}

function Choice({ value, onChange, options, allLabel }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allLabel: string }) {
  const items = [{ value: ALL, label: allLabel }, ...options];
  return (
    <Select items={items} value={value || ALL} onValueChange={(v) => onChange(!v || v === ALL ? "" : String(v))}>
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
