import type { CampDetailDto } from "@xperts/shared";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { CampDetail } from "./camp-detail";

export default async function CampPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePagePermission("camps.view");
  const { id } = await params;
  const camp = await serverApi<CampDetailDto>(`/camps/${id}`);
  return <CampDetail camp={camp} access={me.access} />;
}
