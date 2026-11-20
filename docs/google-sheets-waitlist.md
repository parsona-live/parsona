# Google Sheets Waitlist Setup (Zero Database)

Waitlist submissions from the landing page (`POST /api/waitlist`) are validated on both the frontend UI and backend API, then forwarded directly to your Google Sheet via a Google Apps Script Web App.

### Built-in Protections
- **Strict validation (UI + Backend)**: Rejects invalid/disposable emails, fake numbers (`0000000000`, `1234567890`, `9999999999`), non-Indian/invalid prefixes, and numeric-only names.
- **Duplicate detection on BOTH Email & WhatsApp Number**: Normalizes Indian numbers (`9876543210`, `09876543210`, `+91 98765 43210` all match as the same number) and case-insensitive emails, returning HTTP `409 Conflict` with a clear UI message.
- **Concurrent write safety (`LockService`)**: Prevents race conditions when multiple visitors submit in the exact same second.

## 1. Paste `Code.gs` into Google Apps Script

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Replace everything in `Code.gs` with the script below and press **Ctrl + S**:

```javascript
// Optional: set the same string in GOOGLE_SHEETS_WEBHOOK_SECRET (or leave empty to skip)
const WEBHOOK_SECRET = '';

function normalizePhoneKey(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '91' + digits;
  if (digits.length === 11 && digits.charAt(0) === '0' && /^[6-9]/.test(digits.slice(1))) {
    return '91' + digits.slice(1);
  }
  return digits;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

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

    const email = String(data.email || '').trim().toLowerCase();
    const phoneKey = data.phoneKey
      ? String(data.phoneKey).replace(/\D/g, '')
      : normalizePhoneKey(data.phone || '');

    // Check duplicates across BOTH Email (col C) and normalized WhatsApp Number (col D)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const existingRows = sheet.getRange(2, 3, lastRow - 1, 2).getValues();
      let emailExists = false;
      let phoneExists = false;

      for (let i = 0; i < existingRows.length; i++) {
        const rowEmail = String(existingRows[i][0] || '').trim().toLowerCase();
        const rowPhoneKey = normalizePhoneKey(existingRows[i][1]);

        if (email && rowEmail === email) emailExists = true;
        if (phoneKey && rowPhoneKey && rowPhoneKey === phoneKey) phoneExists = true;
        if (emailExists && phoneExists) break;
      }

      if (emailExists || phoneExists) {
        const field = emailExists && phoneExists ? 'both' : emailExists ? 'email' : 'phone';
        const error =
          field === 'both'
            ? 'This email and WhatsApp number are already on the waitlist.'
            : field === 'phone'
              ? 'This WhatsApp number is already on the waitlist.'
              : 'This email address is already on the waitlist.';

        return jsonResponse({ ok: false, duplicate: true, field: field, error: error });
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
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
```

## 2. Deploy / Update Your Web App

- **Updating an existing deployment (keeps the exact same URL):**
  1. Click **Deploy → Manage deployments**.
  2. Click the **pencil (Edit)** icon on your Web App deployment.
  3. Change **Version** to **`New version`** → click **Deploy**.
- **First-time deployment:**
  1. Click **Deploy → New deployment → Web app**.
  2. Set **Execute as: `Me`**, **Who has access: `Anyone`**, then **Deploy**.

## 3. Environment Variable

### Local Development (`.env.local`)
```env
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
# Optional shared secret (must match WEBHOOK_SECRET in Code.gs):
# GOOGLE_SHEETS_WEBHOOK_SECRET=your-random-secret
```

### Cloudflare Workers (Production)
Set `GOOGLE_SHEETS_WEBHOOK_URL` under **Cloudflare Dashboard → Workers & Pages → `parsona` → Settings → Variables and Secrets**.
