export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

const DEFAULT_TZ = 'Europe/London';

function validTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    // Throws for unsupported IANA identifiers.
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await sql`
    SELECT weekly_quests_enabled, timezone FROM user_settings WHERE user_id = ${user.userId}
  ` as { weekly_quests_enabled: boolean; timezone: string }[];

  return NextResponse.json({
    enabled: row?.weekly_quests_enabled === true,
    timezone: row?.timezone || DEFAULT_TZ,
  });
}

export async function PUT(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const enabled = body.enabled === true;
  const timezone = validTimezone(body.timezone) ? body.timezone : DEFAULT_TZ;

  // Record consent time the first time the feature is switched on.
  await sql`
    INSERT INTO user_settings (user_id, weekly_quests_enabled, timezone, consent_at, updated_at)
    VALUES (${user.userId}, ${enabled}, ${timezone}, ${enabled ? new Date().toISOString() : null}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      weekly_quests_enabled = ${enabled},
      timezone = ${timezone},
      consent_at = CASE
        WHEN ${enabled} AND user_settings.consent_at IS NULL THEN NOW()
        ELSE user_settings.consent_at
      END,
      updated_at = NOW()
  `;

  return NextResponse.json({ enabled, timezone });
}
