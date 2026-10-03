"use client";

import { BED_STATUS_LABELS, EMIRATE_LABELS, todayDubai, type BedType, type CampDetailDto, type CampOptionDto, type Emirate } from "@xperts/shared";
import { BedDouble, Calendar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LoadingText } from "@/components/skeletons";
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
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BED_STATUS_STYLES, BED_TYPE_LABELS } from "./bed-status";
import { useAppRouter } from "@/lib/use-app-router";

type Target = { campId: string; bedId: string; label: string; type: BedType | null; roomNumber: string; campName: string };

/**
 * Picks a vacant bed for a worker. mode "assign" = worker has no bed; "move" = closes the current stay (MOVED)
 * and opens a new one on the chosen date. Held and occupied beds cannot be chosen.
 */
export function BedPickerDialog({
  worker,
  mode,
  initialCampId,
  excludeBedId,
  onClose,
  onDone,
}: {
  worker: { id: string; fullName: string; employeeCode?: string; designation?: string | null; currentBed?: string | null };
  mode: "assign" | "move";
  initialCampId?: string;
  excludeBedId?: string;
  onClose: () => void;
  /** Awaited before closing, so the caller can reload its own data first. */
  onDone?: () => void | Promise<void>;
}) {
  const router = useAppRouter();
  const [camps, setCamps] = useState<CampOptionDto[] | null>(null);
  const [campId, setCampId] = useState<string | null>(initialCampId ?? null);
  const [loadedCamp, setLoadedCamp] = useState<CampDetailDto | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [date, setDate] = useState(todayDubai());
  const [roomFilter, setRoomFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<CampOptionDto[]>("/camps/options")
      .then((list) => {
        const active = list.filter((c) => c.isActive);
        setCamps(active);
        setCampId((current) => current ?? active[0]?.id ?? null);
      })
      .catch((e) => toast.error(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!campId) return;
    api<CampDetailDto>(`/camps/${campId}`)
      .then(setLoadedCamp)
      .catch((e) => toast.error(errorMessage(e)));
  }, [campId]);

  // Only show data / a selection that belongs to the camp currently chosen.
  const camp = loadedCamp?.id === campId ? loadedCamp : null;
  const target = selected?.campId === campId ? selected : null;

  const rooms = useMemo(() => {
    const q = roomFilter.trim().toLowerCase();
    return (camp?.rooms ?? []).filter((r) => r.isActive && r.beds.some((b) => b.isActive) && (!q || r.number.toLowerCase().includes(q)));
  }, [camp, roomFilter]);
  const isSelectable = (status: string, id: string) => status === "VACANT" && id !== excludeBedId;
  const vacantCount = rooms.reduce((n, r) => n + r.beds.filter((b) => isSelectable(b.status, b.id)).length, 0);
  const campLabel = (c: CampOptionDto) => `${c.name} · ${EMIRATE_LABELS[c.emirate as Emirate] ?? c.emirate}`;

  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      if (mode === "assign") {
        await api("/assignments", { body: { workerId: worker.id, bedId: target.bedId, startDate: date } });
      } else {
        await api("/assignments/move", { body: { workerId: worker.id, toBedId: target.bedId, moveDate: date } });
      }
      toast.success(`${worker.fullName} → ${target.campName} · Room ${target.roomNumber} · ${target.label}`);
      await Promise.all([router.refresh(), onDone?.()]);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{mode === "assign" ? `Assign a bed to ${worker.fullName}` : `Move ${worker.fullName}`}</DialogTitle>
          <DialogDescription>
            {worker.employeeCode && <span className="font-mono">{worker.employeeCode}</span>}
            {worker.designation && ` · ${worker.designation}`}
            {mode === "assign" ? " · currently has no bed" : worker.currentBed ? ` · now in ${worker.currentBed}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label>Camp</Label>
            <Select items={(camps ?? []).map((c) => ({ value: c.id, label: campLabel(c) }))} value={campId} onValueChange={(v) => v && setCampId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={camps ? "Choose a camp" : "Loading…"} />
              </SelectTrigger>
              <SelectContent>
                {(camps ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {campLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="room-filter">Room</Label>
            <Input id="room-filter" placeholder="Filter rooms, e.g. 10 or G-" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} />
          </div>
          <span className="flex h-9.5 items-center rounded-lg bg-status-vacant-bg px-3 text-[13px] font-bold whitespace-nowrap text-status-vacant-fg">
            {camp ? `${vacantCount} vacant beds` : "…"}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="flex flex-wrap gap-4 border-b bg-muted px-4 py-2 text-xs text-muted-foreground">
            <LegendSwatch className={BED_STATUS_STYLES.VACANT} label="Vacant · selectable" />
            <LegendSwatch className={BED_STATUS_STYLES.OCCUPIED} label="Occupied" />
            <LegendSwatch className={BED_STATUS_STYLES.HELD} label="Held" />
            <LegendSwatch className="border-primary bg-primary" label="Selected" />
          </div>
          <div className="max-h-[42vh] overflow-y-auto">
            {!camp ? (
              <LoadingText className="p-6">Loading beds…</LoadingText>
            ) : rooms.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No rooms with beds.</p>
            ) : (
              rooms.map((room) => {
                const active = room.beds.filter((b) => b.isActive);
                const vacant = active.filter((b) => isSelectable(b.status, b.id)).length;
                return (
                  <div key={room.id} className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0">
                    <div className="flex w-28 shrink-0 flex-col">
                      <span className="text-sm font-bold">Room {room.number}</span>
                      <span className="text-xs text-muted-foreground">
                        {vacant} vacant of {active.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {active.map((b) => {
                        const selectable = isSelectable(b.status, b.id);
                        const isSelected = target?.bedId === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            disabled={!selectable}
                            onClick={() => setSelected({ campId: camp.id, bedId: b.id, label: b.label, type: b.type, roomNumber: room.number, campName: camp.name })}
                            title={
                              selectable
                                ? `Choose ${b.label}`
                                : `${b.label}: ${b.id === excludeBedId ? "current bed" : BED_STATUS_LABELS[b.status]}${b.occupant ? ` (${b.occupant.fullName})` : ""}`
                            }
                            className={cn(
                              "flex h-9 min-w-11 items-center justify-center rounded-md border px-2 text-xs font-bold transition",
                              isSelected ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30" : BED_STATUS_STYLES[b.status],
                              !selectable && "cursor-not-allowed opacity-45",
                              selectable && !isSelected && "hover:-translate-y-px hover:shadow-sm",
                            )}
                          >
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="grid items-end gap-3 sm:grid-cols-[220px_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-date">{mode === "assign" ? "From date" : "Move date"}</Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="assign-date" type="date" className="pl-9" value={date} max={todayDubai()} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div
            className={cn(
              "flex min-h-[62px] items-center gap-3 rounded-xl border px-4 py-2.5 text-[13px]",
              target ? "border-status-occupied-border bg-status-occupied-bg" : "border-dashed text-muted-foreground",
            )}
          >
            <BedDouble className="size-5 shrink-0 text-primary" />
            {target ? (
              <span>
                <span className="font-bold">{worker.fullName}</span> → {target.campName} ·{" "}
                <span className="font-bold">
                  Room {target.roomNumber} · {target.label}
                </span>
                {target.type && ` (${BED_TYPE_LABELS[target.type].toLowerCase()})`}
                <br />
                <span className="text-muted-foreground">from {formatDate(date)}</span>
              </span>
            ) : (
              <span>Pick a vacant bed above.</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={busy || !target || !date} loading={busy}>
            {busy ? "Saving…" : mode === "assign" ? "Assign bed" : "Move worker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[3px] border", className)} />
      {label}
    </span>
  );
}
