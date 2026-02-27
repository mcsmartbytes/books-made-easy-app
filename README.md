# Books Made Easy

Professional accounting software for small businesses. Manage invoices, bills, customers, and vendors with ease.

**Live URL:** https://books-made-easy-app.vercel.app

## Features

### Core Accounting
- **Invoices (AR)** - Create, send, and track customer invoices
- **Bills (AP)** - Manage vendor bills and payments
- **Customers** - Customer database with contact info and history
- **Vendors** - Vendor management and payment tracking
- **Chart of Accounts** - Customizable account structure
- **Reports** - Financial reports and analytics

### Integrations
- **Expense Tracker** - Embedded Expenses Made Easy for expense management
- **Job Costing** - Embedded SiteSense for job/project costing

### Progressive Web App (PWA)
- Install on iOS and Android devices
- Offline support with service worker caching
- App shortcuts for quick access to common tasks
- Push notification ready

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 14 | React framework (App Router) |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Supabase | Database & Authentication |
| Vercel | Hosting & Deployment |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/mcsmartbytes/books-made-easy-app.git
cd books-made-easy-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
books_made_easy/
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   └── icons/              # App icons (72x72 to 512x512)
├── src/
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── dashboard/      # Main dashboard pages
│   │   │   ├── invoices/
│   │   │   ├── bills/
│   │   │   ├── customers/
│   │   │   ├── vendors/
│   │   │   ├── reports/
│   │   │   ├── expense-tracker/  # Expenses Made Easy integration
│   │   │   └── sitesense/        # SiteSense integration
│   │   ├── login/
│   │   └── signup/
│   ├── components/
│   │   └── DashboardLayout.tsx
│   └── lib/
│       └── supabase.ts
└── scripts/
    ├── generate-icons.js   # Generate PWA icon SVGs
    └── convert-to-png.js   # Convert SVGs to PNGs
```

## PWA Installation

### Android (Chrome)
1. Visit https://books-made-easy-app.vercel.app
2. Tap menu → "Install app" or "Add to Home screen"

### iOS (Safari only)
1. Visit https://books-made-easy-app.vercel.app in Safari
2. Tap Share → "Add to Home Screen"

### Desktop (Chrome/Edge)
1. Visit the site
2. Click install icon in address bar, or Menu → "Install Books Made Easy"

## Related Apps

| App | Description | URL |
|-----|-------------|-----|
| Expenses Made Easy | Business expense tracking with receipt OCR | https://expenses-made-easy-opal.vercel.app |
| SiteSense | Job costing and time tracking for contractors | https://sitesense-lilac.vercel.app |

## Scripts

```bash
# Development
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint
npm run lint

# Generate PWA icons
node scripts/generate-icons.js
node scripts/convert-to-png.js
```

## License

Private - All rights reserved
