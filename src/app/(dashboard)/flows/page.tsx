"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Workflow,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  MessageSquare,
  PlayCircle,
  PauseCircle,
  Archive,
  HelpCircle,
  UserPlus,
  FileText,
  Sparkles,
  Search,
  Share2,
  ArrowRight,
} from "lucide-react";

import { useTranslations } from "next-intl";
import { useCan } from "@/hooks/use-can";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface FlowRow {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: { keywords?: string[] } | Record<string, unknown>;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
  origin_template_id?: string | null;
  is_template?: boolean;
}

const STATUS_LABELS = (t: ReturnType<typeof useTranslations>): Record<FlowRow["status"], string> => ({
  draft: t("statusDraft"),
  active: t("statusActive"),
  archived: t("statusArchived"),
});

const STATUS_COLORS: Record<FlowRow["status"], string> = {
  draft: "border-border bg-muted text-muted-foreground",
  active: "border-emerald-600/40 bg-emerald-500/10 text-emerald-300",
  archived: "border-border bg-muted/50 text-muted-foreground",
};

interface TemplateSummary {
  slug: string;
  name: string;
  description: string;
  icon: "MessageSquare" | "HelpCircle" | "UserPlus";
  trigger_type: string;
  node_count: number;
}

interface LibraryTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  trigger_type: string;
  node_count: number;
  created_at: string;
}

const TEMPLATE_ICONS = {
  MessageSquare,
  HelpCircle,
  UserPlus,
} as const;

const LIBRARY_CATEGORIES = [
  "All",
  "Sales & Lead Gen",
  "Customer Support",
  "Appointments & Booking",
  "Onboarding & Welcome",
  "Feedback & Surveys",
  "General",
];

export default function FlowsPage() {
  const router = useRouter();
  const canCreate = useCan("send-messages");
  const { isSuperAdmin } = useAuth();
  const t = useTranslations("Flows.list");
  const tGate = useTranslations("GatedButton");

  const [activeTab, setActiveTab] = useState<"my_flows" | "library">("my_flows");
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);

  // Flow Library State
  const [libraryTemplates, setLibraryTemplates] = useState<LibraryTemplate[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [librarySearch, setLibrarySearch] = useState("");
  const [cloningId, setCloningId] = useState<string | null>(null);

  // Promote flow to template (Super Admin)
  const [promoteFlow, setPromoteFlow] = useState<FlowRow | null>(null);
  const [promoteName, setPromoteName] = useState("");
  const [promoteDescription, setPromoteDescription] = useState("");
  const [promoteCategory, setPromoteCategory] = useState("Sales & Lead Gen");
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [flowsRes, tmplRes, libRes] = await Promise.all([
          fetch("/api/flows"),
          fetch("/api/flows/templates"),
          fetch("/api/flows/library"),
        ]);

        if (!flowsRes.ok) {
          throw new Error(`Failed to load flows: ${flowsRes.status}`);
        }
        const flowsJson = (await flowsRes.json()) as { flows: FlowRow[] };
        // Exclude any templates from client's My Automations
        if (!cancelled) {
          const rawFlows = flowsJson.flows ?? [];
          setFlows(rawFlows.filter((f) => !f.is_template));
        }

        if (tmplRes.ok) {
          const tmplJson = (await tmplRes.json()) as {
            templates: TemplateSummary[];
          };
          if (!cancelled) setTemplates(tmplJson.templates ?? []);
        }

        if (libRes.ok) {
          const libJson = (await libRes.json()) as {
            templates: LibraryTemplate[];
          };
          if (!cancelled) setLibraryTemplates(libJson.templates ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          toast.error(t("loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshLibrary() {
    try {
      setLoadingLibrary(true);
      const res = await fetch("/api/flows/library");
      if (res.ok) {
        const json = await res.json();
        setLibraryTemplates(json.templates ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLibrary(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          trigger_type: "keyword",
          trigger_config: { keywords: [] },
        }),
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      const json = (await res.json()) as { flow: FlowRow };
      setCreateOpen(false);
      setNewName("");
      router.push(`/flows/${json.flow.id}`);
    } catch (err) {
      console.error(err);
      toast.error(t("createError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleUseTemplate(slug: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_slug: slug }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? t("cloneFailedStatus", { status: res.status }));
      }
      const json = (await res.json()) as { flow: FlowRow };
      setCreateOpen(false);
      router.push(`/flows/${json.flow.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("cloneError");
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleCloneLibraryTemplate(templateId: string) {
    try {
      setCloningId(templateId);
      const res = await fetch("/api/flows/library/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to clone template");
      }

      toast.success("Template cloned to your workspace! Opening canvas...");
      router.push(`/flows/${data.flowId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to use template";
      toast.error(msg);
    } finally {
      setCloningId(null);
    }
  }

  async function handleDelete(flow: FlowRow) {
    const yes = window.confirm(t("deleteConfirm", { name: flow.name }));
    if (!yes) return;
    try {
      const res = await fetch(`/api/flows/${flow.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
      toast.success(t("deleteSuccess"));
    } catch (err) {
      console.error(err);
      toast.error(t("deleteError"));
    }
  }

  const openPromoteModal = (flow: FlowRow) => {
    setPromoteFlow(flow);
    setPromoteName(flow.name);
    setPromoteDescription(flow.description || "");
    setPromoteCategory("Sales & Lead Gen");
  };

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteFlow || !promoteName.trim()) return;
    try {
      setPromoting(true);
      const res = await fetch("/api/admin/flows/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceFlowId: promoteFlow.id,
          name: promoteName,
          description: promoteDescription,
          category: promoteCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to promote flow");

      toast.success("Flow successfully published to Master Library!");
      setPromoteFlow(null);
      refreshLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setPromoting(false);
    }
  };

  const myFlows = flows.filter((f) => !f.is_template);

  const filteredLibrary = libraryTemplates.filter((item) => {
    const matchesCategory =
      selectedCategory === "All" || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !librarySearch.trim() ||
      item.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(librarySearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
            <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              {t("beta")}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <div className="flex items-center gap-2">
          <GatedButton
            canAct={canCreate}
            gateReason={tGate("reasons.createFlows")}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t("newFlow")}
          </GatedButton>
        </div>
      </header>

      {/* Tabs with toggle button style like AI Agent */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          const next = val as "my_flows" | "library";
          setActiveTab(next);
          if (next === "library") refreshLibrary();
        }}
        className="space-y-6"
      >
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="my_flows" className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold">
            <Workflow className="h-4 w-4" />
            My Flows
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {myFlows.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="library" className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Flow Library
            <Badge
              variant="outline"
              className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-300 border-amber-500/30"
            >
              {libraryTemplates.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MY FLOWS */}
        <TabsContent value="my_flows" className="space-y-4 outline-hidden mt-0">
          {myFlows.length === 0 ? (
            <EmptyState
              onCreate={() => setCreateOpen(true)}
              onBrowseLibrary={() => {
                setActiveTab("library");
                refreshLibrary();
              }}
              canCreate={canCreate}
              t={t}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {myFlows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  isSuperAdmin={Boolean(isSuperAdmin)}
                  onEdit={() => router.push(`/flows/${flow.id}`)}
                  onDelete={() => handleDelete(flow)}
                  onPromote={() => openPromoteModal(flow)}
                  t={t}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: FLOW LIBRARY */}
        <TabsContent value="library" className="space-y-6 outline-hidden mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Prebuilt Automation Library
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select any ready-made workflow blueprint to clone into your workspace and customize.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search prebuilt flows..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {LIBRARY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  selectedCategory === cat
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid of Library Templates */}
          {loadingLibrary ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading templates...
            </div>
          ) : filteredLibrary.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
              No prebuilt templates found for this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLibrary.map((template) => (
                <Card
                  key={template.id}
                  className="border-border hover:border-amber-500/40 transition-colors flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className="text-[11px] font-semibold text-amber-400 border-amber-500/30 bg-amber-500/10"
                      >
                        {template.category}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">
                        {template.trigger_type.replace("_", " ")}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold mt-2 text-foreground">{template.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {template.description || "Pre-designed chatbot automation."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-3">
                      <span className="inline-flex items-center gap-1">
                        <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
                        {template.node_count} nodes configured
                      </span>
                      <span>Ready to deploy</span>
                    </div>

                    <Button
                      onClick={() => handleCloneLibraryTemplate(template.id)}
                      disabled={cloningId === template.id}
                      className="w-full text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      {cloningId === template.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Installing Template...
                        </>
                      ) : (
                        <>
                          Use Template
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Flow Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-4xl bg-popover text-popover-foreground">
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{t("createDesc")}</DialogDescription>
          </DialogHeader>

          {templates.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("startTemplate")}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => {
                  const Icon = TEMPLATE_ICONS[template.icon] ?? FileText;
                  return (
                    <button
                      key={template.slug}
                      type="button"
                      onClick={() => handleUseTemplate(template.slug)}
                      disabled={creating}
                      className="flex flex-col gap-2.5 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted disabled:opacity-50"
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-sm font-semibold text-popover-foreground">{template.name}</span>
                      <span className="text-xs leading-relaxed text-muted-foreground">{template.description}</span>
                      <span className="mt-auto border-t border-border pt-2 text-[11px] text-muted-foreground">
                        {t("nodeCount", { count: template.node_count })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("startBlank")}</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("placeholderName")}
              className="bg-muted"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {t("createBlank")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin Promote Flow Dialog */}
      <Dialog open={Boolean(promoteFlow)} onOpenChange={(open) => !open && setPromoteFlow(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handlePromoteSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Publish to Master Flow Library
              </DialogTitle>
              <DialogDescription>
                Convert this flow into a prebuilt template visible to all tenant accounts.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Template Name</label>
                <Input
                  value={promoteName}
                  onChange={(e) => setPromoteName(e.target.value)}
                  placeholder="e.g. Real Estate Lead Qualifier"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Category</label>
                <select
                  value={promoteCategory}
                  onChange={(e) => setPromoteCategory(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <option value="Sales & Lead Gen">Sales & Lead Gen</option>
                  <option value="Customer Support">Customer Support</option>
                  <option value="Appointments & Booking">Appointments & Booking</option>
                  <option value="Onboarding & Welcome">Onboarding & Welcome</option>
                  <option value="Feedback & Surveys">Feedback & Surveys</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <Input
                  value={promoteDescription}
                  onChange={(e) => setPromoteDescription(e.target.value)}
                  placeholder="Explain what this automation template does..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPromoteFlow(null)} disabled={promoting}>
                Cancel
              </Button>
              <Button type="submit" disabled={promoting} className="bg-amber-600 hover:bg-amber-500 text-white">
                {promoting ? "Publishing..." : "Publish to Library"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({
  onCreate,
  onBrowseLibrary,
  canCreate,
  t,
}: {
  onCreate: () => void;
  onBrowseLibrary: () => void;
  canCreate: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const tGate = useTranslations("GatedButton");
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Workflow className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-base font-medium text-foreground">{t("emptyTitle")}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("emptyDesc")}</p>
      <div className="mt-5 flex items-center gap-3">
        <GatedButton canAct={canCreate} gateReason={tGate("reasons.createFlows")} onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t("createFirst")}
        </GatedButton>
        <Button variant="outline" onClick={onBrowseLibrary} className="text-amber-400 border-amber-500/30">
          <Sparkles className="h-4 w-4 mr-1.5 text-amber-400" />
          Browse Flow Library
        </Button>
      </div>
    </div>
  );
}

function FlowCard({
  flow,
  isSuperAdmin,
  onEdit,
  onDelete,
  onPromote,
  t,
}: {
  flow: FlowRow;
  isSuperAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPromote: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const triggerSummary = describeTrigger(flow, t);
  const StatusIcon =
    flow.status === "active" ? PlayCircle : flow.status === "archived" ? Archive : PauseCircle;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Workflow className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="truncate text-sm font-semibold text-foreground">{flow.name}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {flow.origin_template_id && (
            <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30 bg-amber-500/10">
              Prebuilt
            </Badge>
          )}
          <Badge variant="outline" className={cn("shrink-0 gap-1 text-[10px]", STATUS_COLORS[flow.status])}>
            <StatusIcon className="h-3 w-3" />
            {STATUS_LABELS(t)[flow.status]}
          </Badge>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{flow.description || triggerSummary}</p>

      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {t("runCount", { count: flow.execution_count })}
        </span>

        {isSuperAdmin && (
          <button
            onClick={onPromote}
            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
            title="Publish this flow to Master Library"
          >
            <Share2 className="h-3 w-3" />
            Publish to Library
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          {t("edit")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}

function describeTrigger(flow: FlowRow, t: ReturnType<typeof useTranslations>): string {
  if (flow.trigger_type === "keyword") {
    const keywords = Array.isArray(flow.trigger_config.keywords)
      ? (flow.trigger_config.keywords as string[])
      : [];
    if (keywords.length === 0) return t("triggerKeywordNone");
    return t("triggerKeyword", { keywords: keywords.join(", ") });
  }
  if (flow.trigger_type === "first_inbound_message") {
    return t("triggerFirstInbound");
  }
  return t("triggerManual");
}
