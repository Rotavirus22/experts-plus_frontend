"use client";

import { Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";

/**
 * Confirmation for consequential actions. With `requireReason` it collects the reason that invalidations
 * must record (nothing is deleted; the reason is shown next to the greyed-out record).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  requireReason = false,
  reasonPlaceholder = "e.g. Water damage, closed by facilities",
  icon,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  icon?: React.ReactNode;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const missingReason = requireReason && !reason.trim();

  async function confirm() {
    setTouched(true);
    if (missingReason) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      setTouched(false);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) setTouched(false);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader className="gap-3">
          {(destructive || icon) && (
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-xl",
                destructive ? "bg-[color-mix(in_oklab,var(--destructive)_12%,var(--card))] text-destructive" : "bg-accent text-accent-foreground",
              )}
            >
              {icon ?? <Ban className="size-5" />}
            </span>
          )}
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        {requireReason && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              maxLength={300}
              rows={3}
              aria-invalid={touched && missingReason}
            />
            {touched && missingReason && <p className="text-[13px] text-destructive">Enter a reason — it is kept in the history.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={confirm} disabled={busy} loading={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
