# Staging acceptance — private resumes and medical targeting

Date: 30 October 2026 (Asia/Baghdad). The owner's “Continue” approved proceeding with the staging phase. Production deployment, production migrations, migration 010 and the 541-row backfill remain outside this approval.

## Environment and safety boundary

This acceptance run used actual official self-hosted Supabase Auth, Storage and PostgREST services with PostgreSQL. It was not a mocked Storage test and not a hosted/production Supabase project. Service images are pinned by digest in `scripts/staging/images.json`.

- All services were on a Docker `--internal` network, with no host ports exposed.
- Fresh credentials and JWT signing keys were generated specifically for each test run. They were not copied from the project's environment.
- Only the required code/dependency directories were mounted read-only. The production `.env`, Telegram sessions, Git metadata and ingestion outbox were not mounted.
- Accounts and resumes were synthetic. The two owner email addresses were reproduced only as local test identities; no production session was impersonated and no email/SMS was sent.
- The gateway harness mirrors Supabase Kong routing/CORS. Actual hosted gateway versions and settings still need release smoke checks; this run does not establish a hosted uptime SLA.
- Migrations 007 (existing baseline), 008 and 009 were applied only inside the disposable local database. Migration 010 was not applied.
- The one-shot runner removed all labelled containers, local volumes, the internal network and generated credential files after completion.

## Reproduce

Docker must be available. Run from the repository root after `npm ci`:

```sh
npm run test:staging:local
```

This invokes the Python-standard-library runner, starts the digest-pinned images, waits for both Auth and Storage initialization, applies the local schema, runs `tests/integration/local-storage.mjs` and always cleans up. It refuses to overwrite an existing staging state. Use `python3 scripts/staging/stop.py` only to remove this project's labelled disposable staging resources after an interrupted test. It does not prune unrelated Docker resources.

In a managed cloud environment, keep the configured Docker daemon/proxy/CA settings. The helper explicitly selects the local Docker socket while preserving registry configuration. HTTPS image pulls must keep TLS verification enabled. Runtime test services need no Internet route.

## Verified against real services

| Scenario | Result |
|---|---|
| Applicant sign-in with real Supabase Auth | Passed |
| Both synthetic owner accounts receive super-admin privileges | Passed |
| Owner publishes without a medical-verification claim | Passed |
| User-editable metadata cannot elevate an applicant | Passed |
| Jobs/platform APIs return data including General Physicians | Passed |
| Signed PDF and DOCX uploads | Passed |
| Actual byte-size/format validation before attachment | Passed |
| Invalid content is rejected and removed | Passed |
| Anonymous and ordinary direct Storage reads are denied | Passed |
| Public-bucket path cannot expose private objects | Passed |
| Applicant cannot obtain another applicant's download URL | Passed |
| Direct browser reads of private resume metadata are denied | Passed |
| Signed upload token cannot target another path or overwrite | Passed |
| Owner and super-admin signed downloads | Passed |
| Downloaded bytes match the uploaded file; attachment disposition | Passed |
| Signed link expires in a real short-TTL test | Passed |
| Upload gateway preflight CORS | Passed |
| Pending/foreign assets cannot be attached | Passed |
| Application retains the asset ID and authenticated applicant ID | Passed |
| Duplicate applications are rejected | Passed |
| Linked resume cannot be discarded | Passed |
| Admin application list includes the attachment | Passed |
| Five concurrent attachment/discard races | Passed; never an attached deleted asset |
| 22 simultaneous upload reservations | Exactly 20 succeeded, 2 returned 429 |
| Actual Storage bucket 5 MiB limit | Oversized upload denied |

The 60-second production download setting was checked in the application's response. Expiry enforcement was exercised using a real 1-second signed URL and a short wait; no assertion relies on waiting for 60 seconds or changing production clocks.

## Additional defect fixed during staging

The initial prepared implementation checked for linked applications before deleting a file using separate HTTP queries. A concurrent application insert could pass its own readiness check while deletion proceeded. Migration 008 now adds:

- An attachment trigger that locks the asset row and requires the same applicant and `ready` state.
- A service-only discard RPC that locks the same row, rejects linked assets and marks the asset deleted before physical Storage removal.
- A 409 response for a readiness conflict during application insertion.

This prevents attachment/deletion interleaving. Failed Storage removal leaves a non-attachable row that can be retried, rather than an attached file disappearing after a successful application. The real concurrency test exercises both API requests against PostgreSQL and Storage.

## Still pending before production

1. Agree retention and cleanup behavior. No automatic deletion of attached resumes has been enabled. Signed upload tokens live for two hours, so abandoned/rejected-object cleanup must wait beyond token expiry. The proposed 24-hour orphan threshold remains a policy proposal, not an activated production job.
2. Decide whether to require malware scanning/quarantine before distributing resumes more widely. File structure checks are not antivirus scanning.
3. Approve production migrations 008/009 and the coordinated code deployment. The admin/application attachment columns require 008 before the new code serves production traffic.
4. Run release smoke checks against the actual hosted project after approval; verify the managed Storage gateway/CORS and rollback path.
5. Keep migration 010 and metadata backfill separate until the main hub's direct-read consumers and the reconciliation plan are reviewed.

No Git commit, push, production data mutation or Vercel deployment was performed during this staging phase. The current production baseline remains `fd78adf`.
