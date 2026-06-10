import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export default sql;

let initialized = false;
const SCHEMA_VERSION = 7;

export async function initDB() {
  if (initialized) return;
  try {
    // Fast path: single query to read installed version.
    // On a migrated DB this is the only DB round-trip before early-exit.
    // Catch handles truly fresh DBs where _schema_version doesn't exist yet.
    const prevRows = await sql`SELECT COALESCE(MAX(version), 0) AS v FROM _schema_version`
      .catch(() => [{ v: 0 }] as { v: number }[]);
    const prevVersion = Number((prevRows[0] as { v: number }).v);

    if (prevVersion >= SCHEMA_VERSION) { initialized = true; return; }

    // Schema needs migration — ensure core infrastructure tables exist first
    await sql`
      CREATE TABLE IF NOT EXISTS _schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;


    // Always run these column additions — safe with IF NOT EXISTS
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS every_day BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_favourite BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE achievements ADD COLUMN IF NOT EXISTS vision_board_image_id INTEGER`;
    await sql`
      CREATE TABLE IF NOT EXISTS dream_capsules (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        content TEXT DEFAULT '',
        is_sealed BOOLEAN DEFAULT FALSE,
        sealed_at TIMESTAMPTZ,
        locked_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS task_completions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        task_id INTEGER NOT NULL,
        task_title TEXT NOT NULL,
        skill TEXT NOT NULL DEFAULT 'energy',
        duration_minutes INTEGER DEFAULT 30,
        completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, task_id, completed_date)
      )
    `;

    // v4 migration: hours → minutes (only when upgrading from before v4)
    if (prevVersion < 4) {
      await sql`UPDATE skill_stats SET points = points * 60 WHERE points > 0 AND points < 1000`;
    }

    // v7 fix: rebuild skill_stats from task_completions to resolve XP corruption from prior migrations
    if (prevVersion >= 5) {
      await sql`DELETE FROM skill_stats`;
      await sql`
        INSERT INTO skill_stats (user_id, skill, points)
        SELECT user_id, skill, LEAST(60000, SUM(duration_minutes))
        FROM task_completions
        GROUP BY user_id, skill
      `;
    }

    // Check if grid_cells needs rebuilding (wrong user_id type)
    const gcCheck = await sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'grid_cells' AND column_name = 'user_id'
    `;
    const needsRebuild = gcCheck.length === 0 || (gcCheck[0] as { data_type: string }).data_type !== 'text';

    if (needsRebuild) {
      await sql`DROP TABLE IF EXISTS vision_board_images`;
      await sql`DROP TABLE IF EXISTS journal_entries`;
      await sql`DROP TABLE IF EXISTS skill_stats`;
      await sql`DROP TABLE IF EXISTS tasks`;
      await sql`DROP TABLE IF EXISTS achievements`;
      await sql`DROP TABLE IF EXISTS grid_cells`;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS grid_cells (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        row_index INTEGER NOT NULL,
        col_index INTEGER NOT NULL,
        content TEXT DEFAULT '',
        cell_type TEXT DEFAULT 'task',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, row_index, col_index)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        trophy_tier TEXT DEFAULT 'bronze',
        unlocked_at TIMESTAMPTZ DEFAULT NOW(),
        is_locked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        skill TEXT NOT NULL,
        duration_minutes INTEGER DEFAULT 30,
        time_of_day TEXT,
        day_of_week INTEGER NOT NULL DEFAULT 0,
        every_day BOOLEAN DEFAULT FALSE,
        is_completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS every_day BOOLEAN DEFAULT FALSE`;

    await sql`
      CREATE TABLE IF NOT EXISTS skill_stats (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        points INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, skill)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT DEFAULT '',
        mood TEXT DEFAULT 'neutral',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS vision_board_images (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        title TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Indexes — safe to re-run, never break existing queries
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_task_completions_user_date ON task_completions(user_id, completed_date DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_skill_stats_user_id ON skill_stats(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_vision_board_images_user_id ON vision_board_images(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_dream_capsules_user_id ON dream_capsules(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_grid_cells_user_id ON grid_cells(user_id)`;

    await sql`INSERT INTO _schema_version (version) VALUES (${SCHEMA_VERSION}) ON CONFLICT DO NOTHING`;
    initialized = true;
  } catch (err) {
    console.error('initDB error:', err);
    throw err;
  }
}
