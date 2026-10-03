"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Button for one-click async actions (no dialog): spinner + disabled until the promise settles. */
export function AsyncButton({ onClick, ...props }: Omit<React.ComponentProps<typeof Button>, "onClick" | "loading"> & { onClick: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      {...props}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
