"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  passwordResetSchema,
  userCreateSchema,
  userUpdateSchema,
  type CampOptionDto,
  type RoleDto,
  type UserCreateInput,
  type UserDto,
} from "@xperts/shared";
import { KeyRound, Lock, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { PageHeader, Pill } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { useAppRouter } from "@/lib/use-app-router";

type Props = { users: UserDto[]; roles: RoleDto[]; camps: CampOptionDto[]; currentUserId: string };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UsersManager({ users, roles, camps, currentUserId }: Props) {
  const router = useAppRouter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserDto | "new" | null>(null);
  const [resetting, setResetting] = useState<UserDto | null>(null);
  const [toggling, setToggling] = useState<UserDto | null>(null);
  const campName = useMemo(() => new Map(camps.map((c) => [c.id, c.name])), [camps]);
  const systemRoleIds = useMemo(() => new Set(roles.filter((r) => r.isSystem).map((r) => r.id)), [roles]);
  const active = users.filter((u) => u.active).length;

  const columns = useMemo<DataTableColumn<UserDto>[]>(
    () => [
      {
        id: "name",
        // Value includes the email so the search box matches either.
        accessorFn: (u) => `${u.name} ${u.email}`,
        header: "User",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center gap-3">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold", u.active ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>
                {initials(u.name)}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold">
                  {u.name}
                  {u.id === currentUserId && <span className="font-normal text-muted-foreground"> (you)</span>}
                </span>
                <span className="truncate text-xs text-muted-foreground">{u.email}</span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "roleName",
        header: "Role",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 font-medium">
            {row.original.roleId && systemRoleIds.has(row.original.roleId) && <Lock className="size-3.5 text-muted-foreground" />}
            {row.original.roleName ?? "—"}
          </span>
        ),
      },
      {
        id: "camps",
        header: "Camps",
        enableSorting: false,
        accessorFn: (u) => (u.campScope === "ASSIGNED" ? u.campIds.map((id) => campName.get(id) ?? "?").join(", ") : "All camps"),
        cell: ({ row }) => {
          const u = row.original;
          if (u.campScope !== "ASSIGNED") return <span className="text-sm">All camps</span>;
          if (u.campIds.length === 0) return <span className="text-sm text-warning-fg">None assigned</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {u.campIds.map((id) => (
                <Pill key={id}>{campName.get(id) ?? "?"}</Pill>
              ))}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (u) => (u.active ? "Active" : "Deactivated"),
        cell: ({ row }) => (row.original.active ? <Pill tone="success">Active</Pill> : <Pill>Deactivated</Pill>),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          const self = user.id === currentUserId;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setEditing(user)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => setResetting(user)}>
                <KeyRound data-icon="inline-start" /> Password
              </Button>
              {user.active ? (
                <Button size="sm" variant="destructive-ghost" disabled={self} title={self ? "You cannot deactivate yourself" : undefined} onClick={() => setToggling(user)}>
                  Deactivate
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="border-primary text-primary" onClick={() => setToggling(user)}>
                  Activate
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [campName, currentUserId, systemRoleIds],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Users"
        subtitle={`Staff who can sign in · ${active} active, ${users.length - active} deactivated`}
        actions={
          <>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button onClick={() => setEditing("new")}>
              <Plus data-icon="inline-start" /> New user
            </Button>
          </>
        }
      />
      <DataTable data={users} columns={columns} search={search} rowClassName={(u) => (u.active ? undefined : "bg-muted/50 text-muted-foreground")} />

      {editing && (
        <UserDialog
          user={editing === "new" ? null : editing}
          roles={roles}
          camps={camps}
          isSelf={editing !== "new" && editing.id === currentUserId}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await router.refresh();
            setEditing(null);
          }}
        />
      )}
      {resetting && <PasswordDialog user={resetting} onClose={() => setResetting(null)} />}
      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.active ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        description={
          toggling?.active ? (
            <>
              They&apos;ll be <span className="font-bold text-foreground">signed out everywhere</span> straight away and can&apos;t sign in. Everything they did
              stays in the audit log. You can activate them again later.
            </>
          ) : (
            "They will be able to sign in again with their current password."
          )
        }
        confirmLabel={toggling?.active ? "Deactivate" : "Activate"}
        destructive={toggling?.active}
        onConfirm={async () => {
          await api(`/users/${toggling!.id}/active`, { body: { active: !toggling!.active } });
          toast.success(toggling!.active ? "User deactivated" : "User activated");
          await router.refresh();
        }}
      />
    </div>
  );
}

// ───────── Create / edit ─────────

const editSchema = userUpdateSchema.extend({ email: z.string(), password: z.string() });

function UserDialog({
  user,
  roles,
  camps,
  isSelf,
  onClose,
  onSaved,
}: {
  user: UserDto | null;
  roles: RoleDto[];
  camps: CampOptionDto[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const activeRoles = roles.filter((r) => r.isActive);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateInput>({
    resolver: zodResolver(user ? editSchema : userCreateSchema) as never,
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: "",
      roleId: user?.roleId ?? "",
      campIds: user?.campIds ?? [],
    },
  });

  async function onSubmit(values: UserCreateInput) {
    try {
      if (user) {
        await api(`/users/${user.id}`, { method: "PATCH", body: { name: values.name, roleId: values.roleId, campIds: values.campIds } });
      } else {
        await api("/users", { body: values });
      }
      toast.success(user ? "User updated" : "User created");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-xl">{user ? `Edit ${user.name}` : "New user"}</DialogTitle>
            {!user && <DialogDescription>Staff sign in with this email and the temporary password you set.</DialogDescription>}
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={errors.name?.message}>
              <Input aria-invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              {user ? <Input value={user.email} disabled /> : <Input type="email" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} />}
            </Field>
            {!user && (
              <Field label="Temporary password" error={errors.password?.message} hint="At least 8 characters, letters and numbers.">
                <Input type="text" autoComplete="new-password" className="font-mono" aria-invalid={!!errors.password} {...register("password")} />
              </Field>
            )}
            <Field label="Role" error={errors.roleId?.message ? "Choose a role" : undefined} hint={isSelf ? "You cannot change your own role." : undefined}>
              <Controller
                control={control}
                name="roleId"
                render={({ field }) => (
                  <Select
                    items={activeRoles.map((r) => ({ value: r.id, label: r.name }))}
                    value={field.value || null}
                    onValueChange={(v) => field.onChange(v ?? "")}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="w-full" aria-invalid={!!errors.roleId}>
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <CampPicker control={control} roles={roles} camps={camps} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
              {isSubmitting ? "Saving…" : user ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Camps only matter when the chosen role is limited to assigned camps. */
function CampPicker({ control, roles, camps }: { control: Control<UserCreateInput>; roles: RoleDto[]; camps: CampOptionDto[] }) {
  const roleId = useWatch({ control, name: "roleId" });
  const role = roles.find((r) => r.id === roleId);
  if (!role) return null;
  if (role.isSystem || role.campScope === "ALL") {
    return <p className="rounded-lg bg-secondary px-3 py-2.5 text-sm text-secondary-foreground">This role can access all camps.</p>;
  }
  return (
    <Controller
      control={control}
      name="campIds"
      render={({ field }) => {
        const selected = new Set(field.value ?? []);
        return (
          <fieldset className="rounded-xl border px-4 pt-1 pb-4">
            <legend className="px-1.5 text-[13px] font-semibold">
              Camps <span className="font-normal text-muted-foreground">· this role is limited to assigned camps</span>
            </legend>
            {camps.length === 0 ? (
              <p className="pt-2 text-sm text-muted-foreground">No camps yet.</p>
            ) : (
              <div className="grid gap-x-6 gap-y-2.5 pt-2 sm:grid-cols-2">
                {camps.map((camp) => (
                  <label key={camp.id} className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={selected.has(camp.id)}
                      onCheckedChange={(on) => {
                        const next = new Set(selected);
                        if (on) next.add(camp.id);
                        else next.delete(camp.id);
                        field.onChange([...next]);
                      }}
                    />
                    <span className={cn(selected.has(camp.id) && "font-semibold", !camp.isActive && "text-muted-foreground line-through")}>{camp.name}</span>
                  </label>
                ))}
              </div>
            )}
            {camps.length > 0 && selected.size === 0 && (
              <p className="pt-3 text-xs font-medium text-warning-fg">No camp selected — this user will not see any camp until one is assigned.</p>
            )}
          </fieldset>
        );
      }}
    />
  );
}

// ───────── Password reset ─────────

function PasswordDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ password: string }>({ resolver: zodResolver(passwordResetSchema) });

  async function onSubmit(values: { password: string }) {
    try {
      await api(`/users/${user.id}/password`, { body: values });
      toast.success(`Password changed. ${user.name} has been signed out everywhere.`);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-xl">New password for {user.name}</DialogTitle>
            <DialogDescription>Share it with them directly. They are signed out of all devices.</DialogDescription>
          </DialogHeader>
          <Field label="New password" error={errors.password?.message} hint="At least 8 characters, letters and numbers.">
            <Input type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
              {isSubmitting ? "Saving…" : "Set password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}
