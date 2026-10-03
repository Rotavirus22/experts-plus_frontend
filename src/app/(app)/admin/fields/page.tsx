import type { CustomFieldDto, SystemFieldDef } from "@xperts/shared";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { FieldsManager } from "./fields-manager";

export default async function FieldsPage() {
  await requirePagePermission("fields.manage");
  const { system, custom } = await serverApi<{ system: SystemFieldDef[]; custom: CustomFieldDto[] }>("/fields");
  return <FieldsManager system={system} custom={custom} />;
}
