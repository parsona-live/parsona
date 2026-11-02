"use client";

/**
 * Validation panel — surfaces every error and warning from
 * `validateFlowForActivation`. Lives once at the bottom of the
 * editor shell so it's visible in both views (canvas + list).
 *
 * Node-scoped issues are clickable: tapping one calls
 * `requestFlash(node_key)` on the editor context to center and highlight.
 */

import { useState } from "react";
import { CircleAlert, CircleCheck, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ValidationIssue } from "@/lib/flows/validate";
import { useFlowEditor } from "./flow-editor-state";

export function ValidationPanel() {
  const { issues, requestFlash } = useFlowEditor();
  const t = useTranslations("Flows.validation");
  const [collapsed, setCollapsed] = useState(false);

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 shadow-xs">
        <div className="flex items-center gap-2">
          <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>{t("noIssues")}</span>
        </div>
        <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-semibold uppercase tracking-wider">
          Ready to publish
        </span>
      </div>
    );
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm transition-all",
        errors.length > 0
          ? "border-destructive/40 bg-destructive/5"
          : "border-amber-500/40 bg-amber-500/5"
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {errors.length > 0 ? (
            <CircleAlert className="h-4 w-4 text-destructive shrink-0" />
          ) : (
            <CircleAlert className="h-4 w-4 text-amber-500 shrink-0" />
          )}
          <span className="font-semibold text-foreground">
            {t("summary", { errorCount: errors.length, warningCount: warnings.length })}
          </span>

          <div className="flex items-center gap-1.5 ml-2">
            {errors.length > 0 && (
              <span className="rounded-full bg-destructive/15 text-destructive font-bold text-[10px] px-2 py-0.5">
                {errors.length} {errors.length === 1 ? "Error" : "Errors"}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[10px] px-2 py-0.5">
                {warnings.length} {warnings.length === 1 ? "Warning" : "Warnings"}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium p-1 rounded-md transition"
        >
          <span>{collapsed ? "Show details" : "Hide"}</span>
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2.5 flex flex-col gap-1 border-t border-border/50 pt-2 max-h-48 overflow-y-auto">
          {issues.map((i, ix) => (
            <IssueLine key={ix} issue={i} onJump={requestFlash} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export function IssueLine({
  issue,
  onJump,
  t,
}: {
  issue: ValidationIssue;
  onJump?: (key: string) => void;
  t?: ReturnType<typeof useTranslations>;
}) {
  const isError = issue.severity === "error";

  const body = (
    <>
      <CircleAlert
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          isError ? "text-destructive" : "text-amber-500"
        )}
      />
      <span className="min-w-0 flex-1 text-[11.5px] leading-tight">
        {issue.node_key && (
          <code className="mr-1.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground font-semibold border border-border/60">
            #{issue.node_key}
          </code>
        )}
        <span className={cn(isError ? "text-destructive font-medium" : "text-amber-600 dark:text-amber-400 font-medium")}>
          {issue.message}
        </span>
      </span>
      {issue.node_key && onJump && (
        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground shrink-0 opacity-80">
          Jump <ArrowRight className="h-2.5 w-2.5" />
        </span>
      )}
    </>
  );

  if (issue.node_key && onJump) {
    return (
      <button
        type="button"
        onClick={() => onJump(issue.node_key!)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/70",
          isError ? "hover:bg-destructive/10" : "hover:bg-amber-500/10"
        )}
        aria-label={t ? t("jumpToNode", { key: issue.node_key! }) : `Jump to node ${issue.node_key}`}
      >
        {body}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs">
      {body}
    </div>
  );
}
