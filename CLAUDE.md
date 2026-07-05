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
  - `api/sync.js` — device-state sync (GET ?id= / POST {id, state}); no login — device IDs are random 24-hex secrets generated at onboarding
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
- Features: 4-step onboarding (name, weight/goal, cal+protein targets, fresh-vs-demo); meals (date-scoped daily totals); weight trend chart (inline SVG); PPL program with live workout mode (per-set weight×reps, last-weight prefill, volume totals, add/swap exercises from library); week calendar (S.schedule ISO-date→program-day-index, tap-to-assign, auto-fill Mon–Sun); finished workouts reopenable/editable in place; peptide/supplement "Stack" scheduler (reminder-only — never suggest compounds or doses, disclaimer in UI); Claude coach chat (persists last 60 msgs in S.chat; falls back to canned coachReply() when API unavailable; chats synced but deliberately NOT shown in admin)
- Admin: members list (workout logs w/ set detail, meals, weights, stack), profile edit + delete, master Program Builder (push replaces for everyone via config/program.json), per-member week schedule assignment ("Push Schedule" PUTs member state)

## Known gaps / next up
- No real logins (Dave deferred) — device-ID only; clearing browser data orphans the server copy
- Last-write-wins sync can clobber concurrent edits (admin push vs member mid-workout)
- Wishlist: rest timer between sets, per-person programs, old-URL→spinclass.app data migration, PWA manifest/icon

## Conventions
- Keep everything single-file where possible; no frameworks, no localStorage assumptions beyond try/catch wrapper
- Dave pastes all secrets himself (API keys, ADMIN_KEY) — never handle credential values
- Escape all user-entered strings with esc() when rendering
