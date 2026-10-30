# Original Projecta palette restored

31 October 2026, Asia/Baghdad.

The original brand colors are read from `f106622:src/design-system.css`:

| Token | Value |
| --- | --- |
| Navy text | `#0B1525` |
| Medical cyan/teal | `#0299B5` |
| Blue accent | `#1C4EE2` |
| Primary button gradient | `linear-gradient(110deg, #0097B5, #1B4BE3)` |
| Soft surface | `#F2F8FD` |
| Border | `#E2EDF7` |
| Focus ring | `#1698CB` |

The current screenshot-inspired layout aliases these shared Projecta tokens;
it no longer defines an independent mint/green or orange brand palette. Buttons,
feature icons, badges, selected filters, the resume uploader and mobile actions
use the original cyan/blue/navy colors. The existing large career-path section
uses a navy-to-cyan brand gradient. The original semantic WhatsApp/success colors
and unparsed-post warning colors retain their separate meanings.

This is a color alignment, not a rollback to the old commit. Current typography,
spacing, photo/overlay geometry, feature/pathway/about/contact sections and
navigation are preserved. No JSX, API, scraper, classification, auth, upload,
application, migration, dependency or admin implementation is replaced. Later
resume submission guards and source separation remain intact.

Validation includes a clean `npm ci`, 63 Node tests, 41 Python tests, a fresh Vite
build, responsive browser checks at 320–1680 px, actual computed brand-token and
button-gradient checks, category/saved/candidate/auth flows, and a local mocked
owner/resume submission regression. Read-only production checks confirmed the job,
application and resume schemas, the private 5 MiB Storage bucket, and both owners'
super-admin access/professional-verification bypass.

Only styles, the browser theme-color and this documentation change in this
release. No production data mutation or SQL migration is required.
