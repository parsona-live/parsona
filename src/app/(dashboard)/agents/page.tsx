'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Settings2, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { AgentsPageSkeleton } from '@/components/skeletons/page-skeletons';

type Tab = 'setup' | 'usage';

export default function AgentsPage() {
  const t = useTranslations('Agents');
  const { accountRole } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;
  const [tab, setTab] = useState<Tab>('setup');
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    setDecided(true);
  }, []);

  if (!decided) {
    return <AgentsPageSkeleton />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 border-b border-border pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="space-y-5"
      >
        <TabsList className="h-9 rounded-md border border-border bg-muted/40 p-0.5">
          <TabsTrigger value="setup" className="rounded-sm px-3 text-xs font-medium">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> {t('tabSetup')}
          </TabsTrigger>
          {canViewUsage && (
            <TabsTrigger value="usage" className="rounded-sm px-3 text-xs font-medium">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> {t('tabUsage')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="setup">
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0">
              <AiConfig />
            </div>
            <div className="min-w-0 xl:sticky xl:top-4">
              <AiPlayground />
            </div>
          </div>
        </TabsContent>

        {canViewUsage && (
          <TabsContent value="usage">
            <AiUsageCard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
