import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WacrmClient } from '../client.js';
import { handle, jsonResult } from './shared.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerCrmReadTools(server: McpServer, client: WacrmClient): void {
  server.registerTool(
    'list_crm_collections',
    {
      title: 'List dynamic CRM collections',
      description:
        'List all user-defined dynamic CRM collections (e.g. appointments, orders, tickets) and their field schemas.',
      inputSchema: {},
      annotations: { ...READ_ONLY, title: 'List dynamic CRM collections' },
    },
    handle(async () => jsonResult(await client.listCrmCollections())),
  );

  server.registerTool(
    'query_crm_records',
    {
      title: 'Query dynamic CRM records',
      description:
        'Query records in a dynamic CRM collection by slug, with optional contact_id, search, or JSON filters.',
      inputSchema: {
        slug: z.string().describe('Collection slug, e.g. "appointments"'),
        contact_id: z.string().optional().describe('Optional contact UUID to filter by'),
        search: z.string().optional().describe('Optional text search across fields'),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: { ...READ_ONLY, title: 'Query dynamic CRM records' },
    },
    handle(async ({ slug, contact_id, search, limit }) =>
      jsonResult(await client.queryCrmRecords(slug, { contact_id, search, limit })),
    ),
  );
}

export function registerCrmWriteTools(server: McpServer, client: WacrmClient): void {
  server.registerTool(
    'create_crm_record',
    {
      title: 'Create dynamic CRM record',
      description: 'Create a new record in a dynamic CRM collection, optionally linked to a contact_id.',
      inputSchema: {
        slug: z.string().describe('Collection slug'),
        contact_id: z.string().optional().describe('Optional contact UUID'),
        data: z.record(z.string(), z.unknown()).describe('Record field values'),
      },
    },
    handle(async ({ slug, contact_id, data }) =>
      jsonResult(await client.createCrmRecord(slug, { contact_id, data })),
    ),
  );

  server.registerTool(
    'update_crm_record',
    {
      title: 'Update dynamic CRM record',
      description: 'Update an existing record in a dynamic CRM collection.',
      inputSchema: {
        slug: z.string().describe('Collection slug'),
        record_id: z.string().describe('Record UUID'),
        data: z.record(z.string(), z.unknown()).describe('Fields to update'),
      },
    },
    handle(async ({ slug, record_id, data }) =>
      jsonResult(await client.updateCrmRecord(slug, record_id, { data })),
    ),
  );

  server.registerTool(
    'delete_crm_record',
    {
      title: 'Delete dynamic CRM record',
      description: 'Delete a record from a dynamic CRM collection.',
      inputSchema: {
        slug: z.string().describe('Collection slug'),
        record_id: z.string().describe('Record UUID'),
      },
    },
    handle(async ({ slug, record_id }) =>
      jsonResult(await client.deleteCrmRecord(slug, record_id)),
    ),
  );
}
