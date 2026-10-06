"use client";

import type { RoomDto, RoomHistoryDto, RoomStayHistoryDto } from "@xperts/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Pill } from "@/components/design/primitives";
import { ExportButton } from "@/components/export-button";
import { LoadingText } from "@/components/skeletons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api";
import { formatDate, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Everyone who ever stayed in a room (any of its beds), newest first, with an Excel export. */
export function RoomHistoryDialog({ room, onClose }: { room: RoomDto; onClose: () => void }) {
  const [data, setData] = useState<RoomHistoryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api<RoomHistoryDto>(`/rooms/${room.id}/history`)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [room.id]);

  const people = data ? new Set(data.stays.map((s) => s.workerId)).size : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Room {room.number} history</DialogTitle>
          <DialogDescription>
            {data
              ? data.stays.length
                ? `${people === 1 ? "1 person" : `${people} people`} stayed here (${plural(data.stays.length, "stay")}), newest first.`
                : "Nobody has stayed in this room yet."
              : "Everyone who stayed in any bed of this room."}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data ? (
          <LoadingText>Loading history…</LoadingText>
        ) : (
          data.stays.length > 0 && (
            <>
              <ol className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1" aria-label={`Stays in room ${room.number}`}>
                {data.stays.map((s) => (
                  <Stay key={s.id} stay={s} />
                ))}
              </ol>
              <div className="flex justify-end">
                <ExportButton href={`/api/rooms/${room.id}/history.xlsx`} fallbackName={`room-${room.number}-history.xlsx`} />
              </div>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stay({ stay: s }: { stay: RoomStayHistoryDto }) {
  const current = !s.endDate && !s.invalidated;
  return (
    <li className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-xl border p-3 text-sm", current && "border-primary/40 bg-status-occupied-bg", s.invalidated && "opacity-60")}>
      <div className="flex min-w-0 flex-col">
        <Link href={`/workers/${s.workerId}`} className="truncate font-semibold hover:underline">
          {s.fullName}
        </Link>
        <span className="text-xs text-muted-foreground">
          <span className="font-mono">{s.employeeCode}</span> · {s.bedLabel}
        </span>
      </div>
      <div className="flex flex-col items-end text-right">
        <span className="tabular-nums">
          {formatDate(s.startDate)} → {s.endDate ? formatDate(s.endDate) : "now"}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {current && <Pill tone="success">Here now</Pill>}
          {s.invalidated ? "Entered by mistake (removed)" : s.endReason === "MOVED" ? "Moved out" : s.endReason === "EXITED" ? "Exited" : ""}
          {s.createdByName && ` · by ${s.createdByName}`}
        </span>
      </div>
    </li>
  );
}
