import { NextRequest, NextResponse } from 'next/server';
import { execSql } from '@/lib/turso';

export const dynamic = 'force-dynamic';

function generateId(): string {
  return crypto.randomUUID();
}

// GET /api/cost-codes/budgets?job_id=xxx&user_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const jobId = searchParams.get('job_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    let sql = `
      SELECT ccb.*, cc.code, cc.division, cc.name as cost_code_name, cc.description as cost_code_description
      FROM cost_code_budgets ccb
      JOIN cost_codes cc ON cc.id = ccb.cost_code_id
      WHERE ccb.user_id = ?
    `;
    const args: (string | number)[] = [userId];

    if (jobId) {
      sql += ' AND ccb.job_id = ?';
      args.push(jobId);
    }

    sql += ' ORDER BY cc.code ASC';
    const data = await execSql(sql, args);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching cost code budgets:', error);
    return NextResponse.json({ error: 'Failed to fetch cost code budgets' }, { status: 500 });
  }
}

// POST /api/cost-codes/budgets - Create or update budget for a cost code on a job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, job_id, cost_code_id, budget_amount, notes } = body;

    if (!user_id || !job_id || !cost_code_id || budget_amount === undefined) {
      return NextResponse.json({ error: 'user_id, job_id, cost_code_id, and budget_amount are required' }, { status: 400 });
    }

    // Upsert - update if exists, insert if not
    const existing = await execSql(
      'SELECT id FROM cost_code_budgets WHERE job_id = ? AND cost_code_id = ?',
      [job_id, cost_code_id]
    );

    let id: string;
    if (existing.length > 0) {
      id = String((existing[0] as any).id);
      await execSql(
        `UPDATE cost_code_budgets SET budget_amount = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
        [budget_amount, notes || null, id]
      );
    } else {
      id = generateId();
      await execSql(
        `INSERT INTO cost_code_budgets (id, user_id, job_id, cost_code_id, budget_amount, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, user_id, job_id, cost_code_id, budget_amount, notes || null]
      );
    }

    const data = await execSql(
      `SELECT ccb.*, cc.code, cc.division, cc.name as cost_code_name
       FROM cost_code_budgets ccb
       JOIN cost_codes cc ON cc.id = ccb.cost_code_id
       WHERE ccb.id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error saving cost code budget:', error);
    return NextResponse.json({ error: 'Failed to save cost code budget' }, { status: 500 });
  }
}

// DELETE /api/cost-codes/budgets?id=xxx
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    await execSql('DELETE FROM cost_code_budgets WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cost code budget:', error);
    return NextResponse.json({ error: 'Failed to delete cost code budget' }, { status: 500 });
  }
}
