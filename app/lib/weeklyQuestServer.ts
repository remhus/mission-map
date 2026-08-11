// ---------------------------------------------------------------------------
// Server-side orchestration for weekly quests: fetch authoritative context for
// a user, run generation (Gemini → validate → deterministic fallback), and
// shape rows for the client. DB access lives here; pure logic in weeklyQuest.ts.
// ---------------------------------------------------------------------------

import sql from './db';
import { generateQuestJson } from './gemini';
import {
  buildHierarchy, buildUserPrompt, deterministicQuest,
  responseSchema, SYSTEM_PROMPT, validateQuest, SKILLS,
  type GeneratedQuest, type MandalaHierarchy, type Rank, type Skill,
  type TaskHistoryItem, type QuestHistoryItem, type FocusTarget,
} from './weeklyQuest';

export type QuestContext = {
  hierarchy: MandalaHierarchy;
  skillXp: Partial<Record<Skill, number>>;
  taskHistory: TaskHistoryItem[];
  questHistory: QuestHistoryItem[];
};

// Pull the latest server-owned grid, skills, task history and quest history.
export async function fetchContext(userId: string): Promise<QuestContext> {
  const [cells, stats, tasks, completions, quests] = await Promise.all([
    sql`SELECT row_index, col_index, content FROM grid_cells WHERE user_id = ${userId}`,
    sql`SELECT skill, points FROM skill_stats WHERE user_id = ${userId}`,
    sql`SELECT title, skill, every_day, day_of_week FROM tasks WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 40`,
    sql`SELECT task_title, skill, completed_date FROM task_completions WHERE user_id = ${userId} ORDER BY completed_date DESC LIMIT 30`,
    sql`SELECT title, rank, status, source_pillar FROM weekly_quests WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 40`,
  ]);

  const hierarchy = buildHierarchy(
    (cells as { row_index: number; col_index: number; content: string }[])
      .map(c => ({ row_index: c.row_index, col_index: c.col_index, content: c.content })),
  );

  const skillXp: Partial<Record<Skill, number>> = {};
  for (const s of SKILLS) skillXp[s] = 0;
  for (const row of stats as { skill: string; points: number }[]) {
    if ((SKILLS as readonly string[]).includes(row.skill)) {
      skillXp[row.skill as Skill] = Math.floor((row.points || 0) / 60); // XP = hours
    }
  }

  const taskHistory: TaskHistoryItem[] = [
    ...(tasks as { title: string; skill: string }[]).map(t => ({
      title: t.title, skill: t.skill, status: 'scheduled' as const,
    })),
    ...(completions as { task_title: string; skill: string; completed_date: string }[]).map(c => ({
      title: c.task_title, skill: c.skill, status: 'completed' as const,
      date: typeof c.completed_date === 'string' ? c.completed_date : new Date(c.completed_date).toISOString().slice(0, 10),
    })),
  ];

  const questHistory: QuestHistoryItem[] = (quests as { title: string; rank: string; status: string; source_pillar: string }[])
    .map(q => ({ title: q.title, rank: q.rank, status: q.status, sourcePillar: q.source_pillar }));

  return { hierarchy, skillXp, taskHistory, questHistory };
}

export type GenerationResult = {
  quest: GeneratedQuest;
  provider: 'gemini' | 'deterministic-fallback';
  model: string | null;
  failureCode: string | null;
};

// Run one provider call, validate, and fall back deterministically on any
// failure rather than spending more quota. `focus` pins this call to a specific
// pillar/sub-cell so a board of four covers different areas of the grid.
export async function runGeneration(rank: Rank, ctx: QuestContext, focus?: FocusTarget | null): Promise<GenerationResult> {
  const outcome = await generateQuestJson(
    SYSTEM_PROMPT,
    buildUserPrompt({ rank, hierarchy: ctx.hierarchy, skillXp: ctx.skillXp, taskHistory: ctx.taskHistory, questHistory: ctx.questHistory, focus }),
    responseSchema(),
  );

  if (outcome.ok) {
    const validated = validateQuest(outcome.data, rank, ctx.hierarchy, {
      taskHistory: ctx.taskHistory, questHistory: ctx.questHistory,
    });
    if (validated.ok) {
      return { quest: validated.quest, provider: 'gemini', model: outcome.model, failureCode: null };
    }
    // Model produced unusable output → deterministic fallback.
    return { quest: deterministicQuest(rank, ctx.hierarchy, ctx.skillXp, focus), provider: 'deterministic-fallback', model: outcome.model, failureCode: validated.reason };
  }

  // Provider failure → deterministic fallback (still gives the user a quest).
  return { quest: deterministicQuest(rank, ctx.hierarchy, ctx.skillXp, focus), provider: 'deterministic-fallback', model: null, failureCode: outcome.failureCode };
}

// Randomly seed each rank with a different pillar/sub-cell so a board covers
// varied areas of the grid (and a rescan explores new ones). Not forced — the
// generator treats it as a starting point.
export function assignFocus(ctx: QuestContext, ranks: readonly Rank[]): (FocusTarget | null)[] {
  const targets: FocusTarget[] = [];
  for (const p of ctx.hierarchy.pillars) {
    if (p.actions.length) for (const a of p.actions) targets.push({ pillar: p.name, sub: a.content });
    else targets.push({ pillar: p.name, sub: '' });
  }
  // Shuffle (Fisher–Yates) so picks are random each call.
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  return ranks.map((_, i) => (targets.length ? targets[i % targets.length] : null));
}

// Write a generated quest into its pre-claimed board row (status → 'offered').
export async function storeGeneratedQuest(
  userId: string,
  weekStart: string,
  version: number,
  result: GenerationResult,
): Promise<QuestRow> {
  const q = result.quest;
  const [saved] = await sql`
    UPDATE weekly_quests SET
      status = 'offered',
      title = ${q.title},
      flavor = '',
      instructions = ${q.objective},
      success_criteria = ${q.victoryCondition},
      rationale = '',
      skill_xp = ${JSON.stringify(q.skillXp)}::jsonb,
      duration_minutes = ${q.estHours * 60},
      est_hours = ${q.estHours},
      source_row_index = ${q.sourceRowIndex},
      source_col_index = ${q.sourceColIndex},
      source_pillar = ${q.targetPillar},
      target_sub_cell = ${q.targetSubCell},
      provider = ${result.provider},
      model = ${result.model},
      failure_code = ${result.failureCode},
      generated_at = NOW()
    WHERE user_id = ${userId} AND week_start = ${weekStart}::date AND version = ${version} AND rank = ${q.rank}
    RETURNING *
  ` as QuestRow[];
  return saved;
}

// Shape a DB row into the client payload (never leaks failure internals except
// a coarse provider flag).
export type QuestRow = {
  id: number;
  week_start: string;
  version: number;
  status: string;
  title: string;
  instructions: string;       // objective
  success_criteria: string;   // victory condition
  flavor: string;
  rank: string;
  skill_xp: Record<string, number>;
  est_hours: number;
  source_pillar: string;      // target pillar
  target_sub_cell: string;
  provider: string;
  completed_at: string | null;
};

export function shapeQuest(row: QuestRow) {
  const skillXp = row.skill_xp || {};
  const totalXp = Object.values(skillXp).reduce((n, v) => n + (Number(v) || 0), 0);
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    title: row.title,
    objective: row.instructions,
    victoryCondition: row.success_criteria,
    rank: row.rank,
    targetPillar: row.source_pillar || '',
    targetSubCell: row.target_sub_cell || '',
    skillXp,
    totalXp,
    estHours: row.est_hours || 0,
    isFallback: row.provider === 'deterministic-fallback',
    completedAt: row.completed_at,
  };
}
