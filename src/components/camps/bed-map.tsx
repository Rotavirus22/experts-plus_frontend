"use client";

import { BED_STATUS_LABELS, type AccessProfile, type BedDto, type RoomDto } from "@xperts/shared";
import { AlertTriangle, Ban, GripVertical, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { Reorder } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pill } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, errorMessage } from "@/lib/api";
import { formatDate, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BedDrawer } from "./bed-drawer";
import { BED_STATUS_STYLES, BED_TYPE_LABELS, BED_TYPE_SHORT } from "./bed-status";
import { AddBedsDialog, RoomDialog } from "./camp-dialogs";
import { useAppRouter } from "@/lib/use-app-router";

type RoomCardProps = { campId: string; room: RoomDto; access: AccessProfile; canManage: boolean; sqmPerWorker: number };

export function RoomCard({ campId, room, access, canManage, sqmPerWorker }: RoomCardProps) {
  const router = useAppRouter();
  const [dialog, setDialog] = useState<"edit" | "beds" | "order" | "invalidate" | null>(null);
  const [bedId, setBedId] = useState<string | null>(null);
  const manage = canManage && room.isActive;
  const inUse = room.occupancy.occupied + room.occupancy.held;
  const activeBeds = room.beds.filter((b) => b.isActive).length;

  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm", !room.isActive && "border-dashed bg-muted/50 shadow-none")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="flex items-center gap-2 text-base font-bold tracking-tight">
            <span className={cn(!room.isActive && "text-muted-foreground line-through")}>Room {room.number}</span>
            {!room.isActive && <Pill>Invalidated</Pill>}
          </h3>
          <p className="text-xs text-muted-foreground">
            {room.isActive
              ? `${room.occupancy.occupied} occupied · ${room.occupancy.held} held · ${room.occupancy.vacant} vacant`
              : plural(room.beds.length, "bed")}
            {room.areaSqm ? ` · ${room.areaSqm} m²` : ""}
          </p>
        </div>
        {manage && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label={`Room ${room.number} actions`} />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setDialog("beds")}>
                <Plus /> Add beds
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("edit")}>
                <Pencil /> Edit room
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("order")} disabled={activeBeds < 2}>
                <GripVertical /> Reorder beds
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={inUse > 0} onClick={() => setDialog("invalidate")} className="items-start">
                <Ban className="mt-0.5" />
                <span className="flex flex-col">
                  Invalidate room
                  {inUse > 0 && <span className="text-[11px] font-normal opacity-80">{plural(inUse, "bed")} in use — move or exit first</span>}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {room.invalidation && (
        <p className="text-xs text-muted-foreground">
          Invalidated {formatDate(room.invalidation.at)}
          {room.invalidation.byName ? ` by ${room.invalidation.byName}` : ""}
          {room.invalidation.reason ? ` · “${room.invalidation.reason}”` : ""}
        </p>
      )}

      {room.capacityWarning && (
        <p className="flex items-center gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-1.5 text-[13px] font-semibold text-warning-fg">
          <AlertTriangle className="size-4 shrink-0" />
          {room.capacityWarning.activeBeds} beds; area fits about {room.capacityWarning.maxBeds}
        </p>
      )}

      {room.beds.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No beds yet.
          {manage && (
            <Button size="sm" variant="outline" onClick={() => setDialog("beds")}>
              <Plus data-icon="inline-start" /> Add beds
            </Button>
          )}
        </div>
      ) : (
        // Phones: as many readable tiles as fit; wider screens: the room's configured layout.
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2 sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
          style={{ "--cols": room.layoutColumns } as React.CSSProperties}
        >
          {room.beds.map((b) => (
            <BedTile key={b.id} bed={b} onClick={() => setBedId(b.id)} />
          ))}
        </div>
      )}

      {dialog === "edit" && <RoomDialog campId={campId} room={room} sqmPerWorker={sqmPerWorker} onClose={() => setDialog(null)} />}
      {dialog === "beds" && <AddBedsDialog room={room} sqmPerWorker={sqmPerWorker} onClose={() => setDialog(null)} />}
      {dialog === "order" && <ReorderDialog room={room} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === "invalidate"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Invalidate room ${room.number}?`}
        description="The room and its remaining beds stay in the history (greyed out) but can no longer be used. Its number can be reused."
        confirmLabel="Invalidate room"
        destructive
        requireReason
        onConfirm={async (reason) => {
          await api(`/rooms/${room.id}/invalidate`, { body: { reason } });
          toast.success(`Room ${room.number} invalidated`);
          await router.refresh();
        }}
      />
      {bedId && <BedDrawer bedId={bedId} campId={campId} access={access} canManage={manage} onClose={() => setBedId(null)} />}
    </div>
  );
}

/** "Ram Prasad Adhikari" -> "Ram A." (titles like "Mr." / "Dr." skipped) so narrow tiles stay readable. */
export function shortName(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((p) => !/^(mr|mrs|ms|miss|dr|mx)\.?$/i.test(p));
  if (parts.length < 2) return parts[0] ?? fullName;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** The whole tile is the button: label + type, then occupant (or status). Min 72×56. */
function BedTile({ bed, onClick }: { bed: BedDto; onClick: () => void }) {
  const label = bed.occupant
    ? shortName(bed.occupant.fullName)
    : bed.status === "INVALIDATED"
      ? (bed.invalidation?.reason ?? "Invalidated")
      : BED_STATUS_LABELS[bed.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-14 min-w-0 flex-col items-start justify-between gap-1 rounded-lg border px-2.5 py-2 text-left transition hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
        BED_STATUS_STYLES[bed.status],
      )}
      title={`${bed.label} – ${BED_STATUS_LABELS[bed.status]}${bed.occupant ? ` – ${bed.occupant.fullName}` : ""}`}
    >
      <span className="flex w-full items-baseline justify-between gap-1">
        <span className={cn("text-[13px] font-bold", !bed.isActive && "line-through")}>{bed.label}</span>
        {bed.type && <span className="text-[10.5px] font-medium opacity-80">{BED_TYPE_SHORT[bed.type]}</span>}
      </span>
      <span className="w-full truncate text-xs font-medium">
        {label}
        {bed.occupant?.onLeave && " · leave"}
      </span>
    </button>
  );
}

function ReorderDialog({ room, onClose }: { room: RoomDto; onClose: () => void }) {
  const router = useAppRouter();
  const [beds, setBeds] = useState(room.beds.filter((b) => b.isActive));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api(`/rooms/${room.id}/beds/order`, { body: { bedIds: beds.map((b) => b.id) } });
      toast.success("Bed order saved");
      await router.refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reorder beds in room {room.number}</DialogTitle>
          <DialogDescription>Drag beds into the order they appear in the room. The bed map fills rows left to right.</DialogDescription>
        </DialogHeader>
        <Reorder.Group axis="y" values={beds} onReorder={setBeds} className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
          {beds.map((b, i) => (
            <Reorder.Item
              key={b.id}
              value={b}
              className="flex cursor-grab items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm active:cursor-grabbing"
              whileDrag={{ scale: 1.02, boxShadow: "0 8px 20px rgba(0,0,0,0.12)" }}
            >
              <GripVertical className="size-4 text-muted-foreground" />
              <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
              <span className="font-medium">{b.label}</span>
              {b.type && <span className="text-xs text-muted-foreground">{BED_TYPE_LABELS[b.type]}</span>}
              <span className="ml-auto truncate text-xs text-muted-foreground">{b.occupant?.fullName ?? BED_STATUS_LABELS[b.status]}</span>
            </Reorder.Item>
          ))}
        </Reorder.Group>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy} loading={busy}>
            {busy ? "Saving…" : "Save order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
