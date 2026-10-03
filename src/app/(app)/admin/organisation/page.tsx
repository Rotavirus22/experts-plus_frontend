import type { OrganisationDto } from "@xperts/shared";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { OrganisationManager } from "./organisation-manager";

export const metadata = { title: "Sponsors & clients" };

export default async function OrganisationPage() {
  await requirePagePermission("org.manage");
  const data = await serverApi<OrganisationDto>("/organisation");
  return <OrganisationManager data={data} />;
}
