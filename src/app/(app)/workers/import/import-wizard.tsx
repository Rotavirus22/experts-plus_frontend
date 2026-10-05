"use client";

import {
  FIELD_TYPE_LABELS,
  guessFieldType,
  IMPORT_CHUNK_SIZE,
  IMPORT_FIELDS,
  IMPORT_NEW_FIELD_TYPES,
  IMPORT_OUTCOME_LABELS,
  IMPORT_STATUS_LABELS,
  IMPORT_STATUSES,
  isImportExit,
  SKIP_TARGET,
  statusKey,
  suggestMapping,
  suggestStatus,
  todayDubai,
  type CustomFieldDto,
  type ImportCommitDto,
  type ImportNewFieldType,
  type ImportOptions,
  type ImportOutcome,
  type ImportParseDto,
  type ImportRow,
  type ImportRowResultDto,
  type ImportSetupDto,
  type ImportStatus,
  type ImportValidateDto,
  type WorkerMetaDto,
} from "@xperts/shared";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ShieldAlert, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldControl } from "@/components/ui/field-control";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, beginWork, errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import { useAppRouter } from "@/lib/use-app-router";
import { cn } from "@/lib/utils";

/** Column value meaning "create a new custom field from this column". */
const NEW = "__new";
const NONE = "__none";
const SAVED_KEY = "camps.import.mapping";

type Step = "upload" | "map" | "review" | "import";
type NewField = { label: string; type: ImportNewFieldType };
type Can = { identity: boolean; createFields: boolean; createDivisions: boolean };

const SENSITIVE = /salary|allowance|bank|iban|account/i;

export function ImportWizard({ meta, customFields, can }: { meta: WorkerMetaDto; customFields: CustomFieldDto[]; can: Can }) {
  const router = useAppRouter();
  const [step, setStep] = useState<Step>("upload");

  // 1 · Upload
  const [file, setFile] = useState<ImportParseDto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);

  // 2 · Map
  const [targets, setTargets] = useState<string[]>([]);
  const [newFields, setNewFields] = useState<Record<number, NewField>>({});
  const [clientId, setClientId] = useState("");
  const [sponsorId, setSponsorId] = useState("");
  const [duplicateMode, setDuplicateMode] = useState<"SKIP" | "UPDATE">("SKIP");

  // 3 · Review
  const [statusMap, setStatusMap] = useState<Record<string, ImportStatus | "">>({});
  const [defaultExitDate, setDefaultExitDate] = useState("");
  const [createDivisions, setCreateDivisions] = useState(can.createDivisions);
  const [checked, setChecked] = useState<ImportValidateDto | null>(null);
  const [checking, setChecking] = useState(false);

  // 4 · Import
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportRowResultDto[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const resume = useRef<{ importId: string; options: ImportOptions; rows: ImportRow[]; next: number } | null>(null);

  const sheet = file?.sheets[sheetIndex];
  const width = useMemo(() => Math.max(0, ...(sheet?.rows.map((r) => r.length) ?? [0])), [sheet]);
  const headers = useMemo(
    () => Array.from({ length: width }, (_, i) => sheet?.rows[headerRow - 1]?.[i]?.trim() || `Column ${columnLetter(i)}`),
    [sheet, headerRow, width],
  );
  const rows: ImportRow[] = useMemo(
    () =>
      (sheet?.rows ?? [])
        .slice(headerRow)
        .map((cells, i) => ({ rowNumber: headerRow + i + 1, cells }))
        .filter((r) => r.cells.some((c) => c.trim())),
    [sheet, headerRow],
  );
  const samples = (index: number) => rows.map((r) => r.cells[index]?.trim() ?? "").filter(Boolean);

  const visibleCustom = customFields.filter((f) => !f.isHidden);
  const columnOf = (target: string) => targets.indexOf(target);
  const statusColumn = columnOf("status");
  const statusValues = useMemo(() => {
    if (statusColumn < 0) return [];
    const counts = new Map<string, number>();
    for (const r of rows) {
      const key = statusKey(r.cells[statusColumn] ?? "");
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, statusColumn]);
  const exitsWithoutDate =
    statusValues.some(([v]) => {
      const s = statusMap[v] || suggestStatus(v);
      return s && isImportExit(s);
    }) && columnOf("exit_date") < 0;

  // ───── step 1 ─────

  async function upload(f: File) {
    if (!/\.xlsx$/i.test(f.name)) {
      toast.error("Choose an Excel workbook (.xlsx). Save older .xls files as .xlsx first.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const parsed = await api<ImportParseDto>("/workers/import/parse", { body });
      setFile(parsed);
      setSheetIndex(0);
      setHeaderRow(parsed.sheets[0].headerRow);
      setChecked(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  /** Suggested mapping, or the one saved last time for a sheet with the same headers. */
  function toMapping() {
    const saved = loadSaved(headers);
    const allowed = new Set(targetOptions(visibleCustom, can).map((o) => o.value));
    if (saved) {
      // A field created by an earlier import now exists: map to it instead of creating it again.
      const existing = new Map(visibleCustom.map((f) => [f.label.trim().toLowerCase(), `custom:${f.key}`]));
      setTargets(
        saved.targets.map((t, i) => {
          if (t === NEW) return existing.get(saved.newFields[i]?.label.trim().toLowerCase() ?? "") ?? (can.createFields ? NEW : SKIP_TARGET);
          return allowed.has(t) ? t : SKIP_TARGET;
        }),
      );
      setNewFields(can.createFields ? saved.newFields : {});
    } else {
      setTargets(suggestMapping(headers, visibleCustom).map((t) => (allowed.has(t) ? t : SKIP_TARGET)));
      setNewFields({});
    }
    setStep("map");
  }

  // ───── step 2 ─────

  function setTarget(index: number, value: string) {
    setTargets((prev) => prev.map((t, i) => (i === index ? value : t)));
    if (value === NEW && !newFields[index]) {
      setNewFields((prev) => ({ ...prev, [index]: { label: headers[index].replace(/\s+/g, " ").trim(), type: guessFieldType(samples(index)) } }));
    }
    setChecked(null);
  }

  const mappingProblems = useMemo(() => {
    const problems: string[] = [];
    if (!targets.includes("employee_code")) problems.push("Choose the column for Emp No");
    if (!targets.includes("full_name")) problems.push("Choose the column for Name");
    const labels = new Map<string, number>();
    targets.forEach((t, i) => {
      if (t !== NEW) return;
      const label = newFields[i]?.label.trim() ?? "";
      if (!label) problems.push(`Name the new field for column "${headers[i]}"`);
      const key = label.toLowerCase();
      if (labels.has(key)) problems.push(`Two new fields are called "${label}"`);
      labels.set(key, i);
      if (visibleCustom.some((f) => f.label.toLowerCase() === key) || IMPORT_FIELDS.some((f) => f.label.toLowerCase() === key)) {
        problems.push(`"${label}" already exists: choose it from the list instead of creating it`);
      }
    });
    if (targets.includes("department") && !targets.includes("client_company") && !clientId) {
      problems.push("Divisions belong to a client: choose the client for this file");
    }
    return problems;
  }, [targets, newFields, headers, visibleCustom, clientId]);

  function toReview() {
    saveMapping(headers, targets, newFields);
    setStatusMap(Object.fromEntries(statusValues.map(([v]) => [v, statusMap[v] ?? suggestStatus(v) ?? ""])));
    setStep("review");
  }

  // ───── step 3 ─────

  /** Request options. New fields are referenced as new:<n> until setup() has created them. */
  function buildOptions(fieldKeys?: string[]): ImportOptions {
    const order = targets.map((t, i) => (t === NEW ? i : -1)).filter((i) => i >= 0);
    return {
      columns: targets
        .map((target, index) => {
          if (target !== NEW) return { index, target };
          const n = order.indexOf(index);
          return { index, target: fieldKeys ? `custom:${fieldKeys[n]}` : `new:${n}` };
        })
        .filter((c) => c.target !== SKIP_TARGET),
      newFields: fieldKeys ? [] : order.map((i) => ({ label: newFields[i].label.trim(), type: newFields[i].type })),
      clientId: clientId || null,
      sponsorId: sponsorId || null,
      duplicateMode,
      defaultExitDate: defaultExitDate || null,
      statusMap: Object.fromEntries(Object.entries(statusMap).filter(([, s]) => s)) as Record<string, ImportStatus>,
      createDivisions,
    };
  }

  const unmatchedStatuses = statusValues.filter(([v]) => !statusMap[v]).map(([v]) => v);
  const reviewProblems = [
    ...(unmatchedStatuses.length ? [`Match every status value (${unmatchedStatuses.join(", ")})`] : []),
    ...(exitsWithoutDate && !defaultExitDate ? ["Choose an exit date for exited workers"] : []),
  ];

  async function check() {
    setChecking(true);
    const done = beginWork();
    try {
      setChecked(await api<ImportValidateDto>("/workers/import/validate", { body: { options: buildOptions(), rows: compact(rows, targets) } }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      done();
      setChecking(false);
    }
  }

  // ───── step 4 ─────

  async function start() {
    if (!checked) return;
    const setupBody = {
      newFields: buildOptions().newFields ?? [],
      divisions: createDivisions ? checked.missingDivisions.map((d) => ({ clientId: d.clientId, name: d.name })) : [],
    };
    let fieldKeys: string[] | undefined;
    if (setupBody.newFields.length || setupBody.divisions.length) {
      fieldKeys = (await api<ImportSetupDto>("/workers/import/setup", { body: setupBody })).fieldKeys;
    }
    const send = new Set(checked.results.filter((r) => r.outcome === "CREATE" || r.outcome === "UPDATE").map((r) => r.rowNumber));
    const pending = compact(rows, targets).filter((r) => send.has(r.rowNumber));
    resume.current = { importId: newObjectId(), options: buildOptions(fieldKeys ?? []), rows: pending, next: 0 };
    setResults(checked.results.filter((r) => r.outcome === "ERROR" || r.outcome === "SKIP"));
    setStep("import");
    void run();
  }

  async function run() {
    const job = resume.current;
    if (!job) return;
    setFailure(null);
    setProgress({ done: job.next, total: job.rows.length });
    const done = beginWork();
    try {
      while (job.next < job.rows.length) {
        const chunk = job.rows.slice(job.next, job.next + IMPORT_CHUNK_SIZE);
        const res = await api<ImportCommitDto>("/workers/import/commit", {
          body: { importId: job.importId, fileName: file?.fileName ?? "", options: job.options, rows: chunk },
        });
        job.next += chunk.length;
        setResults((prev) => [...(prev ?? []), ...res.results]);
        setProgress({ done: job.next, total: job.rows.length });
      }
      await router.refresh();
      toast.success("Import finished");
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      done();
    }
  }

  const finished = progress !== null && progress.done === progress.total && !failure;
  const summary = results ? countBy(results) : null;

  // ───── render ─────

  return (
    <div className="flex flex-col gap-5">
      <Steps step={step} />

      {step === "upload" && (
        <Card title="Upload the Excel file">
          <DropZone busy={uploading} onFile={upload} />
          {file && sheet && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                {file.sheets.length > 1 ? (
                  <Field label="Sheet">
                    <Select
                      items={file.sheets.map((s, i) => ({ value: String(i), label: s.name }))}
                      value={String(sheetIndex)}
                      onValueChange={(v) => {
                        const i = Number(v);
                        setSheetIndex(i);
                        setHeaderRow(file.sheets[i].headerRow);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {file.sheets.map((s, i) => (
                          <SelectItem key={s.name} value={String(i)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <div className="flex flex-col gap-1.5 text-sm">
                    <span className="text-[13px] font-medium">Sheet</span>
                    <span className="flex h-9.5 items-center gap-2 font-semibold">
                      <FileSpreadsheet className="size-4 text-status-occupied" /> {sheet.name}
                    </span>
                  </div>
                )}
                <Field label="Headings are in row">
                  <Input
                    type="number"
                    min={1}
                    max={Math.min(50, sheet.rows.length)}
                    value={headerRow}
                    onChange={(e) => setHeaderRow(Math.max(1, Math.min(sheet.rows.length, Number(e.target.value) || 1)))}
                  />
                </Field>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{file.fileName}</span> · {plural(rows.length, "row")} below the headings · {plural(headers.length, "column")}:{" "}
                <span className="text-foreground">{headers.slice(0, 8).join(", ")}{headers.length > 8 ? "…" : ""}</span>
              </p>
              <div className="flex justify-end">
                <Button onClick={toMapping} disabled={!rows.length}>
                  Next: match columns
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {step === "map" && (
        <>
          <Card title="Whole file" aside="Used for every row unless a column below provides it">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Client">
                <Pick
                  value={clientId}
                  onChange={(v) => setClientId(v)}
                  none="No client"
                  options={meta.clients.filter((c) => !c.isHidden).map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field label="Sponsor">
                <Pick
                  value={sponsorId}
                  onChange={(v) => setSponsorId(v)}
                  none="No sponsor"
                  options={meta.sponsors.filter((s) => !s.isHidden).map((s) => ({ value: s.id, label: s.name }))}
                />
              </Field>
              <Field label="Emp No already in the app">
                <Pick
                  value={duplicateMode}
                  onChange={(v) => setDuplicateMode(v === "UPDATE" ? "UPDATE" : "SKIP")}
                  options={[
                    { value: "SKIP", label: "Skip, keep the app's data" },
                    { value: "UPDATE", label: "Update with the file's values" },
                  ]}
                />
              </Field>
            </div>
            {duplicateMode === "UPDATE" && (
              <p className="text-xs text-muted-foreground">
                Updates change only the columns you import. Status, beds and history are never changed by an import.
              </p>
            )}
          </Card>

          <Card title="Match columns" aside={`${plural(targets.filter((t) => t !== SKIP_TARGET).length, "column")} will be imported`}>
            <div className="flex items-start gap-2 rounded-xl border border-status-held-border bg-status-held-bg p-3 text-[13px] text-status-held-fg">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Custom fields are visible to everyone who can view workers. Think twice before importing salary or bank details.
                {!can.identity && " Passport and Emirates ID numbers are not imported because you cannot see them."}
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Excel column</th>
                    <th className="px-3 py-2 font-semibold">Example values</th>
                    <th className="w-[280px] px-3 py-2 font-semibold">Import as</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((header, i) => {
                    const target = targets[i] ?? SKIP_TARGET;
                    const example = samples(i).slice(0, 3);
                    return (
                      <tr key={i} className={cn("border-t align-top", target === SKIP_TARGET && "text-muted-foreground")}>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-foreground">{header}</div>
                          <div className="text-xs text-muted-foreground">Column {columnLetter(i)}</div>
                        </td>
                        <td className="max-w-[260px] px-3 py-2.5 text-xs">
                          {example.length ? (
                            <span className="line-clamp-2 break-all">{example.join(" · ")}</span>
                          ) : (
                            <span className="italic">empty</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <TargetSelect
                            label={header}
                            value={target}
                            used={targets}
                            custom={visibleCustom}
                            can={can}
                            sensitive={SENSITIVE.test(header)}
                            onChange={(v) => setTarget(i, v)}
                          />
                          {target === NEW && newFields[i] && (
                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                              <Input
                                aria-label={`New field name for ${header}`}
                                value={newFields[i].label}
                                maxLength={60}
                                onChange={(e) => setNewFields((prev) => ({ ...prev, [i]: { ...prev[i], label: e.target.value } }))}
                              />
                              <Select
                                items={IMPORT_NEW_FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))}
                                value={newFields[i].type}
                                onValueChange={(v) => setNewFields((prev) => ({ ...prev, [i]: { ...prev[i], type: v as ImportNewFieldType } }))}
                              >
                                <SelectTrigger className="w-full" aria-label={`Type of the new field for ${header}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMPORT_NEW_FIELD_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {FIELD_TYPE_LABELS[t]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Problems items={mappingProblems} />
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={toReview} disabled={mappingProblems.length > 0}>
                Next: check values
              </Button>
            </div>
          </Card>
        </>
      )}

      {step === "review" && (
        <>
          {statusValues.length > 0 && (
            <Card title="Match status values" aside="Exited workers are imported as exited; leave statuses open a leave from today">
              <div className="grid gap-2 sm:grid-cols-2">
                {statusValues.map(([value, count]) => (
                  <div key={value} className="flex items-center gap-3 rounded-xl border p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{value}</div>
                      <div className="text-xs text-muted-foreground">{plural(count, "row")}</div>
                    </div>
                    <div className="w-[190px]">
                      <Select
                        items={[{ value: NONE, label: "Choose…" }, ...IMPORT_STATUSES.map((s) => ({ value: s, label: IMPORT_STATUS_LABELS[s] }))]}
                        value={statusMap[value] || NONE}
                        onValueChange={(v) => {
                          setStatusMap((prev) => ({ ...prev, [value]: v === NONE ? "" : (v as ImportStatus) }));
                          setChecked(null);
                        }}
                      >
                        <SelectTrigger className="w-full" aria-label={`App status for ${value}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {IMPORT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {IMPORT_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              {exitsWithoutDate && (
                <div className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-end">
                  <Field label="Exit date for exited workers">
                    <Input
                      type="date"
                      max={todayDubai()}
                      value={defaultExitDate}
                      onChange={(e) => {
                        setDefaultExitDate(e.target.value);
                        setChecked(null);
                      }}
                    />
                  </Field>
                  <p className="pb-2 text-xs text-muted-foreground">The file has no exit date column, so this date is recorded for every exited worker.</p>
                </div>
              )}
            </Card>
          )}

          <Card title="Check the rows" aside="Nothing is saved until you import">
            {can.createDivisions && targets.includes("department") && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={createDivisions}
                  onCheckedChange={(v) => {
                    setCreateDivisions(v === true);
                    setChecked(null);
                  }}
                />
                Create divisions that do not exist yet
              </label>
            )}
            <Problems items={reviewProblems} />
            {!checked ? (
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep("map")}>
                  Back
                </Button>
                <Button onClick={check} loading={checking} disabled={reviewProblems.length > 0}>
                  Check {plural(rows.length, "row")}
                </Button>
              </div>
            ) : (
              <>
                <Counts counts={checked.counts} />
                {checked.missingDivisions.length > 0 && (
                  <p className="text-sm">
                    {createDivisions ? "New divisions: " : "Divisions not found (left blank): "}
                    <span className="font-semibold">
                      {checked.missingDivisions.map((d) => `${d.name} (${d.clientName})`).join(", ")}
                    </span>
                  </p>
                )}
                <ResultsTable results={checked.results} />
                <div className="flex flex-wrap justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep("map")}>
                    Back
                  </Button>
                  <Button onClick={() => setConfirming(true)} disabled={checked.counts.CREATE + checked.counts.UPDATE === 0}>
                    <Upload data-icon="inline-start" />
                    Import {plural(checked.counts.CREATE + checked.counts.UPDATE, "worker")}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {step === "import" && progress && (
        <Card title={finished ? "Import finished" : failure ? "Import stopped" : "Importing…"}>
          <div className="flex flex-col gap-2">
            <div
              className="h-2.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Import progress"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
            >
              <div
                className={cn("h-full rounded-full transition-[width] duration-300", failure ? "bg-destructive" : "bg-primary")}
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {progress.done.toLocaleString()} of {plural(progress.total, "row")} sent
            </p>
          </div>
          {failure && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 p-3 text-sm">
              <span className="text-destructive">{failure}</span>
              <Button variant="outline" onClick={() => void run()}>
                Continue import
              </Button>
            </div>
          )}
          {summary && <Counts counts={summary} />}
          {results && finished && <ResultsTable results={results} />}
          {finished && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setChecked(null);
                  setResults(null);
                  setProgress(null);
                  setStep("upload");
                }}
              >
                Import another file
              </Button>
              <Link href="/workers" className={buttonVariants()}>
                View workers
              </Link>
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Import workers?"
        icon={<Upload />}
        confirmLabel="Import"
        description={
          checked && (
            <>
              {plural(checked.counts.CREATE, "new worker")} will be added
              {checked.counts.UPDATE ? ` and ${plural(checked.counts.UPDATE, "worker")} updated` : ""}.{" "}
              {checked.counts.ERROR ? `${plural(checked.counts.ERROR, "row")} with errors will be left out. ` : ""}
              Every change is recorded in the audit log.
            </>
          )
        }
        onConfirm={start}
      />
    </div>
  );
}

// ───── pieces ─────

function Steps({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "map", label: "Match columns" },
    { key: "review", label: "Check" },
    { key: "import", label: "Import" },
  ];
  const at = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Import steps">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2" aria-current={i === at ? "step" : undefined}>
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs font-bold",
              i < at ? "bg-status-vacant text-white" : i === at ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {i < at ? "✓" : i + 1}
          </span>
          <span className={cn("font-semibold", i === at ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function Card({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <FieldControl>
      {(id) => (
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={id} className="text-[13px]">
            {label}
          </Label>
          {children}
        </div>
      )}
    </FieldControl>
  );
}

function Pick({ value, onChange, options, none }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; none?: string }) {
  const items = none ? [{ value: NONE, label: none }, ...options] : options;
  return (
    <Select items={items} value={value || (none ? NONE : options[0]?.value)} onValueChange={(v) => onChange(!v || v === NONE ? "" : String(v))}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function targetOptions(custom: CustomFieldDto[], can: Can): { value: string; label: string; group: string }[] {
  return [
    { value: SKIP_TARGET, label: "Don't import", group: "" },
    ...IMPORT_FIELDS.filter((f) => can.identity || !("identity" in f)).map((f) => ({
      value: f.key,
      label: "required" in f ? `${f.label} *` : f.label,
      group: "Built-in fields",
    })),
    ...custom.map((f) => ({ value: `custom:${f.key}`, label: f.label, group: "Custom fields" })),
    ...(can.createFields ? [{ value: NEW, label: "New custom field…", group: "" }] : []),
  ];
}

function TargetSelect({
  label,
  value,
  used,
  custom,
  can,
  sensitive,
  onChange,
}: {
  label: string;
  value: string;
  used: string[];
  custom: CustomFieldDto[];
  can: Can;
  sensitive: boolean;
  onChange: (v: string) => void;
}) {
  const options = targetOptions(custom, can);
  const taken = new Set(used.filter((t) => t !== value && t !== SKIP_TARGET && t !== NEW));
  const builtIn = options.filter((o) => o.group === "Built-in fields");
  const customOpts = options.filter((o) => o.group === "Custom fields");
  const item = (o: { value: string; label: string }) => (
    <SelectItem key={o.value} value={o.value} disabled={taken.has(o.value)}>
      {o.label}
    </SelectItem>
  );
  return (
    <Select items={options} value={value} onValueChange={(v) => onChange(String(v ?? SKIP_TARGET))}>
      <SelectTrigger className={cn("w-full", value !== SKIP_TARGET && "border-primary/50")} aria-label={`Import ${label} as`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {item(options[0])}
        {can.createFields && item({ value: NEW, label: sensitive ? "New custom field… (sensitive?)" : "New custom field…" })}
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Built-in fields</SelectLabel>
          {builtIn.map(item)}
        </SelectGroup>
        {customOpts.length > 0 && (
          <SelectGroup>
            <SelectSeparator />
            <SelectLabel>Custom fields</SelectLabel>
            {customOpts.map(item)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

function DropZone({ busy, onFile }: { busy: boolean; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f && !busy) onFile(f);
      }}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition",
        over ? "border-primary bg-status-occupied-bg" : "border-border",
      )}
    >
      <FileSpreadsheet className="size-9 text-status-occupied" />
      <div>
        <div className="font-semibold">Drop an Excel file here</div>
        <div className="text-sm text-muted-foreground">.xlsx, up to 10 MB. The first sheet with data is used; you can pick another.</div>
      </div>
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        aria-label="Excel file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" loading={busy} onClick={() => input.current?.click()}>
        {!busy && <Upload data-icon="inline-start" />}
        {busy ? "Reading file…" : "Choose file"}
      </Button>
    </div>
  );
}

function Problems({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm text-destructive">
      {items.map((p) => (
        <li key={p} className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {p}
        </li>
      ))}
    </ul>
  );
}

const OUTCOME_STYLE: Record<ImportOutcome, string> = {
  CREATE: "border-status-vacant-border bg-status-vacant-bg text-status-vacant-fg",
  UPDATE: "border-status-occupied-border bg-status-occupied-bg text-status-occupied-fg",
  SKIP: "bg-muted text-muted-foreground",
  ERROR: "border-destructive/40 bg-destructive/10 text-destructive",
};

function Counts({ counts }: { counts: Record<ImportOutcome, number> }) {
  const labels: Record<ImportOutcome, string> = { CREATE: "New", UPDATE: "Updated", SKIP: "Skipped", ERROR: "Errors" };
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Row counts">
      {(Object.keys(labels) as ImportOutcome[]).map((k) => (
        <div key={k} className={cn("rounded-xl border p-3", OUTCOME_STYLE[k])}>
          <div className="text-2xl font-extrabold">{counts[k].toLocaleString()}</div>
          <div className="text-xs font-semibold">{labels[k]}</div>
        </div>
      ))}
    </div>
  );
}

const SHOW_ROWS = 200;

/** Rows with errors or warnings first; everything can be downloaded as CSV. */
function ResultsTable({ results }: { results: ImportRowResultDto[] }) {
  const [filter, setFilter] = useState<"issues" | "all">("issues");
  const issues = results.filter((r) => r.errors.length || r.warnings.length);
  const list = (filter === "issues" ? issues : results).slice().sort((a, b) => rank(a) - rank(b) || a.rowNumber - b.rowNumber);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Rows to show">
          {(["issues", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn("rounded-lg px-2.5 py-1 text-[13px] font-semibold", filter === f ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {f === "issues" ? `Rows with notes (${issues.length.toLocaleString()})` : `All rows (${results.length.toLocaleString()})`}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(results)}>
          <Download data-icon="inline-start" /> Download results (CSV)
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border p-3 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-status-vacant" /> No problems found.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Row</th>
                <th className="px-3 py-2 font-semibold">Emp No</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Result</th>
                <th className="px-3 py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, SHOW_ROWS).map((r) => (
                <tr key={r.rowNumber} className="border-t align-top">
                  <td className="px-3 py-2 tabular-nums">{r.rowNumber}</td>
                  <td className="px-3 py-2 font-semibold">{r.employeeCode ?? "—"}</td>
                  <td className="px-3 py-2">{r.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", OUTCOME_STYLE[r.outcome])}>
                      {IMPORT_OUTCOME_LABELS[r.outcome]}
                      {r.status && r.outcome !== "ERROR" && r.status !== "ACTIVE" ? ` · ${IMPORT_STATUS_LABELS[r.status]}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.errors.map((e) => (
                      <div key={e} className="flex items-start gap-1 text-destructive">
                        <XCircle className="mt-px size-3.5 shrink-0" /> {e}
                      </div>
                    ))}
                    {r.warnings.map((w) => (
                      <div key={w} className="text-muted-foreground">
                        {w}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > SHOW_ROWS && (
            <p className="border-t p-2 text-center text-xs text-muted-foreground">
              Showing {SHOW_ROWS} of {list.length.toLocaleString()} rows. Download the CSV for all of them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ───── helpers ─────

const rank = (r: ImportRowResultDto) => (r.outcome === "ERROR" ? 0 : r.warnings.length ? 1 : 2);

function countBy(results: ImportRowResultDto[]): Record<ImportOutcome, number> {
  const counts: Record<ImportOutcome, number> = { CREATE: 0, UPDATE: 0, SKIP: 0, ERROR: 0 };
  for (const r of results) counts[r.outcome]++;
  return counts;
}

/** Sends only the mapped cells (others become ""), keeping column positions. */
function compact(rows: ImportRow[], targets: string[]): ImportRow[] {
  const keep = targets.map((t) => t !== SKIP_TARGET);
  const last = keep.lastIndexOf(true);
  return rows.map((r) => ({ rowNumber: r.rowNumber, cells: Array.from({ length: last + 1 }, (_, i) => (keep[i] ? (r.cells[i] ?? "") : "")) }));
}

function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function newObjectId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function downloadCsv(results: ImportRowResultDto[]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    ["Row", "Emp No", "Name", "Result", "Errors", "Notes"].join(","),
    ...results
      .slice()
      .sort((a, b) => a.rowNumber - b.rowNumber)
      .map((r) => [String(r.rowNumber), r.employeeCode ?? "", r.name ?? "", IMPORT_OUTCOME_LABELS[r.outcome], r.errors.join("; "), r.warnings.join("; ")].map(esc).join(",")),
  ];
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: "import-results.csv" }).click();
  URL.revokeObjectURL(url);
}

/** Last mapping per header layout, so a monthly re-import is one click. Per browser only. */
function loadSaved(headers: string[]): { targets: string[]; newFields: Record<number, NewField> } | null {
  try {
    const all = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "{}") as Record<string, { targets: string[]; newFields: Record<number, NewField> }>;
    const saved = all[headers.join("|")];
    return saved && saved.targets.length === headers.length ? saved : null;
  } catch {
    return null;
  }
}

function saveMapping(headers: string[], targets: string[], newFields: Record<number, NewField>) {
  try {
    const all = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "{}") as Record<string, unknown>;
    all[headers.join("|")] = { targets, newFields };
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable (private window): mapping just isn't remembered.
  }
}
