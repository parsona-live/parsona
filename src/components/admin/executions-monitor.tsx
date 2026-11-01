"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Workflow,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  Search,
  Building2,
  AlertTriangle,
  Play,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface ExecutionRow {
  id: string;
  flow_id: string;
  flow_name: string;
  account_id: string;
  account_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface ExecutionsMonitorProps {
  initialExecutions: ExecutionRow[];
}

export function ExecutionsMonitor({ initialExecutions }: ExecutionsMonitorProps) {
  const [executions, setExecutions] = useState<ExecutionRow[]>(initialExecutions);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = executions.filter((item) => {
    const matchesSearch =
      item.flow_name.toLowerCase().includes(search.toLowerCase()) ||
      item.account_name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDuration = (start: string, end: string | null) => {
    if (!end) return "Running...";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Workflow className="h-6 w-6 text-amber-400" />
            Automation Executions Monitor
          </h1>
          <p className="text-xs text-muted-foreground">
            Platform-wide real-time execution log and failure tracking across all client bots
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search flow, business, or execution ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["all", "failed", "completed", "running"].map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
              onClick={() => setStatusFilter(status)}
              className="text-xs capitalize h-8"
            >
              {status === "all" ? "All Executions" : status}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Execution ID</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Automation Flow</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Started At</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                      {item.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/tenants/${item.account_id}`}
                        className="font-medium text-foreground hover:text-amber-400 hover:underline flex items-center gap-1.5"
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {item.account_name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-foreground">
                      {item.flow_name}
                    </td>
                    <td className="py-3 px-4">
                      {item.status === "completed" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      ) : item.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="h-3 w-3" /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <RotateCw className="h-3 w-3 animate-spin" /> Running
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(item.started_at).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                      {getDuration(item.started_at, item.completed_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.error_message ? (
                        <span
                          className="text-xs text-rose-400 truncate max-w-xs inline-block"
                          title={item.error_message}
                        >
                          {item.error_message}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Clean execution</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No executions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

