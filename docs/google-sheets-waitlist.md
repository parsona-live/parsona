# Google Sheets Waitlist Setup (Zero Database)

Waitlist submissions from the landing page (`POST /api/waitlist`) are forwarded directly from the server to your Google Sheet via a lightweight Google Apps Script Web App. No database or Google Cloud billing is required, and it works on both local Next.js and Cloudflare Workers.

## 1. Create Your Google Sheet & Apps Script (60 seconds)

1. Open [sheets.new](https://sheets.new) to create a new Google Sheet (e.g., **Parsona Waitlist**).
2. In the top menu, click **Extensions → Apps Script**.
3. Delete any default code in `Code.gs` and paste the following script:

```javascript
// Optional: set the same string in GOOGLE_SHEETS_WEBHOOK_SECRET (or leave empty to skip)
const WEBHOOK_SECRET = '';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    if (WEBHOOK_SECRET && data.secret !== WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Auto-create header row if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp (IST)',
        'Full Name',
        'Email',
        'WhatsApp Number',
        'Source',
        'ISO Timestamp',
      ]);
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    }

    // Prevent duplicate rows for the same email (case-insensitive)
    const email = String(data.email || '').trim().toLowerCase();
    const lastRow = sheet.getLastRow();
    if (email && lastRow > 1) {
      const existingEmails = sheet
        .getRange(2, 3, lastRow - 1, 1)
        .getValues()
        .flat()
        .map((v) => String(v).trim().toLowerCase());

      if (existingEmails.includes(email)) {
        return jsonResponse({ ok: true, duplicate: true });
      }
    }

    sheet.appendRow([
      data.istTime || new Date().toISOString(),
      data.name || '',
      email,
      data.phone || '',
      data.source || 'parsona.live',
      data.timestamp || new Date().toISOString(),
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
```

## 2. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to *Select type* → choose **Web app**.
3. Set:
   - **Description**: `Parsona Waitlist`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**, authorize the script when prompted, and copy the **Web app URL** (looks like `https://script.google.com/macros/s/.../exec`).

## 3. Add the Environment Variable

### Local Development (`.env.local`)
```env
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
# Optional shared secret (must match WEBHOOK_SECRET in Code.gs):
# GOOGLE_SHEETS_WEBHOOK_SECRET=your-random-secret
```

### Cloudflare Workers (Production)
Add `GOOGLE_SHEETS_WEBHOOK_URL` (and optionally `GOOGLE_SHEETS_WEBHOOK_SECRET`) under **Cloudflare Dashboard → Workers & Pages → `parsona` → Settings → Variables and Secrets**, or via CLI:

```powershell
npx cf secrets put GOOGLE_SHEETS_WEBHOOK_URL
```

Once set, every waitlist form submission on the landing page immediately appends a new row to your Google Sheet.

DeploymentID
AKfycbxchePn95M8keKW5B8bZcCq7ne82H8QlVjrIMaVwkO2Bi64jrVDbCUMDmKscv5GRMR4

Web app URL
https://script.google.com/macros/s/AKfycbxchePn95M8keKW5B8bZcCq7ne82H8QlVjrIMaVwkO2Bi64jrVDbCUMDmKscv5GRMR4/exec