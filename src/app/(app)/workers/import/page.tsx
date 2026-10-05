import { hasPermission, type CustomFieldDto, type SystemFieldDef, type WorkerMetaDto } from "@xperts/shared";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/design/primitives";
import { SetBreadcrumb } from "@/components/shell/breadcrumbs";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Import workers" };

export default async function ImportWorkersPage() {
  const me = await requirePagePermission("workers.manage");
  const [meta, fields] = await Promise.all([
    serverApi<WorkerMetaDto>("/workers/meta"),
    serverApi<{ system: SystemFieldDef[]; custom: CustomFieldDto[] }>("/fields"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Import from Excel" }]} />
      <PageHeader
        back={
          <Link href="/workers" className="inline-flex w-max items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-[15px]" /> Workers
          </Link>
        }
        title="Import workers from Excel"
        subtitle="Upload a sheet, choose which column goes into which field, check the rows, then import. Only Emp No and Name are required."
      />
      <ImportWizard
        meta={meta}
        customFields={fields.custom}
        can={{
          identity: hasPermission(me.access, "workers.viewIdentity"),
          createFields: hasPermission(me.access, "fields.manage"),
          createDivisions: hasPermission(me.access, "org.manage"),
        }}
      />
    </div>
  );
}
