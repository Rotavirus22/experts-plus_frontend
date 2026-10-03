"use client";

import type { OrganisationDto, OrgClientDto, OrgItemDto } from "@xperts/shared";
import { Briefcase, Building, ChevronRight, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AsyncButton } from "@/components/async-button";
import { EmptyState, PageHeader, Pill } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppRouter } from "@/lib/use-app-router";

type Kind = "sponsors" | "clients" | "divisions";
const NOUN: Record<Kind, string> = { sponsors: "sponsor", clients: "client", divisions: "division" };

/** Name dialog for add and rename. `path` is the POST (add) or PATCH (rename) endpoint. */
type NameTarget = { title: string; description?: string; path: string; method: "POST" | "PATCH"; initial: string; done: string };

export function OrganisationManager({ data }: { data: OrganisationDto }) {
  const router = useAppRouter();
  const [target, setTarget] = useState<NameTarget | null>(null);
  // undefined = nothing chosen yet: show the first client open (also right after the first one is added).
  const [chosenClient, setOpenClient] = useState<string | null | undefined>(undefined);
  const openClient = chosenClient === undefined ? (data.clients[0]?.id ?? null) : chosenClient;

  async function setHidden(kind: Kind, item: OrgItemDto, hidden: boolean) {
    try {
      await api(`/organisation/${kind}/${item.id}/hidden`, { body: { hidden } });
      toast.success(hidden ? `“${item.name}” hidden` : `“${item.name}” visible again`);
      await router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const add = (kind: Kind, path: string, description?: string): NameTarget => ({
    title: `Add ${NOUN[kind]}`,
    description,
    path,
    method: "POST",
    initial: "",
    done: `${NOUN[kind][0].toUpperCase()}${NOUN[kind].slice(1)} added`,
  });
  const rename = (kind: Kind, item: OrgItemDto): NameTarget => ({
    title: `Rename ${NOUN[kind]}`,
    description: item.workerCount ? `${item.workerCount} worker(s) will show the new name.` : undefined,
    path: `/organisation/${kind}/${item.id}`,
    method: "PATCH",
    initial: item.name,
    done: "Renamed",
  });

  const actions = (kind: Kind) => ({
    onRename: (item: OrgItemDto) => setTarget(rename(kind, item)),
    onHide: (item: OrgItemDto) => setHidden(kind, item, !item.isHidden),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sponsors & clients"
        subtitle="Lists used on the worker form. Entries are never deleted — hide one to stop offering it; workers keep their value."
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-lg font-bold">Sponsors</h2>
              <p className="text-[13px] text-muted-foreground">Visa sponsor entities</p>
            </div>
            <Button size="sm" onClick={() => setTarget(add("sponsors", "/organisation/sponsors"))}>
              <Plus data-icon="inline-start" /> Add sponsor
            </Button>
          </header>
          {data.sponsors.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={<Briefcase className="size-5" />} title="No sponsors yet">
                Add the companies that sponsor workers&apos; visas.
              </EmptyState>
            </div>
          ) : (
            <div className="divide-y">
              {data.sponsors.map((s) => (
                <Row key={s.id} item={s} {...actions("sponsors")} />
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-lg font-bold">Clients & divisions</h2>
              <p className="text-[13px] text-muted-foreground">Companies workers are outsourced to</p>
            </div>
            <Button size="sm" onClick={() => setTarget(add("clients", "/organisation/clients"))}>
              <Plus data-icon="inline-start" /> Add client
            </Button>
          </header>
          {data.clients.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={<Building className="size-5" />} title="No clients yet">
                Add a client, then its divisions.
              </EmptyState>
            </div>
          ) : (
            <div className="divide-y">
              {data.clients.map((c) => (
                <ClientBlock
                  key={c.id}
                  client={c}
                  open={openClient === c.id}
                  onToggle={() => setOpenClient(openClient === c.id ? null : c.id)}
                  clientActions={actions("clients")}
                  divisionActions={actions("divisions")}
                  onAddDivision={() =>
                    setTarget(add("divisions", `/organisation/clients/${c.id}/divisions`, `Division of ${c.name}.`))
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {target && (
        <NameDialog
          target={target}
          onClose={() => setTarget(null)}
          onSaved={async () => {
            await router.refresh();
            setTarget(null);
          }}
        />
      )}
    </div>
  );
}

type RowActions = { onRename: (item: OrgItemDto) => void; onHide: (item: OrgItemDto) => Promise<void> };

function Row({ item, extra, onRename, onHide }: { item: OrgItemDto; extra?: React.ReactNode } & RowActions) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5", item.isHidden && "bg-muted/50 text-muted-foreground")}>
      {extra}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate font-semibold", item.isHidden && "line-through")}>{item.name}</span>
        <span className="text-xs text-muted-foreground">
          {item.workerCount.toLocaleString()} worker{item.workerCount === 1 ? "" : "s"}
        </span>
      </div>
      {item.isHidden && <Pill>Hidden</Pill>}
      <Button size="icon-sm" variant="ghost" aria-label={`Rename ${item.name}`} onClick={() => onRename(item)}>
        <Pencil />
      </Button>
      <AsyncButton size="sm" variant="outline" onClick={() => onHide(item)}>
        {item.isHidden ? "Show" : "Hide"}
      </AsyncButton>
    </div>
  );
}

function ClientBlock({
  client,
  open,
  onToggle,
  clientActions,
  divisionActions,
  onAddDivision,
}: {
  client: OrgClientDto;
  open: boolean;
  onToggle: () => void;
  clientActions: RowActions;
  divisionActions: RowActions;
  onAddDivision: () => void;
}) {
  return (
    <div>
      <Row
        item={client}
        {...clientActions}
        extra={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-expanded={open}
            aria-label={open ? `Collapse ${client.name}` : `Show divisions of ${client.name}`}
            onClick={onToggle}
          >
            <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
          </Button>
        }
      />
      {open && (
        <div className="border-t bg-muted/30 pb-3 pl-12">
          {client.divisions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No divisions yet.</p>
          ) : (
            <div className="divide-y">
              {client.divisions.map((d) => (
                <Row key={d.id} item={d} {...divisionActions} />
              ))}
            </div>
          )}
          <div className="px-4 pt-2">
            <Button size="sm" variant="outline" onClick={onAddDivision}>
              <Plus data-icon="inline-start" /> Add division
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NameDialog({ target, onClose, onSaved }: { target: NameTarget; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [name, setName] = useState(target.initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return setError("Name is required");
    setBusy(true);
    setError(null);
    try {
      await api(target.path, { method: target.method, body: { name: value } });
      toast.success(target.done);
      await onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{target.title}</DialogTitle>
            {target.description && <DialogDescription>{target.description}</DialogDescription>}
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input id="org-name" autoFocus value={name} maxLength={120} aria-invalid={!!error} onChange={(e) => setName(e.target.value)} />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
