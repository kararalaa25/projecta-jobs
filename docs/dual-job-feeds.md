# Platform offers and Telegram job feed

Release date: 31 October 2026 (Asia/Baghdad).

## Source contract

- **وظائف المنصة** displays only `source = 'manual'` offers with a title,
  description, nonempty salary text, recognized Iraqi governorate and valid Iraqi
  contact phone. User publication already enforces these fields server-side;
  admin creation/editing of direct offers now enforces them too.
- **وظائف التليجرام / Telegram Job Feed** displays only `source = 'telegram'`.
  Imported posts are explicitly labelled and retain their original-source links
  and phone/WhatsApp/Telegram actions. Applications through the platform are shown
  on direct offers; imported listings use their source's contact methods.
- Candidate profiles remain a separate tab with the existing clearly labelled
  examples/device-local behavior. Legacy device-local job offers cannot appear
  as published platform offers.
- Editing an imported listing in admin preserves its Telegram source even after
  its content is reviewed. Review does not turn it into a direct clinic posting.

## Public API and UI filtering

`/api/jobs?feed=platform` filters active manual rows in SQL before offset pagination
and excludes incomplete direct offers from the response. `?feed=telegram` filters
active Telegram rows before pagination. Invalid feed values return 400. `feed=all`
and the existing default remain available for backward-compatible API consumers;
the UI explicitly requests the selected feed and independently enforces source
membership when rendering. Pagination continuation uses the database page size,
so a page containing incomplete direct offers cannot truncate later valid rows.

Each feed has independent loading/error state. Telegram has visible specialty,
governorate and employment dropdowns on both desktop and mobile. The sidebar uses
the same filter values. Unknown specialties use **غير مصنّف**; unknown locations
and work schedules are selectable instead of silently assuming Baghdad/full-time.
Switching away from Telegram clears Telegram-only unknown filter values. Search,
saved listings, sorting and the existing governorate/specialty filters still apply.
If there are no direct offers, the main board explains this and links to Telegram.

## Parsing and storage

The existing Gemini JSON/hybrid parser continues to categorize incoming posts,
with conservative shared role rules, all 18 governorates and regex fallback.
Explicit full-time/part-time text is now captured in parsed records, raw fallback
metadata and unchanged-post enrichment. Conflicting or absent schedule evidence
stays unknown. Specialty categories retain the existing physicians category in
addition to dentists, pharmacists, reps, assistants and secretaries/admin.

Older Telegram records also receive conservative display-time specialty/location/
schedule matching, so their filters work without rewriting their raw content.
The schema's historical `full_time` default is not treated as evidence when the
import metadata does not specify a schedule. Raw records remain visibly unverified.
No salary, address, phone or company is invented to satisfy the direct-offer rules.

No SQL migration is required: existing `source`, `contact_info`, role, city and
employment fields already support the separation. No production rows are deleted,
relabelled as manual, or bulk reclassified. This release does not activate draft
migration 010 or change Storage/authentication policies. It does not start a new
scraping schedule or replay history; the updated scraper is used on its next run.

## Verification

Unit coverage checks source isolation, incomplete-offer exclusion, source-scoped
pagination, invalid feed parameters, all governorate aliases, unknown-role handling,
work-schedule evidence and admin source preservation. Browser acceptance uses
mixed-source fixtures to verify combined specialty/location/schedule filters,
the unsorted view, candidate/tab switching, contact actions, RTL and mobile sizing.
Read-only API checks against the existing production database confirm both source
queries work. Hosted release checks must verify the exact Git release identifier,
both API feeds, the live Telegram tab and admin authentication protection.
