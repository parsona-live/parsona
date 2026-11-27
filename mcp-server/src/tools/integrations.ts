import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WacrmClient } from '../client.js';
import { handle, jsonResult } from './shared.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerIntegrationReadTools(server: McpServer, client: WacrmClient): void {
  server.registerTool(
    'list_integrations',
    {
      title: 'List configured external integrations',
      description:
        'List all connected external integrations (Cal.com, Calendly, Google Sheets, Google Calendar, Razorpay, Slack, Webhook Bridge, Custom APIs) and their available actions.',
      inputSchema: {},
      annotations: { ...READ_ONLY, title: 'List configured external integrations' },
    },
    handle(async () => jsonResult(await client.listIntegrations())),
  );
}

export function registerIntegrationWriteTools(server: McpServer, client: WacrmClient): void {
  server.registerTool(
    'execute_integration',
    {
      title: 'Execute an external integration action',
      description:
        'Run an action on a configured external integration by integration_id and action_key (e.g. create_booking, append_row, create_payment_link, send_notification).',
      inputSchema: {
        integration_id: z.string().describe('UUID of the configured account integration'),
        action_key: z.string().describe('Action key from list_integrations, e.g. "append_row" or "custom:slug"'),
        inputs: z.record(z.string(), z.unknown()).optional().describe('Action input parameters'),
      },
    },
    handle(async ({ integration_id, action_key, inputs }) =>
      jsonResult(await client.executeIntegration(integration_id, { action_key, inputs: inputs ?? {} })),
    ),
  );
}
