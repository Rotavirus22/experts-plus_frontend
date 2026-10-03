import { workerListQuerySchema, type WorkerListDto, type WorkerMetaDto } from "@xperts/shared";
import { requirePagePermission, serverApi } from "@/lib/server-api";
import { toSearchParams } from "@/lib/worker-query";
import { WorkersView } from "./workers-view";

export default async function WorkersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePagePermission("workers.view");
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = workerListQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : workerListQuerySchema.parse({});

  const qs = toSearchParams(query).toString();
  const [data, meta] = await Promise.all([
    serverApi<WorkerListDto>(`/workers${qs ? `?${qs}` : ""}`),
    serverApi<WorkerMetaDto>("/workers/meta"),
  ]);

  return <WorkersView data={data} meta={meta} query={query} access={me.access} />;
}
