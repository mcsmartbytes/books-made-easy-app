import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Get user from auth header or body
    const body = await request.json().catch(() => ({}));
    const userId = body.user_id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'user_id required in request body' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Seed Customers
    const customers = [
      { user_id: userId, name: 'ABC Construction', email: 'billing@abcconstruction.com', phone: '(555) 123-4567', company: 'ABC Construction LLC', address: '123 Main St', city: 'Denver', state: 'CO', zip: '80202', balance: 2500.00 },
      { user_id: userId, name: 'Smith & Associates', email: 'accounts@smithassoc.com', phone: '(555) 234-5678', company: 'Smith & Associates', address: '456 Oak Ave', city: 'Boulder', state: 'CO', zip: '80301', balance: 1250.00 },
      { user_id: userId, name: 'Metro Properties', email: 'pay@metroproperties.com', phone: '(555) 345-6789', company: 'Metro Properties Inc', address: '789 Pine St', city: 'Aurora', state: 'CO', zip: '80012', balance: 0 },
      { user_id: userId, name: 'Johnson Enterprises', email: 'ap@johnsonent.com', phone: '(555) 456-7890', company: 'Johnson Enterprises', address: '321 Elm Dr', city: 'Lakewood', state: 'CO', zip: '80226', balance: 5000.00 },
      { user_id: userId, name: 'Sunrise Retail', email: 'finance@sunriseretail.com', phone: '(555) 567-8901', company: 'Sunrise Retail Corp', address: '654 Maple Ln', city: 'Centennial', state: 'CO', zip: '80112', balance: 750.00 },
    ];

    const { data: customerData } = await supabase.from('customers').insert(customers).select();

    // Seed Vendors
    const vendors = [
      { user_id: userId, name: 'Office Depot', email: 'orders@officedepot.com', phone: '(800) 463-3768', company: 'Office Depot Inc', address: '6600 N Military Trail', city: 'Boca Raton', state: 'FL', zip: '33496', balance: 450.00 },
      { user_id: userId, name: 'City Utilities', email: 'business@cityutil.com', phone: '(555) 999-1234', company: 'City Utilities Dept', address: '100 City Center', city: 'Denver', state: 'CO', zip: '80202', balance: 320.00 },
      { user_id: userId, name: 'Tech Solutions', email: 'billing@techsolutions.com', phone: '(555) 888-2345', company: 'Tech Solutions LLC', address: '500 Tech Blvd', city: 'Austin', state: 'TX', zip: '78701', balance: 1200.00 },
    ];

    await supabase.from('vendors').insert(vendors);

    // Seed Invoices
    if (customerData && customerData.length > 0) {
      const invoices = [
        { user_id: userId, customer_id: customerData[0].id, invoice_number: 'INV-001', status: 'sent', subtotal: 2500, tax_rate: 8, tax_amount: 200, total: 2700, amount_paid: 0, balance_due: 2700, issue_date: '2024-01-15', due_date: '2024-02-15', notes: 'Construction consulting services' },
        { user_id: userId, customer_id: customerData[1].id, invoice_number: 'INV-002', status: 'paid', subtotal: 1250, tax_rate: 8, tax_amount: 100, total: 1350, amount_paid: 1350, balance_due: 0, issue_date: '2024-01-10', due_date: '2024-02-10', notes: 'Professional services - January' },
        { user_id: userId, customer_id: customerData[2].id, invoice_number: 'INV-003', status: 'draft', subtotal: 3500, tax_rate: 8, tax_amount: 280, total: 3780, amount_paid: 0, balance_due: 3780, issue_date: '2024-01-20', due_date: '2024-02-20', notes: 'Property management services' },
        { user_id: userId, customer_id: customerData[3].id, invoice_number: 'INV-004', status: 'overdue', subtotal: 5000, tax_rate: 8, tax_amount: 400, total: 5400, amount_paid: 0, balance_due: 5400, issue_date: '2023-12-01', due_date: '2024-01-01', notes: 'Enterprise software license' },
        { user_id: userId, customer_id: customerData[4].id, invoice_number: 'INV-005', status: 'sent', subtotal: 750, tax_rate: 8, tax_amount: 60, total: 810, amount_paid: 0, balance_due: 810, issue_date: '2024-01-18', due_date: '2024-02-18', notes: 'Retail consulting' },
      ];

      const { data: invoiceData } = await supabase.from('invoices').insert(invoices).select();

      // Seed Invoice Items
      if (invoiceData) {
        const invoiceItems = [
          { invoice_id: invoiceData[0].id, description: 'Construction consulting - 10 hours', quantity: 10, rate: 250, amount: 2500 },
          { invoice_id: invoiceData[1].id, description: 'Professional services - January', quantity: 1, rate: 1250, amount: 1250 },
          { invoice_id: invoiceData[2].id, description: 'Property management fee', quantity: 1, rate: 2500, amount: 2500 },
          { invoice_id: invoiceData[2].id, description: 'Maintenance coordination', quantity: 1, rate: 1000, amount: 1000 },
          { invoice_id: invoiceData[3].id, description: 'Enterprise license - Annual', quantity: 1, rate: 5000, amount: 5000 },
          { invoice_id: invoiceData[4].id, description: 'Retail consulting - 3 hours', quantity: 3, rate: 250, amount: 750 },
        ];

        await supabase.from('invoice_items').insert(invoiceItems);
      }
    }

    // Seed Jobs
    const jobs = [
      { user_id: userId, name: 'Office Renovation Project', description: 'Complete office renovation for ABC Construction', status: 'in_progress', estimated_revenue: 15000, actual_revenue: 5000, estimated_cost: 8000, actual_cost: 3500 },
      { user_id: userId, name: 'Website Redesign', description: 'Full website redesign for Smith & Associates', status: 'completed', estimated_revenue: 8000, actual_revenue: 8500, estimated_cost: 4000, actual_cost: 3800 },
      { user_id: userId, name: 'Property Assessment', description: 'Full property assessment for Metro Properties', status: 'pending', estimated_revenue: 3500, actual_revenue: 0, estimated_cost: 1500, actual_cost: 0 },
    ];

    await supabase.from('jobs').insert(jobs);

    return NextResponse.json({
      success: true,
      message: 'Demo data seeded successfully',
      data: {
        customers: customers.length,
        vendors: vendors.length,
        invoices: 5,
        jobs: jobs.length,
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Seed error:', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint with { "user_id": "your-user-id" } to seed demo data',
    warning: 'This will add sample customers, vendors, invoices, and jobs',
  });
}
