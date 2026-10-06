"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  bedsAddSchema,
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
import { AlertTriangle, Info } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
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
import { useAppRouter } from "@/lib/use-app-router";
import { plural } from "@/lib/format";
import { FieldControl } from "@/components/ui/field-control";

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
    <FieldControl>
      {(id) => (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          {children}
          {hint && !error && <div className="text-xs text-muted-foreground">{hint}</div>}
          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>
      )}
    </FieldControl>
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
      <Field label="Room number" required error={errors.number?.message} hint="Any text: 101, 2B, G-12, 301 Sup. Add beds after saving.">
        <Input {...register("number")} aria-invalid={!!errors.number} autoFocus />
      </Field>
      <Field
        label="Area (m²)"
        error={errors.areaSqm?.message}
        hint={
          fits === null ? (
            "Optional. Only used to warn when a room has more beds than its floor area allows."
          ) : room && activeBeds > fits ? (
            <span className="font-semibold text-warning-fg">
              This room has {plural(activeBeds, "bed")}; its area allows at most {fits} ({sqmPerWorker} m² per worker)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-primary">
              <Info className="size-3.5" /> Area allows at most {plural(fits, "bed")} ({sqmPerWorker} m² per worker)
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

/** Adds beds to a room: just a count. Beds are labelled Bed 1, Bed 2, … continuing after the existing ones. */
export function AddBedsDialog({ room, sqmPerWorker, onClose }: { room: RoomDto; sqmPerWorker: number; onClose: () => void }) {
  const router = useAppRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BedsAddInput>({
    resolver: zodResolver(bedsAddSchema),
    defaultValues: { count: 1 },
  });
  const count = useWatch({ control, name: "count" });
  const n = Math.max(0, Math.min(40, Number(count) || 0));
  const labels = n > 0 ? nextBedLabels(room.beds.map((b) => b.label), "Bed ", n) : [];
  const activeBeds = room.beds.filter((b) => b.isActive).length;
  const warning = roomCapacityWarning(room.areaSqm, activeBeds + n, sqmPerWorker);

  const submit = handleSubmit(async (values) => {
    try {
      const res = await api<{ labels: string[] }>(`/rooms/${room.id}/beds`, { body: { count: values.count } });
      toast.success(`Room ${room.number} now has ${plural(activeBeds + res.labels.length, "bed")}`);
      await router.refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <FormDialog
      title={`Add beds to Room ${room.number}`}
      description={`Room ${room.number} has ${plural(activeBeds, "bed")} now.`}
      submitLabel={n === 1 ? "Add 1 bed" : `Add ${n || ""} beds`}
      busy={isSubmitting}
      onClose={onClose}
      onSubmit={submit}
    >
      <Field label="How many beds to add" error={errors.count?.message}>
        <Input type="number" min={1} max={40} {...register("count")} autoFocus />
      </Field>
      {labels.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          The room will have <span className="font-bold text-foreground">{plural(activeBeds + n, "bed")}</span>. New:{" "}
          {labels.length > 3 ? `${labels[0]} to ${labels[labels.length - 1]}` : labels.join(", ")}.
        </p>
      )}
      {warning && (
        <p className="flex items-center gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-[13px] font-semibold text-warning-fg">
          <AlertTriangle className="size-4 shrink-0" />
          {plural(warning.activeBeds, "bed")} is more than the room&apos;s area allows ({warning.maxBeds})
        </p>
      )}
    </FormDialog>
  );
}
