export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { findFreeSlug, isValidSlug } from '@/lib/publicTrophies';

type SettingsRow = { public_trophies_enabled: boolean; public_slug: string | null };

function feedUrl(slug: string | null): string | null {
  if (!slug) return null;
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  return `${base}/api/public/trophies/${slug}`;
}

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await sql`
    SELECT public_trophies_enabled, public_slug FROM user_settings WHERE user_id = ${user.userId}
  ` as SettingsRow[];

  const [counts] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_public)::int AS shared
    FROM achievements WHERE user_id = ${user.userId}
  ` as { total: number; shared: number }[];

  const slug = row?.public_slug ?? null;
  return NextResponse.json({
    enabled: row?.public_trophies_enabled === true,
    slug,
    url: feedUrl(slug),
    total: counts?.total ?? 0,
    shared: counts?.shared ?? 0,
  });
}

export async function PUT(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const enabled = body.enabled === true;

  const [existing] = await sql`
    SELECT public_trophies_enabled, public_slug FROM user_settings WHERE user_id = ${user.userId}
  ` as SettingsRow[];

  let slug = existing?.public_slug ?? null;

  if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
    if (!isValidSlug(body.slug)) {
      return NextResponse.json(
        { error: 'Handle must be 3–40 characters: lowercase letters, numbers and hyphens.' },
        { status: 400 },
      );
    }
    const clash = await sql`
      SELECT 1 FROM user_settings WHERE public_slug = ${body.slug} AND user_id <> ${user.userId} LIMIT 1
    `;
    if (clash.length > 0) {
      return NextResponse.json({ error: 'That handle is already taken.' }, { status: 409 });
    }
    slug = body.slug;
  }

  // Turning sharing on for the first time mints a handle from the account name.
  if (enabled && !slug) {
    slug = await findFreeSlug(user.username || user.email.split('@')[0] || 'trophies', user.userId);
  }

  await sql`
    INSERT INTO user_settings (user_id, public_trophies_enabled, public_slug, updated_at)
    VALUES (${user.userId}, ${enabled}, ${slug}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      public_trophies_enabled = ${enabled},
      public_slug = ${slug},
      updated_at = NOW()
  `;

  return NextResponse.json({ enabled, slug, url: feedUrl(slug) });
}
