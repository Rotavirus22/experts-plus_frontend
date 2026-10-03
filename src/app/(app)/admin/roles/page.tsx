import type { RoleDto } from "@xperts/shared";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { RolesManager } from "./roles-manager";

export default async function RolesPage() {
  await requirePagePermission("roles.manage");
  const roles = await serverApi<RoleDto[]>("/roles");
  return <RolesManager roles={roles} />;
}
