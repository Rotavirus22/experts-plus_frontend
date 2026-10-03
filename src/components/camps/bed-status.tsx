import type { BedStatus, BedType } from "@xperts/shared";
import { cn } from "@/lib/utils";

/** Tile / chip colours per bed status (design tokens, light + dark). Invalidated = dashed + struck label. */
export const BED_STATUS_STYLES: Record<BedStatus, string> = {
  OCCUPIED: "border-status-occupied-border bg-status-occupied-bg text-status-occupied-fg",
  HELD: "border-status-held-border bg-status-held-bg text-status-held-fg",
  VACANT: "border-status-vacant-border bg-status-vacant-bg text-status-vacant-fg",
  INVALIDATED: "border-dashed border-status-invalid-border bg-status-invalid-bg text-status-invalid-fg",
};

export const BED_STATUS_DOT: Record<Exclude<BedStatus, "INVALIDATED">, string> = {
  OCCUPIED: "bg-status-occupied",
  HELD: "bg-status-held",
  VACANT: "bg-status-vacant",
};

/** Label used wherever status is shown; Held always says why. */
export const BED_STATUS_TEXT: Record<BedStatus, string> = {
  OCCUPIED: "Occupied",
  HELD: "Held · on leave",
  VACANT: "Vacant",
  INVALIDATED: "Invalidated",
};

export const BED_TYPE_SHORT: Record<BedType, string> = { SINGLE: "Single", BUNK_LOWER: "Lower", BUNK_UPPER: "Upper" };
export const BED_TYPE_LABELS: Record<BedType, string> = { SINGLE: "Single", BUNK_LOWER: "Bunk lower", BUNK_UPPER: "Bunk upper" };

export function BedStatusBadge({ status, className }: { status: BedStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-[11.5px] font-bold whitespace-nowrap",
        BED_STATUS_STYLES[status],
        status === "INVALIDATED" && "line-through",
        className,
      )}
    >
      {BED_STATUS_TEXT[status]}
    </span>
  );
}

/** Legend chips shown above bed maps. */
export function BedLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(["OCCUPIED", "HELD", "VACANT", "INVALIDATED"] as const).map((s) => (
        <BedStatusBadge key={s} status={s} />
      ))}
    </div>
  );
}
