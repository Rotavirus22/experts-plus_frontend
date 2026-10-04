"use client";

import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  fieldCreateSchema,
  fieldKeyFromLabel,
  type CustomFieldDto,
  type FieldCreateInput,
  type FieldType,
  type SystemFieldDef,
} from "@xperts/shared";
import { Lock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AsyncButton } from "@/components/async-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { PageHeader, Pill } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, errorMessage } from "@/lib/api";
import { useAppRouter } from "@/lib/use-app-router";
import { plural } from "@/lib/format";

export function FieldsManager({ system, custom }: { system: readonly SystemFieldDef[]; custom: CustomFieldDto[] }) {
  const router = useAppRouter();
  const [editing, setEditing] = useState<CustomFieldDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<CustomFieldDto | null>(null);
  const hidden = custom.filter((f) => f.isHidden).length;

  async function setHidden(field: CustomFieldDto, value: boolean) {
    try {
      await api(`/fields/${field.id}/hidden`, { body: { hidden: value } });
      toast.success(value ? `“${field.label}” hidden` : `“${field.label}” visible again`);
      await router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const columns = useMemo<DataTableColumn<CustomFieldDto>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Field",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold">
              {row.original.label}
              {row.original.required && <span className="text-destructive"> *</span>}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{row.original.key}</span>
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (f) => FIELD_TYPE_LABELS[f.type],
        cell: ({ getValue }) => <Pill tone="info">{getValue() as string}</Pill>,
      },
      {
        id: "options",
        header: "Options",
        enableSorting: false,
        accessorFn: (f) => f.options.join(", "),
        cell: ({ row }) =>
          row.original.options.length ? (
            <div className="flex max-w-40 flex-wrap gap-1">
              {row.original.options.map((o) => (
                <Pill key={o} className="h-5 px-2 font-semibold">
                  {o}
                </Pill>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "valueCount",
        header: "Workers with data",
        cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.valueCount.toLocaleString()}</span>,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (f) => (f.isHidden ? "Hidden" : "Visible"),
        cell: ({ row }) => (row.original.isHidden ? <Pill>Hidden</Pill> : <Pill tone="success">Visible</Pill>),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => {
          const field = row.original;
          const hasData = field.valueCount > 0;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setEditing(field)}>
                Edit
              </Button>
              <AsyncButton size="sm" variant="outline" onClick={() => setHidden(field, !field.isHidden)}>
                {field.isHidden ? "Show" : "Hide"}
              </AsyncButton>
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button size="sm" variant="destructive-ghost" disabled={hasData} onClick={() => setDeleting(field)}>
                    Delete
                  </Button>
                </TooltipTrigger>
                {hasData && (
                  <TooltipContent className="max-w-60">
                    {field.valueCount === 1 ? "1 worker has" : `${field.valueCount.toLocaleString()} workers have`} data — can only be hidden
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Worker fields"
        subtitle="Add your own fields to the worker form. They appear in worker details, exports and reports."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" /> Add field
          </Button>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <DataTable
          data={custom}
          columns={columns}
          search=""
          empty="No custom fields yet. Add one for anything else you track."
          rowClassName={(f) => (f.isHidden ? "bg-muted/50 text-muted-foreground" : undefined)}
          title={
            <>
              <h2 className="text-lg font-bold">Custom fields</h2>
              <span className="text-[13px] text-muted-foreground">
                {custom.length} field{custom.length === 1 ? "" : "s"}
                {hidden > 0 && ` · ${hidden} hidden`}
              </span>
            </>
          }
        />

        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Lock className="size-4" /> Built-in fields
          </h2>
          <p className="text-[13px] text-muted-foreground">These can&apos;t be deleted or hidden, and are always available in reports.</p>
          <ul className="divide-y overflow-hidden rounded-xl border">
            {system.map((f) => (
              <li key={f.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1">{f.label}</span>
                {f.derived && (
                  <Pill tone="info" className="h-5 px-2 text-[10.5px]">
                    Automatic
                  </Pill>
                )}
                {f.requires && (
                  <Pill tone="accent" className="h-5 px-2 text-[10.5px]">
                    Restricted
                  </Pill>
                )}
                <span className="w-16 text-right text-xs text-muted-foreground">{FIELD_TYPE_LABELS[f.type]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {editing && (
        <FieldDialog
          field={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await router.refresh();
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.label}”?`}
        description="No worker has data in this field, so it can be removed permanently."
        confirmLabel="Delete field"
        destructive
        onConfirm={async () => {
          await api(`/fields/${deleting!.id}`, { method: "DELETE" });
          toast.success("Field deleted");
          await router.refresh();
        }}
      />
    </div>
  );
}

type FormValues = { label: string; type: FieldType; optionsText: string; required: boolean };

function FieldDialog({ field, onClose, onSaved }: { field: CustomFieldDto | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      label: field?.label ?? "",
      type: field?.type ?? "TEXT",
      optionsText: field?.options.join("\n") ?? "",
      required: field?.required ?? false,
    },
  });
  const [type, label] = useWatch({ control, name: ["type", "label"] });
  const key = field?.key ?? fieldKeyFromLabel(label ?? "");

  async function onSubmit(values: FormValues) {
    const options = values.optionsText
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    const body: FieldCreateInput = { label: values.label, type: values.type, options, required: values.required };
    const parsed = fieldCreateSchema.safeParse(body);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const name = issue.path[0] === "options" ? "optionsText" : (issue.path[0] as keyof FormValues);
        setError(name, { message: issue.message });
      }
      return;
    }
    try {
      if (field) {
        await api(`/fields/${field.id}`, { method: "PATCH", body: { label: body.label, options, required: body.required } });
      } else {
        await api("/fields", { body: parsed.data });
      }
      toast.success(field ? "Field updated" : "Field added");
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
            <DialogTitle className="text-xl">{field ? `Edit “${field.label}”` : "Add field"}</DialogTitle>
            {field && <DialogDescription>The type cannot change once created.</DialogDescription>}
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="field-label">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input id="field-label" aria-invalid={!!errors.label} {...register("label", { required: "Label is required" })} />
              {errors.label ? (
                <p className="text-[13px] text-destructive">{errors.label.message}</p>
              ) : (
                key && (
                  <p className="text-xs text-muted-foreground">
                    Stored as <span className="font-mono">{key}</span>
                  </p>
                )
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="field-type">Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field: f }) => (
                  <Select items={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))} value={f.value} onValueChange={(v) => v && f.onChange(v)} disabled={!!field}>
                    <SelectTrigger id="field-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {FIELD_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">{FIELD_TYPES.map((t) => FIELD_TYPE_LABELS[t]).join(" · ")}</p>
            </div>
          </div>

          {type === "SELECT" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="field-options">
                Options <span className="font-normal text-muted-foreground">· one per line</span>
              </Label>
              <Textarea id="field-options" rows={4} aria-invalid={!!errors.optionsText} {...register("optionsText")} />
              {errors.optionsText ? (
                <p className="text-[13px] text-destructive">{errors.optionsText.message}</p>
              ) : (
                field && <p className="text-xs text-muted-foreground">Options already used by a worker cannot be removed.</p>
              )}
            </div>
          )}

          <Controller
            control={control}
            name="required"
            render={({ field: f }) => (
              <label className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">Required</span>
                  <span className="text-xs text-muted-foreground">Staff must fill it when adding or editing a worker</span>
                </span>
                <Switch checked={f.value} onCheckedChange={f.onChange} />
              </label>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
              {isSubmitting ? "Saving…" : field ? "Save changes" : "Add field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
