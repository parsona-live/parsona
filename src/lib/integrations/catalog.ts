export type IntegrationCategory =
  | 'scheduling'
  | 'spreadsheets'
  | 'payments'
  | 'alerts'
  | 'custom';

export type ProviderKey =
  | 'cal_com'
  | 'calendly'
  | 'google_calendar'
  | 'google_sheets'
  | 'razorpay'
  | 'slack'
  | 'webhook_bridge'
  | 'custom_api';

export interface IntegrationFieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select' | 'textarea' | 'json';
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export interface IntegrationActionInputField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'json' | 'select';
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export interface IntegrationActionDef {
  key: string;
  label: string;
  description: string;
  inputFields: IntegrationActionInputField[];
  outputExample: Record<string, unknown>;
}

export interface IntegrationProviderDef {
  provider_key: ProviderKey;
  name: string;
  category: IntegrationCategory;
  categoryLabel: string;
  description: string;
  shortBadge: string;
  brandColor: string;
  docsUrl?: string;
  setupSteps: string[];
  appsScriptSnippet?: string;
  credentialFields: IntegrationFieldDef[];
  configFields: IntegrationFieldDef[];
  actions: IntegrationActionDef[];
}

export const INTEGRATION_CATEGORIES: { id: 'all' | IntegrationCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'spreadsheets', label: 'Spreadsheets' },
  { id: 'payments', label: 'Payments' },
  { id: 'alerts', label: 'Alerts & Automation' },
  { id: 'custom', label: 'Custom Tools' },
];

export const GOOGLE_SHEETS_APPS_SCRIPT = `function doPost(e) {
  var body = JSON.parse(e.postData.contents || '{}');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = body.sheetName ? ss.getSheetByName(body.sheetName) : ss.getSheets()[0];
  if (!sheet) return jsonOut({ ok: false, error: 'Sheet not found' });

  if (body.action === 'ping') {
    return jsonOut({ ok: true, title: ss.getName(), sheet: sheet.getName() });
  }
  if (body.action === 'append_row') {
    var values = Array.isArray(body.values) ? body.values : Object.values(body.row || {});
    sheet.appendRow(values);
    return jsonOut({ ok: true, rowNumber: sheet.getLastRow() });
  }
  if (body.action === 'lookup_row') {
    var rows = sheet.getDataRange().getValues();
    var colIndex = Number(body.columnIndex || 0);
    var match = String(body.matchValue || '').toLowerCase();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][colIndex] || '').toLowerCase() === match) {
        return jsonOut({ ok: true, found: true, rowNumber: i + 1, row: rows[i] });
      }
    }
    return jsonOut({ ok: true, found: false });
  }
  if (body.action === 'update_row') {
    var rowNum = Number(body.rowNumber || 0);
    var vals = Array.isArray(body.values) ? body.values : [];
    if (rowNum < 1 || vals.length === 0) return jsonOut({ ok: false, error: 'Invalid rowNumber or values' });
    sheet.getRange(rowNum, 1, 1, vals.length).setValues([vals]);
    return jsonOut({ ok: true, rowNumber: rowNum });
  }
  return jsonOut({ ok: false, error: 'Unknown action' });
}
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;

export const GOOGLE_CALENDAR_APPS_SCRIPT = `function doPost(e) {
  var body = JSON.parse(e.postData.contents || '{}');
  var cal = body.calendarId ? CalendarApp.getCalendarById(body.calendarId) : CalendarApp.getDefaultCalendar();
  if (!cal) return jsonOut({ ok: false, error: 'Calendar not found' });

  if (body.action === 'ping') {
    return jsonOut({ ok: true, calendarName: cal.getName() });
  }
  if (body.action === 'create_event') {
    var start = new Date(body.startTime);
    var end = new Date(body.endTime);
    var event = cal.createEvent(body.title || 'Appointment', start, end, {
      description: body.description || '',
      guests: body.guestEmail || '',
      sendInvites: Boolean(body.guestEmail)
    });
    return jsonOut({ ok: true, eventId: event.getId(), title: event.getTitle() });
  }
  if (body.action === 'check_availability') {
    var start = new Date(body.startTime);
    var end = new Date(body.endTime);
    var events = cal.getEvents(start, end);
    return jsonOut({
      ok: true,
      isFree: events.length === 0,
      busyCount: events.length,
      events: events.map(function(ev) { return { title: ev.getTitle(), start: ev.getStartTime(), end: ev.getEndTime() }; })
    });
  }
  return jsonOut({ ok: false, error: 'Unknown action' });
}
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;

export const INTEGRATION_PROVIDERS: IntegrationProviderDef[] = [
  {
    provider_key: 'cal_com',
    name: 'Cal.com',
    category: 'scheduling',
    categoryLabel: 'Scheduling',
    description: 'Check open calendar slots, create bookings, and cancel appointments automatically.',
    shortBadge: 'CAL',
    brandColor: '#111827',
    docsUrl: 'https://cal.com/docs/api-reference/v2',
    setupSteps: [
      'Open Cal.com → Settings → Developer → API Keys and create an API key.',
      'Copy your numeric Event Type ID from the Event Types URL or API.',
      'Paste both below and click Test Connection.',
    ],
    credentialFields: [
      {
        key: 'api_key',
        label: 'Cal.com API Key',
        type: 'password',
        placeholder: 'cal_live_xxxxxxxxxxxx',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'event_type_id',
        label: 'Default Event Type ID',
        type: 'text',
        placeholder: '123456',
        helpText: 'Numeric ID of the Cal.com event type used for bookings & slots.',
      },
      {
        key: 'booking_url',
        label: 'Public Booking Link (Optional)',
        type: 'url',
        placeholder: 'https://cal.com/your-team/30min',
      },
      {
        key: 'time_zone',
        label: 'Default Time Zone',
        type: 'text',
        placeholder: 'Asia/Kolkata',
        defaultValue: 'UTC',
      },
    ],
    actions: [
      {
        key: 'get_slots',
        label: 'Get Available Slots',
        description: 'Fetch open time slots between start_date and end_date.',
        inputFields: [
          { key: 'start_date', label: 'Start Date (YYYY-MM-DD)', type: 'text', placeholder: '{{current_date}}', required: true },
          { key: 'end_date', label: 'End Date (YYYY-MM-DD)', type: 'text', placeholder: '2026-12-01', required: true },
          { key: 'event_type_id', label: 'Override Event Type ID (Optional)', type: 'text', placeholder: 'Uses default if blank' },
        ],
        outputExample: { slots: ['2026-12-01T10:00:00Z', '2026-12-01T11:30:00Z'] },
      },
      {
        key: 'create_booking',
        label: 'Create Booking',
        description: 'Book an appointment for a contact in Cal.com.',
        inputFields: [
          { key: 'start', label: 'Start Time (ISO 8601)', type: 'text', placeholder: '{{vars.slot_time}}', required: true },
          { key: 'name', label: 'Attendee Name', type: 'text', placeholder: '{{contact.name}}', required: true },
          { key: 'email', label: 'Attendee Email', type: 'text', placeholder: '{{vars.email}}', required: true },
          { key: 'phone', label: 'Attendee Phone (Optional)', type: 'text', placeholder: '{{contact.phone}}' },
          { key: 'notes', label: 'Notes (Optional)', type: 'textarea', placeholder: '{{vars.notes}}' },
        ],
        outputExample: { uid: 'bk_12345', status: 'accepted', start: '2026-12-01T10:00:00Z' },
      },
      {
        key: 'cancel_booking',
        label: 'Cancel Booking',
        description: 'Cancel an existing Cal.com booking by booking UID.',
        inputFields: [
          { key: 'booking_uid', label: 'Booking UID', type: 'text', placeholder: '{{vars.booking_uid}}', required: true },
          { key: 'reason', label: 'Cancellation Reason', type: 'text', placeholder: 'Customer requested reschedule' },
        ],
        outputExample: { uid: 'bk_12345', status: 'cancelled' },
      },
      {
        key: 'get_booking_link',
        label: 'Get Booking Link',
        description: 'Return the configured public booking link with optional prefilled query params.',
        inputFields: [
          { key: 'name', label: 'Prefill Name (Optional)', type: 'text', placeholder: '{{contact.name}}' },
          { key: 'email', label: 'Prefill Email (Optional)', type: 'text', placeholder: '{{vars.email}}' },
        ],
        outputExample: { url: 'https://cal.com/your-team/30min?name=Alex' },
      },
    ],
  },
  {
    provider_key: 'calendly',
    name: 'Calendly',
    category: 'scheduling',
    categoryLabel: 'Scheduling',
    description: 'Share scheduling links, list upcoming scheduled events, and cancel bookings.',
    shortBadge: 'CLY',
    brandColor: '#006BFF',
    docsUrl: 'https://developer.calendly.com/api-docs',
    setupSteps: [
      'Go to Calendly → Integrations & Apps → API & Webhooks.',
      'Generate a Personal Access Token and paste it below.',
      'Optionally add your default Calendly scheduling link.',
    ],
    credentialFields: [
      {
        key: 'access_token',
        label: 'Personal Access Token',
        type: 'password',
        placeholder: 'eyJraWQiOiIxY2...',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'scheduling_url',
        label: 'Default Scheduling URL (Optional)',
        type: 'url',
        placeholder: 'https://calendly.com/your-team/intro-call',
      },
    ],
    actions: [
      {
        key: 'get_scheduling_link',
        label: 'Get Scheduling Link',
        description: 'Return a personalized Calendly booking URL for the contact.',
        inputFields: [
          { key: 'name', label: 'Prefill Name (Optional)', type: 'text', placeholder: '{{contact.name}}' },
          { key: 'email', label: 'Prefill Email (Optional)', type: 'text', placeholder: '{{vars.email}}' },
        ],
        outputExample: { url: 'https://calendly.com/your-team/intro-call?name=Alex' },
      },
      {
        key: 'list_events',
        label: 'List Upcoming Events',
        description: 'List upcoming scheduled Calendly events (optionally filtered by invitee email).',
        inputFields: [
          { key: 'invitee_email', label: 'Invitee Email (Optional)', type: 'text', placeholder: '{{vars.email}}' },
          { key: 'count', label: 'Max Results', type: 'text', placeholder: '10', defaultValue: '10' },
        ],
        outputExample: { events: [{ name: 'Intro Call', start_time: '2026-12-01T10:00:00Z', status: 'active' }] },
      },
      {
        key: 'cancel_event',
        label: 'Cancel Event',
        description: 'Cancel an active Calendly scheduled event by UUID.',
        inputFields: [
          { key: 'event_uuid', label: 'Event UUID', type: 'text', placeholder: '{{vars.event_uuid}}', required: true },
          { key: 'reason', label: 'Cancellation Reason', type: 'text', placeholder: 'Customer cancelled via WhatsApp' },
        ],
        outputExample: { canceled: true },
      },
    ],
  },
  {
    provider_key: 'google_calendar',
    name: 'Google Calendar',
    category: 'scheduling',
    categoryLabel: 'Scheduling',
    description: 'Create calendar events and check free/busy slots in under 60 seconds.',
    shortBadge: 'GCAL',
    brandColor: '#1A73E8',
    setupSteps: [
      'Open script.google.com → New Project and paste the Google Calendar Apps Script shown below.',
      'Click Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.',
      'Copy the Web App URL and paste it below.',
    ],
    appsScriptSnippet: GOOGLE_CALENDAR_APPS_SCRIPT,
    credentialFields: [
      {
        key: 'webapp_url',
        label: 'Apps Script Web App URL',
        type: 'password',
        placeholder: 'https://script.google.com/macros/s/.../exec',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'calendar_id',
        label: 'Calendar ID (Optional)',
        type: 'text',
        placeholder: 'primary (leave blank for default calendar)',
      },
    ],
    actions: [
      {
        key: 'create_event',
        label: 'Create Event',
        description: 'Create a Google Calendar event and invite the guest by email.',
        inputFields: [
          { key: 'title', label: 'Event Title', type: 'text', placeholder: 'Consultation with {{contact.name}}', required: true },
          { key: 'start_time', label: 'Start Time (ISO 8601)', type: 'text', placeholder: '{{vars.start_time}}', required: true },
          { key: 'end_time', label: 'End Time (ISO 8601)', type: 'text', placeholder: '{{vars.end_time}}', required: true },
          { key: 'guest_email', label: 'Guest Email (Optional)', type: 'text', placeholder: '{{vars.email}}' },
          { key: 'description', label: 'Description (Optional)', type: 'textarea', placeholder: 'Phone: {{contact.phone}}' },
        ],
        outputExample: { ok: true, eventId: 'evt_abc123', title: 'Consultation' },
      },
      {
        key: 'check_availability',
        label: 'Check Free/Busy Slots',
        description: 'Check if the calendar is free between start_time and end_time.',
        inputFields: [
          { key: 'start_time', label: 'Start Time (ISO 8601)', type: 'text', placeholder: '{{vars.start_time}}', required: true },
          { key: 'end_time', label: 'End Time (ISO 8601)', type: 'text', placeholder: '{{vars.end_time}}', required: true },
        ],
        outputExample: { ok: true, isFree: true, busyCount: 0 },
      },
    ],
  },
  {
    provider_key: 'google_sheets',
    name: 'Google Sheets',
    category: 'spreadsheets',
    categoryLabel: 'Spreadsheets',
    description: 'Append leads, look up customer rows, and update spreadsheets in real time.',
    shortBadge: 'GS',
    brandColor: '#0F9D58',
    setupSteps: [
      'Open your Google Sheet → Extensions → Apps Script and paste the snippet below.',
      'Click Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.',
      'Copy the Web App URL and paste it below (no Google Cloud OAuth review needed).',
    ],
    appsScriptSnippet: GOOGLE_SHEETS_APPS_SCRIPT,
    credentialFields: [
      {
        key: 'webapp_url',
        label: 'Apps Script Web App URL',
        type: 'password',
        placeholder: 'https://script.google.com/macros/s/.../exec',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'sheet_name',
        label: 'Sheet Tab Name (Optional)',
        type: 'text',
        placeholder: 'Sheet1 (uses first tab if blank)',
      },
    ],
    actions: [
      {
        key: 'append_row',
        label: 'Append Row',
        description: 'Append a new row to the configured Google Sheet.',
        inputFields: [
          {
            key: 'values',
            label: 'Row Values (JSON Array or Comma-Separated)',
            type: 'textarea',
            placeholder: '["{{contact.name}}", "{{contact.phone}}", "{{vars.email}}", "{{current_date}}"]',
            required: true,
          },
          { key: 'sheet_name', label: 'Override Sheet Tab (Optional)', type: 'text', placeholder: 'Uses default if blank' },
        ],
        outputExample: { ok: true, rowNumber: 42 },
      },
      {
        key: 'lookup_row',
        label: 'Lookup Row',
        description: 'Find the first row matching a column value (e.g. phone or email).',
        inputFields: [
          { key: 'column_index', label: 'Column Index (0 = Col A)', type: 'text', placeholder: '1', defaultValue: '0', required: true },
          { key: 'match_value', label: 'Match Value', type: 'text', placeholder: '{{contact.phone}}', required: true },
          { key: 'sheet_name', label: 'Override Sheet Tab (Optional)', type: 'text', placeholder: 'Uses default if blank' },
        ],
        outputExample: { ok: true, found: true, rowNumber: 12, row: ['Alex', '+919876543210'] },
      },
      {
        key: 'update_row',
        label: 'Update Row',
        description: 'Overwrite values in a specific row number.',
        inputFields: [
          { key: 'row_number', label: 'Row Number', type: 'text', placeholder: '{{vars.sheet_row.rowNumber}}', required: true },
          { key: 'values', label: 'New Values (JSON Array)', type: 'textarea', placeholder: '["{{contact.name}}", "{{contact.phone}}", "Confirmed"]', required: true },
        ],
        outputExample: { ok: true, rowNumber: 12 },
      },
    ],
  },
  {
    provider_key: 'razorpay',
    name: 'Razorpay',
    category: 'payments',
    categoryLabel: 'Payments',
    description: 'Generate instant Razorpay Payment Links and verify payment status in Flows.',
    shortBadge: 'RZP',
    brandColor: '#0C2451',
    docsUrl: 'https://razorpay.com/docs/api/payments/payment-links/',
    setupSteps: [
      'Open Razorpay Dashboard → Account & Settings → API Keys.',
      'Generate a Key ID & Key Secret (Test or Live mode) and paste them below.',
    ],
    credentialFields: [
      { key: 'key_id', label: 'Razorpay Key ID', type: 'text', placeholder: 'rzp_live_xxxxxxxxxxxx', required: true },
      { key: 'key_secret', label: 'Razorpay Key Secret', type: 'password', placeholder: '••••••••••••', required: true },
    ],
    configFields: [
      { key: 'currency', label: 'Default Currency', type: 'text', placeholder: 'INR', defaultValue: 'INR' },
    ],
    actions: [
      {
        key: 'create_payment_link',
        label: 'Create Payment Link',
        description: 'Create a Razorpay payment link and return short_url to send on WhatsApp.',
        inputFields: [
          { key: 'amount', label: 'Amount (in main currency, e.g. 499)', type: 'text', placeholder: '499', required: true },
          { key: 'description', label: 'Payment Description', type: 'text', placeholder: 'Consultation Fee', required: true },
          { key: 'customer_name', label: 'Customer Name', type: 'text', placeholder: '{{contact.name}}' },
          { key: 'customer_phone', label: 'Customer Phone', type: 'text', placeholder: '{{contact.phone}}' },
          { key: 'customer_email', label: 'Customer Email (Optional)', type: 'text', placeholder: '{{vars.email}}' },
        ],
        outputExample: { id: 'plink_12345', short_url: 'https://rzp.io/i/abc123', status: 'created' },
      },
      {
        key: 'fetch_payment_link',
        label: 'Fetch Payment Status',
        description: 'Check whether a Razorpay payment link has been paid.',
        inputFields: [
          { key: 'payment_link_id', label: 'Payment Link ID', type: 'text', placeholder: '{{vars.payment.id}}', required: true },
        ],
        outputExample: { id: 'plink_12345', status: 'paid', amount_paid: 49900 },
      },
    ],
  },
  {
    provider_key: 'slack',
    name: 'Slack',
    category: 'alerts',
    categoryLabel: 'Alerts & Automation',
    description: 'Post instant lead, order, and booking alerts directly into your team Slack channels.',
    shortBadge: 'SLK',
    brandColor: '#4A154B',
    docsUrl: 'https://api.slack.com/messaging/webhooks',
    setupSteps: [
      'Open Slack App Directory → Incoming Webhooks (or create a Slack App with Incoming Webhooks).',
      'Choose a channel and copy the Webhook URL below.',
    ],
    credentialFields: [
      {
        key: 'webhook_url',
        label: 'Slack Incoming Webhook URL',
        type: 'password',
        placeholder: 'https://hooks.slack.com/services/T000/B000/XXXX',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'default_channel_label',
        label: 'Channel Label (For Display)',
        type: 'text',
        placeholder: '#sales-leads',
      },
    ],
    actions: [
      {
        key: 'send_notification',
        label: 'Send Channel Notification',
        description: 'Post a formatted message to your Slack channel.',
        inputFields: [
          {
            key: 'text',
            label: 'Message Text',
            type: 'textarea',
            placeholder: 'New lead: {{contact.name}} ({{contact.phone}})',
            required: true,
          },
        ],
        outputExample: { ok: true, status: 200 },
      },
    ],
  },
  {
    provider_key: 'webhook_bridge',
    name: 'Zapier / Make / n8n',
    category: 'alerts',
    categoryLabel: 'Alerts & Automation',
    description: 'Trigger any Zapier, Make, or n8n workflow and receive JSON data back in your flow.',
    shortBadge: 'ZAP',
    brandColor: '#FF4F00',
    setupSteps: [
      'Create a Webhook trigger in Zapier, Make, or n8n.',
      'Paste the Webhook URL below and optionally set a shared secret header.',
    ],
    credentialFields: [
      {
        key: 'webhook_url',
        label: 'Webhook Trigger URL',
        type: 'password',
        placeholder: 'https://hooks.zapier.com/hooks/catch/...',
        required: true,
      },
      {
        key: 'secret_token',
        label: 'X-Webhook-Secret Header (Optional)',
        type: 'password',
        placeholder: 'Optional shared secret',
      },
    ],
    configFields: [],
    actions: [
      {
        key: 'trigger_workflow',
        label: 'Trigger External Workflow',
        description: 'POST a JSON payload to the webhook and capture the JSON response.',
        inputFields: [
          {
            key: 'payload',
            label: 'JSON Payload',
            type: 'json',
            placeholder: '{"name": "{{contact.name}}", "phone": "{{contact.phone}}", "source": "whatsapp"}',
            required: true,
          },
        ],
        outputExample: { ok: true, status: 'accepted', data: {} },
      },
    ],
  },
  {
    provider_key: 'custom_api',
    name: 'Custom REST API',
    category: 'custom',
    categoryLabel: 'Custom Tools',
    description: 'Connect any internal CRM, ERP, or backend REST API with Bearer, Header, or Basic auth.',
    shortBadge: 'API',
    brandColor: '#2563EB',
    setupSteps: [
      'Enter your API Base URL (HTTPS recommended) and authentication method.',
      'After saving, add custom endpoint actions (GET/POST/PATCH/DELETE) or call ad-hoc paths.',
    ],
    credentialFields: [
      {
        key: 'auth_token',
        label: 'API Key / Bearer Token (Optional)',
        type: 'password',
        placeholder: 'Bearer token or API key value',
      },
      {
        key: 'basic_password',
        label: 'Basic Auth Password (Optional)',
        type: 'password',
        placeholder: 'Only needed for Basic Auth',
      },
    ],
    configFields: [
      {
        key: 'base_url',
        label: 'Base URL',
        type: 'url',
        placeholder: 'https://api.yourcompany.com/v1',
        required: true,
      },
      {
        key: 'auth_type',
        label: 'Auth Type',
        type: 'select',
        defaultValue: 'bearer',
        options: [
          { value: 'none', label: 'No Auth' },
          { value: 'bearer', label: 'Bearer Token' },
          { value: 'header', label: 'Custom Header (e.g. X-API-Key)' },
          { value: 'basic', label: 'Basic Auth' },
        ],
      },
      {
        key: 'auth_header_name',
        label: 'Header Name / Basic Username',
        type: 'text',
        placeholder: 'X-API-Key (for header auth) or username (for basic)',
      },
    ],
    actions: [
      {
        key: 'request',
        label: 'Execute API Request',
        description: 'Call any endpoint relative to Base URL or run a saved custom action.',
        inputFields: [
          {
            key: 'method',
            label: 'HTTP Method',
            type: 'select',
            defaultValue: 'POST',
            options: [
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'PATCH', label: 'PATCH' },
              { value: 'DELETE', label: 'DELETE' },
            ],
            required: true,
          },
          {
            key: 'path',
            label: 'Endpoint Path',
            type: 'text',
            placeholder: '/orders/{{vars.order_id}}',
            required: true,
          },
          {
            key: 'body',
            label: 'JSON Body (Optional)',
            type: 'json',
            placeholder: '{"phone": "{{contact.phone}}"}',
          },
        ],
        outputExample: { ok: true, status: 200, data: {} },
      },
    ],
  },
];

export const INTEGRATION_PROVIDER_MAP: Record<ProviderKey, IntegrationProviderDef> =
  INTEGRATION_PROVIDERS.reduce((acc, p) => {
    acc[p.provider_key] = p;
    return acc;
  }, {} as Record<ProviderKey, IntegrationProviderDef>);

export function getIntegrationProvider(key: string): IntegrationProviderDef | undefined {
  return INTEGRATION_PROVIDER_MAP[key as ProviderKey];
}
