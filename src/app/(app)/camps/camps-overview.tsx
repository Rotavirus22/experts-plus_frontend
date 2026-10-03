"use client";

import { EMIRATE_LABELS, hasPermission, type AccessProfile, type CampSummaryDto } from "@xperts/shared";
import { Building2, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CampDialog } from "@/components/camps/camp-dialogs";
import { EmptyState, FadeIn, OccupancyBar, PageHeader, percentInUse, Pill } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatDate, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CampsOverview({ camps, access }: { camps: CampSummaryDto[]; access: AccessProfile }) {
  const [creating, setCreating] = useState(false);
  const [showInvalidated, setShowInvalidated] = useState(false);
  const canCreate = hasPermission(access, "camps.manage") && (access.isSystemAdmin || access.campScope === "ALL");
  const active = camps.filter((c) => c.isActive);
  const visible = camps.filter((c) => c.isActive || showInvalidated);
  const invalidatedCount = camps.length - active.length;
  const totals = active.reduce(
    (t, c) => ({ beds: t.beds + c.occupancy.beds, occupied: t.occupied + c.occupancy.occupied, held: t.held + c.occupancy.held, vacant: t.vacant + c.occupancy.vacant }),
    { beds: 0, occupied: 0, held: 0, vacant: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Camps"
        subtitle={`${active.length} camp${active.length === 1 ? "" : "s"} · ${totals.beds.toLocaleString()} beds · ${percentInUse(totals).toFixed(1)}% in use`}
        actions={
          <>
            {invalidatedCount > 0 && (
              <label className="mr-2 flex items-center gap-2.5 text-[13px] font-medium">
                <Switch checked={showInvalidated} onCheckedChange={setShowInvalidated} />
                Show invalidated ({invalidatedCount})
              </label>
            )}
            {canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus data-icon="inline-start" /> New camp
              </Button>
            )}
          </>
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="No camps yet"
          action={
            canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus data-icon="inline-start" /> New camp
              </Button>
            )
          }
        >
          {canCreate ? "Create the first camp, then add rooms and beds." : "You have not been given access to any camp."}
        </EmptyState>
      ) : (
        <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
          {visible.map((camp, i) => (
            <FadeIn key={camp.id} index={i}>
              <CampCard camp={camp} />
            </FadeIn>
          ))}
        </div>
      )}
      {creating && <CampDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CampCard({ camp }: { camp: CampSummaryDto }) {
  const o = camp.occupancy;
  return (
    <Link
      href={`/camps/${camp.id}`}
      className={cn(
        "flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        !camp.isActive && "border-dashed bg-muted/60 shadow-none hover:translate-y-0",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className={cn("truncate text-lg font-bold tracking-tight", !camp.isActive && "text-muted-foreground")}>{camp.name}</h3>
          <p className="flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {EMIRATE_LABELS[camp.emirate]}
            {camp.address ? ` · ${camp.address}` : ""}
          </p>
        </div>
        {!camp.isActive && <Pill>Invalidated</Pill>}
      </div>
      {camp.isActive ? <OccupancyBar occupancy={o} /> : <div className="h-2.5" />}
      <p className="text-[13px] text-muted-foreground">
        <span className="font-bold text-foreground">{plural(o.beds, "bed")}</span> · {percentInUse(o).toFixed(1)}% in use
      </p>
      {camp.invalidation && (
        <p className="text-xs text-muted-foreground">
          Invalidated {formatDate(camp.invalidation.at)}
          {camp.invalidation.byName ? ` by ${camp.invalidation.byName}` : ""}
          {camp.invalidation.reason ? ` · “${camp.invalidation.reason}”` : ""}
        </p>
      )}
      <div className="mt-auto grid grid-cols-4 gap-2 border-t pt-4">
        <Stat label="Rooms" value={camp.activeRooms} />
        <Stat label="Occupied" value={o.occupied} tone="text-status-occupied-fg" />
        <Stat label="Held" value={o.held} tone="text-status-held-fg" />
        <Stat label="Vacant" value={o.vacant} tone="text-status-vacant-fg" />
      </div>
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("text-xs font-medium text-muted-foreground", tone)}>{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  );
}
