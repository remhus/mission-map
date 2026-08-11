// ---------------------------------------------------------------------------
// Server-side orchestration for weekly quests: fetch authoritative context for
// a user, run generation (Gemini → validate → deterministic fallback), and
// shape rows for the client. DB access lives here; pure logic in weeklyQuest.ts.
// ---------------------------------------------------------------------------

import sql from './db';
import { generateQuestJson } from './gemini';
import {
  buildHierarchy, buildUserPrompt, deterministicQuest, gridReadiness,
  responseSchema, SYSTEM_PROMPT, validateQuest, SKILLS,
  type GeneratedQuest, type MandalaHierarchy, type Rank, type Skill,
  type TaskHistoryItem, type QuestHistoryItem,
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
// failure rather than spending more quota.
export async function runGeneration(rank: Rank, ctx: QuestContext): Promise<GenerationResult> {
  const readiness = gridReadiness(ctx.hierarchy);
  // Caller guarantees not 'empty'. goal-only is allowed (conservative quest).

  const outcome = await generateQuestJson(
    SYSTEM_PROMPT,
    buildUserPrompt({ rank, hierarchy: ctx.hierarchy, skillXp: ctx.skillXp, taskHistory: ctx.taskHistory, questHistory: ctx.questHistory }),
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
    return { quest: deterministicQuest(rank, ctx.hierarchy, ctx.skillXp), provider: 'deterministic-fallback', model: outcome.model, failureCode: validated.reason };
  }

  // Provider failure → deterministic fallback (still gives the user a quest).
  if (readiness === 'empty') {
    // Should be blocked upstream, but guard anyway.
    return { quest: deterministicQuest(rank, ctx.hierarchy, ctx.skillXp), provider: 'deterministic-fallback', model: null, failureCode: outcome.failureCode };
  }
  return { quest: deterministicQuest(rank, ctx.hierarchy, ctx.skillXp), provider: 'deterministic-fallback', model: null, failureCode: outcome.failureCode };
}

// Shape a DB row into the client payload (never leaks failure internals except
// a coarse provider flag).
export type QuestRow = {
  id: number;
  week_start: string;
  version: number;
  status: string;
  title: string;
  instructions: string;
  success_criteria: string;
  rationale: string;
  rank: string;
  skill_xp: Record<string, number>;
  duration_minutes: number;
  source_pillar: string;
  provider: string;
  completed_at: string | null;
};

export function shapeQuest(row: QuestRow) {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    title: row.title,
    instructions: row.instructions,
    successCriteria: row.success_criteria,
    rationale: row.rationale,
    rank: row.rank,
    skillXp: row.skill_xp,
    durationMinutes: row.duration_minutes,
    sourcePillar: row.source_pillar,
    isFallback: row.provider === 'deterministic-fallback',
    completedAt: row.completed_at,
  };
}
