import type { Permission } from "@xperts/shared";
import { Hourglass } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/design/primitives";
import { requirePagePermission } from "@/lib/server-api";

/** Placeholder for sections built in later phases. Still enforces the section's permission. */
export async function ComingSoon({
  title,
  phase,
  permission,
  children,
}: {
  title: string;
  phase: number;
  permission: Permission;
  children: React.ReactNode;
}) {
  await requirePagePermission(permission);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <EmptyState icon={<Hourglass className="size-5" />} title={`Coming in phase ${phase}`}>
        {children}
      </EmptyState>
    </div>
  );
}
