# Nestlink

> A modern housing society management platform for iOS, Android, and Web — your society's digital backbone.

## What is Nestlink?

Nestlink is a full-stack housing society management platform similar to MyGate, ADDA, and NoBrokerHood. It connects residents, society admins, security guards, domestic staff, and vendors in one unified ecosystem.

## MVP Features

| # | Feature | Description |
|---|---|---|
| 1 | **Resident Onboarding** | Phone OTP signup, flat linkage, family & vehicle registration |
| 2 | **Visitor Management** | Pre-approve visitors, generate QR/OTP pass, real-time arrival alerts |
| 3 | **Security Guard App** | Scan QR, verify OTP, log check-in/out, package & vehicle management |
| 4 | **Notices & Announcements** | Society-wide broadcasts with push notifications |
| 5 | **Complaint Management** | Raise tickets with photos, track status, SLA monitoring |
| 6 | **Maintenance Billing** | Monthly invoices, Razorpay payments, PDF receipts |
| 7 | **Amenity Booking** | Real-time slot booking for clubhouse, pool, party hall |
| 8 | **Domestic Staff Management** | Add staff, QR badge, daily attendance tracking |
| 9 | **Push Notifications** | Expo Push (mobile) + Web Push (browser) |
| 10 | **Admin Dashboard** | Resident management, analytics, bulk invoice generation |

## Tech Stack

- **Mobile**: Expo 52 (React Native) + Expo Router + NativeWind — iOS & Android
- **Web**: React 18 + Vite + TailwindCSS + shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- **Payments**: Razorpay
- **Monorepo**: Turborepo + pnpm workspaces
- **State**: Zustand + TanStack Query v5

## Project Structure

```
nestlink/
├── apps/
│   ├── web/               # React + Vite — Admin & Resident web portal
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── auth/           # Login (phone OTP)
│   │       │   ├── admin/          # Dashboard, residents, complaints, invoices, amenities, guards
│   │       │   ├── resident/       # Home, visitors, payments, complaints, notices, amenities, staff
│   │       │   └── guard/          # OTP verification portal
│   │       ├── components/
│   │       │   ├── ui/             # shadcn/ui components (Button, Card, Dialog, etc.)
│   │       │   ├── layout/         # Sidebar, AppLayout
│   │       │   └── shared/         # StatCard, PageHeader, StatusBadge
│   │       ├── hooks/              # useAuth
│   │       ├── store/              # Zustand auth store
│   │       └── lib/                # Supabase client, utils
│   └── mobile/            # Expo React Native — iOS + Android
│       └── app/
│           ├── auth/               # Login screen (phone OTP)
│           ├── resident/           # Home, visitors, complaints, payments, notices, amenities, staff
│           ├── guard/              # OTP scanner (text + QR)
│           └── admin/              # Dashboard, residents, complaints, notices
├── packages/
│   ├── core/              # Shared Zod schemas, TypeScript types, utility functions
│   └── supabase/          # Supabase client singleton + DB types
├── supabase/
│   ├── migrations/        # SQL migration files (schema + RLS + seed data)
│   └── functions/         # Edge Functions (Razorpay, QR pass, push notifications, OTP verify)
├── turbo.json
├── pnpm-workspace.yaml
└── ARCHITECTURE.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+ (via `corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Expo CLI (`npx expo`)

### 1. Clone and Install

```bash
git clone https://github.com/arunkumar6545/nestlink.git
cd nestlink
corepack enable
pnpm install
```

### 2. Set Up Supabase

```bash
# Start local Supabase (requires Docker)
supabase start

# Run migrations
supabase db push

# Note the local Supabase URL and anon key printed by supabase start
```

### 3. Configure Environment Variables

```bash
# Web app
cp apps/web/.env.example apps/web/.env.local
# Edit with your Supabase URL, anon key, and Razorpay key

# Mobile app
cp apps/mobile/.env.example apps/mobile/.env.local
# Edit with your Supabase URL, anon key, and Razorpay key
```

### 4. Run the Apps

```bash
# Run web app (http://localhost:3000)
pnpm --filter web dev

# Run mobile app
pnpm --filter mobile start

# Run all apps simultaneously
pnpm dev
```

### 5. Deploy Supabase Edge Functions

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy razorpay-webhook
supabase functions deploy generate-visitor-pass
supabase functions deploy send-push-notification
supabase functions deploy verify-visitor-otp
```

## Environment Variables

### Web (`apps/web/.env.local`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

### Mobile (`apps/mobile/.env.local`)
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

### Supabase Edge Functions (set via `supabase secrets set`)
```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@nestlink.in
EXPO_ACCESS_TOKEN=your-expo-access-token
```

## User Roles

| Role | Web Access | Mobile Access |
|---|---|---|
| `admin` | `/admin/*` (full dashboard) | Admin tabs |
| `resident` | `/resident/*` (resident portal) | Resident tabs |
| `guard` | `/guard` (OTP verifier) | Guard scanner |

## Building for Production

```bash
# Build web app
pnpm --filter web build

# Build mobile apps (requires Expo EAS account)
cd apps/mobile
npx eas build --platform ios
npx eas build --platform android

# Deploy web to Vercel
cd apps/web && npx vercel --prod
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full architecture plan including:
- Database schema
- Supabase Edge Functions
- Feature module breakdown
- Implementation phases
- Data flow diagrams

## License

MIT
