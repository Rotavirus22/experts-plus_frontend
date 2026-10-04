import type { AccountSessionDto } from "@xperts/shared";
import { getMe, serverApi } from "@/lib/server-api";
import { AccountView } from "./account-view";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const [me, sessions] = await Promise.all([getMe(), serverApi<AccountSessionDto[]>("/me/sessions")]);
  return <AccountView me={{ name: me.name, email: me.email, roleName: me.roleName }} sessions={sessions} />;
}
