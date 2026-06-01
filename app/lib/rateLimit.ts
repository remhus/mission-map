import sql from './db';

/**
 * Returns true if the request is allowed, false if the rate limit is exceeded.
 * key        — unique identifier, e.g. "login:1.2.3.4"
 * max        — maximum allowed requests per window
 * windowSecs — rolling window duration in seconds
 */
export async function checkRateLimit(key: string, max: number, windowSecs: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowSecs * 1000).toISOString();

  const rows = await sql`
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (${key}, 1, NOW())
    ON CONFLICT (key) DO UPDATE
      SET count = CASE
            WHEN rate_limits.window_start > ${windowStart}::timestamptz
            THEN rate_limits.count + 1
            ELSE 1
          END,
          window_start = CASE
            WHEN rate_limits.window_start > ${windowStart}::timestamptz
            THEN rate_limits.window_start
            ELSE NOW()
          END
    RETURNING count
  `;

  const count = (rows[0] as { count: number })?.count ?? 1;
  return count <= max;
}
