import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { parseCSV, parseAmount, normalizeDate } from '@/lib/csvParser';

export const dynamic = 'force-dynamic';

// POST /api/bank-transactions/import - Import bank transactions from CSV
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('user_id') as string;
    const bankAccountId = formData.get('bank_account_id') as string;
    const mappingStr = formData.get('mapping') as string;

    if (!file || !userId || !bankAccountId) {
      return NextResponse.json({ error: 'file, user_id, and bank_account_id are required' }, { status: 400 });
    }

    const csvText = await file.text();
    const { headers, rows, detectedMapping } = parseCSV(csvText);

    // Use provided mapping or detected mapping
    const mapping = mappingStr ? JSON.parse(mappingStr) : detectedMapping;

    if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit)) {
      return NextResponse.json({
        error: 'Could not detect required columns (date, description, amount). Please provide column mapping.',
        headers,
        detectedMapping,
        sampleRows: rows.slice(0, 5),
      }, { status: 422 });
    }

    const importId = crypto.randomUUID();
    const transactions = [];
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const dateStr = normalizeDate(row[mapping.date] || '');
      const description = row[mapping.description] || '';

      if (!dateStr || !description) {
        skipped++;
        continue;
      }

      let amount: number;
      let type: 'debit' | 'credit';

      if (mapping.amount) {
        // Single amount column (negative = debit, positive = credit)
        amount = parseAmount(row[mapping.amount]);
        type = amount < 0 ? 'debit' : 'credit';
        amount = Math.abs(amount);
      } else {
        // Separate debit/credit columns
        const debitAmount = mapping.debit ? parseAmount(row[mapping.debit]) : 0;
        const creditAmount = mapping.credit ? parseAmount(row[mapping.credit]) : 0;
        if (debitAmount > 0) {
          amount = debitAmount;
          type = 'debit';
        } else if (creditAmount > 0) {
          amount = creditAmount;
          type = 'credit';
        } else {
          skipped++;
          continue;
        }
      }

      transactions.push({
        user_id: userId,
        bank_account_id: bankAccountId,
        date: dateStr,
        description,
        amount,
        type,
        payee: description,
        reference: mapping.reference ? row[mapping.reference] || null : null,
        check_number: mapping.checkNumber ? row[mapping.checkNumber] || null : null,
        memo: null,
        status: 'unreviewed',
        import_id: importId,
      });
      imported++;
    }

    // Batch insert transactions
    if (transactions.length > 0) {
      // Insert in batches of 50 to avoid query size limits
      for (let i = 0; i < transactions.length; i += 50) {
        const batch = transactions.slice(i, i + 50);
        const { error } = await supabaseAdmin
          .from('bank_transactions')
          .insert(batch);

        if (error) throw error;
      }

      // Update bank account balance based on imported transactions
      const netChange = transactions.reduce((sum, t) => {
        return sum + (t.type === 'credit' ? t.amount : -t.amount);
      }, 0);

      const { data: account } = await supabaseAdmin
        .from('bank_accounts')
        .select('current_balance')
        .eq('id', bankAccountId)
        .single();

      if (account) {
        await supabaseAdmin
          .from('bank_accounts')
          .update({ current_balance: (Number(account.current_balance) || 0) + netChange })
          .eq('id', bankAccountId);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        import_id: importId,
        imported,
        skipped,
        total: rows.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error importing bank transactions:', error);
    return NextResponse.json({ error: 'Failed to import bank transactions' }, { status: 500 });
  }
}
