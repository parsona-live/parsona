"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { notificationsAccountFilter } from "@/lib/notifications/unread-count";
import type { Notification } from "@/types";
import { ArrowUpRight, Bell, Check, CheckCheck, Loader2, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { NotificationsPageSkeleton } from "@/components/skeletons/page-skeletons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// Icon per notification type. Only one type exists today
// (conversation_assigned) but this keeps future types a one-line add.
const TYPE_ICON: Record<Notification["type"], typeof Bell> = {
  conversation_assigned: UserPlus,
};

export default function NotificationsPage() {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const { accountId } = useAuth();
  const [notifications, setNotifications] = useState<Notification[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    if (!accountId) return;
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from("notifications")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }
    setNotifications((data ?? []) as Notification[]);
  }, [accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Realtime — new assignments appear without a refresh, and a
  // "mark all read" fired from another tab/device stays in sync here.
  useEffect(() => {
    if (!accountId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-page:${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: notificationsAccountFilter(accountId),
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Notification;
            setNotifications((prev) => {
              if (!prev) return [row];
              if (prev.some((n) => n.id === row.id)) return prev;
              return [row, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Notification;
            setNotifications((prev) =>
              prev?.map((n) => (n.id === row.id ? { ...n, ...row } : n)) ??
              prev,
            );
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<Notification>;
            setNotifications(
              (prev) => prev?.filter((n) => n.id !== oldRow.id) ?? prev,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId]);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic — the row is already visually "read" by the time the
      // request lands, so the UI doesn't wait on the round-trip.
      setNotifications(
        (prev) =>
          prev?.map((n) =>
            n.id === id && !n.read_at
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ) ?? prev,
      );
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (updateErr) {
        toast.error(t("markReadFailed"));
        load();
      }
    },
    [load, t],
  );

  const handleClick = useCallback(
    (n: Notification) => {
      if (!n.read_at) markRead(n.id);
      if (n.conversation_id) {
        router.push(`/inbox?c=${n.conversation_id}`);
      }
    },
    [markRead, router],
  );

  const unreadIds = notifications?.filter((n) => !n.read_at).map((n) => n.id) ?? [];

  const markAllRead = useCallback(async () => {
    if (unreadIds.length === 0 || !accountId) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications(
      (prev) => prev?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? prev,
    );
    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("account_id", accountId)
      .is("read_at", null);
    setMarkingAll(false);
    if (updateErr) {
      toast.error(t("markAllFailed"));
      load();
    }
  }, [unreadIds.length, accountId, load, t]);

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (notifications === null) {
    return <NotificationsPageSkeleton />;
  }

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.read_at)
      : notifications;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t("title")}
            </h1>
            {unreadIds.length > 0 && (
              <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground tabular-nums">
                {unreadIds.length} {t("unread").toLowerCase()}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 items-center rounded-md border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "unread"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Unread ({unreadIds.length})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-md text-xs"
            disabled={unreadIds.length === 0 || markingAll}
            onClick={markAllRead}
          >
            {markingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            {t("markAllRead")}
          </Button>
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground">
            <Bell className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {filter === "unread" ? "All caught up" : t("emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filter === "unread"
              ? "You have no unread notifications."
              : t("emptyDesc")}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {filteredNotifications.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            const isUnread = !n.read_at;
            return (
              <li
                key={n.id}
                className={cn(
                  "group relative flex items-start gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/40",
                  isUnread && "bg-muted/20",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                    isUnread
                      ? "border-border bg-background text-foreground"
                      : "border-transparent bg-muted/60 text-muted-foreground",
                  )}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </div>

                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className="min-w-0 flex-1 text-left focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    {isUnread && (
                      <span
                        aria-label={t("unread")}
                        className="h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                    <span
                      className={cn(
                        "truncate text-sm",
                        isUnread
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground/80",
                      )}
                    >
                      {n.title}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {n.body}
                    </p>
                  )}
                </button>

                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(n.created_at), {
                      addSuffix: true,
                    })}
                  </span>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      title="Mark as read"
                      aria-label="Mark as read"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {n.conversation_id && (
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      title="Open conversation"
                      aria-label="Open conversation"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-background hover:text-foreground"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
