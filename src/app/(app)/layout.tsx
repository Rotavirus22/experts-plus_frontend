import { AppShell } from "@/components/shell/app-shell";
import type { NavCounts } from "@/components/shell/app-sidebar";
import { getMe, serverApi } from "@/lib/server-api";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [me, counts] = await Promise.all([getMe(), serverApi<NavCounts>("/me/nav-counts")]);
  return (
    <AppShell me={me} counts={counts}>
      {children}
    </AppShell>
  );
}
