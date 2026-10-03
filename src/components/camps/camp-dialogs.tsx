"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BED_LAYOUTS,
  bedsAddSchema,
  bedTypesFor,
  campInputSchema,
  defaultSqmPerWorker,
  EMIRATE_LABELS,
  EMIRATES,
  nextBedLabels,
  roomCapacityWarning,
  roomInputSchema,
  type BedsAddInput,
  type CampInput,
  type CampSummaryDto,
  type Emirate,
  type RoomDto,
  type RoomInput,
} from "@xperts/shared";
import { AlertTriangle, Info, Minus, Plus } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Pill } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BED_TYPE_SHORT } from "./bed-status";
import { useAppRouter } from "@/lib/use-app-router";
import { plural } from "@/lib/format";

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && <div className="text-xs text-muted-foreground">{hint}</div>}
      {error && <p className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}

function FormDialog({
  title,
  description,
  submitLabel,
  busy,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} loading={busy}>
              {busy ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────── Camp ─────────

export function CampDialog({ camp, onClose }: { camp?: CampSummaryDto; onClose: () => void }) {
  const router = useAppRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CampInput>({
    resolver: zodResolver(campInputSchema),
    defaultValues: {
      name: camp?.name ?? "",
      emirate: camp?.emirate ?? "DUBAI",
      address: camp?.address ?? "",
      sqmPerWorker: camp?.sqmPerWorker ?? "",
    },
  });
  const emirate = useWatch({ control, name: "emirate" }) as Emirate;

  const submit = handleSubmit(async (values) => {
    try {
      const { id } = await api<{ id: string }>(camp ? `/camps/${camp.id}` : "/camps", { method: camp ? "PATCH" : "POST", body: values });
      toast.success(camp ? "Camp updated" : "Camp created");
      if (!camp) {
        router.push(`/camps/${id}`); // dialog stays busy until the new camp page has rendered
        return router.refresh(); // sidebar counts live in the layout
      }
      await router.refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <FormDialog title={camp ? `Edit ${camp.name}` : "New camp"} submitLabel={camp ? "Save changes" : "Create camp"} busy={isSubmitting || router.pending} onClose={onClose} onSubmit={submit}>
      <Field label="Name" required error={errors.name?.message}>
        <Input {...register("name")} aria-invalid={!!errors.name} autoFocus />
      </Field>
      <Field label="Emirate" required>
        <Controller
          control={control}
          name="emirate"
          render={({ field }) => (
            <Select items={EMIRATES.map((e) => ({ value: e, label: EMIRATE_LABELS[e] }))} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMIRATES.map((e) => (
                  <SelectItem key={e} value={e}>
                    {EMIRATE_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Address" error={errors.address?.message}>
        <Input {...register("address")} />
      </Field>
      <Field
        label="Square metres per worker"
        error={errors.sqmPerWorker?.message}
        hint="Leave empty to use 3.7 m² in Dubai, 3.0 elsewhere. Only used to warn about crowded rooms."
      >
        <Input type="number" step="0.1" min="1" {...register("sqmPerWorker")} placeholder={`${defaultSqmPerWorker(emirate)} (${EMIRATE_LABELS[emirate]} default)`} />
      </Field>
    </FormDialog>
  );
}

// ───────── Room ─────────

export function RoomDialog({
  campId,
  campName,
  room,
  sqmPerWorker,
  onClose,
}: {
  campId: string;
  campName?: string;
  room?: RoomDto;
  sqmPerWorker: number;
  onClose: () => void;
}) {
  const router = useAppRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RoomInput>({
    resolver: zodResolver(roomInputSchema),
    defaultValues: {
      number: room?.number ?? "",
      areaSqm: room?.areaSqm ?? "",
      layoutColumns: room?.layoutColumns ?? 4,
      notes: room?.notes ?? "",
    },
  });
  const area = Number(useWatch({ control, name: "areaSqm" }) || 0);
  const fits = area > 0 ? Math.floor(area / sqmPerWorker) : null;
  const activeBeds = room?.beds.filter((b) => b.isActive).length ?? 0;

  const submit = handleSubmit(async (values) => {
    try {
      await api(room ? `/rooms/${room.id}` : `/camps/${campId}/rooms`, { method: room ? "PATCH" : "POST", body: values });
      toast.success(room ? "Room updated" : `Room ${values.number} added`);
      await router.refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <FormDialog
      title={room ? `Edit Room ${room.number}` : "Add room"}
      description={room ? undefined : campName}
      submitLabel={room ? "Save changes" : "Add room"}
      busy={isSubmitting}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room number" required error={errors.number?.message} hint="Any text: 101, 2B, G-12, 301 Sup.">
          <Input {...register("number")} aria-invalid={!!errors.number} autoFocus />
        </Field>
        <Field label="Bed map columns" error={errors.layoutColumns?.message}>
          <Controller
            control={control}
            name="layoutColumns"
            render={({ field }) => {
              const value = Number(field.value) || 1;
              return (
                <div className="flex h-9.5 items-stretch overflow-hidden rounded-lg border border-input bg-card">
                  <button
                    type="button"
                    className="flex w-10 items-center justify-center border-r text-muted-foreground hover:bg-muted disabled:opacity-40"
                    onClick={() => field.onChange(Math.max(1, value - 1))}
                    disabled={value <= 1}
                    aria-label="Fewer columns"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="flex flex-1 items-center justify-center text-sm font-bold tabular-nums">{value}</span>
                  <button
                    type="button"
                    className="flex w-10 items-center justify-center border-l text-muted-foreground hover:bg-muted disabled:opacity-40"
                    onClick={() => field.onChange(Math.min(12, value + 1))}
                    disabled={value >= 12}
                    aria-label="More columns"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              );
            }}
          />
        </Field>
      </div>
      <Field
        label="Area (m²)"
        error={errors.areaSqm?.message}
        hint={
          fits === null ? (
            "Optional. Used to warn about crowded rooms."
          ) : room && activeBeds > fits ? (
            <span className="font-semibold text-warning-fg">
              Fits about {fits} beds — this room has {activeBeds}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-primary">
              <Info className="size-3.5" /> Fits about {fits} beds at {sqmPerWorker} m² per worker
            </span>
          )
        }
      >
        <Input type="number" step="0.1" min="1" {...register("areaSqm")} />
      </Field>
      <Field label="Notes" error={errors.notes?.message}>
        <Textarea rows={2} {...register("notes")} placeholder="e.g. Near washroom block B" />
      </Field>
    </FormDialog>
  );
}

// ───────── Add beds ─────────

const LAYOUT_OPTIONS: Record<(typeof BED_LAYOUTS)[number], { title: string; hint?: string }> = {
  SINGLE: { title: "Single beds" },
  BUNK_PAIRS: { title: "Bunk pairs", hint: "lower + upper" },
  UNSPECIFIED: { title: "Unspecified" },
};

export function AddBedsDialog({ room, sqmPerWorker, onClose }: { room: RoomDto; sqmPerWorker: number; onClose: () => void }) {
  const router = useAppRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BedsAddInput>({
    resolver: zodResolver(bedsAddSchema),
    defaultValues: { count: 2, prefix: "B", layout: "BUNK_PAIRS" },
  });
  const [count, prefix, layout] = useWatch({ control, name: ["count", "prefix", "layout"] });
  const n = Math.max(0, Math.min(40, Number(count) || 0));
  const labels = n > 0 ? nextBedLabels(room.beds.map((b) => b.label), String(prefix ?? "B").trimStart(), n) : [];
  const types = n > 0 ? bedTypesFor((layout ?? "SINGLE") as (typeof BED_LAYOUTS)[number], n) : [];
  const activeBeds = room.beds.filter((b) => b.isActive).length;
  const warning = roomCapacityWarning(room.areaSqm, activeBeds + n, sqmPerWorker);
  const fits = room.areaSqm ? Math.floor(room.areaSqm / sqmPerWorker) : null;

  const submit = handleSubmit(async (values) => {
    try {
      const res = await api<{ labels: string[] }>(`/rooms/${room.id}/beds`, { body: values });
      toast.success(`Added ${res.labels.join(", ")}`);
      await router.refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <FormDialog
      title={`Add beds to Room ${room.number}`}
      description={`Room has ${plural(activeBeds, "bed")}${room.areaSqm ? ` · ${room.areaSqm} m² · fits about ${fits}` : ""}`}
      submitLabel={n === 1 ? "Add 1 bed" : `Add ${n || ""} beds`}
      busy={isSubmitting}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How many" error={errors.count?.message}>
          <Input type="number" min={1} max={40} {...register("count")} autoFocus />
        </Field>
        <Field label="Label prefix" error={errors.prefix?.message}>
          <Input {...register("prefix")} />
        </Field>
      </div>
      <Field label="Type">
        <Controller
          control={control}
          name="layout"
          render={({ field }) => (
            <div role="radiogroup" className="flex flex-col gap-2">
              {BED_LAYOUTS.map((l) => {
                const selected = field.value === l;
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => field.onChange(l)}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-lg border px-3.5 text-left text-sm transition",
                      selected ? "border-primary bg-status-occupied-bg font-semibold" : "hover:bg-muted/60",
                    )}
                  >
                    <span className={cn("flex size-4 items-center justify-center rounded-full border-2", selected ? "border-primary" : "border-input")}>
                      {selected && <span className="size-1.5 rounded-full bg-primary" />}
                    </span>
                    {LAYOUT_OPTIONS[l].title}
                    {LAYOUT_OPTIONS[l].hint && <span className="font-normal text-muted-foreground">· {LAYOUT_OPTIONS[l].hint}</span>}
                  </button>
                );
              })}
            </div>
          )}
        />
      </Field>
      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          Adds
          {labels.slice(0, 12).map((label, i) => (
            <Pill key={label} tone="success">
              {label}
              {types[i] ? ` · ${BED_TYPE_SHORT[types[i]!]}` : ""}
            </Pill>
          ))}
          {labels.length > 12 && <span>+{labels.length - 12} more</span>}
        </div>
      )}
      {warning && (
        <p className="flex items-center gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-[13px] font-semibold text-warning-fg">
          <AlertTriangle className="size-4 shrink-0" />
          {warning.activeBeds} beds; area fits about {warning.maxBeds}
        </p>
      )}
    </FormDialog>
  );
}
