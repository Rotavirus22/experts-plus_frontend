"use client";

import { EMIRATE_LABELS, hasPermission, type AccessProfile, type CampDetailDto } from "@xperts/shared";
import { ArrowLeft, Ban, BedDouble, MapPin, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RoomCard } from "@/components/camps/bed-map";
import { BedLegend } from "@/components/camps/bed-status";
import { CampExplorer } from "@/components/camps/camp-explorer";
import { CampDialog, RoomDialog } from "@/components/camps/camp-dialogs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, FadeIn, OccupancyBar, PageHeader, percentInUse, Pill } from "@/components/design/primitives";
import { SetBreadcrumb } from "@/components/shell/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { formatDate, plural } from "@/lib/format";
import { useAppRouter } from "@/lib/use-app-router";

export function CampDetail({ camp, access }: { camp: CampDetailDto; access: AccessProfile }) {
  const router = useAppRouter();
  const [dialog, setDialog] = useState<"edit" | "room" | "invalidate" | null>(null);
  const [search, setSearch] = useState("");
  const [showInvalidated, setShowInvalidated] = useState(false);
  const canManage = hasPermission(access, "camps.manage") && camp.isActive;
  const o = camp.occupancy;

  const rooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return camp.rooms.filter(
      (r) =>
        (r.isActive || showInvalidated || !camp.isActive) &&
        (!q || r.number.toLowerCase().includes(q) || r.beds.some((b) => b.occupant?.fullName.toLowerCase().includes(q) || b.occupant?.employeeCode.toLowerCase().includes(q))),
    );
  }, [camp, search, showInvalidated]);
  const invalidatedRooms = camp.rooms.filter((r) => !r.isActive).length;

  return (
    <div className="flex flex-col gap-5">
      <SetBreadcrumb items={[{ label: camp.name }]} />
      <PageHeader
        back={
          <Link href="/camps" className="inline-flex w-max items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-[15px]" /> All camps
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {camp.name}
            {!camp.isActive && <Pill>Invalidated</Pill>}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {EMIRATE_LABELS[camp.emirate]}
              {camp.address ? ` · ${camp.address}` : ""}
            </span>
            <span>
              {camp.effectiveSqmPerWorker} m² per worker
              {camp.sqmPerWorker === null && <span className="opacity-80"> ({EMIRATE_LABELS[camp.emirate]} default)</span>}
            </span>
            {camp.invalidation && (
              <span>
                Invalidated {formatDate(camp.invalidation.at)}
                {camp.invalidation.byName ? ` by ${camp.invalidation.byName}` : ""} · “{camp.invalidation.reason}”
              </span>
            )}
          </span>
        }
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={() => setDialog("edit")}>
                <Pencil data-icon="inline-start" /> Edit camp
              </Button>
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button variant="destructive-outline" disabled={camp.activeRooms > 0} onClick={() => setDialog("invalidate")}>
                    <Ban data-icon="inline-start" /> Invalidate camp
                  </Button>
                </TooltipTrigger>
                {camp.activeRooms > 0 && (
                  <TooltipContent className="max-w-60">
                    Invalidate all {camp.activeRooms} active rooms first. A camp can only be invalidated when it has no rooms in use.
                  </TooltipContent>
                )}
              </Tooltip>
              <Button onClick={() => setDialog("room")}>
                <Plus data-icon="inline-start" /> Add room
              </Button>
            </>
          )
        }
      />

      <CampExplorer camp={camp} access={access} canManage={canManage} />

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="flex items-baseline gap-3">
            <span className="text-[32px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">{percentInUse(o).toFixed(1)}%</span>
            <span className="text-sm text-muted-foreground">
              in use · {plural(o.beds, "bed")} in {plural(camp.activeRooms, "room")}
            </span>
          </p>
          <div className="flex flex-wrap gap-5 text-sm">
            <LegendCount dot="bg-status-occupied" value={o.occupied} label="occupied" />
            <LegendCount dot="bg-status-held" value={o.held} label="held" />
            <LegendCount dot="bg-status-vacant" value={o.vacant} label="vacant" />
          </div>
        </div>
        <OccupancyBar occupancy={o} height={12} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-[440px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Room number, worker name or Emp No" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <BedLegend />
          {invalidatedRooms > 0 && camp.isActive && (
            <label className="flex items-center gap-2.5 text-[13px] font-medium">
              <Switch checked={showInvalidated} onCheckedChange={setShowInvalidated} />
              Invalidated rooms ({invalidatedRooms})
            </label>
          )}
        </div>
      </div>

      {rooms.length === 0 ? (
        camp.rooms.length === 0 ? (
          <EmptyState
            icon={<BedDouble className="size-5" />}
            title={`${camp.name} has no rooms yet`}
            action={
              canManage && (
                <Button onClick={() => setDialog("room")}>
                  <Plus data-icon="inline-start" /> Add first room
                </Button>
              )
            }
          >
            Add rooms, then add beds to each one. Workers can be put into beds once they exist.
          </EmptyState>
        ) : (
          <EmptyState icon={<Search className="size-5" />} title="No rooms match">
            Try a different room number, name or Emp No.
          </EmptyState>
        )
      ) : (
        <div className="grid items-start gap-[18px] md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room, i) => (
            <FadeIn key={room.id} index={i}>
              <RoomCard campId={camp.id} room={room} access={access} canManage={canManage} sqmPerWorker={camp.effectiveSqmPerWorker} />
            </FadeIn>
          ))}
        </div>
      )}

      {dialog === "edit" && <CampDialog camp={camp} onClose={() => setDialog(null)} />}
      {dialog === "room" && <RoomDialog campId={camp.id} campName={camp.name} sqmPerWorker={camp.effectiveSqmPerWorker} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === "invalidate"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Invalidate ${camp.name}?`}
        description="The camp stays in the history (greyed out) with all its rooms and beds, but can no longer be used."
        confirmLabel="Invalidate camp"
        destructive
        requireReason
        onConfirm={async (reason) => {
          await api(`/camps/${camp.id}/invalidate`, { body: { reason } });
          toast.success(`${camp.name} invalidated`);
          await router.refresh();
        }}
      />
    </div>
  );
}

function LegendCount({ dot, value, label }: { dot: string; value: number; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-2.5 rounded-[3px] ${dot}`} />
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
