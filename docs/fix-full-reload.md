# Full-App Reload Problem — Manual Fix Guide

> This guide explains **why** the app was doing a full browser reload when a component needed to refresh its data, **how** to identify the pattern in any file, and **how** to fix it correctly.

---

## The Problem at a Glance

When a data fetch fails (network hiccup, Supabase timeout, etc.) the "Retry" button in some pages was calling:

```js
window.location.reload()
```

This is a **full browser reload** — identical to the user pressing F5. Everything is destroyed and rebuilt from scratch.

---

## What Actually Happens: Full Reload vs. Component Reload

### ❌ Bad Path — `window.location.reload()`

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Next as Next.js (HTML)
    participant Auth as AuthProvider
    participant WS as Supabase Realtime WS
    participant DB as Supabase DB

    User->>Browser: clicks "Retry"
    Browser->>Browser: window.location.reload()
    Note over Browser: ❌ Entire page destroyed
    Browser->>Next: GET /automations (full HTTP request)
    Next-->>Browser: HTML + JS bundle
    Browser->>Auth: re-run getSession()
    Auth->>DB: fetch profile row
    DB-->>Auth: profile data
    Auth->>WS: re-subscribe realtime channel
    Note over WS: ❌ Old WS connection dead, new one opened
    Browser->>DB: fetch automations
    DB-->>Browser: data
    Note over User: ~2–4 seconds of blank/spinner
```

### ✅ Good Path — `load()` / `fetchBroadcasts()`

```mermaid
sequenceDiagram
    participant User
    participant Component as React Component
    participant DB as Supabase DB
    participant Auth as AuthProvider
    participant WS as Supabase Realtime WS

    User->>Component: clicks "Retry"
    Component->>Component: setError(null)
    Component->>DB: fetch automations (1 query)
    DB-->>Component: data
    Component->>Component: setState(data)
    Note over Auth: ✅ Still alive, untouched
    Note over WS: ✅ Still connected, no interruption
    Note over User: ~200ms, only the list refreshes
```

---

## App Architecture — What Survives vs. What Dies

```mermaid
flowchart TD
    subgraph Browser["Browser Tab"]
        subgraph React["React Tree (lives in memory)"]
            Root["RootLayout\n(theme, i18n)"]
            Auth["AuthProvider\n(user, profile, account role)"]
            Shell["DashboardShell\n(sidebar, header)"]
            WS["Supabase Realtime WS\n(inbox subscriptions)"]
            Page["Page Component\n(automations / broadcasts / notifications)"]
            Data["Page State\n(automations[], error, loading)"]
        end
    end

    Root --> Auth --> Shell --> Page --> Data
    Shell -.-> WS
```

> [!NOTE]
> When `window.location.reload()` is called, **everything in the React tree is destroyed** — including `AuthProvider`, the Realtime WebSocket, the sidebar state, etc. Only `Data` (the page's local state) needed to be reset.

---

## Identifying the Pattern

Search for this in any `.tsx` / `.ts` file under `src/`:

```bash
# PowerShell
Get-ChildItem -Recurse src -Include *.tsx,*.ts | Select-String "window\.location\.reload"

# bash / grep
grep -rn "window.location.reload" src/
```

Or in VS Code: `Ctrl+Shift+F` → search `window.location.reload`

### Decision Tree — Which reload is correct?

```mermaid
flowchart TD
    Q1{"Why does the\npage need to reload?"}
    Q1 -->|"Data fetch failed\nor data is stale"| A1["✅ Call the local\nload() function"]
    Q1 -->|"User just signed out"| A2["✅ window.location.href = '/login'\nor router.push('/login')"]
    Q1 -->|"Auth session just changed\n(sign in, invitation accepted)"| A3["✅ window.location.href\n(full reset needed)"]
    Q1 -->|"Not sure — reflex use"| A4["Replace with load()\nThis is the bug"]
```

---

## The Three Files to Fix

### 1. `src/app/(dashboard)/automations/page.tsx`

**How to find it:** The `load()` function is defined at line ~71 as a plain `async function`. The error state is `const [error, setError] = useState<string | null>(null)`.

**Before (line ~145):**
```tsx
if (error) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm text-red-400">{error}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>  {/* ❌ */}
        {t("retry")}
      </Button>
    </div>
  )
}
```

**After:**
```tsx
if (error) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm text-red-400">{error}</p>
      <Button variant="outline" onClick={() => { setError(null); load(); }}>  {/* ✅ */}
        {t("retry")}
      </Button>
    </div>
  )
}
```

**What `load()` does:**
```mermaid
flowchart LR
    A["load() called"] --> B["createClient()"]
    B --> C["supabase.from('automations')\n.select('*')"]
    C -->|success| D["setAutomations(data)"]
    C -->|error| E["setError(message)"]
```

---

### 2. `src/app/(dashboard)/broadcasts/page.tsx`

**How to find it:** The fetch function is called `fetchBroadcasts()` (not `load()`). The error state is `const [error, setError] = useState<string | null>(null)`. There is also a `loading` boolean — reset it to `true` so the spinner shows during the retry.

**Before (line ~147):**
```tsx
if (error) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm text-red-400">{error}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>  {/* ❌ */}
        {t('retry')}
      </Button>
    </div>
  );
}
```

**After:**
```tsx
if (error) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm text-red-400">{error}</p>
      <Button variant="outline" onClick={() => { setError(null); setLoading(true); fetchBroadcasts(); }}>  {/* ✅ */}
        {t('retry')}
      </Button>
    </div>
  );
}
```

> [!TIP]
> `setLoading(true)` is needed here because `broadcasts/page.tsx` has a **separate loading block** that renders the spinner. Without it, the error block disappears but the data block shows stale empty state until `fetchBroadcasts` resolves.

**What `fetchBroadcasts()` does:**
```mermaid
flowchart LR
    A["fetchBroadcasts() called"] --> B["createClient()"]
    B --> C["supabase.from('broadcasts')\n.select('*')"]
    C -->|success| D["setBroadcasts(data)\nsetLoading(false)"]
    C -->|error| E["setError(message)\nsetLoading(false)"]
```

---

### 3. `src/app/(dashboard)/notifications/page.tsx`

**How to find it:** The `load` function is a `useCallback` at line ~32. Error state: `const [error, setError] = useState<string | null>(null)`.

**Before (line ~159):**
```tsx
if (error) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm text-destructive">{error}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>  {/* ❌ */}
        {t("retry")}
      </Button>
    </div>
  );
}
```

**After:**
```tsx
if (error) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm text-destructive">{error}</p>
      <Button variant="outline" onClick={() => { setError(null); load(); }}>  {/* ✅ */}
        {t("retry")}
      </Button>
    </div>
  );
}
```

**What `load()` does:**
```mermaid
flowchart LR
    A["load() called"] --> B{"accountId\navailable?"}
    B -->|No| C["return early"]
    B -->|Yes| D["supabase.from('notifications')\n.select('*')"]
    D -->|success| E["setNotifications(data)"]
    D -->|error| F["setError(message)"]
```

---

## State Flow Comparison

### Before the Fix (Broken)

```mermaid
flowchart TD
    FetchFails["Fetch fails\n(network/Supabase error)"]
    FetchFails --> SetError["setError('...')"]
    SetError --> RenderError["Render error UI\n+ Retry button"]
    RenderError -->|"User clicks Retry"| FullReload["window.location.reload()"]
    FullReload --> DestroyAll["Destroy entire\nReact tree"]
    DestroyAll --> RebootAuth["Re-run AuthProvider\n(2 DB fetches)"]
    RebootAuth --> ReconnectWS["Re-open Realtime WS"]
    ReconnectWS --> ReFetch["Re-fetch page data"]
    ReFetch --> RenderPage["Page renders\n(~2-4s later)"]
```

### After the Fix (Correct)

```mermaid
flowchart TD
    FetchFails["Fetch fails\n(network/Supabase error)"]
    FetchFails --> SetError["setError('...')"]
    SetError --> RenderError["Render error UI\n+ Retry button"]
    RenderError -->|"User clicks Retry"| ClearError["setError(null)"]
    ClearError --> CallLoad["load() / fetchBroadcasts()"]
    CallLoad --> OneFetch["1 Supabase query"]
    OneFetch -->|success| SetData["setState(data)"]
    OneFetch -->|error again| SetError2["setError('...')"]
    SetData --> RenderPage["Page renders\n(~200ms later)"]

    Auth["AuthProvider — alive and unchanged"]
    WS["Realtime WS — alive and unchanged"]
    Sidebar["Sidebar — alive and unchanged"]
```

---

## General Rule for Future Pages

Whenever you add a new page with a data fetch + error state, follow this pattern:

```tsx
// 1. State
const [data, setData] = useState<MyType[] | null>(null);
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

// 2. Fetch function (plain async or useCallback)
const load = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase.from('my_table').select('*');
    if (fetchErr) throw fetchErr;
    setData(data ?? []);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load');
  } finally {
    setLoading(false);
  }
}, []);

// 3. Initial fetch on mount
useEffect(() => { load(); }, [load]);

// 4. Error UI — always call load(), NEVER window.location.reload()
if (error) {
  return (
    <div>
      <p>{error}</p>
      <button onClick={() => { setError(null); load(); }}>
        Retry
      </button>
    </div>
  );
}
```

---

## Reference: Which `window.location.*` calls are intentional

| File | Pattern | Correct? | Why |
|---|---|---|---|
| `use-auth.tsx` — `signOut()` | `window.location.href = '/login'` | ✅ Yes | Auth session cleared; React state is stale with old user's data |
| `use-auth.tsx` — fallback | `window.location.href = '/login'` | ✅ Yes | Outside `AuthProvider`; no router available |
| `join/[token]/page.tsx` | `window.location.href = '/dashboard'` | ✅ Yes | Account context just changed after accepting invite |
| `sessions-card.tsx` | `window.location.href = '/login'` | ✅ Yes | User just invalidated their own token |
| `login/page.tsx` | `window.location.href = ...` | ✅ Yes | Post-auth hard navigate |
| `automations/page.tsx` — Retry | ~~`window.location.reload()`~~ → `load()` | ✅ Fixed | Only data was stale; auth/WS untouched |
| `broadcasts/page.tsx` — Retry | ~~`window.location.reload()`~~ → `fetchBroadcasts()` | ✅ Fixed | Only data was stale; auth/WS untouched |
| `notifications/page.tsx` — Retry | ~~`window.location.reload()`~~ → `load()` | ✅ Fixed | Only data was stale; auth/WS untouched |

