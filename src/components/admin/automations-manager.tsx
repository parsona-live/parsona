"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Workflow,
  Plus,
  ArrowUpRight,
  Send,
  Building2,
  CheckCircle2,
  Layers,
  Sparkles,
  Pencil,
  Trash2,
  Search,
  Share2,
  Loader2,
  Globe2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, formatDisplayDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface MasterTemplate {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  status: string;
  template_category: string | null;
  created_at: string;
  assignedCount: number;
}

export interface TenantOption {
  id: string;
  name: string;
}

export interface ClientFlowItem {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  status: string;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
  account_id: string;
  account_name: string;
  node_count: number;
  is_from_template: boolean;
}

interface AutomationsManagerProps {
  initialTemplates: MasterTemplate[];
  tenants: TenantOption[];
}

export function AutomationsManager({ initialTemplates, tenants }: AutomationsManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"templates" | "client_flows">("templates");
  const [templates, setTemplates] = useState<MasterTemplate[]>(initialTemplates);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTemplate, setAssignTemplate] = useState<MasterTemplate | null>(null);

  // Edit Template state
  const [editTemplate, setEditTemplate] = useState<MasterTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("Sales & Lead Gen");
  const [editStatus, setEditStatus] = useState("active");
  const [savingEdit, setSavingEdit] = useState(false);

  // New Template Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Sales & Lead Gen");
  const [triggerType, setTriggerType] = useState("keyword");
  const [creating, setCreating] = useState(false);

  // Assign Form
  const [targetAccountId, setTargetAccountId] = useState(tenants[0]?.id ?? "");
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Client Flows Explorer state
  const [clientFlows, setClientFlows] = useState<ClientFlowItem[]>([]);
  const [loadingClientFlows, setLoadingClientFlows] = useState(false);
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Promote Modal state
  const [promoteFlow, setPromoteFlow] = useState<ClientFlowItem | null>(null);
  const [promoteName, setPromoteName] = useState("");
  const [promoteDescription, setPromoteDescription] = useState("");
  const [promoteCategory, setPromoteCategory] = useState("Sales & Lead Gen");
  const [promoting, setPromoting] = useState(false);

  // Load client flows when switching to tab
  useEffect(() => {
    if (activeTab === "client_flows") {
      fetchClientFlows();
    }
  }, [activeTab, tenantFilter]);

  async function fetchClientFlows() {
    try {
      setLoadingClientFlows(true);
      const url = new URL("/api/admin/flows/client-flows", window.location.origin);
      if (tenantFilter !== "all") {
        url.searchParams.set("accountId", tenantFilter);
      }
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load client flows");
      const json = await res.json();
      setClientFlows(json.clientFlows ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClientFlows(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setCreating(true);
      const res = await fetch("/api/admin/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, triggerType, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create template");

      setCreateOpen(false);
      setName("");
      setDescription("");
      router.refresh();
      window.location.href = `/flows/${data.flow.id}`;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async () => {
    if (!assignTemplate || !targetAccountId) return;
    try {
      setAssigning(true);
      setAssignSuccess(null);
      const res = await fetch("/api/admin/automations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateFlowId: assignTemplate.id,
          targetAccountId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign template");

      setAssignSuccess("Template cloned and deployed to tenant account!");
      setTimeout(() => {
        setAssignTemplate(null);
        setAssignSuccess(null);
        router.refresh();
      }, 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setAssigning(false);
    }
  };

  const openEditModal = (tpl: MasterTemplate) => {
    setEditTemplate(tpl);
    setEditName(tpl.name);
    setEditDescription(tpl.description || "");
    setEditCategory(tpl.template_category || "Sales & Lead Gen");
    setEditStatus(tpl.status || "active");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTemplate || !editName.trim()) return;
    try {
      setSavingEdit(true);
      const res = await fetch(`/api/admin/automations/${editTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          category: editCategory,
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update template");

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editTemplate.id
            ? {
                ...t,
                name: editName,
                description: editDescription,
                template_category: editCategory,
                status: editStatus,
              }
            : t
        )
      );
      setEditTemplate(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    const ok = window.confirm(`Are you sure you want to delete the master template "${templateName}"?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/automations/${templateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const openPromoteModal = (flow: ClientFlowItem) => {
    setPromoteFlow(flow);
    setPromoteName(flow.name);
    setPromoteDescription(flow.description || `Prebuilt chatbot automation created from ${flow.account_name}.`);
    setPromoteCategory("Sales & Lead Gen");
  };

  const handlePromote = async (e: React.FormEvent) => {
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
      if (!res.ok) throw new Error(data.error || "Failed to promote flow to template");

      const newTpl: MasterTemplate = {
        id: data.template.id,
        name: data.template.name,
        description: data.template.description,
        trigger_type: data.template.trigger_type,
        status: data.template.status,
        template_category: data.template.template_category,
        created_at: data.template.created_at,
        assignedCount: 0,
      };

      setTemplates((prev) => [newTpl, ...prev]);
      setPromoteFlow(null);
      setActiveTab("templates");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setPromoting(false);
    }
  };

  // Filter client flows by search query
  const filteredClientFlows = clientFlows.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      f.account_name.toLowerCase().includes(q) ||
      (f.description && f.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "templates" | "client_flows")}
        className="space-y-6"
      >
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="templates" className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold">
            <Layers className="h-4 w-4" />
            Master Templates Library
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {templates.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="client_flows" className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold">
            <Globe2 className="h-4 w-4" />
            Client Flows Explorer
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {clientFlows.length > 0 ? clientFlows.length : "Browse"}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MASTER TEMPLATES */}
        <TabsContent value="templates" className="space-y-6 outline-hidden mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Layers className="h-5 w-5 text-amber-400" />
                Published Prebuilt Flows
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                These flows are published globally in the Flow Library for all tenant accounts to use.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white">
              <Plus className="h-4 w-4 mr-1.5" />
              New Master Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <Card
                key={tpl.id}
                className="border-border hover:border-amber-500/40 transition-colors flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="text-[11px] font-semibold text-amber-400 border-amber-500/30 bg-amber-500/10"
                    >
                      {tpl.template_category || "General"}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] capitalize",
                          tpl.status === "active"
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {tpl.status}
                      </Badge>
                      <button
                        onClick={() => openEditModal(tpl)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit details"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                        className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400"
                        title="Delete template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <CardTitle className="text-base font-bold mt-2">{tpl.name}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2 mt-1">
                    {tpl.description || "No description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-3">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Deployed to: <strong>{tpl.assignedCount}</strong> {tpl.assignedCount === 1 ? "tenant" : "tenants"}
                    </span>
                    <span className="font-mono text-[11px]">{tpl.trigger_type.replace("_", " ")}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/flows/${tpl.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "flex-1 text-xs"
                      )}
                    >
                      Visual Builder
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                    <Button
                      size="sm"
                      className="flex-1 text-xs bg-amber-600 hover:bg-amber-500 text-white"
                      onClick={() => {
                        setAssignTemplate(tpl);
                        setAssignSuccess(null);
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Assign to Tenant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {templates.length === 0 && (
              <div className="col-span-full border border-dashed border-border rounded-xl p-10 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <Workflow className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">No Master Templates Yet</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Create templates from scratch or promote flows from the Client Flows tab.
                  </p>
                </div>
                <Button
                  onClick={() => setCreateOpen(true)}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                >
                  Create First Template
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: CLIENT FLOWS EXPLORER */}
        <TabsContent value="client_flows" className="space-y-4 outline-hidden mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-amber-400" />
                All Tenant Client Flows
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Browse workflows built by clients across all workspaces and promote the best into Prebuilt Templates.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchClientFlows}
              disabled={loadingClientFlows}
              className="text-xs"
            >
              {loadingClientFlows ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Refresh Flows
            </Button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by flow name, tenant name, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <div className="w-full sm:w-64">
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="all">All Tenants ({tenants.length})</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          {loadingClientFlows ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading client flows...
            </div>
          ) : filteredClientFlows.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              No client flows found matching your search.
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Flow Name</th>
                    <th className="py-3 px-4">Tenant</th>
                    <th className="py-3 px-4">Trigger / Nodes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Executions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredClientFlows.map((flow) => (
                    <tr key={flow.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {flow.name}
                          {flow.is_from_template && (
                            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                              From Template
                            </Badge>
                          )}
                        </div>
                        {flow.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {flow.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-foreground">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {flow.account_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        <span className="capitalize font-mono">{flow.trigger_type.replace("_", " ")}</span>
                        <span className="mx-1.5">•</span>
                        <span>{flow.node_count} nodes</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] capitalize",
                            flow.status === "active"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {flow.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        <div>{flow.execution_count} runs</div>
                        {flow.last_executed_at && (
                          <div className="text-[10px] text-muted-foreground/70" suppressHydrationWarning>
                            {formatDisplayDate(flow.last_executed_at)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/flows/${flow.id}`}
                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs")}
                          >
                            Inspect
                          </Link>
                          <Button
                            size="sm"
                            onClick={() => openPromoteModal(flow)}
                            className="h-7 text-xs bg-amber-600 hover:bg-amber-500 text-white"
                          >
                            <Share2 className="h-3.5 w-3.5 mr-1" />
                            Promote to Template
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Promote to Template Dialog */}
      <Dialog open={Boolean(promoteFlow)} onOpenChange={(open) => !open && setPromoteFlow(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handlePromote}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Promote Flow to Master Library
              </DialogTitle>
              <DialogDescription>
                Convert &quot;{promoteFlow?.name}&quot; from <strong>{promoteFlow?.account_name}</strong> into a reusable
                template available to all clients.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Template Name</label>
                <Input
                  value={promoteName}
                  onChange={(e) => setPromoteName(e.target.value)}
                  placeholder="e.g. Lead Qualification & Scheduling Bot"
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
                {promoting ? "Promoting..." : "Publish to Library"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={Boolean(editTemplate)} onOpenChange={(open) => !open && setEditTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-amber-400" />
                Edit Template Details
              </DialogTitle>
              <DialogDescription>Update template metadata in the master catalogue.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Name</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
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
                <label className="text-xs font-semibold text-foreground">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <option value="active">Active (Visible in Library)</option>
                  <option value="draft">Draft (Hidden from Library)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTemplate(null)} disabled={savingEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit} className="bg-amber-600 hover:bg-amber-500 text-white">
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Master Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Create Master Flow Template
              </DialogTitle>
              <DialogDescription>
                Design an automation blueprint that can be assigned and customized across client accounts.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Template Name</label>
                <Input
                  placeholder="e.g. Real Estate Lead Qualifier"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
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
                <label className="text-xs font-semibold text-foreground">Trigger Type</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <option value="keyword">Keyword Match (e.g. 'hi', 'price')</option>
                  <option value="first_inbound_message">First Inbound Message (Welcome Bot)</option>
                  <option value="manual">Manual Trigger Only</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                <Input
                  placeholder="Brief description of what this flow automates..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating} className="bg-amber-600 hover:bg-amber-500 text-white">
                {creating ? "Creating..." : "Create & Open Canvas"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Template Dialog */}
      <Dialog open={Boolean(assignTemplate)} onOpenChange={(open) => !open && setAssignTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-400" />
              Assign &quot;{assignTemplate?.name}&quot;
            </DialogTitle>
            <DialogDescription>
              Select the client account that should receive a copy of this automation flow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Target Business</label>
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {assignSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {assignSuccess}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTemplate(null)} disabled={assigning}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assigning || !targetAccountId}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {assigning ? "Cloning..." : "Deploy Flow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
