"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Workflow,
  Plus,
  ArrowUpRight,
  Send,
  Building2,
  CheckCircle2,
  Users,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

interface AutomationsManagerProps {
  initialTemplates: MasterTemplate[];
  tenants: TenantOption[];
}

export function AutomationsManager({ initialTemplates, tenants }: AutomationsManagerProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<MasterTemplate[]>(initialTemplates);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTemplate, setAssignTemplate] = useState<MasterTemplate | null>(null);

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
      // Redirect to visual builder
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

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-400" />
            Master Flow Catalog
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create standard chatbot funnels and push them to client accounts with one click.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white">
          <Plus className="h-4 w-4 mr-1.5" />
          New Master Template
        </Button>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => (
          <Card key={tpl.id} className="border-border hover:border-amber-500/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[11px] font-semibold text-amber-400 border-amber-500/30 bg-amber-500/10">
                  {tpl.template_category || "General"}
                </Badge>
                <span className="text-[11px] text-muted-foreground capitalize flex items-center gap-1 font-mono">
                  {tpl.trigger_type.replace("_", " ")}
                </span>
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
                <span>{new Date(tpl.created_at).toLocaleDateString()}</span>
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
                Build standardized lead qualifiers, support FAQs, or survey bots that you can clone to any client in seconds.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} size="sm" className="bg-amber-600 hover:bg-amber-500 text-white">
              Create First Template
            </Button>
          </div>
        )}
      </div>

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
