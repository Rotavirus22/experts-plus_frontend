import type { CampOptionDto, RoleDto, UserDto } from "@xperts/shared";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { UsersManager } from "./users-manager";

export default async function UsersPage() {
  const me = await requirePagePermission("users.manage");
  const [users, roles, camps] = await Promise.all([
    serverApi<UserDto[]>("/users"),
    serverApi<RoleDto[]>("/roles"),
    serverApi<CampOptionDto[]>("/camps/options"),
  ]);
  return <UsersManager users={users} roles={roles} camps={camps} currentUserId={me.userId} />;
}
