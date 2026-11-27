'use client';

import { Suspense, useMemo, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { WorkspaceShell, type WorkspaceNavSection } from '@/components/layout/workspace-shell';
import { SettingsOverview } from '@/components/settings/settings-overview';
import { ProfileForm } from '@/components/settings/profile-form';
import { SecurityPanel } from '@/components/settings/security-panel';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { ChannelsIntegrationsConfig } from '@/components/settings/channels-integrations-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { QuickRepliesManager } from '@/components/settings/quick-replies-manager';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { DealsSettings } from '@/components/settings/deals-settings';
import { InboxSettings } from '@/components/settings/inbox-settings';
import { EmailSettings } from '@/components/settings/email-settings';
import { MembersTab } from '@/components/settings/members-tab';
import { ApiKeysSettings } from '@/components/settings/api-keys-settings';
import { BillingPanel } from '@/components/settings/billing-panel';
import { SettingsPageSkeleton, SettingsTabSkeleton } from '@/components/skeletons/page-skeletons';
import {
  RAIL_GROUPS,
  SECTION_META,
  SETTINGS_SECTIONS,
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';

// `useSearchParams` opts this page out of static prerendering unless it
// sits under a Suspense boundary. Without one, the production build hits
// the "missing Suspense with CSR bailout" error and the whole page bails
// to client-side rendering — shipping a settings screen whose rail never
// wires up its click handlers. You land on the section the URL carried
// (the account-menu Settings link points at `?tab=whatsapp`) and can't
// navigate away. Mirror the login/signup split: a thin wrapper supplies
// the boundary; the inner component reads the query string.
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const { defaultCurrency } = useAuth();
  const { mode } = useTheme();
  const t = useTranslations('Settings');

  // The URL (`?tab=`) is the single source of truth for the active
  // section — deep-linkable, and it keeps the existing links in the
  // app sidebar/header working. Legacy tab values (tags, custom-fields)
  // resolve onto their new home; unknown/empty → the Overview landing.
  const [section, setSection] = useState<SettingsSection>(() =>
    resolveSection(searchParams.get('tab')),
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    setSection(resolveSection(tabParam));
  }, [searchParams]);

  const go = useCallback((next: SettingsSection) => {
    setSection(next);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', next);
      window.history.replaceState(null, '', `/settings?${params.toString()}`);
    }
  }, []);

  // Cheap, fetch-free rail hints. The Overview landing carries the
  // full live status/counts; the rail just surfaces the two that are
  // already in context.
  const hints: Partial<Record<SettingsSection, ReactNode>> = useMemo(
    () => ({
      appearance: mode.charAt(0).toUpperCase() + mode.slice(1),
      deals: defaultCurrency,
    }),
    [mode, defaultCurrency],
  );

  const panel: Record<SettingsSection, ReactNode> = {
    overview: <SettingsOverview onSelect={go} />,
    billing: <BillingPanel />,
    profile: <ProfileForm />,
    security: <SecurityPanel />,
    appearance: <AppearancePanel />,
    channels: <ChannelsIntegrationsConfig />,
    templates: <TemplateManager />,
    'quick-replies': <QuickRepliesManager />,
    fields: <FieldsAndTagsPanel />,
    inbox: <InboxSettings />,
    deals: <DealsSettings />,
    email: <EmailSettings />,
    members: <MembersTab />,
    api: <ApiKeysSettings />,
  };

  const workspaceSections: WorkspaceNavSection[] = useMemo(
    () =>
      RAIL_GROUPS.map((grp) => ({
        title: grp.label ?? undefined,
        items: SETTINGS_SECTIONS.filter((id) => SECTION_META[id].group === grp.group).map((id) => {
          const meta = SECTION_META[id];
          const hint = hints[id];
          return {
            id,
            label: meta.label,
            icon: meta.icon,
            badge: typeof hint === 'string' ? hint : undefined,
            active: section === id,
            onClick: () => go(id),
          };
        }),
      })),
    [section, hints, go],
  );

  const activeMeta = SECTION_META[section];

  return (
    <WorkspaceShell
      sidebarTitle="Settings"
      sections={workspaceSections}
      breadcrumbs={[
        { label: t('pageTitle'), onClick: () => go('overview') },
        { label: activeMeta.label },
      ]}
      title={activeMeta.label}
      subtitle={t('pageDesc')}
    >
      <div className="min-w-0 max-w-5xl">
        <Suspense key={section} fallback={<SettingsTabSkeleton />}>
          {panel[section]}
        </Suspense>
      </div>
    </WorkspaceShell>
  );
}
