import { hasPermission, type CustomFieldDto, type SystemFieldDef, type WorkerMetaDto } from "@xperts/shared";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/design/primitives";
import { SetBreadcrumb } from "@/components/shell/breadcrumbs";
import { WorkerForm } from "@/components/workers/worker-form";
import { requirePagePermission, serverApi } from "@/lib/server-api";

export default async function NewWorkerPage() {
  const me = await requirePagePermission("workers.manage");
  const [meta, fields] = await Promise.all([
    serverApi<WorkerMetaDto>("/workers/meta"),
    serverApi<{ system: SystemFieldDef[]; custom: CustomFieldDto[] }>("/fields"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Add worker" }]} />
      <PageHeader
        back={
          <Link href="/workers" className="inline-flex w-max items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-[15px]" /> Workers
          </Link>
        }
        title="Add worker"
        subtitle={
          <>
            Fields marked <span className="text-destructive">*</span> are required. You can assign a bed after saving.
          </>
        }
      />
      <WorkerForm meta={meta} customFields={fields.custom} canEditIdentity={hasPermission(me.access, "workers.viewIdentity")} />
    </div>
  );
}
