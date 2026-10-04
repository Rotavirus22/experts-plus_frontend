"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, profileSchema, type AccountSessionDto, type ChangePasswordInput, type ProfileInput } from "@xperts/shared";
import { Eye, EyeOff, LogOut, Monitor } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader, Pill } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
import { FieldControl } from "@/components/ui/field-control";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAppRouter } from "@/lib/use-app-router";

type Me = { name: string; email: string; roleName: string | null };

/** My account: name, password and signed-in devices. */
export function AccountView({ me, sessions }: { me: Me; sessions: AccountSessionDto[] }) {
  const router = useAppRouter();
  const [confirmOthers, setConfirmOthers] = useState(false);
  const others = sessions.filter((s) => !s.current).length;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader title="My account" subtitle={`${me.email} · ${me.roleName ?? "No role"}`} />
      <ProfileCard me={me} onSaved={() => router.refresh()} />
      <PasswordCard onChanged={() => router.refresh()} />

      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Signed-in devices</h2>
            <p className="text-[13px] text-muted-foreground">Sessions end after 1 day without activity.</p>
          </div>
          <Button variant="outline" disabled={others === 0} onClick={() => setConfirmOthers(true)}>
            <LogOut data-icon="inline-start" /> Sign out other devices
          </Button>
        </div>
        <ul className="divide-y overflow-hidden rounded-xl border">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Monitor className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {s.device}
                  {s.current && <Pill tone="success">This device</Pill>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Signed in {formatDateTime(s.signedInAt)} · last active {formatDateTime(s.lastActiveAt)}
                  {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title="Sign out other devices?"
        description={`${others} other session${others === 1 ? "" : "s"} will be signed out. You stay signed in here.`}
        confirmLabel="Sign them out"
        onConfirm={async () => {
          const { signedOut } = await api<{ signedOut: number }>("/me/sessions/sign-out-others", { body: {} });
          toast.success(`Signed out ${signedOut} other session${signedOut === 1 ? "" : "s"}`);
          await router.refresh();
        }}
      />
    </div>
  );
}

function ProfileCard({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: { name: me.name } });

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await api<{ name: string }>("/me", { method: "PATCH", body: values });
      toast.success("Name updated");
      reset({ name: saved.name });
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm" noValidate>
      <h2 className="text-lg font-bold">Profile</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message}>
          <Input autoComplete="name" {...register("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email">
          <Input value={me.email} readOnly disabled />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Your email and role are managed by an administrator.</p>
      <div>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          {isSubmitting ? "Saving…" : "Save name"}
        </Button>
      </div>
    </form>
  );
}

function PasswordCard({ onChanged }: { onChanged: () => void }) {
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });

  const submit = handleSubmit(async (values) => {
    try {
      const { signedOutOthers } = await api<{ signedOutOthers: number }>("/me/password", { body: values });
      toast.success(signedOutOthers ? `Password changed · ${signedOutOthers} other session${signedOutOthers === 1 ? "" : "s"} signed out` : "Password changed");
      reset();
      onChanged();
    } catch (error) {
      const message = errorMessage(error);
      if (/current password/i.test(message)) setError("currentPassword", { message });
      else toast.error(message);
    }
  });

  const type = show ? "text" : "password";
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm" noValidate>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Password</h2>
          <p className="text-[13px] text-muted-foreground">At least 8 characters with letters and numbers. Other devices are signed out when you change it.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShow((s) => !s)} aria-pressed={show}>
          {show ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
          {show ? "Hide" : "Show"}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Current password" error={errors.currentPassword?.message}>
          <Input type={type} autoComplete="current-password" {...register("currentPassword")} aria-invalid={!!errors.currentPassword} />
        </Field>
        <Field label="New password" error={errors.newPassword?.message}>
          <Input type={type} autoComplete="new-password" {...register("newPassword")} aria-invalid={!!errors.newPassword} />
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword?.message}>
          <Input type={type} autoComplete="new-password" {...register("confirmPassword")} aria-invalid={!!errors.confirmPassword} />
        </Field>
      </div>
      <div>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <FieldControl>
      {(id) => (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id} className="text-[13px]">
            {label}
          </Label>
          {children}
          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>
      )}
    </FieldControl>
  );
}
