import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cells = await sql`
    SELECT row_index, col_index, content, cell_type
    FROM grid_cells
    WHERE user_id = ${user.userId}
    ORDER BY row_index, col_index
  `;

  return NextResponse.json({ cells });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { row_index, col_index, content, cell_type } = await req.json();

  await sql`
    INSERT INTO grid_cells (user_id, row_index, col_index, content, cell_type)
    VALUES (${user.userId}, ${row_index}, ${col_index}, ${content}, ${cell_type || 'task'})
    ON CONFLICT (user_id, row_index, col_index)
    DO UPDATE SET content = ${content}, cell_type = ${cell_type || 'task'}, updated_at = NOW()
  `;

  return NextResponse.json({ success: true });
}

