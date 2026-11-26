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
  FileText,
  Search,
  Share2,
  ArrowRight,
  Clock,
  CreditCard,
  Calendar,
  LayoutGrid,
  List,
  MessageSquare,
  HelpCircle,
  UserPlus,
  Award,
} from "lucide-react";

import { useTranslations } from "next-intl";
import { useCan } from "@/hooks/use-can";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FlowsPageSkeleton } from "@/components/skeletons/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  trigger_type: "keyword" | "first_inbound_message" | "manual" | "ai_intent";
  trigger_config: { keywords?: string[]; intent_name?: string } | Record<string, unknown>;
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
  draft: "border-border bg-muted/60 text-muted-foreground",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  archived: "border-border bg-muted/40 text-muted-foreground",
};

interface TemplateSummary {
  slug: string;
  name: string;
  description: string;
  icon: string;
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

const TEMPLATE_ICONS: Record<string, any> = {
  MessageSquare,
  HelpCircle,
  UserPlus,
  CreditCard,
  Calendar,
  Award,
};

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
  const { isSuperAdmin, isImpersonating } = useAuth();
  const [cookieImpersonating, setCookieImpersonating] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";").map((c) => c.trim());
      const hasFlag = cookies.some(
        (c) =>
          c.startsWith("wapp_is_impersonating=") ||
          c.startsWith("wapp_impersonate_account_id=")
      );
      if (hasFlag) setCookieImpersonating(true);
    }
  }, []);

  // Only super admins or admins currently impersonating a client account can promote flows to the master library
  const canPromote = Boolean(isSuperAdmin || isImpersonating || cookieImpersonating);
  const t = useTranslations("Flows.list");
  const tGate = useTranslations("GatedButton");

  const [activeTab, setActiveTab] = useState<"my_flows" | "library">("my_flows");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [flowSearch, setFlowSearch] = useState("");
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

    // 1. Primary list: unblock My Flows immediately without waiting for templates/library
    (async () => {
      try {
        const flowsRes = await fetch("/api/flows");
        if (!flowsRes.ok) {
          throw new Error(`Failed to load flows: ${flowsRes.status}`);
        }
        const flowsJson = (await flowsRes.json()) as { flows: FlowRow[] };
        if (!cancelled) {
          const rawFlows = flowsJson.flows ?? [];
          setFlows(rawFlows.filter((f) => !f.is_template));
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

    // 2. Secondary data: load templates & library in parallel without blocking primary UI
    fetch("/api/flows/templates")
      .then((res) => (res.ok ? res.json() : null))
      .then((tmplJson) => {
        if (!cancelled && tmplJson?.templates) {
          setTemplates(tmplJson.templates);
        }
      })
      .catch(() => {});

    fetch("/api/flows/library")
      .then((res) => (res.ok ? res.json() : null))
      .then((libJson) => {
        if (!cancelled && libJson?.templates) {
          setLibraryTemplates(libJson.templates);
        }
      })
      .catch(() => {});

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
  const filteredMyFlows = myFlows.filter((f) => {
    if (!flowSearch.trim()) return true;
    const q = flowSearch.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      (f.description && f.description.toLowerCase().includes(q)) ||
      f.trigger_type.toLowerCase().includes(q)
    );
  });

  const filteredLibrary = libraryTemplates.filter((item) => {
    const matchesCategory =
      selectedCategory === "All" || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !librarySearch.trim() ||
      item.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(librarySearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  async function toggleFlowStatus(flow: FlowRow) {
    const next = flow.status === "active" ? "draft" : "active";
    try {
      const res = await fetch(`/api/flows/${flow.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setFlows((prev) => prev.map((f) => (f.id === flow.id ? { ...f, status: data.flow.status } : f)));
      toast.success(next === "active" ? "Flow activated" : "Flow paused");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (loading) {
    return <FlowsPageSkeleton />;
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">{t("title")}</h1>
            <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {t("beta")}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <div className="flex items-center gap-2">
          <GatedButton
            canAct={canCreate}
            gateReason={tGate("reasons.createFlows")}
            onClick={() => setCreateOpen(true)}
            className="rounded-md"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t("newFlow")}
          </GatedButton>
        </div>
      </header>

      {/* Tabs: My Flows | Prebuilt Flows */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          const next = val as "my_flows" | "library";
          setActiveTab(next);
          if (next === "library") refreshLibrary();
        }}
        className="space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="bg-muted/70 p-1 rounded-md border border-border">
            <TabsTrigger value="my_flows" className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded">
              My Flows
              <span className="text-[11px] text-muted-foreground font-mono">
                {myFlows.length}
              </span>
            </TabsTrigger>

            <TabsTrigger value="library" className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded">
              Prebuilt Flows
              <span className="text-[11px] text-muted-foreground font-mono">
                {libraryTemplates.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {activeTab === "my_flows" && myFlows.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search flows..."
                  value={flowSearch}
                  onChange={(e) => setFlowSearch(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-md"
                />
              </div>

              <div className="flex items-center rounded-md border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    viewMode === "cards"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Cards view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    viewMode === "list"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                  <span>List</span>
                </button>
              </div>
            </div>
          )}
        </div>

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
          ) : filteredMyFlows.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-10 text-center text-muted-foreground text-sm">
              No flows match &ldquo;{flowSearch}&rdquo;.
            </div>
          ) : viewMode === "cards" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredMyFlows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  canPromote={canPromote}
                  onEdit={() => router.push(`/flows/${flow.id}`)}
                  onDelete={() => handleDelete(flow)}
                  onPromote={() => openPromoteModal(flow)}
                  onToggleStatus={() => void toggleFlowStatus(flow)}
                  onViewRuns={() => router.push(`/flows/${flow.id}/runs`)}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="py-2.5 px-4">Flow</th>
                      <th className="py-2.5 px-4">Trigger</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Runs</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {filteredMyFlows.map((flow) => (
                      <FlowListRow
                        key={flow.id}
                        flow={flow}
                        canPromote={canPromote}
                        onEdit={() => router.push(`/flows/${flow.id}`)}
                        onDelete={() => handleDelete(flow)}
                        onPromote={() => openPromoteModal(flow)}
                        onToggleStatus={() => void toggleFlowStatus(flow)}
                        onViewRuns={() => router.push(`/flows/${flow.id}/runs`)}
                        t={t}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: PREBUILT FLOWS */}
        <TabsContent value="library" className="space-y-5 outline-hidden mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Prebuilt Flows
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clone a ready-made workflow into your workspace and customize its steps.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search prebuilt flows..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-md"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-1.5">
            {LIBRARY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid of Library Templates */}
          {loadingLibrary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="rounded-md border border-border bg-card p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-16 rounded" />
                  </div>
                  <Skeleton className="h-10 w-full rounded" />
                  <Skeleton className="h-8 w-full rounded" />
                </div>
              ))}
            </div>
          ) : filteredLibrary.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-10 text-center text-muted-foreground text-sm">
              No prebuilt flows found for this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLibrary.map((template) => (
                <Card
                  key={template.id}
                  className="rounded-md border-border hover:border-foreground/25 transition-colors flex flex-col justify-between shadow-none"
                >
                  <CardHeader className="pb-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-[11px] font-medium rounded">
                        {template.category}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">
                        {template.trigger_type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {template.name}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {template.description || "Ready-to-use workflow blueprint."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-2.5">
                      <span>{template.node_count} steps</span>
                      <span>Click to clone</span>
                    </div>

                    <Button
                      onClick={() => handleCloneLibraryTemplate(template.id)}
                      disabled={cloningId === template.id}
                      size="sm"
                      className="w-full h-8 text-xs font-medium rounded-md"
                    >
                      {cloningId === template.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Cloning Flow...
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
              <DialogTitle>
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
              <Button type="submit" disabled={promoting}>
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
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
        <Workflow className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-base font-medium text-foreground">{t("emptyTitle")}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("emptyDesc")}</p>
      <div className="mt-5 flex items-center gap-3">
        <GatedButton canAct={canCreate} gateReason={tGate("reasons.createFlows")} onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t("createFirst")}
        </GatedButton>
        <Button variant="outline" onClick={onBrowseLibrary}>
          Browse Prebuilt Flows
        </Button>
      </div>
    </div>
  );
}

function FlowCard({
  flow,
  canPromote,
  onEdit,
  onDelete,
  onPromote,
  onToggleStatus,
  onViewRuns,
  t,
}: {
  flow: FlowRow;
  canPromote: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPromote: () => void;
  onToggleStatus: () => void;
  onViewRuns: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const triggerSummary = describeTrigger(flow, t);

  return (
    <div className="flex flex-col justify-between rounded-md border border-border bg-card p-4 transition-colors hover:border-foreground/25">
      <div>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="text-left text-sm font-semibold text-foreground hover:underline truncate"
          >
            {flow.name}
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            {flow.origin_template_id && (
              <Badge variant="secondary" className="text-[10px] font-normal rounded">
                Prebuilt
              </Badge>
            )}
            <Badge variant="outline" className={cn("text-[10px] rounded", STATUS_COLORS[flow.status])}>
              {STATUS_LABELS(t)[flow.status]}
            </Badge>
          </div>
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground min-h-[2rem]">
          {flow.description || triggerSummary}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 truncate max-w-[200px]">
            {triggerSummary}
          </span>
          <span>·</span>
          <span>{t("runCount", { count: flow.execution_count })}</span>
          {flow.last_executed_at && (
            <>
              <span>·</span>
              <span>Last run {new Date(flow.last_executed_at).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Switch checked={flow.status === "active"} onCheckedChange={onToggleStatus} />
          <span className="text-xs text-muted-foreground">{flow.status === "active" ? "Active" : "Paused"}</span>
        </div>
        <div className="flex items-center gap-1">
          {canPromote && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPromote}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Publish to Prebuilt Library"
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onViewRuns} className="h-7 px-2 text-xs">
            <Clock className="h-3.5 w-3.5 mr-1" />
            Runs
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2 text-xs">
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {t("edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 px-2 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-500"
            title={t("delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FlowListRow({
  flow,
  canPromote,
  onEdit,
  onDelete,
  onPromote,
  onToggleStatus,
  onViewRuns,
  t,
}: {
  flow: FlowRow;
  canPromote: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPromote: () => void;
  onToggleStatus: () => void;
  onViewRuns: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const triggerSummary = describeTrigger(flow, t);

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4 max-w-[280px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="font-semibold text-foreground hover:underline truncate text-left"
          >
            {flow.name}
          </button>
          {flow.origin_template_id && (
            <Badge variant="secondary" className="text-[10px] font-normal rounded shrink-0">
              Prebuilt
            </Badge>
          )}
        </div>
        {flow.description && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{flow.description}</p>
        )}
      </td>
      <td className="py-3 px-4 max-w-[220px]">
        <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 truncate max-w-full">
          {triggerSummary}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Switch checked={flow.status === "active"} onCheckedChange={onToggleStatus} />
          <Badge variant="outline" className={cn("text-[10px] rounded", STATUS_COLORS[flow.status])}>
            {STATUS_LABELS(t)[flow.status]}
          </Badge>
        </div>
      </td>
      <td className="py-3 px-4 text-muted-foreground">
        <div>{t("runCount", { count: flow.execution_count })}</div>
        {flow.last_executed_at && (
          <div className="text-[10px] opacity-80">
            Last: {new Date(flow.last_executed_at).toLocaleDateString()}
          </div>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="inline-flex items-center gap-1">
          {canPromote && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPromote}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Publish to Prebuilt Library"
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onViewRuns} className="h-7 px-2 text-xs">
            Runs
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2 text-xs">
            {t("edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 px-2 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-500"
            title={t("delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function describeTrigger(flow: FlowRow, t: ReturnType<typeof useTranslations>): string {
  if (flow.trigger_type === "ai_intent") {
    const intent = (flow.trigger_config as { intent_name?: string })?.intent_name;
    return intent ? `AI Intent: ${intent}` : "AI Intent";
  }
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
