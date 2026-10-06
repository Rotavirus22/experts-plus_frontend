"use client";

import { bedGridColumns, type AccessProfile, type BedDto, type BedStatus, type CampDetailDto, type RoomDto } from "@xperts/shared";
import { ArrowLeft, Maximize2, Minimize2, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EASE } from "@/components/design/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BedDrawer } from "./bed-drawer";
import { shortName } from "./bed-map";
import { BED_STATUS_TEXT } from "./bed-status";

/**
 * Camp explorer: a top-down plan of the camp. Rooms are laid out in natural room-number order (there are no
 * floors), each drawn as a box of bed tiles coloured by status. Click a room to zoom in (bed labels and
 * occupants appear), click a bed to open its drawer. Find a worker to fly to their bed, filter by status,
 * watch tiles pulse when a bed changes, and go full screen for an office display.
 */

const FILTERABLE: BedStatus[] = ["OCCUPIED", "HELD", "VACANT"];
const TILE: Record<BedStatus, string> = {
  OCCUPIED: "bg-status-occupied border-status-occupied text-white",
  HELD: "bg-status-held border-status-held text-white",
  VACANT: "bg-status-vacant border-status-vacant text-white",
  INVALIDATED: "border-dashed border-status-invalid-border bg-status-invalid-bg text-status-invalid-fg",
};
const CHIP: Record<BedStatus, string> = {
  OCCUPIED: "bg-status-occupied",
  HELD: "bg-status-held",
  VACANT: "bg-status-vacant",
  INVALIDATED: "bg-status-invalid",
};

type Camera = { x: number; y: number; scale: number };
type Props = { camp: CampDetailDto; access: AccessProfile; canManage: boolean };

export function CampExplorer({ camp, access, canManage }: Props) {
  const reduceMotion = useReducedMotion();
  const rooms = useMemo(() => camp.rooms.filter((r) => r.isActive), [camp.rooms]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const roomRefs = useRef(new Map<string, HTMLDivElement>());

  const [focusId, setFocusId] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [toolbarH, setToolbarH] = useState(56);
  const [canvasW, setCanvasW] = useState(0);
  const [hidden, setHidden] = useState<Set<BedStatus>>(new Set());
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [drawerBedId, setDrawerBedId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const focused = rooms.find((r) => r.id === focusId) ?? null;

  // ───── camera ─────

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    // The toolbar wraps on narrow screens; the plan is laid out below whatever height it takes.
    const bar = toolbarRef.current;
    const barObserver = bar ? new ResizeObserver(() => setToolbarH(bar.offsetHeight)) : null;
    if (bar) barObserver!.observe(bar);
    return () => {
      observer.disconnect();
      barObserver?.disconnect();
    };
  }, []);

  // Pick the wrap width that lets the whole plan render largest in the space available.
  useLayoutEffect(() => {
    if (!size.w || !size.h) return;
    const boxes = rooms.map((r) => roomRefs.current.get(r.id)).filter((el): el is HTMLDivElement => !!el);
    if (!boxes.length) return;
    setCanvasW(bestWrapWidth(boxes.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight })), size.w, Math.max(size.h - toolbarH - 22, 80)));
  }, [rooms, size, toolbarH]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h || !canvasW) return;
    const room = focusId ? roomRefs.current.get(focusId) : null;
    const top = toolbarH;
    const free = Math.max(size.h - top - (focusId ? 0 : 22), 80); // leave room for the hint line when zoomed out
    if (room) {
      const w = room.offsetWidth;
      const h = room.offsetHeight;
      const scale = Math.min((size.w * 0.86) / w, (free * 0.86) / h, 7);
      setCamera({ scale, x: size.w / 2 - (room.offsetLeft + w / 2) * scale, y: top + free / 2 - (room.offsetTop + h / 2) * scale });
    } else {
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      const scale = Math.min((size.w * 0.96) / cw, (free * 0.94) / ch, 2.4);
      setCamera({ scale, x: (size.w - cw * scale) / 2, y: top + (free - ch * scale) / 2 });
    }
  }, [focusId, size, rooms, toolbarH, canvasW]);

  const zoomOut = useCallback(() => setFocusId(null), []);

  useEffect(() => {
    if (!focusId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !drawerBedId && !document.fullscreenElement) zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusId, drawerBedId, zoomOut]);

  // ───── live changes: pulse tiles whose status changed after a refresh ─────

  const previous = useRef<Map<string, BedStatus> | null>(null);
  useEffect(() => {
    const now = new Map(rooms.flatMap((r) => r.beds.map((b) => [b.id, b.status] as const)));
    const before = previous.current;
    previous.current = now;
    if (!before) return;
    const diff = new Set([...now].filter(([id, status]) => before.has(id) && before.get(id) !== status).map(([id]) => id));
    if (!diff.size) return;
    setChanged(diff);
    const t = window.setTimeout(() => setChanged(new Set()), 2200);
    return () => window.clearTimeout(t);
  }, [rooms]);

  // ───── find a worker ─────

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return rooms
      .flatMap((room) => room.beds.filter((b) => b.occupant).map((bed) => ({ room, bed })))
      .filter(({ bed }) => bed.occupant!.fullName.toLowerCase().includes(q) || bed.occupant!.employeeCode.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, rooms]);

  function flyTo(room: RoomDto, bed: BedDto) {
    setFocusId(room.id);
    setHighlight(bed.id);
    setQuery("");
    window.setTimeout(() => setHighlight((h) => (h === bed.id ? null : h)), 6000);
  }

  // ───── full screen ─────

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrapperRef.current?.requestFullscreen?.();
  }

  async function openBed(bedId: string) {
    // The drawer renders outside the explorer, so leave full screen first or it would open unseen.
    if (document.fullscreenElement) await document.exitFullscreen();
    setDrawerBedId(bedId);
  }

  if (rooms.length === 0) return null;

  const counts = camp.occupancy;
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.55, ease: EASE };

  return (
    <section
      ref={wrapperRef}
      aria-label="Camp explorer"
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card shadow-sm",
        fullscreen ? "h-screen rounded-none border-0" : "h-[420px] sm:h-[380px]",
      )}
    >
      {/* Dotted floor */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      />

      {/* Toolbar */}
      <div ref={toolbarRef} className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 p-3 [&>*]:pointer-events-auto">
        {focused ? (
          <Button size="sm" variant="outline" onClick={zoomOut}>
            <ArrowLeft data-icon="inline-start" /> All rooms
          </Button>
        ) : (
          <span className="rounded-lg bg-card/90 px-2.5 py-1 text-[13px] font-bold shadow-sm backdrop-blur">Camp plan</span>
        )}
        {focused && (
          <span className="rounded-lg bg-card/90 px-2.5 py-1 text-[13px] font-bold shadow-sm backdrop-blur">
            Room {focused.number}
            <span className="font-medium text-muted-foreground">
              {" "}
              · {focused.occupancy.occupied} occupied · {focused.occupancy.held} held · {focused.occupancy.vacant} vacant
            </span>
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Find a worker in this camp"
              className="h-7.5 w-44 bg-card/95 pl-8 text-[13px] sm:w-56"
              placeholder="Find a worker…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) flyTo(matches[0].room, matches[0].bed);
                if (e.key === "Escape") setQuery("");
              }}
            />
            {query.trim().length >= 2 && (
              <ul role="listbox" aria-label="Matching workers" className="absolute right-0 z-30 mt-1 w-72 overflow-hidden rounded-lg border bg-popover text-sm shadow-md">
                {matches.length === 0 ? (
                  <li className="px-3 py-2 text-muted-foreground">No one in this camp matches.</li>
                ) : (
                  matches.map(({ room, bed }) => (
                    <li key={bed.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => flyTo(room, bed)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{bed.occupant!.fullName}</span>
                          <span className="font-mono text-xs text-muted-foreground">{bed.occupant!.employeeCode}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                          Room {room.number} · {bed.label}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div role="group" aria-label="Show bed statuses" className="flex gap-1 rounded-lg bg-card/90 p-0.5 shadow-sm backdrop-blur">
            {FILTERABLE.map((s) => {
              const on = !hidden.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (next.has(s)) next.delete(s);
                      else next.add(s);
                      return next.size === FILTERABLE.length ? new Set() : next;
                    })
                  }
                  className={cn(
                    "flex h-6.5 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition",
                    on ? "bg-muted text-foreground" : "text-muted-foreground opacity-60 line-through",
                  )}
                >
                  <span className={cn("size-2 rounded-[2px]", CHIP[s])} />
                  {s === "OCCUPIED" ? `${counts.occupied} occupied` : s === "HELD" ? `${counts.held} held` : `${counts.vacant} vacant`}
                </button>
              );
            })}
          </div>

          <Button size="icon-sm" variant="outline" aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </div>

      {/* Plan */}
      <div
        ref={viewportRef}
        className="absolute inset-0"
        onClick={(e) => {
          if (e.target === e.currentTarget && focusId) zoomOut();
        }}
      >
        <motion.div
          ref={canvasRef}
          className="absolute top-0 left-0 flex flex-wrap content-start items-start gap-3 p-4"
          style={{ width: canvasW || Math.max(size.w, 320), transformOrigin: "0 0" }}
          initial={false}
          animate={camera}
          transition={transition}
        >
          {rooms.map((room) => (
            <RoomBox
              key={room.id}
              room={room}
              focused={room.id === focusId}
              dimmed={!!focusId && room.id !== focusId}
              hidden={hidden}
              highlight={highlight}
              changed={changed}
              reduceMotion={!!reduceMotion}
              setRef={(el) => {
                if (el) roomRefs.current.set(room.id, el);
                else roomRefs.current.delete(room.id);
              }}
              onRoom={() => setFocusId(room.id)}
              onBed={openBed}
            />
          ))}
        </motion.div>
      </div>

      {!focused && (
        <p className="pointer-events-none absolute bottom-2.5 left-3 z-10 text-[11.5px] font-medium text-muted-foreground">
          Click a room to zoom in · click a bed for details
        </p>
      )}

      {drawerBedId && (
        <BedDrawer
          bedId={drawerBedId}
          campId={camp.id}
          access={access}
          canManage={canManage && (focused?.isActive ?? true)}
          onClose={() => setDrawerBedId(null)}
        />
      )}
    </section>
  );
}

function RoomBox({
  room,
  focused,
  dimmed,
  hidden,
  highlight,
  changed,
  reduceMotion,
  setRef,
  onRoom,
  onBed,
}: {
  room: RoomDto;
  focused: boolean;
  dimmed: boolean;
  hidden: Set<BedStatus>;
  highlight: string | null;
  changed: Set<string>;
  reduceMotion: boolean;
  setRef: (el: HTMLDivElement | null) => void;
  onRoom: () => void;
  onBed: (bedId: string) => void;
}) {
  const inUse = room.occupancy.occupied + room.occupancy.held;
  const columns = bedGridColumns(room.beds.length);
  return (
    // Zoomed out the whole room is one button; zoomed in it becomes a group so each bed is its own button.
    <div
      ref={setRef}
      role={focused ? "group" : "button"}
      tabIndex={focused ? undefined : 0}
      onClick={focused ? undefined : onRoom}
      onKeyDown={
        focused
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRoom();
              }
            }
      }
      aria-label={`Room ${room.number}: ${inUse} of ${room.occupancy.beds} beds in use${focused ? "" : ". Zoom in"}`}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border-2 bg-card/95 p-1.5 text-left shadow-sm transition-[opacity,border-color,box-shadow] duration-300",
        focused ? "cursor-default border-primary shadow-md" : "cursor-zoom-in hover:border-primary/60 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring",
        dimmed && "opacity-25",
        room.capacityWarning && !focused && "border-warning-border",
      )}
    >
      <span className="flex items-center justify-between gap-2 px-0.5 text-[9px] leading-none font-bold">
        <span>{room.number}</span>
        <span className="font-semibold text-muted-foreground tabular-nums">
          {inUse}/{room.occupancy.beds}
        </span>
      </span>
      {room.beds.length === 0 ? (
        <span className="px-0.5 pb-0.5 text-[7px] text-muted-foreground">No beds</span>
      ) : (
        <span className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${columns}, 22px)` }}>
          {room.beds.map((bed) => {
            const faded = hidden.size > 0 && (bed.status === "INVALIDATED" || hidden.has(bed.status));
            const isHighlight = highlight === bed.id;
            const isChanged = changed.has(bed.id);
            const label = bed.occupant ? `${bed.label}, ${BED_STATUS_TEXT[bed.status]}: ${bed.occupant.fullName}` : `${bed.label}, ${BED_STATUS_TEXT[bed.status]}`;
            return (
              <motion.span
                key={bed.id}
                role={focused ? "button" : undefined}
                tabIndex={focused ? 0 : -1}
                aria-label={focused ? label : undefined}
                title={label}
                onClick={
                  focused
                    ? (e) => {
                        e.stopPropagation();
                        onBed(bed.id);
                      }
                    : undefined
                }
                onKeyDown={
                  focused
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onBed(bed.id);
                        }
                      }
                    : undefined
                }
                animate={isChanged && !reduceMotion ? { scale: [1, 1.45, 1] } : { scale: 1 }}
                transition={{ duration: 0.7, ease: EASE }}
                className={cn(
                  "relative flex h-[18px] w-[22px] flex-col justify-center overflow-hidden rounded-[3px] border px-[2px] leading-none transition-[opacity,background-color] duration-500",
                  TILE[bed.status],
                  faded && "opacity-15",
                  focused && "cursor-pointer hover:brightness-110 focus-visible:outline-2 focus-visible:outline-ring",
                  isChanged && "ring-2 ring-primary ring-offset-1",
                  isHighlight && "z-10 ring-[2px] ring-foreground ring-offset-1 ring-offset-card",
                )}
              >
                {isHighlight && !reduceMotion && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-[3px] bg-white"
                    animate={{ opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
                <span className={cn("relative text-[5px] font-bold transition-opacity", focused ? "opacity-100" : "opacity-0")}>{bed.label}</span>
                <span className={cn("relative truncate text-[3.5px] font-medium transition-opacity", focused ? "opacity-95" : "opacity-0")}>
                  {bed.occupant ? shortName(bed.occupant.fullName) : bed.status === "VACANT" ? "Vacant" : ""}
                </span>
              </motion.span>
            );
          })}
        </span>
      )}
    </div>
  );
}

const PAD = 16;
const GAP = 12;

/** Simulates the flex-wrap layout for candidate widths and returns the one with the largest fit scale. */
function bestWrapWidth(boxes: { w: number; h: number }[], viewW: number, viewH: number): number {
  const widest = Math.max(...boxes.map((b) => b.w)) + PAD * 2;
  const total = boxes.reduce((sum, b) => sum + b.w + GAP, PAD * 2);
  let best = { width: Math.max(widest, viewW), scale: 0 };
  for (let width = widest; width <= Math.max(total, widest); width += 16) {
    let x = PAD;
    let y = PAD;
    let rowH = 0;
    let used = 0;
    for (const b of boxes) {
      if (x > PAD && x + b.w > width - PAD) {
        y += rowH + GAP;
        x = PAD;
        rowH = 0;
      }
      x += b.w + GAP;
      used = Math.max(used, x - GAP + PAD);
      rowH = Math.max(rowH, b.h);
    }
    const height = y + rowH + PAD;
    const scale = Math.min(viewW / used, viewH / height);
    if (scale > best.scale) best = { width: used + 2, scale }; // +2px so sub-pixel widths never wrap differently
  }
  return best.width;
}
