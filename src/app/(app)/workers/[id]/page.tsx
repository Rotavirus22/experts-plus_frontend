import {
  hasPermission,
  SYSTEM_FIELDS,
  systemFieldValue,
  WORKER_STATUS_LABELS,
  type CustomFieldDto,
  type SystemFieldDef,
  type WorkerDetailDto,
} from "@xperts/shared";
import { ArrowLeft, Lock, Pencil } from "lucide-react";
import Link from "next/link";
import { Pill, SectionLabel } from "@/components/design/primitives";
import { SetBreadcrumb } from "@/components/shell/breadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccommodationBadge, BedButton, ExitButton, LeaveToggle } from "@/components/workers/worker-actions";
import { formatDate } from "@/lib/format";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { cn } from "@/lib/utils";

/** Shown in the header / bed card instead of the details grid. */
const SHOWN_ELSEWHERE = new Set(["camp", "room_no", "bed", "accommodation_status", "employee_code", "full_name"]);
const MONO_FIELDS = new Set(["uae_phone", "home_phone", "passport_number", "emirates_id_number"]);
const DATE_FIELDS = new Set(["join_date", "exit_date"]);

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePagePermission("workers.view");
  const { id } = await params;
  const [worker, fields] = await Promise.all([
    serverApi<WorkerDetailDto>(`/workers/${id}`),
    serverApi<{ system: SystemFieldDef[]; custom: CustomFieldDto[] }>("/fields"),
  ]);
  const details = SYSTEM_FIELDS.filter((f) => !SHOWN_ELSEWHERE.has(f.key) && (!f.requires || hasPermission(me.access, f.requires)));
  const customValues = fields.custom.filter((f) => !f.isHidden || worker.customFields[f.key] !== undefined);
  const h = worker.housing;

  const statusPill =
    worker.status !== "ACTIVE" ? (
      <AccommodationBadge status="EXITED">
        {WORKER_STATUS_LABELS[worker.status]} · {formatDate(worker.exitDate)}
      </AccommodationBadge>
    ) : worker.leave ? (
      <AccommodationBadge status="ON_LEAVE">On leave · since {formatDate(worker.leave.since)}</AccommodationBadge>
    ) : (
      <AccommodationBadge status={worker.accommodationStatus} />
    );

  return (
    <div className="flex flex-col gap-5">
      <SetBreadcrumb items={[{ label: worker.fullName }]} />
      <Link href="/workers" className="inline-flex w-max items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-[15px]" /> Workers
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full border text-lg font-bold",
              worker.leave ? "border-status-vacant-border bg-status-vacant-bg text-status-vacant-fg" : "bg-secondary text-secondary-foreground",
            )}
          >
            {initials(worker.fullName)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-tight font-extrabold tracking-[-0.02em]">
              {worker.fullName}
              {statusPill}
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono font-medium text-foreground">{worker.employeeCode}</span>
              {worker.designation && ` · ${worker.designation}`}
              {(worker.departmentName || worker.clientName) && ` · ${[worker.departmentName, worker.clientName].filter(Boolean).join(", ")}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <BedButton worker={worker} access={me.access} size="default" />
          <LeaveToggle worker={worker} access={me.access} size="default" />
          {hasPermission(me.access, "workers.manage") && (
            <Link href={`/workers/${worker.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil data-icon="inline-start" /> Edit
            </Link>
          )}
          <ExitButton worker={worker} access={me.access} size="default" variant="destructive" />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_1fr]">
        <section className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold">Details</h2>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {details.map((f) => {
              const value = systemFieldValue(worker, f.key);
              const shown = DATE_FIELDS.has(f.key) ? formatDate(value) : value;
              return (
                <div key={f.key} className={cn("flex flex-col gap-0.5", f.key === "remarks" && "sm:col-span-2")}>
                  <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {f.label}
                    {f.requires && (
                      <Pill tone="accent" className="h-4.5 px-1.5 text-[10px]">
                        <Lock className="size-2.5" /> Restricted
                      </Pill>
                    )}
                  </dt>
                  <dd className={cn("text-[15px]", MONO_FIELDS.has(f.key) && "font-mono text-sm")}>{shown ?? "—"}</dd>
                </div>
              );
            })}
          </dl>
          {customValues.length > 0 && (
            <>
              <div className="border-t" />
              <SectionLabel>Additional fields</SectionLabel>
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {customValues.map((f) => (
                  <div key={f.id} className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      {f.label}
                      {f.isHidden && " (hidden field)"}
                    </dt>
                    <dd className="text-[15px]">{formatCustom(f, worker.customFields[f.key])}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Current bed</h2>
              {h && hasPermission(me.access, "camps.view") && (
                <Link href={`/camps/${h.campId}`} className="text-[13px] font-semibold text-primary hover:underline">
                  Open camp
                </Link>
              )}
            </div>
            {h ? (
              <div
                className={cn(
                  "flex items-center gap-4 rounded-xl border p-4",
                  worker.leave ? "border-status-held-border bg-status-held-bg" : "border-status-occupied-border bg-status-occupied-bg",
                )}
              >
                <span className="flex h-[52px] min-w-[52px] shrink-0 items-center justify-center rounded-lg bg-card px-2.5 shadow-sm">
                  <span className="text-base font-bold whitespace-nowrap">{h.bedLabel}</span>
                </span>
                <div className={cn("flex flex-col text-sm", worker.leave ? "text-status-held-fg" : "text-status-occupied-fg")}>
                  <span className="text-[15px] font-bold text-foreground">
                    {h.campName} · Room {h.roomNumber}
                  </span>
                  <span>Since {formatDate(h.since)}</span>
                  {worker.leave && <span className="font-bold">On leave — bed held</span>}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {worker.status !== "ACTIVE" ? `${WORKER_STATUS_LABELS[worker.status]} on ${formatDate(worker.exitDate)} — bed released.` : "No bed assigned yet."}
              </p>
            )}
            {h && worker.leave && (
              <p className="text-[13px] text-muted-foreground">
                Leave never frees a bed. {h.bedLabel} stays reserved until {worker.fullName.split(" ")[0]} exits or is moved.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-bold">Leave history</h2>
            {worker.leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Went on leave</TableHead>
                    <TableHead className="text-xs">Returned / closed</TableHead>
                    <TableHead className="text-xs">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worker.leaves.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-semibold">{formatDate(l.startDate)}</TableCell>
                      <TableCell>
                        {l.returnDate ? (
                          <>
                            {formatDate(l.returnDate)} · {l.closedByExit ? "closed on exit" : "returned"}
                          </>
                        ) : (
                          <span className="font-bold text-status-vacant-fg">On leave</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">{l.note ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold">Bed history</h2>
        {worker.stays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No beds yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Camp · Room · Bed</TableHead>
                <TableHead className="text-xs">From</TableHead>
                <TableHead className="text-xs">To</TableHead>
                <TableHead className="text-xs">Ended</TableHead>
                <TableHead className="text-xs">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {worker.stays.map((s) => (
                <TableRow key={s.id} className={s.invalidated ? "text-muted-foreground line-through" : undefined}>
                  <TableCell className="font-semibold">
                    {s.campName} · {s.roomNumber} · {s.bedLabel}
                  </TableCell>
                  <TableCell>{formatDate(s.startDate)}</TableCell>
                  <TableCell>{s.endDate ? formatDate(s.endDate) : "Now"}</TableCell>
                  <TableCell>
                    {s.endReason === "MOVED" ? (
                      <Pill>Moved</Pill>
                    ) : s.endReason === "EXITED" ? (
                      <Pill tone="danger">Exited</Pill>
                    ) : worker.leave ? (
                      <Pill tone="warning">Current · held</Pill>
                    ) : (
                      <Pill tone="info">Current</Pill>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {s.createdByName && `In by ${s.createdByName}`}
                    {s.createdByName && s.endedByName && " · "}
                    {s.endedByName && `out by ${s.endedByName}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function formatCustom(field: CustomFieldDto, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "BOOLEAN") return value ? "Yes" : "No";
  if (field.type === "DATE") return formatDate(String(value));
  return String(value);
}
