"use client";

import { hasPermission, type AccessProfile, type CampOptionDto, type WorkerListDto } from "@xperts/shared";
import { Building2, CornerDownLeft, Search, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppRouter } from "@/lib/use-app-router";

type Result = { key: string; kind: "worker" | "camp"; title: string; subtitle: string; href: string };

/** ⌘K / Ctrl+K search: workers by Emp No or name, camps by name. */
export function CommandPalette({ open, onOpenChange, access }: { open: boolean; onOpenChange: (o: boolean) => void; access: AccessProfile }) {
  const router = useAppRouter();
  const [q, setQ] = useState("");
  const [workers, setWorkers] = useState<Result[]>([]);
  const [camps, setCamps] = useState<CampOptionDto[]>([]);
  const [index, setIndex] = useState(0);
  const canWorkers = hasPermission(access, "workers.view");
  const canCamps = hasPermission(access, "camps.view");

  useEffect(() => {
    if (!open || !canCamps) return;
    api<CampOptionDto[]>("/camps/options").then(setCamps).catch(() => setCamps([]));
  }, [open, canCamps]);

  useEffect(() => {
    if (!open || !canWorkers) return;
    const term = q.trim();
    const t = setTimeout(() => {
      if (term.length < 2) {
        setWorkers([]);
        return;
      }
      api<WorkerListDto>(`/workers?status=ALL&pageSize=10&q=${encodeURIComponent(term)}`)
        .then((d) =>
          setWorkers(
            d.rows.map((w) => ({
              key: w.id,
              kind: "worker" as const,
              title: w.fullName,
              subtitle: `${w.employeeCode}${w.housing ? ` · ${w.housing.campName} · ${w.housing.roomNumber} · ${w.housing.bedLabel}` : ""}`,
              href: `/workers/${w.id}`,
            })),
          ),
        )
        .catch(() => setWorkers([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, canWorkers]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const campResults: Result[] = camps
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .slice(0, 5)
      .map((c) => ({ key: c.id, kind: "camp", title: c.name, subtitle: c.isActive ? "Camp" : "Camp · invalidated", href: `/camps/${c.id}` }));
    return [...workers, ...campResults];
  }, [workers, camps, q]);
  const selected = Math.min(index, Math.max(0, results.length - 1));

  function go(r: Result | undefined) {
    if (!r) return;
    onOpenChange(false);
    setQ("");
    router.push(r.href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[selected]);
              }
            }}
            placeholder={canWorkers ? "Search workers by Emp No or name, or a camp…" : "Search camps…"}
            className="h-13 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {q.trim().length < 2 && canWorkers ? "Type at least 2 characters to search workers." : "Nothing found."}
            </p>
          ) : (
            results.map((r, i) => {
              const Icon = r.kind === "worker" ? User : Building2;
              return (
                <button
                  key={`${r.kind}-${r.key}`}
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => go(r)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", i === selected && "bg-muted")}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{r.title}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{r.subtitle}</span>
                  </span>
                  {i === selected && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
