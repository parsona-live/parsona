import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Conversation List Skeleton (used in Inbox and widgets)
 */
export function ConversationListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex w-full items-start gap-3 px-3 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Message Thread Skeleton (used in Inbox chat area)
 */
export function MessageThreadSkeleton() {
  return (
    <div className="flex-1 space-y-4 overflow-hidden p-4">
      {/* Date separator */}
      <div className="flex justify-center">
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>

      {/* Incoming message */}
      <div className="flex justify-start">
        <div className="max-w-[70%] space-y-2 rounded-2xl rounded-tl-sm bg-muted/60 p-3.5 shadow-xs">
          <Skeleton className="h-3.5 w-52" />
          <Skeleton className="h-3.5 w-36" />
          <div className="flex justify-end">
            <Skeleton className="h-2.5 w-10" />
          </div>
        </div>
      </div>

      {/* Outgoing message */}
      <div className="flex justify-end">
        <div className="max-w-[70%] space-y-2 rounded-2xl rounded-tr-sm bg-primary/10 p-3.5 shadow-xs">
          <Skeleton className="h-3.5 w-60" />
          <Skeleton className="h-3.5 w-44" />
          <div className="flex justify-end">
            <Skeleton className="h-2.5 w-10" />
          </div>
        </div>
      </div>

      {/* Incoming message short */}
      <div className="flex justify-start">
        <div className="max-w-[70%] space-y-2 rounded-2xl rounded-tl-sm bg-muted/60 p-3.5 shadow-xs">
          <Skeleton className="h-3.5 w-40" />
          <div className="flex justify-end">
            <Skeleton className="h-2.5 w-10" />
          </div>
        </div>
      </div>

      {/* Outgoing message longer */}
      <div className="flex justify-end">
        <div className="max-w-[70%] space-y-2 rounded-2xl rounded-tr-sm bg-primary/10 p-3.5 shadow-xs">
          <Skeleton className="h-3.5 w-72" />
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="h-3.5 w-32" />
          <div className="flex justify-end">
            <Skeleton className="h-2.5 w-10" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Contact Sidebar Skeleton (used in Inbox right panel)
 */
export function ContactSidebarSkeleton() {
  return (
    <div className="hidden h-full w-80 shrink-0 flex-col border-l border-border bg-card p-4 xl:flex">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3.5 w-24" />
      </div>

      <div className="mt-4 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/**
 * Full Inbox Page Skeleton
 */
export function InboxSkeleton() {
  return (
    <div className="-m-4 sm:-m-6 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left conversation list */}
      <div className="flex h-full w-full flex-col border-r border-border bg-card sm:w-80 md:w-96 shrink-0">
        <div className="border-b border-border p-3 space-y-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="flex gap-1.5 overflow-hidden">
            <Skeleton className="h-7 w-12 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-14 rounded-full" />
            <Skeleton className="h-7 w-18 rounded-full" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationListSkeleton count={9} />
        </div>
      </div>

      {/* Center message thread */}
      <div className="hidden flex-1 flex-col bg-background sm:flex min-w-0">
        {/* Thread header */}
        <div className="flex h-16 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* Thread messages */}
        <MessageThreadSkeleton />

        {/* Thread composer */}
        <div className="border-t border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          </div>
        </div>
      </div>

      {/* Right contact panel */}
      <ContactSidebarSkeleton />
    </div>
  )
}

/**
 * Dashboard Page Skeleton
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Attention row skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[66px] rounded-xl" />
        ))}
      </div>

      {/* KPI row skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* 2-column volume & reply queue */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3-column cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
        <div className="lg:col-span-2 2xl:col-span-1 rounded-xl border border-border bg-card p-5 space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
      </div>

      {/* Activity feed skeleton */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 w-48 sm:w-80" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * AI Config Skeleton
 */
export function AiConfigSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * AI Agents Page Skeleton
 */
export function AgentsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-7 w-36" />
        </div>
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Content */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1">
          <AiConfigSkeleton />
        </div>
        <div className="w-full xl:w-[380px] shrink-0">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
            <div className="space-y-3 py-6">
              <div className="flex justify-start">
                <Skeleton className="h-14 w-48 rounded-2xl bg-muted/60" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-36 rounded-2xl bg-primary/10" />
              </div>
              <div className="flex justify-start">
                <Skeleton className="h-16 w-56 rounded-2xl bg-muted/60" />
              </div>
            </div>
            <div className="pt-4 border-t border-border flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-lg" />
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/**
 * Contacts Table Rows Skeleton
 */
export function ContactsTableRowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} className="border-border">
          <TableCell className="w-12">
            <Skeleton className="h-4 w-4 rounded-sm" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell className="hidden lg:table-cell">
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell className="hidden xl:table-cell">
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className="w-12 text-right">
            <Skeleton className="h-8 w-8 ml-auto rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

/**
 * Full Contacts Page Skeleton
 */
export function ContactsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-full sm:w-72 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="w-12">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden lg:table-cell">Tags</TableHead>
              <TableHead className="hidden sm:table-cell">Stage</TableHead>
              <TableHead className="hidden xl:table-cell">Created</TableHead>
              <TableHead className="w-12 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ContactsTableRowsSkeleton rows={8} />
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/**
 * Broadcasts Page Skeleton
 */
export function BroadcastsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-7 w-36" />
          </div>
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Table Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-64 rounded-lg" />
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead>Broadcast</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Audience</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Read</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="border-border">
                <TableCell>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-12 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-16 ml-auto rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/**
 * Automations Page Skeleton
 */
export function AutomationsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Cards list */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-11 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Flows Page Skeleton
 */
export function FlowsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Flow Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Pipelines Page Skeleton
 */
export function PipelinesPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-44 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div
            key={col}
            className="w-72 shrink-0 rounded-xl border border-border bg-muted/30 p-3 space-y-3"
          >
            {/* Column header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>

            {/* Column cards */}
            <div className="space-y-2.5">
              {Array.from({ length: col === 0 ? 3 : col === 1 ? 2 : 1 }).map((_, card) => (
                <div
                  key={card}
                  className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-xs"
                >
                  <div className="flex justify-between items-start">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                  <div className="flex justify-between items-center pt-1 border-t border-border/50">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Settings Page Skeleton
 */
export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left rail */}
        <div className="w-full lg:w-64 shrink-0 space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>

        {/* Right content */}
        <div className="flex-1 space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            </div>
            <div className="pt-2">
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/**
 * Business Profile Page Skeleton
 */
export function BusinessProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
        <div className="pt-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </Card>
    </div>
  )
}

/**
 * Notifications Page Skeleton
 */
export function NotificationsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48 sm:w-80" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-7 w-7 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Super Admin Overview Skeleton
 */
export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-5 rounded-md" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-border">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Generic Admin Table Skeleton
 */
export function AdminTableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <Skeleton className="h-10 w-72 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-border/50">
              <div className="space-y-1">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Auth Card Skeleton (for login / signup)
 */
export function AuthCardSkeleton() {
  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Settings Tab Skeleton (for individual settings sections)
 */
export function SettingsTabSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Card className="p-6 space-y-6">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
        <div className="pt-2 flex justify-end">
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </Card>
    </div>
  )
}
