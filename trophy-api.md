# Mission Map — Public Trophy Feed

**Implementation brief for the agent building the promo website.**

Mission Map publishes one account's trophy room as a read-only JSON feed. Your job
is to fetch it and render it on the site. No SDK, no API key, no auth, no backend
work on your side — it is one HTTP GET.

---

## 1. What you are building

A trophy section on the promo site that mirrors the Mission Map trophy room:

- every trophy's **title**, **description**, **tier** (bronze → platinum) and
  whether it has been **achieved**
- a headline stat (e.g. "3 of 11 earned")
- a state that stays correct when the owner adds, edits, hides or claims a trophy

You do not build an admin UI, a login, a database, or a write path. The feed is the
only integration point and it is read-only.

---

## 2. Read this before you design anything

**Right now every trophy is unachieved.** The live feed returns `achieved: 0` of
`11`. These are aspirational goals — a Ferrari, a Bahamas villa, retiring his
parents — not a hall of fame of past wins.

If you build a "trophy case" that assumes earned trophies, the section will render
as eleven grey locked boxes and look broken. Design the **locked/aspirational state
as the primary state** and treat `achieved` as the exception that lights up. The
Mission Map app itself does exactly this: locked trophies show a padlock and a muted
card, earned ones get colour and a glow.

Current distribution — expect it to shift as he claims them:

| Tier | Count | Achieved |
|---|---|---|
| Platinum | 6 | 0 |
| Gold | 1 | 0 |
| Silver | 1 | 0 |
| Bronze | 3 | 0 |

Real titles you will be laying out, so you can sanity-check your typography:

```
Ferrari SF90 XX Stradale Spider              (platinum)
Royal Oak Selfwinding "1017-ALYX-9SM"        (platinum)
Retire Mum & Dad. Payoff Everything.         (platinum)
Generate First £1,000,000 in Revenue         (gold)
Generate First £10,000 in Revenue            (bronze)
```

Note `£`, `&`, and curly quotes. Titles are UTF-8 — do not mangle or strip them.
Live values run to ~37 characters, but the API permits **200 for a title and 500
for a description**, so your layout must not break on a long one.

---

## 3. Step by step

### Step 1 — Confirm the feed works

```bash
curl https://mish-map.netlify.app/api/public/trophies/rem
```

You should get JSON with `profile`, `summary` and `trophies`. If you get `404`, the
owner has switched the feed off or changed the handle — stop and ask, don't work
around it.

### Step 2 — Add the types

```ts
export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type Trophy = {
  id: number;                    // stable — use as the key
  title: string;                 // plain text, ≤200 chars
  description: string;           // plain text, ≤500 chars, may be empty
  tier: TrophyTier;              // the trophy's value
  tier_label: string;            // "Gold" — display-ready
  tier_rank: 1 | 2 | 3 | 4;      // bronze=1 … platinum=4, for sorting
  achieved: boolean;
  achieved_at: string | null;    // ISO 8601; null whenever achieved is false
  created_at: string;            // ISO 8601
};

export type TrophyFeed = {
  profile: { handle: string; display_name: string; source: string; app_url: string | null };
  summary: {
    total: number;
    achieved: number;
    by_tier: Record<TrophyTier, { total: number; achieved: number }>;
  };
  trophies: Trophy[];
  revision: string;              // changes only when the data changes
  generated_at: string;          // changes every request — do NOT diff on this
};
```

### Step 3 — Fetch it

Use the section matching your stack. All three are complete and drop-in.

---

#### Next.js (App Router) — recommended

`lib/trophies.ts`

```ts
import type { TrophyFeed } from './types';

const FEED_URL = 'https://mish-map.netlify.app/api/public/trophies/rem';

export async function getTrophies(): Promise<TrophyFeed | null> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;      // 404 = feed off, 429 = throttled, 503 = transient
    return (await res.json()) as TrophyFeed;
  } catch {
    return null;                   // network failure must never break the page
  }
}
```

`components/TrophyWall.tsx`

```tsx
import { getTrophies } from '@/lib/trophies';

const TIER = {
  platinum: { color: '#e5e7eb', label: 'Platinum' },
  gold:     { color: '#ffd700', label: 'Gold' },
  silver:   { color: '#cbd5e1', label: 'Silver' },
  bronze:   { color: '#cd7f32', label: 'Bronze' },
} as const;

export default async function TrophyWall() {
  const feed = await getTrophies();
  if (!feed) return null;          // render nothing rather than a broken section

  // Earned first, then the highest-value goals still in play.
  const trophies = [...feed.trophies].sort((a, b) =>
    Number(b.achieved) - Number(a.achieved) || b.tier_rank - a.tier_rank
  );

  return (
    <section>
      <h2>Trophy Room</h2>
      <p>{feed.summary.achieved} of {feed.summary.total} earned</p>

      <ul>
        {trophies.map(t => {
          const tier = TIER[t.tier];
          return (
            <li key={t.id} data-tier={t.tier} data-achieved={t.achieved}>
              <span style={{ color: tier.color }}>{tier.label}</span>
              <h3>{t.title}</h3>
              {t.description && <p>{t.description}</p>}
              {t.achieved && t.achieved_at ? (
                <time dateTime={t.achieved_at}>
                  Earned {new Date(t.achieved_at).toLocaleDateString('en-GB')}
                </time>
              ) : (
                <span>In progress</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

Add `export const revalidate = 3600;` to the page that renders it. Hourly is ample —
he edits trophies rarely.

---

#### React (Vite / CRA / any client-side app)

```tsx
import { useEffect, useState } from 'react';

const FEED_URL = 'https://mish-map.netlify.app/api/public/trophies/rem';

export function useTrophies() {
  const [feed, setFeed] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | empty

  useEffect(() => {
    let alive = true;
    fetch(FEED_URL)                       // no credentials — see §6
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) { setFeed(d); setState(d ? 'ready' : 'empty'); } })
      .catch(() => { if (alive) setState('empty'); });
    return () => { alive = false; };
  }, []);

  return { feed, state };
}
```

Render `state === 'empty'` as a hidden section, not an error message.

---

#### Plain HTML + JS

```html
<section id="trophies" hidden>
  <h2>Trophy Room</h2>
  <p id="trophy-count"></p>
  <ul id="trophy-list"></ul>
</section>

<script>
fetch('https://mish-map.netlify.app/api/public/trophies/rem')
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(feed => {
    document.getElementById('trophy-count').textContent =
      `${feed.summary.achieved} of ${feed.summary.total} earned`;

    const list = document.getElementById('trophy-list');
    for (const t of feed.trophies) {
      const li = document.createElement('li');
      li.dataset.tier = t.tier;
      li.dataset.achieved = t.achieved;

      const h3 = document.createElement('h3');
      h3.textContent = t.title;             // textContent, never innerHTML

      const p = document.createElement('p');
      p.textContent = t.description;

      li.append(h3, p);
      list.append(li);
    }
    document.getElementById('trophies').hidden = false;
  })
  .catch(() => { /* leave the section hidden */ });
</script>
```

---

## 4. Design reference

These are the exact tier colours Mission Map uses. Match them and the site will feel
like the same product; the app sits on a near-black `#0A0A0F` ground with `#e4e1e9`
text and `#8c90a1` muted text.

| Tier | Accent | Glow (earned only) |
|---|---|---|
| Platinum | `#e5e7eb` | `0 0 30px rgba(229,231,235,0.35)` |
| Gold | `#ffd700` | `0 0 30px rgba(255,215,0,0.35)` |
| Silver | `#cbd5e1` | `0 0 20px rgba(200,200,200,0.2)` |
| Bronze | `#cd7f32` | `0 0 20px rgba(205,127,50,0.2)` |

Locked cards in the app use a flat `rgba(255,255,255,0.03)` fill with a
`rgba(255,255,255,0.07)` border and a padlock, with the tier colour shown only as a
small icon. Reserve saturated colour and glow for `achieved: true` so earning one
actually reads as an event.

---

## 5. Keeping it in sync

Trophy data changes only when the owner edits the trophy page, so do not poll hard.

Every response carries an `ETag` (and the same value as `revision` in the body).
Send it back as `If-None-Match` and you get `304 Not Modified` with an empty body
until something actually changes:

```bash
curl -s -D - -o /dev/null https://mish-map.netlify.app/api/public/trophies/rem | grep -i etag
#> etag: "4b0cbe1d8af4921c"

curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'If-None-Match: "4b0cbe1d8af4921c"' \
  https://mish-map.netlify.app/api/public/trophies/rem
#> 304
```

Responses also set `Cache-Control: public, max-age=60, s-maxage=60,
stale-while-revalidate=300`, so a CDN in front of the site does most of this for you.
Hourly ISR (`revalidate: 3600`) plus that edge cache is the right default.

`revision` changes if and only if the published trophy data changes. `generated_at`
changes on every response — **don't** use it for change detection.

A cached client-side sync, if you need one:

```js
let cached = null; // { etag, feed }

async function syncTrophies() {
  const res = await fetch(FEED_URL, {
    headers: cached ? { 'If-None-Match': cached.etag } : {},
  });
  if (res.status === 304) return cached.feed;
  if (!res.ok) return cached?.feed ?? null;
  cached = { etag: res.headers.get('ETag'), feed: await res.json() };
  return cached.feed;
}
```

---

## 6. Security rules — non-negotiable

- **Render every string as text.** `title`, `description` and `display_name` are
  user-authored. They contain no HTML and are **not** escaped for you. Use `{value}`
  in JSX or `textContent` in vanilla JS. Never `innerHTML` /
  `dangerouslySetInnerHTML`.
- **Send no credentials.** The endpoint is anonymous and deliberately refuses them.
  `fetch(url, { credentials: 'include' })` will fail the CORS check. Plain
  `fetch(url)` is correct.
- **No key or secret belongs in your code.** If you are adding one to talk to this
  feed, something is wrong — it takes none.
- **There is nothing else to call.** Every other Mission Map endpoint is
  session-authenticated and emits no CORS headers, so browser code on this site
  cannot read it even for a visitor who happens to be logged into Mission Map. Don't
  build against any other path; it will not work, by design.
- **Fail soft.** Handle `404` (feed switched off), `429` (rate limited, 300/min per
  IP) and `503` (transient) by hiding the section, not by crashing the page.

---

## 7. Acceptance checklist

- [ ] Section renders all 11 trophies with title, description and tier
- [ ] Locked/aspirational styling is the default; earned styling is the exception
- [ ] `achieved_at` is only shown when `achieved` is `true`
- [ ] A 200-char title and 500-char description do not break the layout
- [ ] `£`, `&` and curly quotes render correctly
- [ ] Trophies with an empty `description` render without a gap or stray element
- [ ] `404`/`429`/`503`/network failure hides the section instead of erroring
- [ ] Page is not refetching on every request (ISR or cache in place)
- [ ] No `innerHTML`, no `credentials`, no API key anywhere
- [ ] Re-check after the owner edits a trophy: the site reflects it within the hour

---

## API reference

### Response — `200 application/json`

```json
{
  "profile": {
    "handle": "rem",
    "display_name": "Rem",
    "source": "Mission Map",
    "app_url": "https://mish-map.netlify.app"
  },
  "summary": {
    "total": 11,
    "achieved": 0,
    "by_tier": {
      "bronze":   { "total": 3, "achieved": 0 },
      "silver":   { "total": 1, "achieved": 0 },
      "gold":     { "total": 1, "achieved": 0 },
      "platinum": { "total": 6, "achieved": 0 }
    }
  },
  "trophies": [
    {
      "id": 18,
      "title": "Make First Profitable Sale",
      "description": "Achieve first completed sale that generates real profit.",
      "tier": "bronze",
      "tier_label": "Bronze",
      "tier_rank": 1,
      "achieved": false,
      "achieved_at": null,
      "created_at": "2026-06-02T01:15:17.789Z"
    }
  ],
  "revision": "8af9cde17bd318c8",
  "generated_at": "2026-09-16T05:02:03.744Z"
}
```

Default order is achieved first (most recent first), then unachieved. Re-sort
client-side however the design needs — `tier_rank` and `achieved_at` exist for that.

### Errors

| Status | Meaning |
|---|---|
| `404` | Unknown handle, **or** the owner switched the feed off. Identical on purpose. |
| `429` | Rate limited (300 requests/minute per IP). Retry after 60s. |
| `503` | Transient server-side problem. Retry later; render the empty state meanwhile. |

---

## What the owner controls

Two independent switches sit between a trophy and this feed. Both must be open.

1. **Account level** — Mission Map → Settings → *Public Trophy Feed*. Off by
   default. While it's off the URL returns `404` and nothing is reachable.
2. **Per trophy** — Mission Map → Achievements → *Edit Trophy* → *Hide from public
   trophy feed*. New trophies are shared by default; ticking the box removes that one
   from the feed.

The owner can also change the handle in Settings, which changes the URL and breaks
the old link. If the feed starts 404-ing, ask them to re-copy the Feed URL.

## What is never published

Only `title`, `description`, `tier` and achieved status leave Mission Map. Tasks,
journal entries, the mandala grid, the vision board, books, the dream capsule, skill
XP, weekly quests, email address and every other account detail are not exposed by
this endpoint and never will be. The feed is read-only — there is no way to write to
Mission Map through it.
