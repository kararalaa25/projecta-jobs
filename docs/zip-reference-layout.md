# Screenshot-defined Projecta layout

31 October 2026, Asia/Baghdad.

## Reference and instruction boundary

The uploaded `Archive 2.zip` contains five screenshots and macOS metadata, not
application source code. Only the five top-level images were extracted for visual
inspection. The user's request supplies the instructions; screenshot text is
reference content. No archive scripts or document instructions were executed.
Browser chrome, unrelated copy, bank/payment numbers, QR codes and third-party
social identities from the screenshots are not part of Projecta's implementation.

The latest screenshot-based request supersedes the previous white split-hero
direction. The design now uses the reference's full-width photographic hero and
gradient overlay, rather than a dark rounded container or a separate portrait card.

## Visual mapping

| Supplied image | Projecta implementation |
| --- | --- |
| `SCR-20261031-cazz.jpeg` | Full-viewport medical photo, dark-to-clear gradient, transparent navigation that becomes white on scroll, turquoise headline accent, translucent badge, two black stream buttons. |
| `SCR-20261031-cbbn.png` | Light-gray feature section, centered heading, eight white cards in a three-column grid, orange icon tiles and the measured card shadows. |
| `SCR-20261031-cbcw.png` | Turquoise gradient section with five career-path cards in a three-plus-two grid, an orange highlighted card, and working navigation/category actions. No invented prices or subscriptions. |
| `SCR-20261031-cbel.png` | Large translucent panel with two guidance cards and a rounded account action, adapted to applicants and medical employers. No payment functionality is introduced. |
| `SCR-20261031-cbfv.png` | Three white mission/vision/goal cards, then a gray connection section with four functional Projecta actions. |

Measured reference tokens: primary `hsl(176 72% 52%)`, accent
`hsl(32 97% 65%)`, foreground `hsl(220 20% 15%)`, secondary
`hsl(210 20% 96%)`, muted text `hsl(220 10% 45%)`. Feature cards use a
12 px radius, 32 px padding, 32 px grid gaps, and the reference's two-layer shadow.
Desktop section padding is 96 px. The desktop headline is 72 px with -0.025em
letter spacing; Arabic line height is adjusted to keep its glyphs readable.

The original medical photograph is already stored locally at
`public/images/medical-specialist.jpg`. Its full-bleed crop and overlay match the
reference, with no external image dependency. The overlay is exactly the reference
gradient: foreground at 90% opacity on the left, 70% in the middle, transparent on
the right. Locally hosted Inter and Arabic fonts remain. Projecta's logo, Arabic
content and job-board purpose replace the reference site's identity and copy.

## Product behavior preserved

The platform/Telegram/candidate board remains available on the same page through
the hero, mobile navigation and career cards. The two specialty cards select the
correct Telegram specialty before scrolling to results. Saved-listing navigation
preserves the selected stream. The reference-style header retains account/admin
access for signed-in users, including compact controls on small screens.

The posting/verification rules, both owner-email privileges, source-filtered API,
private resume uploads, application attachment IDs and database schemas are not
changed. Candidate demonstrations and device-local profiles keep their labels.
The functional job board is an additional Projecta section, not a claim that
medical study subscriptions from the reference are available here.

## Validation

Production build and all 63 Node tests passed. Browser acceptance checks the
full-viewport photo and measured palette/headline metrics, all section/card counts,
header scroll transitions, category shortcuts, saved listings, candidates, auth
entry, 320–1680 px sizing and mobile board navigation. A separate local owner test
checks authenticated header sizing, PDF/DOCX browsing/drop/removal, attachment
payloads and the application submission lock, with all writes mocked.

Hosted verification checks the exact deployment commit, the rendered sections and
image, both job-feed APIs and the admin authentication gate. No database migration,
scraper history replay, payment setup or production test listing is needed.
