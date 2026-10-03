"use client";

import {
  BED_TYPES,
  hasPermission,
  todayDubai,
  type AccessProfile,
  type BedCandidateDto,
  type BedHistoryDto,
  type BedType,
} from "@xperts/shared";
import { ArrowRightLeft, Ban, Calendar, Plane, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingText } from "@/components/skeletons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EASE, Pill, SectionLabel } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BedPickerDialog } from "./bed-picker";
import { BED_TYPE_LABELS, BedStatusBadge } from "./bed-status";
import { useAppRouter } from "@/lib/use-app-router";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * Bed drawer: current occupant, assign / move, bed details, and the history of everyone who stayed in this exact bed.
 */
export function BedDrawer({
  bedId,
  campId,
  access,
  canManage,
  onClose,
}: {
  bedId: string;
  campId: string;
  access: AccessProfile;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useAppRouter();
  const [data, setData] = useState<BedHistoryDto | null>(null);
  const [moving, setMoving] = useState(false);

  const load = useCallback(
    () =>
      api<BedHistoryDto>(`/beds/${bedId}/history`)
        .then(setData)
        .catch((e) => toast.error(errorMessage(e))),
    [bedId],
  );
  useEffect(() => {
    load();
  }, [load]);

  /** Reload the drawer and the page behind it; resolves once both show the new data. */
  const refresh = async () => {
    await Promise.all([load(), router.refresh()]);
  };

  const canAssign = hasPermission(access, "beds.assign") && data?.bed.status === "VACANT";
  const canMove = hasPermission(access, "beds.assign") && !!data?.occupant && data.camp.isActive;
  const editable = canManage && !!data?.bed.isActive && data.room.isActive;
  const seeWorkers = hasPermission(access, "workers.view");

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 shadow-lg sm:max-w-[480px]">
        <SheetHeader className="gap-1.5 border-b px-6 pt-6 pb-5">
          <p className="text-xs font-medium text-muted-foreground">{data?.camp.name ?? " "}</p>
          <SheetTitle className="text-[26px] leading-tight font-extrabold">
            {data ? `Room ${data.room.number} · ${data.bed.label}` : "Bed"}
          </SheetTitle>
          <SheetDescription render={<div />} className="flex flex-wrap gap-2 pt-1">
            {data && (
              <>
                <BedStatusBadge status={data.bed.status} />
                {data.bed.type && <Pill tone="info">{BED_TYPE_LABELS[data.bed.type]}</Pill>}
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {!data ? (
          <div className="flex flex-col gap-3 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-7 px-6 py-6">
            {data.bed.invalidationReason && (
              <p className="rounded-xl border border-dashed bg-muted p-3 text-sm text-muted-foreground">Invalidated: “{data.bed.invalidationReason}”</p>
            )}

            {data.occupant ? (
              <section className="flex flex-col gap-3">
                <SectionLabel>Current occupant</SectionLabel>
                <div
                  className={cn(
                    "flex flex-col gap-3 rounded-[14px] border p-4",
                    data.occupant.onLeave ? "border-status-held-border bg-status-held-bg" : "bg-card",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-sm font-bold ring-1 ring-border">
                      {initials(data.occupant.fullName)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      {seeWorkers ? (
                        <Link href={`/workers/${data.occupant.workerId}`} className="truncate font-bold hover:underline">
                          {data.occupant.fullName}
                        </Link>
                      ) : (
                        <span className="truncate font-bold">{data.occupant.fullName}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono">{data.occupant.employeeCode}</span> · in this bed since {formatDate(data.occupant.since)}
                      </span>
                    </div>
                  </div>
                  {data.occupant.onLeave && (
                    <p className="flex gap-2 text-[13px] text-status-held-fg">
                      <Plane className="mt-0.5 size-4 shrink-0" />
                      <span>
                        <span className="font-bold">On leave — bed held.</span> Nobody can be put here until they exit or are moved.
                      </span>
                    </p>
                  )}
                  {canMove && (
                    <Button variant="outline" className="w-full" onClick={() => setMoving(true)}>
                      <ArrowRightLeft data-icon="inline-start" /> Move to another bed
                    </Button>
                  )}
                </div>
              </section>
            ) : canAssign ? (
              <AssignPanel bedId={bedId} bedLabel={data.bed.label} onAssigned={refresh} />
            ) : (
              data.bed.status === "VACANT" && <p className="text-sm text-muted-foreground">Nobody is in this bed.</p>
            )}

            {editable && <EditPanel data={data} onSaved={refresh} />}

            <section className="flex flex-col gap-3">
              <SectionLabel>Everyone who stayed in this bed</SectionLabel>
              <Timeline data={data} seeWorkers={seeWorkers} />
            </section>
          </div>
        )}

        {moving && data?.occupant && (
          <BedPickerDialog
            worker={{ id: data.occupant.workerId, fullName: data.occupant.fullName, employeeCode: data.occupant.employeeCode, currentBed: `${data.camp.name} · Room ${data.room.number} · ${data.bed.label}` }}
            mode="move"
            initialCampId={campId}
            excludeBedId={bedId}
            onClose={() => setMoving(false)}
            onDone={refresh}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Timeline({ data, seeWorkers }: { data: BedHistoryDto; seeWorkers: boolean }) {
  const reduce = useReducedMotion();
  if (data.stays.length === 0) return <p className="text-sm text-muted-foreground">Nobody has stayed in this bed yet.</p>;
  return (
    <ol className="relative flex flex-col gap-5 pl-7">
      <span className="absolute top-2 bottom-2 left-[7px] w-px bg-border" aria-hidden />
      {data.stays.map((s, i) => {
        const current = !s.endDate;
        return (
          <motion.li
            key={s.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
            transition={{ duration: 0.32, ease: EASE, delay: Math.min(i, 8) * 0.04 }}
            className={cn("relative flex flex-col gap-0.5 text-sm", s.invalidated && "text-muted-foreground line-through")}
          >
            <span
              className={cn(
                "absolute top-1 -left-7 size-[15px] rounded-full border-2 bg-card",
                current ? "border-primary after:absolute after:inset-[3px] after:rounded-full after:bg-primary" : "border-muted-foreground/50",
              )}
            />
            <span className="flex flex-wrap items-center gap-2">
              {seeWorkers ? (
                <Link href={`/workers/${s.workerId}`} className="font-bold hover:underline">
                  {s.fullName}
                </Link>
              ) : (
                <span className="font-bold">{s.fullName}</span>
              )}
              <span className="font-mono text-xs text-muted-foreground">{s.employeeCode}</span>
              {current && <Pill tone="primary">Current</Pill>}
            </span>
            <span>
              <span className="font-semibold">
                {formatDate(s.startDate)} → {s.endDate ? formatDate(s.endDate) : "now"}
              </span>
              {s.endReason && <span className="text-muted-foreground"> · {s.endReason === "MOVED" ? "moved out" : "exited"}</span>}
              {current && data.occupant?.onLeave && <span className="text-muted-foreground"> · on leave</span>}
            </span>
            {(s.createdByName || s.endedByName) && (
              <span className="text-xs text-muted-foreground">
                {s.createdByName && `In by ${s.createdByName}`}
                {s.createdByName && s.endedByName && " · "}
                {s.endedByName && `out by ${s.endedByName}`}
              </span>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Search active workers (without a bed first, then movable ones) and put one into this vacant bed. */
function AssignPanel({ bedId, bedLabel, onAssigned }: { bedId: string; bedLabel: string; onAssigned: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BedCandidateDto[] | null>(null);
  const [picked, setPicked] = useState<BedCandidateDto | null>(null);
  const [date, setDate] = useState(todayDubai());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api<BedCandidateDto[]>(`/beds/${bedId}/candidates?q=${encodeURIComponent(q)}`)
        .then(setResults)
        .catch((e) => toast.error(errorMessage(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [bedId, q]);

  async function confirm() {
    if (!picked) return;
    setBusy(true);
    try {
      if (picked.housing) {
        await api("/assignments/move", { body: { workerId: picked.id, toBedId: bedId, moveDate: date } });
        toast.success(`${picked.fullName} moved to ${bedLabel}`);
      } else {
        await api("/assignments", { body: { workerId: picked.id, bedId, startDate: date } });
        toast.success(`${picked.fullName} assigned to ${bedLabel}`);
      }
      await onAssigned(); // keep the panel busy until the drawer shows the new occupant
      setPicked(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const unhoused = results?.filter((w) => !w.housing).length ?? 0;

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Put a worker in this bed</SectionLabel>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search Emp No or name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-hidden rounded-xl border">
        <p className="border-b bg-muted px-3 py-2 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
          Without a bed · {results === null ? "…" : unhoused}
        </p>
        <div role="radiogroup" className="max-h-72 overflow-y-auto">
          {results === null ? (
            <LoadingText className="p-3 text-xs">Searching workers…</LoadingText>
          ) : results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No matching active workers.</p>
          ) : (
            results.map((w) => {
              const selected = picked?.id === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPicked(w)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition last:border-b-0 hover:bg-muted/60",
                    selected && "bg-status-occupied-bg ring-2 ring-primary ring-inset",
                  )}
                >
                  <span className={cn("flex size-[18px] shrink-0 items-center justify-center rounded-full border-2", selected ? "border-primary" : "border-input")}>
                    {selected && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{w.fullName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{w.employeeCode}</span>
                      {w.designation && ` · ${w.designation}`}
                    </span>
                  </span>
                  {w.housing ? (
                    <Pill tone="info">
                      Now in Room {w.housing.roomNumber} · {w.housing.bedLabel}
                    </Pill>
                  ) : (
                    <Pill tone="warning">No bed</Pill>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {picked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            <Label htmlFor="drawer-date">{picked.housing ? "Moves on" : "In this bed from"}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Calendar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="drawer-date" type="date" className="pl-9" value={date} max={todayDubai()} onChange={(e) => setDate(e.target.value)} />
              </div>
              <Button className="flex-1" onClick={confirm} disabled={busy || !date} loading={busy}>
                {busy ? "Saving…" : picked.housing ? "Move here" : `Assign to ${bedLabel}`}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="text-xs text-muted-foreground">
        Choosing a worker who already has a bed turns this into a <span className="font-bold text-foreground">move</span> — the button
        becomes “Move here” and their old bed is freed.
      </p>
    </section>
  );
}

function EditPanel({ data, onSaved }: { data: BedHistoryDto; onSaved: () => Promise<void> }) {
  const [label, setLabel] = useState(data.bed.label);
  const [type, setType] = useState<BedType | null>(data.bed.type);
  const [busy, setBusy] = useState(false);
  const [invalidating, setInvalidating] = useState(false);
  const NONE = "__none";
  const vacant = data.bed.status === "VACANT";

  async function save() {
    setBusy(true);
    try {
      await api(`/beds/${data.bed.id}`, { method: "PATCH", body: { label, type } });
      toast.success("Bed updated");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Bed details</SectionLabel>
      <div className="flex items-end gap-2">
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor="bed-label">Label</Label>
          <Input id="bed-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={20} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label>Type</Label>
          <Select
            items={[{ value: NONE, label: "Not set" }, ...BED_TYPES.map((t) => ({ value: t, label: BED_TYPE_LABELS[t] }))]}
            value={type ?? NONE}
            onValueChange={(v) => setType(!v || v === NONE ? null : (v as BedType))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {BED_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {BED_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" onClick={save} disabled={busy || !label.trim() || (label === data.bed.label && type === data.bed.type)} loading={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="destructive-outline" size="sm" disabled={!vacant} onClick={() => setInvalidating(true)}>
          <Ban data-icon="inline-start" /> Invalidate bed…
        </Button>
        {!vacant && <span className="text-xs text-muted-foreground">Only vacant beds can be invalidated.</span>}
      </div>
      <ConfirmDialog
        open={invalidating}
        onOpenChange={setInvalidating}
        title={`Invalidate ${data.bed.label}?`}
        description="The bed stays in the history (greyed out) but can no longer be assigned. Its label can be reused."
        confirmLabel="Invalidate bed"
        destructive
        requireReason
        onConfirm={async (reason) => {
          await api(`/beds/${data.bed.id}/invalidate`, { body: { reason } });
          toast.success(`${data.bed.label} invalidated`);
          await onSaved();
        }}
      />
    </section>
  );
}
