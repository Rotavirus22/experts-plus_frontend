"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { beginWork, errorMessage } from "@/lib/api";

/**
 * Downloads an Excel file from a backend export URL via fetch, so the button can show progress while the
 * server builds it (a plain <a download> gives no feedback and no error message).
 */
export function ExportButton({
  href,
  fallbackName = "export.xlsx",
  variant = "outline",
  disabled,
}: {
  href: string;
  fallbackName?: string;
  variant?: "outline" | "default";
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    const done = beginWork();
    try {
      const res = await fetch(href, { credentials: "same-origin" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Export failed");
      const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel file downloaded");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      done();
      setBusy(false);
    }
  }
  return (
    <Button variant={variant} onClick={download} loading={busy} disabled={disabled}>
      {!busy && <Download data-icon="inline-start" />}
      {busy ? "Preparing…" : "Export to Excel"}
    </Button>
  );
}
