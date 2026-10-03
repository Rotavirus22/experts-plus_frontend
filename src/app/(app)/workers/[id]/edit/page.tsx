import { hasPermission, type CustomFieldDto, type SystemFieldDef, type WorkerDetailDto, type WorkerMetaDto } from "@xperts/shared";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/design/primitives";
import { SetBreadcrumb } from "@/components/shell/breadcrumbs";
import { WorkerForm } from "@/components/workers/worker-form";
import { requirePagePermission, serverApi } from "@/lib/server-api";

export default async function EditWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePagePermission("workers.manage");
  const { id } = await params;
  const [worker, meta, fields] = await Promise.all([
    serverApi<WorkerDetailDto>(`/workers/${id}`),
    serverApi<WorkerMetaDto>("/workers/meta"),
    serverApi<{ system: SystemFieldDef[]; custom: CustomFieldDto[] }>("/fields"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <SetBreadcrumb items={[{ label: worker.fullName, href: `/workers/${worker.id}` }, { label: "Edit" }]} />
      <PageHeader
        back={
          <Link href={`/workers/${worker.id}`} className="inline-flex w-max items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-[15px]" /> {worker.fullName}
          </Link>
        }
        title={`Edit ${worker.fullName}`}
        subtitle={
          <>
            <span className="font-mono">{worker.employeeCode}</span> · To change their bed use Move; to end employment use Exit.
          </>
        }
      />
      <WorkerForm worker={worker} meta={meta} customFields={fields.custom} canEditIdentity={hasPermission(me.access, "workers.viewIdentity")} />
    </div>
  );
}
