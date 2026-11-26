"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Timer, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSoundPrefs } from "@/hooks/use-inbox-sound-notifications";
import {
  playChannelNotificationSound,
  writeSoundPrefs,
  type SoundChannel,
} from "@/lib/notifications/sound-engine";
import { ChannelIcon } from "@/components/channels/channel-badge";
import { parseReplyTarget } from "@/lib/settings/reply-target";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";

const SOUND_CHANNELS: ReadonlyArray<{
  key: SoundChannel;
  label: string;
  desc: string;
  color: string;
}> = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    desc: "Warm double-chime for incoming WhatsApp messages",
    color: "text-emerald-500",
  },
  {
    key: "instagram",
    label: "Instagram",
    desc: "Crisp upward pop for incoming Instagram Direct messages",
    color: "text-pink-500",
  },
  {
    key: "facebook",
    label: "Messenger",
    desc: "Classic two-tone chime for incoming Facebook Messenger messages",
    color: "text-blue-500",
  },
];

export function InboxSettings() {
  const { accountId, canEditSettings, profileLoading } = useAuth();
  const t = useTranslations("Settings.inbox");
  const soundPrefs = useSoundPrefs();
  const [saved, setSaved] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    createClient()
      .from("accounts")
      .select("reply_target_minutes")
      .eq("id", accountId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          toast.error(t("loadFailed"));
          return;
        }
        setSaved(data.reply_target_minutes);
        setDraft(String(data.reply_target_minutes));
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, t]);

  const parsed = parseReplyTarget(draft);
  const dirty = parsed !== null && parsed !== saved;

  async function handleSave() {
    if (!accountId || parsed === null || !dirty) return;
    setSaving(true);
    const { error } = await createClient()
      .from("accounts")
      .update({ reply_target_minutes: parsed })
      .eq("id", accountId);
    setSaving(false);
    if (error) {
      toast.error(t("saveFailed"));
      return;
    }
    setSaved(parsed);
    toast.success(t("saveSuccess"));
  }

  if (saved === null || profileLoading) {
    return (
      <section className="max-w-2xl animate-in fade-in-50 duration-200">
        <SettingsPanelHead title={t("title")} description={t("description")} />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full max-w-xs rounded-lg" />
        </Card>
      </section>
    );
  }

  const disabled = !canEditSettings;

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead title={t("title")} description={t("description")} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Timer className="size-4 text-primary" />
            {t("replyTarget")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("replyTargetDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="reply-target" className="text-muted-foreground">
              {t("minutesLabel")}
            </Label>
            <Input
              id="reply-target"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              step={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={disabled}
              aria-invalid={draft !== "" && parsed === null}
              aria-describedby="reply-target-hint"
            />
            <p id="reply-target-hint" className="text-xs text-muted-foreground">
              {draft !== "" && parsed === null
                ? t("invalid")
                : canEditSettings
                  ? t("hint")
                  : t("adminOnlyHint")}
            </p>
          </div>

          {canEditSettings && (
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            {soundPrefs.enabled ? (
              <Volume2 className="size-4 text-primary" />
            ) : (
              <VolumeX className="size-4 text-muted-foreground" />
            )}
            Notification Sounds
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Play channel-specific sound alerts when new customer messages arrive. Automatically throttled during high-volume bursts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Enable inbox sound notifications
              </p>
              <p className="text-xs text-muted-foreground">
                Saved on this device across all dashboard pages
              </p>
            </div>
            <Switch
              checked={soundPrefs.enabled}
              onCheckedChange={(checked) => writeSoundPrefs({ enabled: checked })}
              aria-label="Enable inbox sound notifications"
            />
          </div>

          <div className="space-y-2">
            {SOUND_CHANNELS.map((ch) => {
              const chEnabled = soundPrefs.channels[ch.key];
              return (
                <div
                  key={ch.key}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                      <ChannelIcon channel={ch.key} className={`size-4 ${ch.color}`} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{ch.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{ch.desc}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => playChannelNotificationSound(ch.key, { force: true })}
                      title={`Test ${ch.label} sound`}
                    >
                      <Play className="size-3" />
                      Test
                    </Button>
                    <Switch
                      checked={chEnabled}
                      disabled={!soundPrefs.enabled}
                      onCheckedChange={(checked) =>
                        writeSoundPrefs({ channels: { [ch.key]: checked } })
                      }
                      aria-label={`Toggle ${ch.label} notification sound`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Sound volume ({Math.round(soundPrefs.volume * 100)}%)
              </p>
              <p className="text-xs text-muted-foreground">
                Adjust chime loudness for incoming alerts
              </p>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              disabled={!soundPrefs.enabled}
              value={Math.round(soundPrefs.volume * 100)}
              onChange={(e) =>
                writeSoundPrefs({ volume: Number(e.target.value) / 100 })
              }
              aria-label="Notification sound volume"
              className="h-1.5 w-full max-w-44 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Mute currently open conversation
              </p>
              <p className="text-xs text-muted-foreground">
                Stay silent when a reply arrives in the chat you are actively viewing
              </p>
            </div>
            <Switch
              checked={soundPrefs.muteActiveChat}
              disabled={!soundPrefs.enabled}
              onCheckedChange={(checked) =>
                writeSoundPrefs({ muteActiveChat: checked })
              }
              aria-label="Mute currently open conversation"
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
