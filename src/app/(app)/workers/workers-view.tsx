"use client";

import { tableFeatures, useTable, type ColumnDef } from "@tanstack/react-table";
import {
  hasPermission,
  WORKER_STATUS_LABELS,
  WORKER_STATUSES,
  type AccessProfile,
  type WorkerListDto,
  type WorkerListQuery,
  type WorkerMetaDto,
  type WorkerRowDto,
  type WorkerSortField,
} from "@xperts/shared";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileUp, Pencil, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { EmptyState, PageHeader } from "@/components/design/primitives";
import { ExportButton } from "@/components/export-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccommodationBadge, accommodationRowClass, BedButton, ExitButton, LeaveToggle } from "@/components/workers/worker-actions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toSearchParams } from "@/lib/worker-query";
import { useAppRouter } from "@/lib/use-app-router";

const ALL = "__all";
const features = tableFeatures({});

type Props = { data: WorkerListDto; meta: WorkerMetaDto; query: WorkerListQuery; access: AccessProfile };

export function WorkersView({ data, meta, query, access }: Props) {
  const router = useAppRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q ?? "");

  function update(patch: Partial<WorkerListQuery>, resetPage = true) {
    const next = { ...query, ...patch, ...(resetPage ? { page: 1 } : {}) };
    const qs = toSearchParams(next).toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounced search box.
  useEffect(() => {
    if ((query.q ?? "") === search) return;
    const t = setTimeout(() => update({ q: search || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const departments = useMemo(() => meta.clients.find((c) => c.id === query.clientId)?.departments ?? [], [meta.clients, query.clientId]);
  const canManage = hasPermission(access, "workers.manage");
  const exportQs = toSearchParams({ ...query, page: undefined, pageSize: undefined }).toString();

  const columns = useMemo<ColumnDef<typeof features, WorkerRowDto>[]>(
    () => [
      {
        id: "employeeCode",
        header: "Emp No",
        cell: ({ row }) => <span className="font-mono text-[13px] font-medium">{row.original.employeeCode}</span>,
      },
      {
        id: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex min-w-40 flex-col">
            <Link href={`/workers/${row.original.id}`} className="font-semibold hover:underline">
              {row.original.fullName}
            </Link>
            <span className="text-xs text-muted-foreground capitalize">{row.original.nationality?.toLowerCase() ?? "—"}</span>
          </div>
        ),
      },
      {
        id: "designation",
        header: "Position",
        cell: ({ row }) => (
          <span className="line-clamp-2 block max-w-44 text-sm whitespace-normal" title={row.original.designation ?? undefined}>
            {row.original.designation ?? "—"}
          </span>
        ),
      },
      {
        id: "division",
        header: "Division / Client",
        cell: ({ row }) => (
          <div className="flex max-w-44 flex-col text-sm">
            <span className="truncate">{row.original.departmentName ?? "—"}</span>
            <span className="truncate text-xs text-muted-foreground" title={row.original.clientName ?? undefined}>
              {row.original.clientName ?? ""}
            </span>
          </div>
        ),
      },
      {
        id: "housing",
        header: "Camp · Room · Bed",
        cell: ({ row }) => {
          const w = row.original;
          if (w.housing)
            return (
              <div className="flex flex-col text-sm">
                <span>{w.housing.campName}</span>
                <span className="text-xs text-muted-foreground">
                  Room {w.housing.roomNumber} · <span className="font-bold text-foreground">{w.housing.bedLabel}</span>
                </span>
              </div>
            );
          return <span className="text-sm text-muted-foreground">{w.status === "ACTIVE" ? "No bed" : "Bed released"}</span>;
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const w = row.original;
          return (
            <div className="flex flex-col items-start gap-1">
              <AccommodationBadge status={w.accommodationStatus} />
              {w.status !== "ACTIVE" ? (
                <span className="text-xs text-muted-foreground">
                  {WORKER_STATUS_LABELS[w.status]} · {formatDate(w.exitDate)}
                </span>
              ) : w.leave ? (
                <span className="text-xs text-muted-foreground">Since {formatDate(w.leave.since)} · bed held</span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const w = row.original;
          if (w.status !== "ACTIVE")
            return (
              <div className="flex justify-end">
                <Link href={`/workers/${w.id}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
                  View history
                </Link>
              </div>
            );
          return (
            <div className="flex items-center justify-end gap-1">
              <BedButton worker={w} access={access} onlyWhenUnhoused />
              {w.housing && <LeaveToggle worker={w} access={access} />}
              {canManage && (
                <Link href={`/workers/${w.id}/edit`} className={buttonVariants({ size: "icon-sm", variant: "ghost" })} aria-label={`Edit ${w.fullName}`} title="Edit">
                  <Pencil />
                </Link>
              )}
              <ExitButton worker={w} access={access} />
            </div>
          );
        },
      },
    ],
    [access, canManage],
  );

  const table = useTable({ features, columns, data: data.rows });
  const SORTABLE: Partial<Record<string, WorkerSortField>> = { employeeCode: "employeeCode", fullName: "fullName", designation: "designation" };
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.total, data.page * data.pageSize);
  const filtered =
    Boolean(query.q || query.clientId || query.departmentId || query.campId) || query.status !== "ACTIVE" || query.leave !== "ALL" || query.housing !== "ALL";
  const scopeText =
    query.status === "ACTIVE"
      ? "active workers"
      : query.status === "EXITED"
        ? "exited workers"
        : query.status === "ALL"
          ? "workers"
          : WORKER_STATUS_LABELS[query.status].toLowerCase();
  const clear = () => {
    setSearch("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Workers"
        subtitle={
          <>
            <span className="font-bold text-foreground">{data.total.toLocaleString()}</span> matching · {scopeText}
            {query.campId ? ` in ${meta.camps.find((c) => c.id === query.campId)?.name ?? "this camp"}` : access.isSystemAdmin || access.campScope === "ALL" ? " across all camps" : " in your camps"}
          </>
        }
        actions={
          <>
            {hasPermission(access, "workers.export") && (
              <ExportButton href={`/api/workers/export.xlsx${exportQs ? `?${exportQs}` : ""}`} fallbackName="workers.xlsx" />
            )}
            {canManage && (
              <Link href="/workers/import" className={buttonVariants({ variant: "outline" })}>
                <FileUp data-icon="inline-start" /> Import from Excel
              </Link>
            )}
            {canManage && (
              <Link href="/workers/new" className={buttonVariants()}>
                <Plus data-icon="inline-start" /> Add worker
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search Emp No, name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <FilterSelect
            label="Client"
            value={query.clientId}
            options={meta.clients.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => update({ clientId: v, departmentId: undefined })}
          />
          <FilterSelect
            label="Division"
            value={query.departmentId}
            disabled={!query.clientId}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            onChange={(v) => update({ departmentId: v })}
          />
          <FilterSelect
            label="Camp"
            value={query.campId}
            options={meta.camps.map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name} (invalidated)` }))}
            onChange={(v) => update({ campId: v })}
          />
          <FilterSelect
            label="Status"
            allLabel="Any"
            value={query.status === "ALL" ? undefined : query.status}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "EXITED", label: "Exited (any reason)" },
              ...WORKER_STATUSES.filter((s) => s !== "ACTIVE").map((s) => ({ value: s, label: WORKER_STATUS_LABELS[s] })),
            ]}
            onChange={(v) => update({ status: (v ?? "ALL") as WorkerListQuery["status"] })}
          />
          <FilterSelect
            label="Leave"
            value={query.leave === "ALL" ? undefined : query.leave}
            options={[
              { value: "PRESENT", label: "Present" },
              { value: "ON_LEAVE", label: "On leave" },
            ]}
            onChange={(v) => update({ leave: (v ?? "ALL") as WorkerListQuery["leave"] })}
          />
          <FilterSelect
            label="Bed"
            value={query.housing === "ALL" ? undefined : query.housing}
            options={[
              { value: "HOUSED", label: "Has a bed" },
              { value: "UNHOUSED", label: "No bed" },
            ]}
            onChange={(v) => update({ housing: (v ?? "ALL") as WorkerListQuery["housing"] })}
          />
          {filtered && (
            <Button variant="link" className="px-2" onClick={clear}>
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="font-semibold">Row colour</span>
          <Swatch className="border-border bg-card" label="Occupied" />
          <Swatch className="border-status-vacant-border bg-row-leave" label="On leave" />
          <Swatch className="border-warning-border bg-row-nobed" label="No bed" />
          <Swatch className="border-border bg-row-exited" label="Exited" />
        </div>
      </div>

      {data.rows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title={filtered ? "No workers match these filters" : "No active workers yet"}
          action={
            filtered ? (
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            ) : (
              canManage && (
                <Link href="/workers/new" className={buttonVariants()}>
                  <Plus data-icon="inline-start" /> Add worker
                </Link>
              )
            )
          }
        >
          {!filtered && "Add workers here, then assign each one a bed from their page or from the camp map."}
        </EmptyState>
      ) : (
        <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm transition-opacity", pending && "opacity-60")}>
          {/* Phones: one card per worker. */}
          <ul className="divide-y md:hidden">
            {data.rows.map((w) => (
              <li key={w.id} className={cn("flex flex-col gap-2.5 p-4", accommodationRowClass(w.accommodationStatus))}>
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/workers/${w.id}`} className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{w.fullName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{w.employeeCode}</span>
                      {w.designation && ` · ${w.designation}`}
                    </span>
                  </Link>
                  <AccommodationBadge status={w.accommodationStatus} />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {w.housing ? (
                    <>
                      {w.housing.campName} · Room {w.housing.roomNumber} · <span className="font-bold text-foreground">{w.housing.bedLabel}</span>
                    </>
                  ) : w.status === "ACTIVE" ? (
                    "No bed"
                  ) : (
                    `${WORKER_STATUS_LABELS[w.status]} · ${formatDate(w.exitDate)}`
                  )}
                  {w.leave && ` · on leave since ${formatDate(w.leave.since)}`}
                </p>
                {w.status === "ACTIVE" && (
                  <div className="flex flex-wrap gap-2 [&_button]:min-h-11">
                    <BedButton worker={w} access={access} onlyWhenUnhoused />
                    {w.housing && <LeaveToggle worker={w} access={access} />}
                    <ExitButton worker={w} access={access} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Table className="hidden md:table">
            <TableHeader className="bg-muted/60">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => {
                    const sortKey = SORTABLE[header.column.id];
                    const active = sortKey && query.sort === sortKey;
                    return (
                      <TableHead
                        key={header.id}
                        className={cn("h-11 text-xs font-semibold text-muted-foreground", header.column.id === "actions" && "text-right")}
                      >
                        {sortKey ? (
                          <button
                            type="button"
                            className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
                            onClick={() => update({ sort: sortKey, dir: active && query.dir === "asc" ? "desc" : "asc" }, false)}
                          >
                            <table.FlexRender header={header} />
                            {active ? (
                              query.dir === "asc" ? (
                                <ArrowUp className="size-3.5" />
                              ) : (
                                <ArrowDown className="size-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3.5 opacity-40" />
                            )}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={accommodationRowClass(row.original.accommodationStatus)}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-[13px] text-muted-foreground">
            <div className="flex items-center gap-2">
              Rows per page
              <Select
                items={["25", "50", "100", "200"].map((v) => ({ value: v, label: v }))}
                value={String(data.pageSize)}
                onValueChange={(v) => v && update({ pageSize: Number(v) })}
              >
                <SelectTrigger size="sm" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["25", "50", "100", "200"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <span>
                {from}–{to} of {data.total.toLocaleString()}
              </span>
              <Pager page={data.page} pages={pages} onPage={(p) => update({ page: p }, false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const items: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) items.push(p);
    else if (items[items.length - 1] !== "…") items.push("…");
  }
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft />
      </Button>
      {items.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1">
            …
          </span>
        ) : (
          <Button
            key={p}
            size="icon-sm"
            variant={p === page ? "default" : "outline"}
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            className="text-[13px] tabular-nums"
          >
            {p}
          </Button>
        ),
      )}
      <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        <ChevronRight />
      </Button>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3.5 rounded-[4px] border", className)} />
      {label}
    </span>
  );
}

/** Trigger reads "Client  All" — muted label, bold value. */
function FilterSelect({
  label,
  allLabel = "All",
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  allLabel?: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}) {
  const items = [{ value: ALL, label: allLabel }, ...options];
  return (
    <Select items={items} value={value ?? ALL} onValueChange={(v) => onChange(!v || v === ALL ? undefined : v)} disabled={disabled}>
      <SelectTrigger className="max-w-56 gap-2" aria-label={label}>
        <span className="text-muted-foreground">{label}</span>
        <SelectValue className="font-semibold" />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

