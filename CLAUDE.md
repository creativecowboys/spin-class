# SPIN CLASS — Project Instructions

SPIN CLASS is Dave's fitness web app for himself and friends. Joke name — there are no bikes; the app owns this with dry humor. Bold dark theme: bg #0b0b0f, electric lime accent #ccff00, pink-red #ff3d71, cyan #00e0ff. Tone: energetic gym-buddy, minimal emoji.

## Live URLs
- App: https://spinclass.app (domain registered at Hostinger, A record @ → 216.150.1.1 → Vercel)
- Admin console: https://spinclass.app/admin.html (gated by ADMIN_KEY env var; only Dave has the password)
- Legacy URL (still serves): spin-class-orcin.vercel.app — browser data is per-URL, so members should use spinclass.app only

## Stack & repo
- GitHub: creativecowboys/spin-class → Vercel project "spin-class" (team Creative Cowboys), auto-deploys on commit to main
- No build step, no framework. Files:
  - `index.html` — the entire app (single file: HTML+CSS+JS, ~80KB). Embedded: 366-exercise library (EXDB const, from Dave's "Gym Exercise Database.xlsx") and the PPL Strength A/B 7-day program (PROGRAM)
  - `admin.html` — admin console (member viewer/editor, program builder, per-member schedule assignment). Has its own EXDB + DEFPROG copies embedded
  - `api/chat.js` — Claude coach proxy (model claude-sonnet-5, Anthropic Messages API, coach system prompt; never gives supplement/peptide dosing advice — reminders only)
  - `api/sync.js` — device-state sync (GET ?id= / POST {id, state}) plus name+PIN account lookup (GET ?name=&pin= → matches list; accounts with no S.pin are claimable by name alone; 403 wrong pin / 404 no match). Device IDs are random 24-hex secrets generated at onboarding
  - `api/community.js` — team feed + crew chat (GET ?id= requires a valid member id; returns per-member name/streak/recent-workout summaries + shared chat log — never weights, meals, stack, coach chats, PINs, or device ids; members are identified by a sha256-derived 12-char key). POST {id, text} appends a chat message (last 100 kept in `config/teamchat.json`, NOT in member state, to avoid last-write-wins clobbering; sender name resolved server-side). POST {id, delAt} deletes one of the caller's own messages (server checks the message's key matches the caller)
  - `api/users.js`, `api/admin-user.js` (PUT/DELETE), `api/program.js` (GET public, PUT admin) — admin endpoints check `x-admin-key` header against ADMIN_KEY env
  - `package.json` (@vercel/blob, type:module), `vercel.json` (cleanUrls)
- Storage: Vercel Blob store "spin-class-blob" (public access; paths `users/<id>.json`, `config/program.json`; cacheControlMaxAge 0)
- Env vars on Vercel: ANTHROPIC_API_KEY (Dave's platform.claude.com account — separate billing from his Claude sub, spend cap set), ADMIN_KEY, BLOB_READ_WRITE_TOKEN + BLOB_STORE_ID (from store connection)

## Deploy workflow ("like our other workflows")
1. Edit the local working copy, verify JS with `node --check` on the extracted <script>
2. Copy to `index.html`
3. Upload via GitHub web UI (github.com/creativecowboys/spin-class → Add file → Upload; same filename overwrites) using the Claude-in-Chrome browser tools — Dave's browser is logged in
4. Vercel auto-deploys in ~30–60s; verify on spinclass.app (env var changes need a manual Redeploy)

## App architecture notes
- All state in one object `S`, persisted to localStorage key "forge" (legacy name), synced to server: debounced POST on every save + sync on open. On load, pulls master program and replaces whole local state if server copy is >2s newer (last-write-wins; admin pushes rely on this)
- Bottom nav has 5 tabs: Home, Train, Team, Coach, Profile. Meals and Stack are sections inside the Profile tab (no tabs of their own); the header avatar also opens Profile. Name/targets/PIN editing + the weight-trend chart live in the profile modal ("Edit Profile" button / `openModal('profile')`)
- Features: 4-step onboarding (name, weight/goal, cal+protein targets, fresh-vs-demo); meals (full CRUD: day navigator ‹Today› in the Profile tab, add/edit/delete any meal on any date, tracks cal/protein/carbs/fats); weight trend chart (inline SVG); PPL program with live workout mode (per-set weight×reps, last-weight prefill, volume totals, add/swap exercises from library); week calendar (S.schedule ISO-date→program-day-index, tap-to-assign, auto-fill Mon–Sun); finished workouts reopenable/editable in place; Team area ("Team This Week" card on home with Mon–Sun training dots, full Team tab with a Chat|Crew segmented toggle — Chat is default and full-page (input pinned at bottom), Crew is the reverse-chron workout-summary feed — summary only, no set detail; chat polls every 25s while the tab is visible; the home "Team This Week" card opens straight to the Crew view; weight trend chart lives in the profile modal, not home); peptide/supplement "Stack" scheduler (reminder-only — never suggest compounds or doses, disclaimer in UI); Claude coach chat (persists last 60 msgs in S.chat; falls back to canned coachReply() when API unavailable; chats synced but deliberately NOT shown in admin)
- Admin: members list (workout logs w/ set detail, meals, weights, stack), profile edit + delete, master Program Builder (push replaces for everyone via config/program.json), per-member week schedule assignment ("Push Schedule" PUTs member state)

## Login / account recovery (added Jul 2026)
- Name + 4-digit PIN (stored as `S.pin`, plain text in state — friends-scale trust model). New members pick a PIN at onboarding step 1; "Been here before? Log back in" on the welcome screen restores an account onto any device/URL (covers old-URL migration and cleared browser data)
- Legacy accounts (no PIN yet) can be claimed by name alone once; after restore the profile modal auto-opens to set a PIN, and a home-screen banner nudges existing members until they set one
- Multiple same-name matches → member picks by workout count + last-active date
- Admin console profile editor shows/resets each member's PIN (blank = none, re-enables claim-by-name)

## Known gaps / next up
- Last-write-wins sync can clobber concurrent edits (admin push vs member mid-workout)
- Wishlist: rest timer between sets, per-person programs, PWA manifest/icon

## Conventions
- Keep everything single-file where possible; no frameworks, no localStorage assumptions beyond try/catch wrapper
- Dave pastes all secrets himself (API keys, ADMIN_KEY) — never handle credential values
- Escape all user-entered strings with esc() when rendering
