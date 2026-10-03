import type { CampSummaryDto } from "@xperts/shared";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { CampsOverview } from "./camps-overview";

export default async function CampsPage() {
  const me = await requirePagePermission("camps.view");
  const camps = await serverApi<CampSummaryDto[]>("/camps");
  return <CampsOverview camps={camps} access={me.access} />;
}
