# Mission Map — Public Trophy Feed

A read-only JSON feed that publishes the trophy room from a Mission Map account so
another website can display it. No SDK, no key, no account needed to read it.

**Endpoint**

```
GET https://mish-map.netlify.app/api/public/trophies/{handle}
```

The handle is set by the account owner in Mission Map → Settings → Public Trophy Feed.
Ask the owner for the exact URL; the Settings panel has a Copy button that puts it on
the clipboard.

---

## Response

`200 application/json`

```json
{
  "profile": {
    "handle": "rem",
    "display_name": "Rem",
    "source": "Mission Map",
    "app_url": "https://mish-map.netlify.app"
  },
  "summary": {
    "total": 12,
    "achieved": 4,
    "by_tier": {
      "bronze":   { "total": 5, "achieved": 2 },
      "silver":   { "total": 3, "achieved": 1 },
      "gold":     { "total": 2, "achieved": 1 },
      "platinum": { "total": 2, "achieved": 0 }
    }
  },
  "trophies": [
    {
      "id": 19,
      "title": "Make First Profitable Sale",
      "description": "Achieve first completed sale that generates real profit.",
      "tier": "gold",
      "tier_label": "Gold",
      "tier_rank": 3,
      "achieved": true,
      "achieved_at": "2026-09-16T04:47:09.120Z",
      "created_at": "2026-09-16T04:47:01.531Z"
    }
  ],
  "revision": "4b0cbe1d8af4921c",
  "generated_at": "2026-09-16T04:47:14.894Z"
}
```

### Trophy fields

| Field | Type | Notes |
|---|---|---|
| `id` | number | Stable for the life of the trophy. Use it as a React key / DB key. |
| `title` | string | Up to 200 chars. Plain text — no HTML. |
| `description` | string | Up to 500 chars. Plain text, may be empty. |
| `tier` | `"bronze" \| "silver" \| "gold" \| "platinum"` | **This is the trophy's value.** |
| `tier_label` | string | Display-ready form of `tier` (`"Gold"`). |
| `tier_rank` | 1–4 | Numeric form of `tier`, so you can sort without hard-coding the order. |
| `achieved` | boolean | `true` once claimed in Mission Map; `false` while still a target. |
| `achieved_at` | ISO 8601 string \| null | Always `null` when `achieved` is `false`. |
| `created_at` | ISO 8601 string | When the trophy was added. |

Default order is achieved trophies first (most recent first), then unachieved.
Re-sort client-side however the design calls for — `tier_rank` and `achieved_at`
are there for exactly that.

### Error responses

| Status | Meaning |
|---|---|
| `404` | Unknown handle, **or** the owner has switched the feed off. Both look identical on purpose. |
| `429` | Rate limited (300 requests/minute per IP). Retry after 60s. |

Render a graceful empty state for `404` — the owner can turn the feed off at any time,
and the site should not break when they do.

---

## Re-syncing

Trophy data only changes when the owner edits their trophy page, so don't poll hard.

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

Responses also set `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300`,
so a CDN in front of your site will do most of this for you.

`revision` changes if and only if the published trophy data changes. `generated_at`
changes on every response — **don't** use it for change detection.

CORS is open (`Access-Control-Allow-Origin: *`), so browser-side fetches work too.

---

## Integration examples

### Next.js — server component, revalidating hourly

```tsx
export const revalidate = 3600;

type Trophy = {
  id: number;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  tier_label: string;
  tier_rank: 1 | 2 | 3 | 4;
  achieved: boolean;
  achieved_at: string | null;
  created_at: string;
};

type TrophyFeed = {
  profile: { handle: string; display_name: string; source: string; app_url: string | null };
  summary: {
    total: number;
    achieved: number;
    by_tier: Record<Trophy['tier'], { total: number; achieved: number }>;
  };
  trophies: Trophy[];
  revision: string;
  generated_at: string;
};

const FEED_URL = 'https://mish-map.netlify.app/api/public/trophies/rem';

async function getTrophies(): Promise<TrophyFeed | null> {
  const res = await fetch(FEED_URL, { next: { revalidate: 3600 } });
  if (!res.ok) return null;           // 404 = feed turned off; render an empty state
  return res.json();
}

export default async function TrophyWall() {
  const feed = await getTrophies();
  if (!feed) return null;

  return (
    <section>
      <h2>{feed.summary.achieved} of {feed.summary.total} trophies earned</h2>
      <ul>
        {feed.trophies.map(t => (
          <li key={t.id} data-tier={t.tier} data-achieved={t.achieved}>
            <h3>{t.title}</h3>
            <p>{t.description}</p>
            <span>{t.tier_label}</span>
            {t.achieved && <time dateTime={t.achieved_at!}>
              {new Date(t.achieved_at!).toLocaleDateString('en-GB')}
            </time>}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### Plain browser fetch

```js
const res = await fetch('https://mish-map.netlify.app/api/public/trophies/rem');
if (res.ok) {
  const { trophies, summary } = await res.json();
  // …render
}
```

### Cached sync with conditional requests

```js
let cached = null; // { etag, feed }

async function syncTrophies() {
  const res = await fetch(FEED_URL, {
    headers: cached ? { 'If-None-Match': cached.etag } : {},
  });
  if (res.status === 304) return cached.feed;      // nothing changed
  if (!res.ok) return cached?.feed ?? null;
  cached = { etag: res.headers.get('ETag'), feed: await res.json() };
  return cached.feed;
}
```

---

## What the owner controls

Two independent switches sit between a trophy and this feed. Both must be open.

1. **Account level** — Mission Map → Settings → *Public Trophy Feed*. Off by default.
   While it's off the URL returns `404` and nothing is reachable.
2. **Per trophy** — Mission Map → Achievements → *Edit Trophy* → *Hide from public
   trophy feed*. New trophies are shared by default; ticking the box removes that one
   from the feed immediately.

The owner can also change their handle in Settings, which changes the URL and breaks
the old link. If the feed starts 404-ing, ask them to re-copy the Feed URL.

## What is never published

Only `title`, `description`, `tier` and achieved status leave Mission Map. Tasks,
journal entries, the mandala grid, the vision board, books, the dream capsule, skill
XP, weekly quests, email address and every other account detail are not exposed by
this endpoint and never will be. The feed is read-only — there is no way to write to
Mission Map through it.
