# Profile and credential trust UI (local implementation)

The reusable `VerifiedBadge`, `VerificationStatus`, `CredentialBadges`,
`SpecialtyBadge` and `ProfileIdentity` components cover profile headers,
job publishers and talent cards. Six pastel identities cover Dentistry,
Pharmacy, Nursing / Clinical Support, Medical Representatives, General
Practitioners and Clinic Operations. Unknown specialties retain a neutral tint.

## Trust data contract

`config/profile-trust.js` reads only administrator-controlled `app_metadata`.
An account also needs a confirmed identity and must not be suspended.

- `medical_professional_verified: true` enables the professional badge, unless
  `verification_status` is `pending` or `rejected`.
- `profile_kind` can identify `doctor`, `dentist`, `pharmacist`, `nurse`,
  `medical_rep`, `clinic_operations`, `clinic`, `medical_center` or `professional`.
- `professional_specialty` can hold a canonical catalog role for the specialty
  label. The broad Assistants & Techs category does not imply a nursing license.
- Clinics and centers require **separate** `organization_verified: true` approval;
  `organization_verification_status` can suppress it during review/rejection.
- `verified_credentials` has independent literal boolean flags:
  `syndicate_membership`, `certified_specialist`, and `facility_license`.
  The first two apply to professionals; the last applies to facilities.

Submitting a license, a self-written profile, confirmed email, publishing
permission or owner/admin privileges alone does not grant a medical badge.
No new approvals, certification claims or database columns are created here.
Existing accounts without separate credential approvals show no credential chips.

## Listing enrichment

The read-only `/api/profile-trust?ids=<up to 24 job UUIDs>` endpoint resolves only
requested active listings. It reads ownership internally, deduplicates publisher
lookups and limits concurrency to four, within a six-second request budget.
It returns only job IDs and an allowlisted verification summary. Emails,
account IDs, license numbers/documents and private review states are excluded.
Public summaries are uncached; the original `/api/jobs` path is unchanged.

`useJobTrust` enriches visible cards separately from their initial feed load,
refreshes every visible minute and on focus/reconnection, and cancels work on
unmount/filter changes. Lookup failures remove stale badges and leave cards
visible. The check denotes the publisher account's approval, not validation of
every statement or employer name in an advertisement.

Telegram posts, example profiles and device-local talent cards cannot acquire
verification from imported text or local storage. The talent card component is
ready to display verified server-backed profiles; the current talent feed
contains example and device-local profiles, so those keep explicit labels.

## Local validation

```sh
npm test
npm run build
```

Browser fixtures exercise verified professionals, facilities, pending profiles,
credential isolation, approval revocation, failure fallback, samples, specialty
contrast, RTL layouts and six viewport widths. All external requests are blocked
or mocked. No deployment, database migration or production mutation is needed
for these checks.
