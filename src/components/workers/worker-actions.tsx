"use client";

import {
  ACCOMMODATION_STATUS_LABELS,
  EXIT_STATUSES,
  hasPermission,
  todayDubai,
  WORKER_STATUS_LABELS,
  type AccessProfile,
  type AccommodationStatus,
  type ExitStatus,
  type WorkerRowDto,
} from "@xperts/shared";
import { AlertTriangle, ArrowRightLeft, BedDouble, Calendar, House, Plane, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BedPickerDialog } from "@/components/camps/bed-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { daysBetween, formatDate, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppRouter } from "@/lib/use-app-router";

/** Worker badges: Occupied → occupied colours; On leave → green; No bed → warning; Exited → muted. */
const STATUS_STYLES: Record<AccommodationStatus, string> = {
  OCCUPIED: "border-status-occupied-border bg-status-occupied-bg text-status-occupied-fg",
  ON_LEAVE: "border-status-vacant-border bg-status-vacant-bg text-status-vacant-fg",
  NOT_HOUSED: "border-warning-border bg-warning-bg text-warning-fg",
  EXITED: "border-border bg-muted text-muted-foreground",
};

export function AccommodationBadge({ status, children }: { status: AccommodationStatus; children?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full border px-2.5 text-[11.5px] font-bold whitespace-nowrap", STATUS_STYLES[status])}>
      {children ?? ACCOMMODATION_STATUS_LABELS[status]}
    </span>
  );
}

/** Row tint (matches the camp occupancy sheet): on leave green, no bed orange, exited grey. */
export function accommodationRowClass(status: AccommodationStatus): string | undefined {
  if (status === "ON_LEAVE") return "bg-row-leave hover:bg-row-leave";
  if (status === "NOT_HOUSED") return "bg-row-nobed hover:bg-row-nobed";
  if (status === "EXITED") return "bg-row-exited text-muted-foreground hover:bg-row-exited";
  return undefined;
}

function bedText(w: WorkerRowDto) {
  return w.housing ? `${w.housing.campName} · Room ${w.housing.roomNumber} · ${w.housing.bedLabel}` : null;
}

function WorkerSubtitle({ worker }: { worker: WorkerRowDto }) {
  return (
    <>
      <span className="font-mono">{worker.employeeCode}</span>
      {worker.designation && ` · ${worker.designation}`}
      {worker.clientName && ` · ${worker.clientName}`}
    </>
  );
}

/** "On leave" / "Returned" toggle. Leave never frees the bed: it shows as Held. */
export function LeaveToggle({ worker, access, size = "sm" }: { worker: WorkerRowDto; access: AccessProfile; size?: "sm" | "default" }) {
  const router = useAppRouter();
  const [starting, setStarting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (worker.status !== "ACTIVE" || !hasPermission(access, "workers.leave")) return null;
  const today = todayDubai();
  const bed = bedText(worker);

  async function start() {
    setBusy(true);
    try {
      await api(`/workers/${worker.id}/leave`, { body: { note } });
      toast.success(`${worker.fullName} is on leave${worker.housing ? `. ${worker.housing.bedLabel} is held.` : "."}`);
      await router.refresh();
      setStarting(false);
      setNote("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {worker.leave ? (
        <Button
          size={size}
          variant="outline"
          className="border-status-vacant-border bg-status-vacant-bg text-status-vacant-fg hover:bg-status-vacant-bg/80 hover:text-status-vacant-fg"
          onClick={() => setReturning(true)}
        >
          <House data-icon="inline-start" />
          {size === "default" ? "Mark returned" : "Returned"}
        </Button>
      ) : (
        <Button size={size} variant="outline" onClick={() => setStarting(true)}>
          <Plane data-icon="inline-start" />
          On leave
        </Button>
      )}

      <Dialog open={starting} onOpenChange={(o) => !busy && setStarting(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Mark {worker.fullName} on leave</DialogTitle>
            <DialogDescription>
              <WorkerSubtitle worker={worker} />
            </DialogDescription>
          </DialogHeader>
          <p className="flex items-center gap-2.5 rounded-lg bg-secondary px-3 py-2.5 text-sm">
            <Calendar className="size-4 text-muted-foreground" />
            Leave starts <span className="font-bold">today, {formatDate(today)}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="leave-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Annual leave · flying to Kathmandu" />
          </div>
          {bed ? (
            <p className="flex gap-2.5 rounded-xl border border-status-held-border bg-status-held-bg p-3 text-[13px] text-status-held-fg">
              <BedDouble className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-bold">Their bed stays reserved.</span> {bed} will show as Held, and nobody can be put into it until they
                exit or are moved.
              </span>
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">They have no bed at the moment.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStarting(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={start} disabled={busy} loading={busy}>
              {busy ? "Saving…" : "Start leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={returning}
        onOpenChange={setReturning}
        icon={<House className="size-5 text-status-vacant-fg" />}
        title={`Mark ${worker.fullName} as returned?`}
        description={
          worker.leave ? (
            <>
              On leave since {formatDate(worker.leave.since)} ({plural(daysBetween(worker.leave.since, today), "day")}).
              {bed ? (
                <>
                  {" "}
                  They go back to <span className="font-bold text-foreground">{bed}</span>, which was held for them.
                </>
              ) : null}{" "}
              The leave closes today.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Mark returned"
        onConfirm={async () => {
          await api(`/workers/${worker.id}/return`, { body: {} });
          toast.success(`${worker.fullName} is back`);
          await router.refresh();
        }}
      />
    </>
  );
}

/** Exit flow: the only way a bed is freed. Closes the bed stay and any open leave in one transaction. */
export function ExitButton({
  worker,
  access,
  size = "sm",
  variant = "destructive-ghost",
}: {
  worker: WorkerRowDto;
  access: AccessProfile;
  size?: "sm" | "default";
  variant?: "destructive-ghost" | "destructive";
}) {
  const router = useAppRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ExitStatus>("RESIGNED");
  const [exitDate, setExitDate] = useState(todayDubai());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (worker.status !== "ACTIVE" || !hasPermission(access, "workers.exit")) return null;
  const bed = bedText(worker);

  async function submit() {
    setBusy(true);
    try {
      await api(`/workers/${worker.id}/exit`, { body: { status, exitDate, reason } });
      toast.success(`${worker.fullName} exited (${WORKER_STATUS_LABELS[status]})${worker.housing ? `. ${worker.housing.bedLabel} is now free.` : "."}`);
      await router.refresh();
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        {variant === "destructive" && <UserX data-icon="inline-start" />}
        Exit
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Exit {worker.fullName}</DialogTitle>
            <DialogDescription>
              <WorkerSubtitle worker={worker} />
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exit-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Select
                items={EXIT_STATUSES.map((s) => ({ value: s, label: WORKER_STATUS_LABELS[s] }))}
                value={status}
                onValueChange={(v) => v && setStatus(v as ExitStatus)}
              >
                <SelectTrigger id="exit-reason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXIT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {WORKER_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exit-date">
                Exit date <span className="text-destructive">*</span>
              </Label>
              <Input id="exit-date" type="date" value={exitDate} max={todayDubai()} onChange={(e) => setExitDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="exit-reason">Details</Label>
              <Textarea id="exit-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Notice served; final settlement cleared." />
            </div>
          </div>
          <div className="flex gap-2.5 rounded-xl border border-[color-mix(in_oklab,var(--destructive)_35%,var(--border))] bg-[color-mix(in_oklab,var(--destructive)_7%,var(--card))] p-3 text-[13px]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="flex flex-col gap-1.5">
              <p>{bed ? <>Frees <span className="font-bold">{bed}</span>. Their stay is kept in the bed&apos;s history.</> : "They have no bed to free."}</p>
              <p className="text-muted-foreground">
                {worker.leave ? "Their open leave is closed on the exit date. " : "Any open leave is closed on the exit date. "}
                This can&apos;t be undone from here.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={busy || !exitDate} loading={busy}>
              {busy ? "Saving…" : "Exit worker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Assign bed" for a worker without a bed, "Move" for a housed worker. Only vacant beds can be chosen. */
export function BedButton({
  worker,
  access,
  size = "sm",
  onlyWhenUnhoused = false,
}: {
  worker: WorkerRowDto;
  access: AccessProfile;
  size?: "sm" | "default";
  onlyWhenUnhoused?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (worker.status !== "ACTIVE" || !hasPermission(access, "beds.assign")) return null;
  if (onlyWhenUnhoused && worker.housing) return null;
  const mode = worker.housing ? "move" : "assign";

  return (
    <>
      <Button size={size} variant={mode === "assign" ? "default" : "outline"} onClick={() => setOpen(true)}>
        {mode === "assign" ? <BedDouble data-icon="inline-start" /> : <ArrowRightLeft data-icon="inline-start" />}
        {mode === "assign" ? "Assign bed" : "Move"}
      </Button>
      {open && (
        <BedPickerDialog
          worker={{
            id: worker.id,
            fullName: worker.fullName,
            employeeCode: worker.employeeCode,
            designation: worker.designation,
            currentBed: bedText(worker),
          }}
          mode={mode}
          initialCampId={worker.housing?.campId}
          excludeBedId={worker.housing?.bedId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
