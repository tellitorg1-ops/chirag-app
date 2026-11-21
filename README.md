# Leader IQ.in

React + Vite + Supabase command platform for private political organizations and businesses. Includes five-stage leadership, ground/digital execution, Hazri, daily diaries, independently verified points, social analytics, rewards, and mandatory notifications.

## Run

```sh
npm ci
npm run dev
npm run build
npm test
npm run test:browser
```

Copy `.env.example` to `.env` for a new installation. Use only the Supabase project URL, publishable/anon key, and **public** VAPID key in the frontend. Never expose service-role, VAPID private, YouTube or AI secrets as `VITE_*` values.

Browser tests use Edge, mock Supabase responses and never send OTPs, submit live proofs, or message real members. SQL integration tests execute the migrations in PGlite (real PostgreSQL WASM) with Supabase auth/storage stubs. They cover tenant separation, reporting scopes, direct joining, profile gates, administrative roles, stage moves, forged/self approvals, duplicate awards, shift ownership, private proof storage, social-channel ownership, period boundaries and reward sealing.

## Routes and modules

| Route | Function |
| --- | --- |
| `/` | Political Parties / Business or Brand choice |
| `/login` | Indian mobile OTP login and verification |
| `/organizations` | Required basic profile, direct joining and assignment waiting screen |
| `/platform` | Separate Admin / Super Admin dashboards: parties, pending members, assignments, global roles and audit |
| `/home` | Role-specific command dashboard and personal progress |
| `/hazri` | Morning, daytime, evening or active shift; server-recorded check-in/out |
| `/diary` | Work, proof, linked shift, timestamps and ground pulse |
| `/tasks` | Assignments, evidence submission, feedback and task lifecycle |
| `/content` | Campaign directives, content assets and linked execution tasks |
| `/reviews` | Independent leadership verification and point awards |
| `/hierarchy` | People, teams, reporting lines, stage movement and audit |
| `/leaderboard` | Daily, weekly, monthly and four-month rankings/rewards |
| `/analytics` | Social links, ownership review and server YouTube synchronization |
| `/notifications` | Mandatory in-app notification center |
| `/broadcast` | Messages to the caller's authorized reporting scope |
| `/profile` | Organization-specific personal details; no Aadhaar collection |

Active frontend implementation is in `src/command/`; `src/pages/Content.jsx` is activated in the router. Old unscoped pages and browser-side scoring/AI integrations were removed. Routes are lazy-loaded. Desktop navigation switches to a sidebar at 1024px; smaller screens have bottom quick actions and a navigation drawer.

## Access model

- Super Admins are stored in cmd_platform_admins; Admins are stored in cmd_admins. User metadata cannot grant roles.
- Eight dashboards: Super Admin, Admin, Main Leader, Subordinate Leader, District Leader, Team Leader, Ground Karyakarta and Social Media Karyakarta.
- Admins sit outside the five-stage hierarchy (stage is null), skip basic profiles and do not enter competition rankings. Super Admin can promote any registered user, demote administrators, and assign Admins to parties. The last Super Admin cannot be removed.
- Anyone can join after mobile OTP, with required name, district and area; photo is optional. No invitation is required. Party membership and leadership cannot be self-selected. Users wait for an authorized administrator to assign their party, stage, reporting leader and Ground/Social work type.
- Initial privileged mobile numbers are stored server-side and matched only to verified auth phone records. These grants are consumed once, so a later demotion is not undone at login.
- A person can have party-scoped memberships; administrators only manage their assigned parties. Admins can create parties. Super Admin has all-party access.
- Assignment and role changes are audited. Active sessions refresh account assignments every 10 seconds; server permissions apply immediately on the next request.
- Leadership reads its reporting subtree. Organization administrators can manage their entire organization. Ordinary members read their own operational records. Organization leaderboards intentionally expose a limited member summary within that organization.
- Database RLS, composite foreign keys and transactional RPC validation enforce isolation independently of the UI. Client queries and query-cache keys include organization and authenticated user.
- Client writes go through `cmd_execute`. The internal privileged dispatcher is in the non-exposed `command_private` schema, checks `auth.uid()` and authorizes every action. Clients cannot insert points, modify roles, approve their own proofs, edit audit logs or read push capability URLs/server configuration.
- Photos use the private `command-proofs` bucket. Ownership paths include organization/user IDs; view URLs expire after two minutes.

## Scoring and cycles

The immutable `cmd_ledger` records separate `task`, `diary`, `hazri` and `social` entries. Analytics never overwrites earned ground points.

Default rules (explicit product choices, change SQL and UI together if the program changes):

- Task: configured by leadership, 1–1000 points, awarded once after independent proof verification.
- Diary: 10 points per verified submission day, capped at one daily award.
- Hazri: 5 points per workday after a linked proof is verified and its closed shift is between five minutes and sixteen hours. Verification may happen before or after checkout.
- Social: first verified YouTube sync establishes a baseline. Subsequent growth earns one point per 100 new views plus one per subscriber, capped at 100 social points per IST day. Five-minute sync interval; a channel cannot earn for two members in the same organization.
- Grades per selected timeframe: Sparsh 0, Sankalp 250, Uday 1000, Ojas 2500, Tejas 5000.
- All period boundaries are Asia/Kolkata. Weeks start Monday; months are calendar months. Four-month cycles are anchored to the organization's creation-month reward anchor.
- Points enter the reward cycle when verified/awarded. Users cannot backdate earnings. Exact next-grade points and data-derived pending-proof/streak prompts are displayed.
- Monthly and four-month rewards go to the top three positive-point ranks, including ties. Administrators finalize only closed cycles. `cmd_reward_cycles` seals each result so later membership changes cannot alter finalized rewards.

## Supabase deployment

The connected project is `amtymjposqvtztjwwwjg`. The five SQL migrations in `supabase/migrations/` are already applied there and their filenames match the remote history. **Do not run those files manually again on this project.** Use a new migration for future changes.

For a fresh project, apply the migrations in chronological order, then add the intended existing Auth user to `cmd_platform_admins` through the SQL editor/admin connection. There is deliberately no public self-promotion/bootstrap endpoint. Log in as that administrator to create an organization.

The existing project was migrated into **Political Workspace**: four existing members, eight active tasks, and one existing platform Super Admin. The two previous admins retain organization-management access. The platform administrator can rename the workspace through Organization name & rewards. No real campaign announcements were sent during development.

Legacy rows remain in their original tables. Browser access to those unscoped tables/functions was revoked. Existing social links and notifications were copied; social links require independent ownership verification. Old Aadhaar/profile-photo buckets are private and archived. Historical unverified scores remain archived rather than being converted into new verified reward points. The new verified ledger starts empty.

Deploy `supabase/functions/command-youtube` and `supabase/functions/command-push`, including their `_shared` dependencies. Both are already deployed and active on the connected project. Gateway JWT verification is off because each function implements its own authentication:

- `command-youtube`: verifies the user's JWT with `auth.getUser()`, checks membership/account via RLS, then uses a service client for validated analytics ingestion.
- `command-push`: accepts only the dedicated dispatcher bearer secret; never callable with an ordinary user's token.

YouTube and Web Push settings are stored in `command_private.runtime_settings` (RLS, no client table access or executable RPC). Only service-role code can read `cmd_runtime_settings()`. Edge environment secrets can override the corresponding fields: `YOUTUBE_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_DISPATCH_SECRET`. `PROJECT_URL` supplies the scheduler endpoint. Do not log or expose this configuration.

`supabase/operations/schedule_push.sql` is installed on the connected project: `leader-iq-push-dispatch` runs every minute using pg_cron and pg_net. Credentials are fetched privately at execution time, not embedded in the job. The scheduler was verified returning HTTP 200 with an empty queue.

## Notifications and PWA

`public/sw.js` handles push and opens organization selection on notification clicks. It does not cache authenticated pages or API responses. Notifications contain a generic lock-screen update; full work details remain behind login.

The app offers an Allow flow and a persistent, non-dismissable settings prompt when permission is blocked, unsupported, or device registration is incomplete. There is no in-app mute toggle. On iPhone/iPad, use Add to Home Screen and open the installed app. Browser/OS permission must still be granted by the user; the app cannot override it.

Notifications and outbox entries are committed together. The dispatcher claims batches with row locks, rechecks active membership/organization, retries failures with backoff, and removes expired subscriptions. After eight unsuccessful attempts a job remains inspectable in the outbox for administrator intervention. Delivery is at least once; notification tags deduplicate the displayed alert. Signing out removes the local device subscription.

## Validation and remaining deployment steps

- Production build and 19 SQL/domain tests pass.
- Desktop/mobile browser coverage includes no horizontal overflow, role-aware screens, Hazri/Diary submission, timeframe controls and leadership attendance/ground-pulse reports.
- Live database checks confirmed all command tables have RLS, legacy profile reads are denied to clients, and clients cannot write the ledger or execute private configuration retrieval.
- Both deployed functions reject unauthenticated calls with HTTP 401. The configured YouTube API key passed a public channel lookup.
- Supabase schema security advisor findings were resolved. The project's pre-existing [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled; this application uses mobile OTP, not a password flow.
- A real user's SMS OTP round trip, independently verified channel sync, and a push received on that user's device still require their login/device permission. Browser tests use fixtures; they are not evidence of those external delivery steps.
- Frontend is available locally with `npm run dev`; public hosting/domain deployment is not configured by this change. Deploy `dist/` to the chosen static host with an SPA fallback to `/index.html`, HTTPS and the production environment's public keys. Redeploy any previously hosted frontend before using the migrated backend; the old unscoped client is intentionally incompatible with the new access model.

No git commit or push was made automatically. Generated test screenshots/results, temporary MCP request files, dependency cache and secrets are excluded from Git.
