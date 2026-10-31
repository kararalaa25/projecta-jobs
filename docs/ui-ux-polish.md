# UI/UX polish

31 October 2026, Asia/Baghdad.

Preserves the latest original Projecta navy/cyan/blue theme and landing layout
from `6379b1a`.

- Both feeds load in parallel. Search filters cached client data immediately,
  keeps the query when switching feeds, and shows matching counts on both tabs.
  Matching supports Arabic diacritics/alef variants, case-insensitive English,
  multiple words, specialties and governorates. Search text is indexed separately
  from keystrokes; changing tabs or typing does not refetch the feeds.
- Specialty badges use teal, emerald, indigo, amber and neutral pastel pairs on
  cards and filters. All five measured text/background pairs exceed 4.5:1.
- Global smooth anchor scrolling respects reduced-motion preferences.
- At 850px and below, header links and account/post actions move into an RTL
  drawer. It locks background scrolling, makes background content inert, traps
  keyboard focus, closes on Escape/backdrop/selection/desktop resize, and restores
  focus without interrupting anchor navigation.
- Search and saved-job empty states have distinct icons, Arabic guidance and
  recovery actions. Saved results span loaded feeds and local candidate profiles.
- Existing feature, mission and connect cards gain brand borders, soft elevated
  shadows and a 4px hover lift. Icons scale and tint; tooltips support pointer and
  keyboard focus. Navbar/footer links have animated underlines. Reduced motion
  disables transitions and decorative animations.

Validation: `npm ci`, `npm run build`, `npm test` (66 passing), and
`git diff --check`. This repository uses JavaScript/JSX and has no TypeScript
configuration or TypeScript sources to type-check.

Chromium checks covered instant matching in both feeds, absence of search/tab
refetches, clear filters, badge contrast, save/unsave and empty recovery, hover
lift, keyboard tooltips, drawer focus trapping/Escape/restoration, drawer-to-account
handoff, smooth anchors, reduced motion and no uncaught browser errors. Responsive
widths: 320, 375, 390, 680, 768, 850, 1024 and 1440px, without horizontal overflow.
Deterministic browser checks used synthetic API fixtures; separate read-only live
API checks returned HTTP 200 for both feeds (no direct platform jobs, a 200-row
Telegram page with more available). No production listing or account was changed
for validation.
