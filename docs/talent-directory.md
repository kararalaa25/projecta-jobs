# Medical talent directory — local phase

`/talent` is a lazy-loaded directory linked from the main navigation, mobile
menu and contact section. It uses the Projecta navy/cyan palette and the existing
specialty and trust UI components.

## Directory and profile flow

- Instant search covers names, headline, qualifications, expertise and Iraqi
  governorate aliases. Search terms combine with AND.
- Filters cover all 18 governorates, all six specialties, availability status and
  full-time / part-time / shift preferences. Filter state is reflected in the URL.
- Availability, experience and name sorting are supported. Cards render in groups
  of 24, with further results available through “عرض المزيد من الكفاءات”.
- Each card shows declared qualifications, expertise, experience, availability,
  work preferences, CV availability and direct contact options.
- “أضف ملفك” creates a device-local profile. Local profiles can be edited and
  deleted; deletion removes their attached CV in the same transaction.
- Existing candidate entries in `projecta-listings` are read as legacy local
  profiles. Private server resume URLs and arbitrary verification fields are
  never imported into this directory.

Eight fictional demo profiles are labeled on every card. Demo contact buttons
are inactive and the CV control opens a clearly labeled example résumé.
Demo visibility can be toggled; the preference is retained in the URL.
The directory does not claim these are real registered job seekers.

## Local CVs and contact actions

Profiles and CVs use separate stores in the browser's `projecta-talent-local-v1`
IndexedDB database. Saving a profile and an attached file uses one transaction.
Persistence is specific to this browser and origin; it is not cross-device or
public storage. Clearing browser storage removes local files.

Uploads accept PDF only, at most 5 MiB, with filename, MIME and PDF-header checks.
Replacing a file that fails validation leaves the original profile/CV intact.
The original file remains available for download.

The PDF.js renderer and worker load only when an uploaded PDF is opened. They
render local file bytes to canvas, with page navigation, zoom/fit controls and
screen-reader text. No résumé bytes are uploaded or sent to an external viewer.
Preview-only object URLs are revoked on close. Password-protected or unsupported
PDFs keep the download fallback with a clear message.

Phone links use validated Iraqi `tel:` numbers. WhatsApp links are generated only
when the profile explicitly enables WhatsApp for that number. Demo files never
contain actionable phone numbers. Clinical qualifications are marked as declared;
local profiles cannot grant themselves the earlier trust system's verified badge.

## Validation

```sh
npm test
npm run build
npm audit --audit-level=high
```

Local browser checks cover instant search, combined filters, empty/reset states,
profile creation, CV persistence after reload, actual PDF page rendering and
download, invalid replacement preservation, contact URLs, object URL cleanup,
deleting both profile and CV, and six responsive widths. They also check the
existing trust UI and block external requests.

The PDF compatibility renderer has a separate on-demand chunk larger than Vite's
standard chunk advisory size. It and its worker are excluded from the initial
directory/feed bundle.

No production talent API, public CV access, Supabase migration or deployment is
introduced by this local phase. A future public directory needs explicit profile
publication/consent, authenticated ownership, private CV access rules and trusted
verification enrichment before enabling shared data.
