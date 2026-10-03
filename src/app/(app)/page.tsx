import {
  EMIRATE_LABELS,
  hasPermission,
  PERMISSIONS,
  WORKER_STATUS_LABELS,
  type DashboardDto,
  type Permission,
} from "@xperts/shared";
import { AlertTriangle, Check, FileSpreadsheet, Plus, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { FadeIn, KpiCard, OccupancyBar, percentInUse, Pill, SectionLabel } from "@/components/design/primitives";
import { buttonVariants } from "@/components/ui/button";
import { daysBetween, formatDate, formatLongDate, formatShortDate, plural } from "@/lib/format";
import { getMe, serverApi } from "@/lib/server-api";
import { cn } from "@/lib/utils";

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  if (hours < 48) return "Yesterday";
  return formatShortDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date(iso)));
}

const ACTIVITY_DOT: Record<string, string> = {
  move: "bg-status-occupied",
  exit: "bg-destructive",
  leave: "bg-status-held",
  invalidate: "bg-status-invalid",
  create: "bg-status-vacant",
  other: "bg-muted-foreground",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [me, d, params] = await Promise.all([getMe(), serverApi<DashboardDto>("/dashboard"), searchParams]);
  const granted = (me.access.isSystemAdmin ? Object.keys(PERMISSIONS) : me.access.permissions) as Permission[];
  const exitBreakdown = Object.entries(d.workers.exitedThisMonthByStatus)
    .map(([s, n]) => `${n} ${WORKER_STATUS_LABELS[s as keyof typeof WORKER_STATUS_LABELS].toLowerCase()}`)
    .join(" · ");
  const occupancy = percentInUse(d.beds);
  const canWorkers = hasPermission(me.access, "workers.view");

  return (
    <div className="flex flex-col gap-6">
      {params.denied && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-fg">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-bold">You don&apos;t have access to that page.</span> Your role ({me.roleName ?? "no role"}) can&apos;t open it, so we
            brought you to the dashboard. Ask an administrator if you need it.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em]">
            {greeting()}, {me.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">{formatLongDate(d.today)} · Dubai. Here is where every bed stands today.</p>
        </div>
        <div className="flex gap-2">
          {hasPermission(me.access, "reports.view") && (
            <Link href="/reports" className={buttonVariants({ variant: "outline" })}>
              <FileSpreadsheet data-icon="inline-start" /> Occupancy sheet
            </Link>
          )}
          {hasPermission(me.access, "workers.manage") && (
            <Link href="/workers/new" className={buttonVariants()}>
              <Plus data-icon="inline-start" /> Add worker
            </Link>
          )}
        </div>
      </div>

      <GettingStarted d={d} access={me.access} />

      {canWorkers && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Workers</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <FadeIn index={0}>
              <KpiCard label="Active workers" dot="bg-primary" value={d.workers.active.toLocaleString()} caption={d.workers.joinedThisWeek ? `+${d.workers.joinedThisWeek} joined this week` : "None joined this week"} />
            </FadeIn>
            <FadeIn index={1}>
              <KpiCard label="Housed" dot="bg-status-occupied" value={d.workers.housed.toLocaleString()} caption="In a bed and present" />
            </FadeIn>
            <FadeIn index={2}>
              <KpiCard label="On leave" dot="bg-status-vacant" value={d.workers.onLeave.toLocaleString()} caption="Beds held for them" />
            </FadeIn>
            <FadeIn index={3}>
              <KpiCard label="Without a bed" dot="bg-warning" value={d.workers.withoutBed.toLocaleString()} caption={me.access.isSystemAdmin || me.access.campScope === "ALL" ? "Need assigning" : "Assign them from a vacant bed"} />
            </FadeIn>
            <FadeIn index={4}>
              <KpiCard label="Exited this month" dot="bg-status-invalid" value={d.workers.exitedThisMonth.toLocaleString()} caption={exitBreakdown || "None yet"} />
            </FadeIn>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionLabel>
          Beds · {d.beds.camps} camp{d.beds.camps === 1 ? "" : "s"}
        </SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <FadeIn index={0}>
            <KpiCard label="Total beds" dot="bg-status-invalid" value={d.beds.beds.toLocaleString()} caption={plural(d.beds.rooms, "room")} />
          </FadeIn>
          <FadeIn index={1}>
            <KpiCard
              label="Occupied"
              dot="bg-status-occupied"
              value={d.beds.occupied.toLocaleString()}
              caption={`${d.beds.beds ? ((d.beds.occupied / d.beds.beds) * 100).toFixed(1) : 0}% of beds`}
            />
          </FadeIn>
          <FadeIn index={2}>
            <KpiCard label="Held" dot="bg-status-held" value={d.beds.held.toLocaleString()} caption="Occupant on leave" />
          </FadeIn>
          <FadeIn index={3}>
            <KpiCard label="Vacant" dot="bg-status-vacant" value={d.beds.vacant.toLocaleString()} caption="Ready to assign" />
          </FadeIn>
          <FadeIn index={4}>
            <div className="flex h-full flex-col justify-between gap-3 rounded-[14px] bg-primary p-5 text-primary-foreground shadow-sm">
              <span className="text-[13px] font-semibold opacity-90">Occupancy</span>
              <span className="text-[26px] leading-none sm:text-[32px] font-extrabold tracking-[-0.02em] tabular-nums">{occupancy.toFixed(1)}%</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/25">
                <span className="block h-full rounded-full bg-white" style={{ width: `${occupancy}%` }} />
              </span>
            </div>
          </FadeIn>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <FadeIn>
          <section className="flex flex-col gap-4 min-w-0 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Occupancy by camp</h2>
                <p className="text-[13px] text-muted-foreground">Held beds count as in use</p>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <Legend className="bg-status-occupied" label="Occupied" />
                <Legend className="bg-status-held" label="Held" />
                <Legend className="bg-status-vacant" label="Vacant" />
              </div>
            </div>
            {d.camps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No camps yet.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {d.camps.map((c) => (
                  <li key={c.id}>
                    <Link href={`/camps/${c.id}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 rounded-lg hover:opacity-80">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {EMIRATE_LABELS[c.emirate]} · {plural(c.occupancy.beds, "bed")}
                        </span>
                      </span>
                      <OccupancyBar occupancy={c.occupancy} height={14} />
                      <span className="flex w-16 flex-col text-right">
                        <span className="text-sm font-bold tabular-nums">{percentInUse(c.occupancy).toFixed(1)}%</span>
                        <span className="text-xs font-semibold text-status-vacant-fg">{c.occupancy.vacant} free</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </FadeIn>

        <div className="flex flex-col gap-5">
          <FadeIn index={1}>
            <section className="flex flex-col gap-3 min-w-0 rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <AlertTriangle className="size-5 text-warning" /> Rooms over capacity
                </h2>
                <Pill tone="warning">
                  {d.overCapacity.total} room{d.overCapacity.total === 1 ? "" : "s"}
                </Pill>
              </div>
              {d.overCapacity.rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every room is within its area.</p>
              ) : (
                <ul className="divide-y">
                  {d.overCapacity.rooms.map((r) => (
                    <li key={r.roomId}>
                      <Link href={`/camps/${r.campId}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                        <span className="flex flex-col">
                          <span className="font-semibold">Room {r.roomNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.campName} · {r.areaSqm} m²
                          </span>
                        </span>
                        <span className="text-[13px] font-semibold text-warning-fg">
                          {plural(r.activeBeds, "bed")} · fits ~{r.maxBeds}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </FadeIn>

          <FadeIn index={2}>
            <section className="flex flex-col gap-3 min-w-0 rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Your access</h2>
                <Pill tone="info">{me.roleName ?? "No role"}</Pill>
              </div>
              <p className="text-[13px] text-muted-foreground">
                Camp access <span className="ml-2 font-bold text-foreground">{me.access.campScope === "ALL" || me.access.isSystemAdmin ? `All camps (${d.beds.camps})` : `${me.access.campIds.length} assigned`}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {granted.map((key) => (
                  <span key={key} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                    {PERMISSIONS[key]?.label ?? key}
                  </span>
                ))}
              </div>
            </section>
          </FadeIn>
        </div>
      </div>

      <div className={cn("grid items-start gap-5", d.activity ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {canWorkers && (
          <section className="flex flex-col gap-3 min-w-0 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">On leave · {d.onLeave.total}</h2>
              <Link href="/workers?leave=ON_LEAVE" className="text-[13px] font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>
            {d.onLeave.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody is on leave.</p>
            ) : (
              <ul className="divide-y">
                {d.onLeave.rows.map((r) => (
                  <li key={r.workerId}>
                    <Link href={`/workers/${r.workerId}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-vacant-bg text-xs font-bold text-status-vacant-fg">
                        {initials(r.fullName)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold">{r.fullName}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">{r.employeeCode}</span>
                          {r.bed && ` · ${r.bed}`} <span className="font-bold text-status-held-fg">held</span>
                        </span>
                      </span>
                      <span className="flex flex-col text-right">
                        <span className="text-sm font-bold">{plural(daysBetween(r.since, d.today), "day")}</span>
                        <span className="text-xs text-muted-foreground">since {formatShortDate(r.since)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {canWorkers && (
          <section className="flex flex-col gap-3 min-w-0 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Recent exits</h2>
              <span className="text-[13px] text-muted-foreground">{d.recentExits.total} this month</span>
            </div>
            {d.recentExits.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exits this month.</p>
            ) : (
              <ul className="divide-y">
                {d.recentExits.rows.map((r) => (
                  <li key={r.workerId}>
                    <Link href={`/workers/${r.workerId}`} className="flex items-start justify-between gap-3 py-3 hover:opacity-80">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{r.fullName}</span>
                        <span className="truncate text-xs text-muted-foreground">{r.freedBed ? `Freed ${r.freedBed}` : "Had no bed"}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <Pill>{WORKER_STATUS_LABELS[r.status]}</Pill>
                        <span className="text-xs text-muted-foreground">{formatDate(r.exitDate)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {d.activity && (
          <section className="flex flex-col gap-3 min-w-0 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Recent activity</h2>
              <Link href="/admin/audit" className="text-[13px] font-semibold text-primary hover:underline">
                Audit log
              </Link>
            </div>
            {d.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y">
                {d.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 py-3 text-sm">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", ACTIVITY_DOT[a.kind])} />
                    <span className="flex-1">
                      <span className="font-semibold">{a.actorName ?? "System"}</span> {a.text}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[3px]", className)} />
      {label}
    </span>
  );
}

/** Shown until the system has camps, beds and housed workers: the order to set things up in. */
function GettingStarted({ d, access }: { d: DashboardDto; access: Parameters<typeof hasPermission>[0] }) {
  const steps = [
    { label: "Add sponsors, clients and divisions", href: "/admin/organisation", done: null, permission: "org.manage" as const },
    { label: "Create a camp", href: "/camps", done: d.beds.camps > 0, permission: "camps.manage" as const },
    { label: "Add rooms and beds", href: "/camps", done: d.beds.beds > 0, permission: "camps.manage" as const },
    { label: "Add workers", href: "/workers/new", done: d.workers.active > 0, permission: "workers.manage" as const },
    { label: "Assign workers to beds", href: "/workers?housing=UNHOUSED", done: d.workers.housed + d.workers.onLeave > 0, permission: "beds.assign" as const },
  ].filter((s) => hasPermission(access, s.permission));
  const finished = d.beds.camps > 0 && d.beds.beds > 0 && d.workers.housed + d.workers.onLeave > 0;
  if (finished || steps.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold">Get started</h2>
        <p className="text-[13px] text-muted-foreground">Set things up in this order. This card goes away once workers are in beds.</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className={cn(
                "flex h-full items-start gap-3 rounded-xl border p-3 text-sm font-semibold transition hover:-translate-y-px hover:shadow-sm",
                s.done ? "border-status-vacant-border bg-status-vacant-bg text-status-vacant-fg" : "bg-card",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  s.done ? "bg-status-vacant text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {s.done ? <Check className="size-3.5" /> : i + 1}
              </span>
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
