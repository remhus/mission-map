export const dynamic = 'force-dynamic';
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import sql, { initDB } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  TROPHY_TIERS, isValidSlug, toPublicTrophy,
  type PublicTrophy, type TrophyRow, type TrophyTier,
} from '@/lib/publicTrophies';

/**
 * Read-only public trophy feed.
 *
 * Two gates stand between a trophy and this response:
 *   1. the account owner has switched on public sharing (user_settings), and
 *   2. the individual trophy is not hidden (achievements.is_public).
 * Nothing else about the account is ever exposed here.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
};

// Short edge cache plus an ETag: consumers re-fetch cheaply and only pay for a
// full payload when the trophy page has actually changed.
const CACHE = 'public, max-age=60, s-maxage=60, stale-while-revalidate=300';

function notFound() {
  return NextResponse.json(
    { error: 'No public trophy feed found for that handle.' },
    { status: 404, headers: { ...CORS, 'Cache-Control': 'public, max-age=30' } },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return notFound();

  const ip = req.headers.get('x-nf-client-connection-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || 'unknown';
  if (!(await checkRateLimit(`public-trophies:${ip}`, 300, 60))) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { ...CORS, 'Retry-After': '60' } },
    );
  }

  await initDB();

  const [owner] = await sql`
    SELECT s.user_id, u.username
    FROM user_settings s
    JOIN users u ON u.id::text = s.user_id
    WHERE s.public_slug = ${slug} AND s.public_trophies_enabled = TRUE
    LIMIT 1
  ` as { user_id: string; username: string | null }[];

  if (!owner) return notFound();

  const rows = await sql`
    SELECT id, title, description, trophy_tier, is_locked, unlocked_at, created_at
    FROM achievements
    WHERE user_id = ${owner.user_id} AND is_public = TRUE
    ORDER BY is_locked ASC, COALESCE(unlocked_at, created_at) DESC, id DESC
  ` as TrophyRow[];

  const trophies: PublicTrophy[] = rows.map(toPublicTrophy);

  const byTier = Object.fromEntries(
    TROPHY_TIERS.map(tier => [tier, { total: 0, achieved: 0 }]),
  ) as Record<TrophyTier, { total: number; achieved: number }>;
  for (const t of trophies) {
    byTier[t.tier].total++;
    if (t.achieved) byTier[t.tier].achieved++;
  }

  const body = {
    profile: {
      handle: slug,
      display_name: owner.username || slug,
      source: 'Mission Map',
      app_url: (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '') || null,
    },
    summary: {
      total: trophies.length,
      achieved: trophies.filter(t => t.achieved).length,
      by_tier: byTier,
    },
    trophies,
  };

  // Revision changes only when the published trophy data changes, so a poller
  // that sends If-None-Match gets a 304 until something is actually edited.
  const revision = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 16);
  const etag = `"${revision}"`;

  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ...CORS, ETag: etag, 'Cache-Control': CACHE } });
  }

  return NextResponse.json(
    { ...body, revision, generated_at: new Date().toISOString() },
    { headers: { ...CORS, ETag: etag, 'Cache-Control': CACHE } },
  );
}
