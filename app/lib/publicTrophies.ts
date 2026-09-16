import sql from './db';

/**
 * Shared vocabulary for the public trophy feed.
 *
 * A trophy's "value" in Mission Map is its tier — bronze through platinum.
 * `rank` is the numeric form of that value so consumers can sort without
 * hard-coding the tier order.
 */
export const TROPHY_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;
export type TrophyTier = (typeof TROPHY_TIERS)[number];

export const TIER_RANK: Record<TrophyTier, number> = {
  bronze: 1, silver: 2, gold: 3, platinum: 4,
};

export const TIER_LABEL: Record<TrophyTier, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum',
};

export type PublicTrophy = {
  id: number;
  title: string;
  description: string;
  tier: TrophyTier;
  tier_label: string;
  tier_rank: number;
  achieved: boolean;
  achieved_at: string | null;
  created_at: string;
};

export type TrophyRow = {
  id: number;
  title: string;
  description: string | null;
  trophy_tier: string;
  is_locked: boolean;
  unlocked_at: string | Date | null;
  created_at: string | Date;
};

function isoOrNull(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Maps a database row onto the published shape. Never leaks internal columns. */
export function toPublicTrophy(row: TrophyRow): PublicTrophy {
  const tier = (TROPHY_TIERS as readonly string[]).includes(row.trophy_tier)
    ? (row.trophy_tier as TrophyTier)
    : 'bronze';
  const achieved = row.is_locked === false;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    tier,
    tier_label: TIER_LABEL[tier],
    tier_rank: TIER_RANK[tier],
    achieved,
    // unlocked_at is only meaningful once a trophy has actually been claimed.
    achieved_at: achieved ? isoOrNull(row.unlocked_at) : null,
    created_at: isoOrNull(row.created_at) ?? new Date(0).toISOString(),
  };
}

/** 3–40 chars, lowercase alphanumeric with internal hyphens. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_PATTERN.test(slug);
}

/** Best-effort slug from arbitrary text. Returns '' when nothing usable remains. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : '';
}

/**
 * Finds a free slug near `desired`, skipping any already taken by another user.
 * Falls back to a random suffix if the obvious candidates are all claimed.
 */
export async function findFreeSlug(desired: string, userId: string): Promise<string> {
  const base = slugify(desired) || 'trophies';
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`.slice(0, 40).replace(/-+$/g, '');
    const taken = await sql`
      SELECT 1 FROM user_settings WHERE public_slug = ${candidate} AND user_id <> ${userId} LIMIT 1
    `;
    if (taken.length === 0) return candidate;
  }
  return `${base.slice(0, 32)}-${Math.random().toString(36).slice(2, 8)}`;
}
