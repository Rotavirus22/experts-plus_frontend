"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ALL_PERMISSIONS, PERMISSIONS, roleInputSchema, type Permission, type RoleDto, type RoleInput } from "@xperts/shared";
import { Lock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { PageHeader, Pill } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppRouter } from "@/lib/use-app-router";

const GROUPS = Object.entries(
  ALL_PERMISSIONS.reduce<Record<string, Permission[]>>((acc, key) => {
    (acc[PERMISSIONS[key].group] ??= []).push(key);
    return acc;
  }, {}),
);
const TOTAL = ALL_PERMISSIONS.length;

export function RolesManager({ roles }: { roles: RoleDto[] }) {
  const router = useAppRouter();
  const [editing, setEditing] = useState<RoleDto | "new" | null>(null);
  const [invalidating, setInvalidating] = useState<RoleDto | null>(null);

  const columns = useMemo<DataTableColumn<RoleDto>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Role",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className={cn("flex items-center gap-1.5 font-semibold", !row.original.isActive && "text-muted-foreground")}>
              {row.original.isSystem && <Lock className="size-3.5 text-brand-ink" />}
              {row.original.name}
            </span>
            {row.original.description && <span className="max-w-md truncate text-xs text-muted-foreground">{row.original.description}</span>}
          </div>
        ),
      },
      {
        id: "permissions",
        header: "Permissions",
        accessorFn: (r) => (r.isSystem ? TOTAL : r.permissions.length),
        cell: ({ getValue }) => {
          const n = getValue() as number;
          return (
            <span className="flex items-center gap-2.5">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / TOTAL) * 100}%` }} />
              </span>
              <span className="text-sm font-medium tabular-nums">
                {n} of {TOTAL}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "campScope",
        header: "Camps",
        cell: ({ row }) => (row.original.isSystem || row.original.campScope === "ALL" ? "All camps" : "Assigned only"),
      },
      { accessorKey: "activeUserCount", header: "Active users" },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => (r.isActive ? "Active" : "Invalidated"),
        cell: ({ row }) => {
          const r = row.original;
          if (r.isSystem) return <Pill tone="accent">Locked</Pill>;
          if (r.isActive) return <Pill tone="success">Active</Pill>;
          return (
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <Pill className="border-dashed">Invalidated</Pill>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Invalidated {formatDate(r.invalidatedAt)} · “{r.invalidationReason}”
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => {
          const role = row.original;
          if (role.isSystem || !role.isActive) return null;
          const inUse = role.activeUserCount > 0;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setEditing(role)}>
                Edit
              </Button>
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button size="sm" variant="destructive-ghost" disabled={inUse} onClick={() => setInvalidating(role)}>
                    Invalidate
                  </Button>
                </TooltipTrigger>
                {inUse && (
                  <TooltipContent className="max-w-60">
                    {role.activeUserCount} user{role.activeUserCount === 1 ? " has" : "s have"} this role. Move them to another role first.
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Roles & permissions"
        subtitle="Roles decide which pages and actions staff see, and which camps they can work in."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" /> New role
          </Button>
        }
      />
      <DataTable data={roles} columns={columns} search="" rowClassName={(r) => (r.isActive ? undefined : "bg-muted/50")} />
      {editing && (
        <RoleDialog
          role={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await router.refresh();
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={invalidating !== null}
        onOpenChange={(o) => !o && setInvalidating(null)}
        title={`Invalidate “${invalidating?.name}”?`}
        description="The role stays in the history but can no longer be assigned. Its name can be reused."
        confirmLabel="Invalidate role"
        destructive
        requireReason
        reasonPlaceholder="e.g. 2025 intake finished"
        onConfirm={async (reason) => {
          await api(`/roles/${invalidating!.id}/invalidate`, { body: { reason } });
          toast.success("Role invalidated");
          await router.refresh();
        }}
      />
    </div>
  );
}

function RoleDialog({ role, onClose, onSaved }: { role: RoleDto | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RoleInput>({
    resolver: zodResolver(roleInputSchema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      permissions: role?.permissions ?? [],
      campScope: role?.campScope ?? "ASSIGNED",
    },
  });

  async function onSubmit(values: RoleInput) {
    try {
      await api(role ? `/roles/${role.id}` : "/roles", { method: role ? "PATCH" : "POST", body: values });
      toast.success(role ? "Role updated" : "Role created");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="text-xl">{role ? `Edit role · ${role.name}` : "New role"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="role-name" aria-invalid={!!errors.name} {...register("name")} />
              {errors.name && <p className="text-[13px] text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-description">Description</Label>
              <Input id="role-description" {...register("description")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span id="role-camp-access" className="text-sm leading-none font-medium">
              Camp access
            </span>
            <Controller
              control={control}
              name="campScope"
              render={({ field }) => (
                <div role="radiogroup" aria-labelledby="role-camp-access" className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["ALL", "All camps", "Every current and future camp"],
                      ["ASSIGNED", "Only camps assigned to each user", "Chosen per user on the Users page"],
                    ] as const
                  ).map(([value, title, hint]) => {
                    const selected = field.value === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => field.onChange(value)}
                        className={cn("flex items-start gap-3 rounded-xl border p-3.5 text-left transition", selected ? "border-primary bg-status-occupied-bg" : "hover:bg-muted/60")}
                      >
                        <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-primary" : "border-input")}>
                          {selected && <span className="size-1.5 rounded-full bg-primary" />}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold">{title}</span>
                          <span className="text-xs text-muted-foreground">{hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>

          <Controller
            control={control}
            name="permissions"
            render={({ field }) => {
              const selected = new Set(field.value as string[]);
              const toggle = (keys: Permission[], on: boolean) => {
                const next = new Set(selected);
                keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
                field.onChange(ALL_PERMISSIONS.filter((k) => next.has(k)));
              };
              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span id="role-permissions" className="text-sm leading-none font-medium">
                      Permissions
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      <span className="font-bold text-foreground">{selected.size}</span> of {TOTAL} selected
                    </span>
                  </div>
                  <div role="group" aria-labelledby="role-permissions" className="grid gap-3 sm:grid-cols-2">
                    {GROUPS.map(([group, keys]) => {
                      const all = keys.every((k) => selected.has(k));
                      return (
                        <fieldset key={group} className="flex flex-col gap-3 rounded-xl border p-4">
                          <div className="flex items-center justify-between border-b pb-2.5">
                            <legend className="text-sm font-bold">{group}</legend>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <Checkbox checked={all} onCheckedChange={(on) => toggle(keys, on)} /> Select all
                            </label>
                          </div>
                          {keys.map((key) => (
                            <label key={key} className={cn("flex items-start gap-2.5 text-sm", !selected.has(key) && "text-muted-foreground")}>
                              <Checkbox className="mt-0.5" checked={selected.has(key)} onCheckedChange={(on) => toggle([key], on)} />
                              {PERMISSIONS[key].label}
                            </label>
                          ))}
                        </fieldset>
                      );
                    })}
                  </div>
                </div>
              );
            }}
          />

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {role && role.activeUserCount > 0
                ? `${role.activeUserCount} user${role.activeUserCount === 1 ? " has" : "s have"} this role. Changes apply at their next page load.`
                : ""}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
                {isSubmitting ? "Saving…" : role ? "Save role" : "Create role"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
