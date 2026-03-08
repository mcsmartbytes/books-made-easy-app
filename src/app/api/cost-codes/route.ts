import { NextRequest, NextResponse } from 'next/server';
import { execSql } from '@/lib/turso';

export const dynamic = 'force-dynamic';

// Default CSI MasterFormat divisions
const CSI_DIVISIONS = [
  { code: '01', name: 'General Requirements', description: 'Project overhead, temporary facilities, cleanup' },
  { code: '02', name: 'Existing Conditions', description: 'Demolition, hazmat abatement, site assessment' },
  { code: '03', name: 'Concrete', description: 'Formwork, reinforcement, cast-in-place, precast' },
  { code: '04', name: 'Masonry', description: 'Unit masonry, stone, tile' },
  { code: '05', name: 'Metals', description: 'Structural steel, metal fabrications, railings' },
  { code: '06', name: 'Wood, Plastics & Composites', description: 'Rough carpentry, finish carpentry, millwork' },
  { code: '07', name: 'Thermal & Moisture Protection', description: 'Insulation, roofing, waterproofing, sealants' },
  { code: '08', name: 'Openings', description: 'Doors, windows, hardware, glazing' },
  { code: '09', name: 'Finishes', description: 'Drywall, tile, flooring, painting, acoustical' },
  { code: '10', name: 'Specialties', description: 'Signage, lockers, partitions, fire extinguishers' },
  { code: '11', name: 'Equipment', description: 'Kitchen, laundry, parking, loading dock' },
  { code: '12', name: 'Furnishings', description: 'Casework, window treatments, furniture' },
  { code: '13', name: 'Special Construction', description: 'Pre-engineered structures, pools, ice rinks' },
  { code: '14', name: 'Conveying Equipment', description: 'Elevators, escalators, lifts' },
  { code: '21', name: 'Fire Suppression', description: 'Sprinkler systems, standpipes, fire pumps' },
  { code: '22', name: 'Plumbing', description: 'Piping, fixtures, water heaters, drainage' },
  { code: '23', name: 'HVAC', description: 'Ductwork, boilers, chillers, air handling' },
  { code: '26', name: 'Electrical', description: 'Wiring, panels, lighting, generators' },
  { code: '27', name: 'Communications', description: 'Data, telecom, audio/video' },
  { code: '28', name: 'Electronic Safety & Security', description: 'Fire alarm, access control, surveillance' },
  { code: '31', name: 'Earthwork', description: 'Excavation, grading, soil stabilization' },
  { code: '32', name: 'Exterior Improvements', description: 'Paving, landscaping, fencing, irrigation' },
  { code: '33', name: 'Utilities', description: 'Water, sewer, gas, electrical distribution' },
];

function generateId(): string {
  return crypto.randomUUID();
}

// GET /api/cost-codes - List cost codes
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const division = searchParams.get('division');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    let sql = 'SELECT * FROM cost_codes WHERE (is_default = 1 OR user_id = ?)';
    const args: (string | number)[] = [userId];

    if (division) {
      sql += ' AND division = ?';
      args.push(division);
    }

    sql += ' ORDER BY code ASC';
    const data = await execSql(sql, args);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching cost codes:', error);
    return NextResponse.json({ error: 'Failed to fetch cost codes' }, { status: 500 });
  }
}

// POST /api/cost-codes - Create custom cost code or seed defaults
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Seed defaults
    if (body.action === 'seed') {
      const userId = body.user_id;
      if (!userId) {
        return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
      }

      // Check if defaults already exist
      const existing = await execSql('SELECT COUNT(*) as cnt FROM cost_codes WHERE is_default = 1');
      if (Number((existing[0] as any)?.cnt) > 0) {
        return NextResponse.json({ success: true, message: 'Default cost codes already exist', seeded: false });
      }

      for (const div of CSI_DIVISIONS) {
        await execSql(
          `INSERT INTO cost_codes (id, code, division, name, description, level, is_default)
           VALUES (?, ?, ?, ?, ?, 1, 1)`,
          [generateId(), div.code, div.code, div.name, div.description]
        );
      }

      return NextResponse.json({ success: true, message: `Seeded ${CSI_DIVISIONS.length} CSI divisions`, seeded: true });
    }

    // Create custom cost code
    const { user_id, code, division, name, description, parent_code, level } = body;

    if (!user_id || !code || !division || !name) {
      return NextResponse.json({ error: 'user_id, code, division, and name are required' }, { status: 400 });
    }

    const id = generateId();
    await execSql(
      `INSERT INTO cost_codes (id, user_id, code, division, name, description, parent_code, level, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, user_id, code, division, name, description || null, parent_code || null, level || 2]
    );

    const data = await execSql('SELECT * FROM cost_codes WHERE id = ?', [id]);
    return NextResponse.json({ success: true, data: data[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating cost code:', error);
    return NextResponse.json({ error: 'Failed to create cost code' }, { status: 500 });
  }
}

// PUT /api/cost-codes - Update custom cost code
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const check = await execSql('SELECT is_default FROM cost_codes WHERE id = ?', [id]);
    if (check.length === 0) {
      return NextResponse.json({ error: 'Cost code not found' }, { status: 404 });
    }
    if (Number((check[0] as any).is_default)) {
      return NextResponse.json({ error: 'Cannot edit default cost codes' }, { status: 400 });
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const key of ['code', 'division', 'name', 'description', 'parent_code', 'level']) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    await execSql(`UPDATE cost_codes SET ${fields.join(', ')} WHERE id = ?`, values);

    const data = await execSql('SELECT * FROM cost_codes WHERE id = ?', [id]);
    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating cost code:', error);
    return NextResponse.json({ error: 'Failed to update cost code' }, { status: 500 });
  }
}

// DELETE /api/cost-codes?id=xxx
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    const check = await execSql('SELECT is_default FROM cost_codes WHERE id = ?', [id]);
    if (check.length > 0 && Number((check[0] as any).is_default)) {
      return NextResponse.json({ error: 'Cannot delete default cost codes' }, { status: 400 });
    }

    await execSql('DELETE FROM cost_codes WHERE id = ? AND is_default = 0', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cost code:', error);
    return NextResponse.json({ error: 'Failed to delete cost code' }, { status: 500 });
  }
}
