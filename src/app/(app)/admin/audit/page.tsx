import type { AuditMetaDto, AuditPageDto } from "@xperts/shared";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { defaultAuditFilters } from "./audit-filters";
import { AuditView } from "./audit-view";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requirePagePermission("audit.view");
  const meta = await serverApi<AuditMetaDto>("/audit/meta");
  const filters = defaultAuditFilters(meta.today);
  const first = await serverApi<AuditPageDto>(`/audit?from=${filters.from}&to=${filters.to}`);
  return <AuditView meta={meta} initial={first} />;
}
