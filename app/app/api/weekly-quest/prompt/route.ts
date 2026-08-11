export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { initDB } from '@/lib/db';
import { buildFullBoardPrompt, gridReadiness } from '@/lib/weeklyQuest';
import { fetchContext } from '@/lib/weeklyQuestServer';

// Returns the ready-to-paste prompt (built from the user's current grid) for
// generating a full quest board in any external LLM.
export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await fetchContext(user.userId);
  const gridReady = gridReadiness(ctx.hierarchy);
  const prompt = buildFullBoardPrompt({
    hierarchy: ctx.hierarchy,
    skillXp: ctx.skillXp,
    taskHistory: ctx.taskHistory,
    questHistory: ctx.questHistory,
  });

  return NextResponse.json({ gridReady, prompt });
}
