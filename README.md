# PepsHub

Thai-first local MVP for PEPS LIVE: schedule, live-event discovery, event-first Photo Match, and an admin workspace for creating and publishing events.

## Run locally

```bash
npm install
npm run dev
```

The default app is intentionally local-first. Seed content is in `src/data.ts` and event edits persist in browser `localStorage` under `pepshub-state-v1`.

## Photo Match flow

Photo Match now starts with a published Photo Event index. Each event shows its upload state (`ลงรูปแล้ว`, `ลงรูปบางส่วน`, or `ยังไม่มีรูป`) and total image count. Selecting an event opens the team search workspace shown in the product reference, with counts scoped to that event.

The admin workspace includes `คู่แข่งขันและรูป`, where an administrator adds one matchup such as `ทีม A VS ทีม C` inside a specific Photo Event. Each pair contains exactly two teams and owns its Google Drive and/or Google Photos links. New team names can be typed directly into the matchup form; only the compact team records needed for that matchup are created. Only HTTPS links on Google domains are accepted. The public page only shows the pair name and a short `ดูรูปเต็มได้ที่นี่` action; raw URLs are never shown to customers.

Photo Match is pair-first: customers choose a Photo Event, then search/select a numbered match pair. It displays at most the first six synchronized preview assets for that pair. The full Drive folder or Google Photos album remains available through the short source-link action, so the customer does not have to load the entire album inside the hub. Pair sources carry `syncMode` and `syncStatus` metadata so a backend scheduler can refresh the preview manifest without changing the public UI.

The seed data includes the supplied Google Drive folder and Google Photos album on the first demo pair. The six Drive preview URLs were verified as publicly readable image responses. The Photos link is stored and opens the album, but its public-album thumbnails are not treated as stable unauthenticated API media URLs; production automatic refresh therefore needs an OAuth-backed server adapter.

The admin workspace is split into tabs: `ภาพรวม`, `งานและอีเว้น`, `ตารางงาน`, and `คู่แข่งขันและรูป`. This keeps the event form, schedule editor, and matchup/source workflow separate so the administrator does not need to scroll through one long page. Schedule controls use constrained grid columns and responsive stacking so datetime fields stay inside their card.

`สร้างงานใหม่` accepts either a local Cover upload or a direct HTTPS image URL. It also requires start and end times. `SCHEDULE BOARD` provides a separate schedule view/editor so an administrator can correct an event's start/end time without recreating the event.

The local MVP deliberately keeps the source adapter boundary separate from the UI. A pasted private folder/album link is not enough for a browser to enumerate or download private media: the production adapter needs OAuth consent, token storage, and a server-side sync job. A public Drive file can be converted to a preview URL by the local adapter, but folder listing still needs the Drive API.

Quality gates:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Firebase boundary

The static production site is deployed to Firebase Hosting project `my-project-1531149704307`, using the dedicated Hosting site `pepshub`. No private Firebase credential is stored in this checkout. The local implementation remains usable without credentials, while the Firebase data boundary is prepared in:

- `.env.example` — public web-config placeholders
- `firebase.json` — Auth, Firestore, Storage, and emulator ports
- `firestore.rules` — published-only public reads and custom-claim admin writes
- `storage.rules` — published-only reads and admin-only image uploads under 5 MB
- `emulator/seed-data.json` — minimal representative local seed

Start the emulator only when the Firebase CLI is available:

```bash
npm run firebase:emulators
# in another terminal
npm run firebase:seed
```

Before moving admin data from localStorage to production, register PepsHub as a separate Web App in the same Firebase project, configure Authentication and the `admin: true` custom claim, add a real data adapter, then run rules tests against the emulator. Sharing the existing project is acceptable only if its quotas, billing, and data ownership are acceptable for PepsHub; the existing PepsLive app and its data must remain isolated. No production private credential is committed.

## Production photo integration checklist

Before implementing the production sync, provide:

- Firebase project ID and the public Firebase Web App config (`apiKey`, `authDomain`, `storageBucket`, `messagingSenderId`, `appId`)
- GitHub repository URL and the branch to commit to
- Google Cloud project ID for the photo integration, or confirmation that it will be created under the same project
- The intended Google Drive folders / Google Photos albums and whether the owner will authorize them with OAuth
- The desired sync behavior: manual sync, scheduled sync, or webhook/queue-based sync

Do not send a service-account JSON key in chat. Google Drive access requires OAuth/scopes appropriate to the chosen read operation, and Google Photos Library access is OAuth-based; the current Library API is focused on media created by the app and does not support service accounts. Use a secret manager or a local `.env` file for any private credentials.
