# WorldMonitor Pro — Implementation Roadmap

## Current State
- **Landing page**: Complete (waitlist form, Turnstile, i18n, referral codes)
- **Convex**: Bare (registrations + counters only)
- **Auth**: None (no Clerk, no sessions)
- **Payments**: None (no Stripe)
- **Feature gating**: UI-only (no backend enforcement)
- **User dashboard**: None

---

## Phase 1: Authentication (Clerk)

### 1.1 — Clerk Setup & Convex Integration
- Install `@clerk/clerk-react` + `@clerk/clerk-js`
- Install `@clerk/backend` for Convex HTTP actions
- Configure Clerk application (sign-in methods: email, Google, GitHub)
- Set up Clerk webhook → Convex to sync user data
- Add `users` table to Convex schema (clerkId, email, name, plan, apiKey, createdAt)
- Environment variables: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`

### 1.2 — Auth UI Components
- Add `<ClerkProvider>` wrapper to app entry point
- Sign-in / Sign-up pages (or Clerk modal)
- User avatar + dropdown menu in navbar (sign out, account, billing)
- Protected route wrapper component
- Handle desktop (Tauri) vs web auth flow differences

### 1.3 — Migrate Waitlist Users
- Migration script: Convex `registrations` → `users` table
- Send "account ready" email to waitlisted users via Resend
- Preserve referral codes and referral counts
- Map existing `WORLDMONITOR_API_KEY` holders to Clerk users

### 1.4 — Session Management
- Clerk session tokens → Convex auth (`ctx.auth` in mutations/queries)
- Token refresh handling
- Desktop (Tauri): Clerk session persistence in keychain
- Rate limiting per authenticated user (not just IP)

---

## Phase 2: Convex Backend Expansion

### 2.1 — Core Schema Design
```
users:
  clerkId (string, indexed)
  email (string, indexed)
  name (string)
  plan: "free" | "pro" | "enterprise"
  stripeCustomerId (optional string)
  stripeSubscriptionId (optional string)
  apiKey (optional string, indexed)
  referralCode (string, indexed)
  referralCount (number)
  createdAt (number)
  updatedAt (number)

subscriptions:
  userId (Id<"users">, indexed)
  stripeSubscriptionId (string, indexed)
  plan: "pro" | "enterprise"
  status: "active" | "past_due" | "canceled" | "trialing"
  currentPeriodStart (number)
  currentPeriodEnd (number)
  cancelAtPeriodEnd (boolean)
  createdAt (number)

apiKeys:
  userId (Id<"users">, indexed)
  key (string, indexed)
  name (string)
  lastUsedAt (optional number)
  createdAt (number)
  revokedAt (optional number)

usage:
  userId (Id<"users">, indexed)
  date (string) — YYYY-MM-DD
  endpoint (string)
  count (number)
  // compound index: [userId, date]
```

### 2.2 — User CRUD Functions
- `users.getByClerkId` — query
- `users.getByApiKey` — query (for API auth)
- `users.create` — mutation (from Clerk webhook)
- `users.updatePlan` — mutation (from Stripe webhook)
- `users.generateApiKey` — mutation
- `users.revokeApiKey` — mutation

### 2.3 — Subscription Functions
- `subscriptions.getActive` — query by userId
- `subscriptions.create` — mutation (from Stripe webhook)
- `subscriptions.update` — mutation (status changes)
- `subscriptions.cancel` — mutation

### 2.4 — Usage Tracking Functions
- `usage.record` — mutation (increment daily counter per endpoint)
- `usage.getDaily` — query (for user dashboard)
- `usage.getMonthly` — query (for billing page)

---

## Phase 3: Payments (Stripe)

### 3.1 — Stripe Setup
- Create Stripe products & prices:
  - **Pro Monthly**: $X/mo
  - **Pro Annual**: $X/yr (discount)
  - **Enterprise**: custom/contact
- Install `stripe` SDK
- Environment variables: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`

### 3.2 — Checkout Flow
- Convex HTTP action: `createCheckoutSession` → returns Stripe Checkout URL
- Pricing page component with plan comparison
- Stripe Checkout redirect (hosted page — simpler than embedded)
- Success/cancel return URLs
- Handle existing free users upgrading

### 3.3 — Stripe Webhooks → Convex
- Convex HTTP endpoint: `/stripe-webhook`
- Handle events:
  - `checkout.session.completed` → create subscription, upgrade user plan
  - `invoice.paid` → renew subscription period
  - `invoice.payment_failed` → mark past_due, send warning email
  - `customer.subscription.updated` → sync status
  - `customer.subscription.deleted` → downgrade to free
- Webhook signature verification
- Idempotency handling

### 3.4 — Billing Management
- Customer portal link (Stripe hosted) for:
  - Update payment method
  - View invoices
  - Cancel subscription
  - Switch plans
- Convex query: get current plan + expiry

### 3.5 — Trial Period (Optional)
- 14-day free trial for Pro
- No credit card required for trial
- Trial expiry → email reminder via Resend
- Auto-downgrade on trial end

---

## Phase 4: Feature Gating (Backend Enforcement)

### 4.1 — Server-Side Plan Verification
- Middleware/wrapper for Vercel API routes: check API key → Convex user → plan
- Convex query: `users.getPlanByApiKey(key)` with caching
- Rate limits per plan tier:
  - Free: 100 req/day, 5 req/min
  - Pro: 10,000 req/day, 60 req/min
  - Enterprise: unlimited
- Return `403` with upgrade prompt for gated endpoints

### 4.2 — Client-Side Feature Flags
- Replace current `getSecretState('WORLDMONITOR_API_KEY')` checks with Clerk auth + plan query
- Convex `useQuery` for user plan in React context
- `<PlanGate plan="pro">` wrapper component
- Graceful degradation: show locked UI + upgrade CTA
- Sync plan state between web and desktop (Tauri)

### 4.3 — Panel/Layer Gating Refactor
- Update `panels.ts` premium flags to check user plan from context
- Map layer visibility tied to plan
- Locked panel modal → links to pricing page (not waitlist)
- "Upgrade to Pro" inline CTAs in locked features

### 4.4 — API Key Enforcement
- Validate API keys on every server request
- Key rotation support
- Key usage logging → `usage` table
- Desktop: store API key via Clerk session (not manual keychain)

---

## Phase 5: User Dashboard

### 5.1 — Account Page (`/account`)
- Profile: name, email (from Clerk)
- Current plan badge + expiry date
- API key management (generate, copy, revoke, regenerate)
- Usage stats (daily/monthly charts)
- Referral stats (code, count, rewards)

### 5.2 — Billing Page (`/account/billing`)
- Current plan details
- Next billing date + amount
- Payment method (last 4 digits)
- Invoice history (from Stripe)
- Upgrade/downgrade buttons
- Cancel subscription flow

### 5.3 — Settings Page (`/account/settings`)
- Notification preferences (email alerts, briefings)
- AI briefing schedule configuration
- Delivery channels (Slack, Telegram, Discord, WhatsApp, Email)
- Theme/language preferences
- Data export

### 5.4 — API Documentation Page (`/account/api`)
- Interactive API reference
- Endpoint list with plan requirements
- Code examples (curl, Python, JS)
- Rate limit info per plan
- Swagger/OpenAPI spec

---

## Phase 6: Pro Feature Implementation

### 6.1 — AI Analyst Briefings
- Scheduled AI-generated briefings (daily/weekly)
- Convex cron job → fetch latest data → LLM summary → store
- Delivery via configured channels (email, Slack, Telegram)
- Custom briefing topics per user
- Historical briefing archive

### 6.2 — Alerts & Notifications
- Custom alert rules (threshold-based, event-based)
- Real-time push via WebSocket or SSE
- Multi-channel delivery (email, push, Slack, Telegram, Discord)
- Alert history + acknowledgment
- Quiet hours / snooze

### 6.3 — Advanced Analytics (Pro-only panels)
- Equity research dashboard
- Geopolitical risk scoring with drill-down
- Economy analytics (macro indicators, forecasts)
- Supply chain disruption tracker
- Custom watchlists

### 6.4 — API Access
- REST API for all data sources
- WebSocket feeds for real-time data
- API key authentication
- SDKs (Python, JS/TS)
- Webhook delivery for events

---

## Phase 7: Enterprise Features

### 7.1 — Team Management
- Organization accounts
- Role-based access (admin, analyst, viewer)
- Invite flow + seat management
- Shared dashboards & watchlists
- Audit log

### 7.2 — Enterprise Integrations
- SSO (SAML, OIDC via Clerk)
- Custom API rate limits
- Dedicated support channel
- On-premise deployment option
- Custom data feeds

### 7.3 — TV/Display Mode
- Full-screen dashboard for wall displays
- Auto-rotating panels
- Custom layouts
- Branding options

---

## GitHub Issues Breakdown

### Epic: Authentication
| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 1 | Set up Clerk with Convex integration | `auth`, `backend`, `infra` | P0 |
| 2 | Auth UI: sign-in/sign-up components + protected routes | `auth`, `frontend` | P0 |
| 3 | Migrate waitlist registrations to users table | `auth`, `migration` | P1 |
| 4 | Desktop (Tauri) auth flow with Clerk | `auth`, `desktop` | P1 |
| 5 | Rate limiting per authenticated user | `auth`, `backend` | P2 |

### Epic: Convex Backend
| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 6 | Design & implement users/subscriptions/apiKeys/usage schema | `backend`, `convex` | P0 |
| 7 | User CRUD mutations & queries | `backend`, `convex` | P0 |
| 8 | API key generation, validation & revocation | `backend`, `convex` | P1 |
| 9 | Usage tracking & daily counters | `backend`, `convex` | P2 |

### Epic: Payments
| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 10 | Stripe products & prices setup | `payments`, `infra` | P0 |
| 11 | Checkout flow: Convex HTTP action → Stripe Checkout | `payments`, `backend` | P0 |
| 12 | Stripe webhook handler in Convex | `payments`, `backend` | P0 |
| 13 | Pricing page component | `payments`, `frontend` | P1 |
| 14 | Billing management via Stripe Customer Portal | `payments`, `frontend` | P1 |
| 15 | Free trial implementation (14-day) | `payments`, `backend` | P2 |

### Epic: Feature Gating
| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 16 | Server-side plan verification middleware | `gating`, `backend` | P0 |
| 17 | Client-side PlanGate component + plan context | `gating`, `frontend` | P0 |
| 18 | Refactor panel/layer premium flags to use plan context | `gating`, `frontend` | P1 |
| 19 | Plan-based rate limiting per API endpoint | `gating`, `backend` | P1 |

### Epic: User Dashboard
| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 20 | Account page: profile, plan, API keys | `dashboard`, `frontend` | P1 |
| 21 | Billing page: invoices, plan management | `dashboard`, `frontend` | P1 |
| 22 | Usage stats dashboard with charts | `dashboard`, `frontend` | P2 |
| 23 | API documentation page | `dashboard`, `frontend`, `docs` | P2 |
| 24 | Settings: notifications, delivery channels, preferences | `dashboard`, `frontend` | P2 |

### Epic: Pro Features
| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 25 | AI briefing engine: scheduled summaries via LLM | `pro-feature`, `backend` | P1 |
| 26 | Multi-channel delivery (email, Slack, Telegram, Discord) | `pro-feature`, `backend` | P1 |
| 27 | Custom alert rules + real-time notifications | `pro-feature`, `fullstack` | P2 |
| 28 | Advanced analytics panels (equity, macro, supply chain) | `pro-feature`, `frontend` | P2 |
| 29 | REST API + WebSocket feeds for pro data access | `pro-feature`, `backend` | P2 |

### Epic: Enterprise
| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 30 | Organization accounts + team management | `enterprise`, `fullstack` | P3 |
| 31 | Role-based access control | `enterprise`, `backend` | P3 |
| 32 | SSO integration (SAML/OIDC via Clerk) | `enterprise`, `auth` | P3 |
| 33 | TV/display mode with auto-rotating panels | `enterprise`, `frontend` | P3 |

---

## Recommended Implementation Order

```
Phase 1 (Auth)          ████████░░  ~2 weeks
Phase 2 (Convex)        ████████░░  ~2 weeks (parallel with Phase 1)
Phase 3 (Payments)      ██████████  ~2 weeks
Phase 4 (Gating)        ██████░░░░  ~1 week
Phase 5 (Dashboard)     ████████░░  ~2 weeks
Phase 6 (Pro Features)  ██████████  ~4 weeks
Phase 7 (Enterprise)    ██████████  ~4 weeks (future)
```

**Critical path**: Auth (P1) → Schema (P2) → Payments (P3) → Gating (P4) → Dashboard (P5)

Phases 1 & 2 can run in parallel. Phase 6 features can be incrementally added after Phase 4.
