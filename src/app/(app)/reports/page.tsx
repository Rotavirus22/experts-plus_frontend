import { REPORT_TYPES, type ReportMetaDto, type ReportType } from "@xperts/shared";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { ReportBuilder } from "./report-builder";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission("reports.view");
  const [meta, params] = await Promise.all([serverApi<ReportMetaDto>("/reports/meta"), searchParams]);
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const type = (REPORT_TYPES as readonly string[]).includes(one("type") ?? "") ? (one("type") as ReportType) : "occupancy";

  return (
    <ReportBuilder
      meta={meta}
      initial={{
        type,
        campId: one("campId") ?? "",
        clientId: one("clientId") ?? "",
        departmentId: one("departmentId") ?? "",
        asOf: one("asOf") ?? "",
        from: one("from") ?? "",
        to: one("to") ?? "",
        exitStatus: one("exitStatus") ?? "",
        includeVacant: one("includeVacant") !== "false",
        columns: one("columns")?.split(",").filter(Boolean) ?? null,
      }}
    />
  );
}
