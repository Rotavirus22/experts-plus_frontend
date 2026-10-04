"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  FIELD_TYPE_LABELS,
  normalizeCustomValue,
  workerInputSchema,
  type CustomFieldDto,
  type WorkerDetailDto,
  type WorkerInput,
  type WorkerMetaDto,
} from "@xperts/shared";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { toast } from "sonner";
import { Pill } from "@/components/design/primitives";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppRouter } from "@/lib/use-app-router";
import { FieldControl } from "@/components/ui/field-control";

const NONE = "__none";

type Props = {
  worker?: WorkerDetailDto;
  meta: WorkerMetaDto;
  customFields: CustomFieldDto[];
  canEditIdentity: boolean;
};

type SectionKey = "worker" | "employment" | "contact" | "identity" | "custom" | "remarks";
const FIELD_SECTION: Partial<Record<keyof WorkerInput, SectionKey>> = {
  employeeCode: "worker",
  fullName: "worker",
  designation: "worker",
  nationality: "worker",
  sponsorEntityId: "employment",
  joinDate: "employment",
  clientCompanyId: "employment",
  departmentId: "employment",
  uaePhone: "contact",
  homePhone: "contact",
  email: "contact",
  passportNumber: "identity",
  emiratesIdNumber: "identity",
  remarks: "remarks",
};

/** Custom field errors keyed by field key (same rules as the backend). */
function customFieldErrors(defs: CustomFieldDto[], values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const def of defs) {
    if (def.isHidden) continue;
    try {
      const v = normalizeCustomValue(def, values[def.key]);
      if (v === undefined && def.required) errors[def.key] = `${def.label} is required.`;
    } catch (message) {
      errors[def.key] = String(message);
    }
  }
  return errors;
}

/** Add / edit a worker. Status, exit and housing are not edited here (exit flow and bed assignment handle those). */
export function WorkerForm({ worker, meta, customFields, canEditIdentity }: Props) {
  const router = useAppRouter();
  const visibleFields = useMemo(() => customFields.filter((f) => !f.isHidden), [customFields]);
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<WorkerInput>({
    resolver: zodResolver(workerInputSchema),
    defaultValues: {
      employeeCode: worker?.employeeCode ?? "",
      fullName: worker?.fullName ?? "",
      designation: worker?.designation ?? "",
      nationality: worker?.nationality ?? "",
      uaePhone: worker?.uaePhone ?? "",
      homePhone: worker?.homePhone ?? "",
      email: worker?.email ?? "",
      joinDate: worker?.joinDate ?? "",
      remarks: worker?.remarks ?? "",
      sponsorEntityId: worker?.sponsorEntityId ?? null,
      clientCompanyId: worker?.clientCompanyId ?? null,
      departmentId: worker?.departmentId ?? null,
      passportNumber: worker?.passportNumber ?? "",
      emiratesIdNumber: worker?.emiratesIdNumber ?? "",
      customFields: Object.fromEntries(visibleFields.map((f) => [f.key, worker?.customFields[f.key] ?? ""])),
    },
  });

  const errorSections = new Set<SectionKey>(
    Object.keys(errors)
      .map((k) => FIELD_SECTION[k as keyof WorkerInput])
      .filter((s): s is SectionKey => !!s),
  );
  if (Object.keys(customErrors).length) errorSections.add("custom");
  const attention = Object.keys(errors).filter((k) => k !== "customFields").length + Object.keys(customErrors).length;

  function checkCustom() {
    const errs = customFieldErrors(customFields, (getValues("customFields") ?? {}) as Record<string, unknown>);
    setCustomErrors(errs);
    return errs;
  }

  async function onSubmit(values: WorkerInput) {
    if (Object.keys(checkCustom()).length) return;
    try {
      const { id } = await api<{ id: string }>(worker ? `/workers/${worker.id}` : "/workers", {
        method: worker ? "PATCH" : "POST",
        body: values,
      });
      toast.success(worker ? "Worker updated" : "Worker added");
      router.push(`/workers/${id}`); // the save button stays busy until the worker page has rendered
      router.refresh(); // sidebar counts live in the layout
    } catch (error) {
      const message = errorMessage(error);
      if (/Emp No/.test(message)) setError("employeeCode", { message });
      toast.error(message);
    }
  }

  const sections: { key: SectionKey; label: string; show: boolean }[] = [
    { key: "worker", label: "Worker", show: true },
    { key: "employment", label: "Employment", show: true },
    { key: "contact", label: "Contact", show: true },
    { key: "identity", label: "Identity documents", show: canEditIdentity },
    { key: "custom", label: "Additional fields", show: visibleFields.length > 0 },
    { key: "remarks", label: "Remarks", show: true },
  ];

  return (
    <form
      onSubmit={(e) => {
        setSubmitted(true);
        checkCustom();
        void handleSubmit(onSubmit)(e);
      }}
      className="grid items-start gap-6 lg:grid-cols-[200px_1fr]"
      noValidate
    >
      <nav className="sticky top-24 hidden flex-col gap-1 lg:flex" aria-label="Form sections">
        {sections
          .filter((s) => s.show)
          .map((s) => (
            <a
              key={s.key}
              href={`#section-${s.key}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              {s.label}
              {errorSections.has(s.key) && <span className="size-2 rounded-full bg-destructive" aria-label="has errors" />}
            </a>
          ))}
      </nav>

      <div className="flex min-w-0 flex-col gap-5">
        <Section id="worker" title="Worker">
          <Field label="Emp No" required error={errors.employeeCode?.message}>
            <Input {...register("employeeCode")} aria-invalid={!!errors.employeeCode} placeholder="EPRS-1234" className="font-mono uppercase" />
          </Field>
          <Field label="Name" required error={errors.fullName?.message}>
            <Input {...register("fullName")} aria-invalid={!!errors.fullName} />
          </Field>
          <Field label="Position" error={errors.designation?.message}>
            <Input {...register("designation")} placeholder="e.g. Helper" />
          </Field>
          <Field label="Nationality" error={errors.nationality?.message}>
            <Input {...register("nationality")} className="uppercase" placeholder="e.g. Nepali" />
          </Field>
        </Section>

        <Section id="employment" title="Employment">
          <RefSelect control={control} name="sponsorEntityId" label="Sponsor" placeholder={meta.sponsors.length ? "Select a sponsor" : "No sponsors yet — add under Sponsors & clients"} options={meta.sponsors.map((s) => ({ value: s.id, label: s.name, hidden: s.isHidden }))} />
          <Field label="Join date" error={errors.joinDate?.message}>
            <Input type="date" {...register("joinDate")} />
          </Field>
          <RefSelect
            control={control}
            name="clientCompanyId"
            label="Client"
            placeholder={meta.clients.length ? "Select a client" : "No clients yet — add under Sponsors & clients"}
            options={meta.clients.map((c) => ({ value: c.id, label: c.name, hidden: c.isHidden }))}
            onChange={() => setValue("departmentId", null)}
          />
          <DivisionSelect control={control} meta={meta} />
        </Section>

        <Section id="contact" title="Contact">
          <Field label="UAE Contact No" error={errors.uaePhone?.message}>
            <Input type="tel" {...register("uaePhone")} placeholder="+971 5X XXX XXXX" className="font-mono" />
          </Field>
          <Field label="Home Country Contact No" error={errors.homePhone?.message}>
            <Input type="tel" {...register("homePhone")} className="font-mono" />
          </Field>
          <Field label="Email ID" error={errors.email?.message}>
            <Input type="email" {...register("email")} placeholder="name@example.com" />
          </Field>
        </Section>

        {canEditIdentity && (
          <Section
            id="identity"
            title="Identity documents"
            columns={2}
            aside={
              <Pill tone="accent">
                <Lock className="size-3" /> Visible to permitted roles only
              </Pill>
            }
          >
            <Field label="Passport No" error={errors.passportNumber?.message}>
              <Input {...register("passportNumber")} className="font-mono uppercase" autoComplete="off" />
            </Field>
            <Field label="Emirates ID No" error={errors.emiratesIdNumber?.message}>
              <Input {...register("emiratesIdNumber")} autoComplete="off" placeholder="784-YYYY-NNNNNNN-N" className="font-mono" />
            </Field>
          </Section>
        )}

        {visibleFields.length > 0 && (
          <Section id="custom" title="Additional fields" aside={<span className="text-[13px] text-muted-foreground">Defined by admins in Custom fields</span>}>
            {visibleFields.map((f) => (
              <CustomFieldInput key={f.id} field={f} control={control} error={submitted ? customErrors[f.key] : undefined} />
            ))}
          </Section>
        )}

        <Section id="remarks" title="Remarks" columns={1}>
          <Textarea rows={3} {...register("remarks")} placeholder="Anything staff should know about this worker" />
        </Section>

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-3 shadow-md">
          <span className={cn("text-sm font-semibold", attention > 0 && submitted ? "text-destructive" : "text-muted-foreground")}>
            {attention > 0 && submitted ? `${attention} field${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} attention` : "Fields marked * are required."}
          </span>
          <div className="flex gap-2">
            <Link href={worker ? `/workers/${worker.id}` : "/workers"} className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>
            <Button type="submit" loading={isSubmitting || router.pending}>
              {isSubmitting || router.pending ? "Saving…" : worker ? "Save changes" : "Save worker"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Section({
  id,
  title,
  aside,
  columns = 3,
  children,
}: {
  id: SectionKey;
  title: string;
  aside?: React.ReactNode;
  columns?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <section id={`section-${id}`} className="scroll-mt-24 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {aside}
      </div>
      <div className={cn("grid gap-x-4 gap-y-4", columns === 3 && "sm:grid-cols-2 xl:grid-cols-3", columns === 2 && "sm:grid-cols-2")}>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <FieldControl>
      {(id) => (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id} className="text-[13px]">
            <span>
              {label}
              {required && <span className="text-destructive"> *</span>}
              {hint && <span className="font-normal text-muted-foreground"> · {hint}</span>}
            </span>
          </Label>
          {children}
          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>
      )}
    </FieldControl>
  );
}

function OptionSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder,
  invalid,
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  placeholder: string;
  invalid?: boolean;
}) {
  const items = [{ value: NONE, label: placeholder }, ...options];
  return (
    <Select items={items} value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger className={cn("w-full", !value && "text-muted-foreground")} aria-invalid={invalid}>
        <SelectValue />
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

function RefSelect({
  control,
  name,
  label,
  placeholder,
  options,
  onChange,
}: {
  control: Control<WorkerInput>;
  name: "sponsorEntityId" | "clientCompanyId";
  label: string;
  placeholder: string;
  /** Hidden entries are offered only when already selected (existing workers keep their value). */
  options: { value: string; label: string; hidden?: boolean }[];
  onChange?: () => void;
}) {
  return (
    <Field label={label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <OptionSelect
            value={field.value}
            placeholder={placeholder}
            options={options.filter((o) => !o.hidden || o.value === field.value)}
            onChange={(v) => {
              field.onChange(v);
              onChange?.();
            }}
          />
        )}
      />
    </Field>
  );
}

function DivisionSelect({ control, meta }: { control: Control<WorkerInput>; meta: WorkerMetaDto }) {
  const clientId = useWatch({ control, name: "clientCompanyId" });
  const departments = meta.clients.find((c) => c.id === clientId)?.departments ?? [];
  return (
    <Field label="Division">
      <Controller
        control={control}
        name="departmentId"
        render={({ field }) => (
          <OptionSelect
            value={field.value}
            onChange={field.onChange}
            disabled={!clientId}
            placeholder={!clientId ? "Choose a client first" : departments.length ? "Select a division" : "This client has no divisions"}
            options={departments.filter((d) => !d.isHidden || d.id === field.value).map((d) => ({ value: d.id, label: d.name }))}
          />
        )}
      />
    </Field>
  );
}

function CustomFieldInput({ field, control, error }: { field: CustomFieldDto; control: Control<WorkerInput>; error?: string }) {
  return (
    <Field label={field.label} hint={FIELD_TYPE_LABELS[field.type].toLowerCase()} required={field.required} error={error}>
      <Controller
        control={control}
        name={`customFields.${field.key}`}
        render={({ field: f }) => {
          const value = f.value as string | number | boolean | undefined | null;
          switch (field.type) {
            case "SELECT":
              return (
                <OptionSelect
                  value={value == null ? null : String(value)}
                  onChange={(v) => f.onChange(v ?? "")}
                  placeholder="Select…"
                  invalid={!!error}
                  options={field.options.map((o) => ({ value: o, label: o }))}
                />
              );
            case "BOOLEAN":
              return (
                <label className="flex h-9.5 items-center justify-between gap-2 rounded-lg border bg-secondary/50 px-3 text-sm">
                  {value === true ? "Yes" : "No"}
                  <Switch checked={value === true} onCheckedChange={(on) => f.onChange(on)} />
                </label>
              );
            default:
              return (
                <Input
                  aria-invalid={!!error}
                  type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : field.type === "EMAIL" ? "email" : field.type === "PHONE" ? "tel" : "text"}
                  value={value == null ? "" : String(value)}
                  onChange={(e) => f.onChange(e.target.value)}
                  onBlur={f.onBlur}
                  className={field.type === "PHONE" ? "font-mono" : undefined}
                />
              );
          }
        }}
      />
    </Field>
  );
}

