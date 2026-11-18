# Security release review — Telegram classification release (Gate 7A)

Date: 2026-11-18
Branch: `feat/option-b-telegram-classification`
Reviewed commit (pre-commit working tree): `e36269d5577200a709e36339c1eceddec17cec88`
Audit command: `npm audit --audit-level=high` (exit 1)
Runtime: Node `v24.12.0`, npm `11.6.2`

## STATUS: **PENDING — PRODUCTION RELEASE BLOCKED**

This document records unresolved high-severity dependency findings. It does **not**
suppress, downgrade, or waive them, and does not declare the security audit passed.
The owner's explicit authorization for a feature-branch commit and push does not
constitute acceptance of these findings or authorization to merge/deploy.

---

## 1. Current findings (rechecked 2026-11-18)

`npm audit --json` reports **4 high, 0 critical, 0 moderate, 0 low** vulnerabilities.

| Package | Installed | Audit range | Severity | Source |
| --- | --- | --- | --- | --- |
| `picomatch` | `4.0.7` | `*` (advisory range `<=4.0.7`) | High | `GHSA-fc5q-39xc-vjpf`, CVSS 3.1 7.5 (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`), CWE-1333 |
| `fdir` | `6.5.0` | `>=5.2.1` | High | transitive — depends on vulnerable `picomatch` |
| `tinyglobby` | `0.2.17` | `*` | High | transitive — depends on vulnerable `fdir` and `picomatch` |
| `vite` | `6.4.5` | `>=6.3.0-beta.0` | High | transitive — depends on `fdir`, `picomatch`, `tinyglobby` |

Advisory detail: *"picomatch vulnerable to ReDoS through single-branch repeated
extglobs"* — https://github.com/advisories/GHSA-fc5q-39xc-vjpf.

## 2. Dependency paths

```
projecta-jobs@1.0.0
├─┬ @tailwindcss/vite@4.3.3
│ └── vite@6.4.5 (deduped)
├─┬ @vitejs/plugin-react@4.7.0
│ └── vite@6.4.5 (deduped)
└─┬ vite@6.4.5                    (devDependency, declared as ^6.1.0)
  ├─┬ fdir@6.5.0
  │ └── picomatch@4.0.7 (deduped)
  ├── picomatch@4.0.7
  └─┬ tinyglobby@0.2.17
    ├── fdir@6.5.0 (deduped)
    └── picomatch@4.0.7 (deduped)
```

`vite` is declared only in `devDependencies`; `picomatch`, `fdir`, and `tinyglobby`
are transitive development/build dependencies. The production runtime dependencies
(`@supabase/supabase-js`, `react`, `undici`, `pdf-lib`, etc.) do not depend on any of
the four affected packages.

## 3. Development/build vs production runtime exposure

- **Development/build tooling:** `vite` is used by `npm run dev` and `vite build`.
  A remote attacker would need to supply attacker-controlled glob patterns to a
  process using `picomatch` — in this project that occurs during local dev-server
  file watching and build-time file discovery. There is no route by which public
  HTTP input reaches these glob calls in the deployed application.
- **Production runtime:** none of the four packages is imported by `api/*` handlers,
  `server/*`, `src/*`, or `telegram_*.py`. They are not present in the browser runtime
  bundle as application dependencies. Vite is not executed in the deployed Functions.
- **CI/process exposure:** `npm audit --audit-level=high` is a required step in
  `.github/workflows/ci.yml`, so the finding is a **hard CI gate failure** regardless
  of the low runtime exploitability. No CI threshold was modified.
- **Pre-existing on `main`:** `origin/main` declares the same `vite ^6.1.0` and its
  lockfile pins the identical `vite@6.4.5`, `fdir@6.5.0`, `tinyglobby@0.2.17`,
  `picomatch@4.0.7`. This release introduces no new dependency, version, or exposure.

## 4. Available fixes and mitigations investigated

- `npm audit fix --dry-run`: **added 0, removed 0, changed 0** packages; 4 high remain.
- Latest published `picomatch` is **`4.0.7`** — still inside the vulnerable range
  `<=4.0.7`. **No patched version has been published.** There is no compatible
  patch/minor upgrade that resolves the root advisory.
- `fdir@6.5.0` and `tinyglobby@0.2.17` are already the latest published versions; both
  still depend on vulnerable `picomatch`.
- `vite@6.4.6` was checked (latest 6.x) — same dependency ranges (`picomatch ^4.0.2`,
  `fdir ^6.4.4`, `tinyglobby ^0.2.13`). No 6.x release removes the dependency.
- `vite@7.0.0`, `vite@8.0.0`, and current `vite@8.3.8` were checked — they still depend
  on `picomatch` (`^4.0.2`, `^4.0.3`, `^4.0.7` respectively). A major upgrade would be
  unnecessary, behavior-risky, and **would not fix the advisory**.
- No `overrides`, audit suppression, `--force`, or CI-threshold change was applied.
  Removing or pinning a transitive dependency without an upstream patch would be a
  speculative workaround that could break the build; it was not attempted.

## 5. Remaining security risks

1. **Unpatched ReDoS primitive** in a build-time dependency. Exploitation requires
   attacker-controlled glob input to the dev/build process, which this application
   does not expose; risk is judged low for the deployed service but is not zero for
   developer workstations or CI runners handling untrusted branch content.
2. **CI gate remains red.** Any PR to `main` will fail the required audit step until
   an upstream fix exists or the owner grants a formal, documented exception.
3. **Upstream timing is unknown.** A patched `picomatch` >4.0.7 may be published later;
   the lockfile would then need a routine compatible update and re-verification.
4. **No suppression is in place**, so the finding remains visible and auditable — this
   is intentional.

## 6. Required security reviewer / owner decision

A decision is required before any merge or production deployment:

- **Option A — Accept documented exception:** acknowledge that the advisories are
  pre-existing, dev/build-only, and upstream-unpatched; accept the CI failure as a
  known exception with an expiry/review date and a named reviewer. CI configuration
  must remain unchanged.
- **Option B — Wait for upstream patch:** hold merge/deploy until `picomatch` publishes
  a version above `4.0.7`, then apply the smallest compatible lockfile update and
  re-run the full suite.
- **Option C — Replace the build tool:** out of scope for this release; would require a
  separate, fully tested migration away from Vite.

**Decision owner:** repository owner / designated security reviewer.
**Decision status: PENDING.** Production release remains **NO-GO**.

## 7. Authorization boundary of this review

This document was prepared under an owner authorization limited to: commit, push to
`feat/option-b-telegram-classification`, local tests/builds/read-only checks, and
security-review documentation. It does **not** authorize accepting or suppressing
vulnerabilities, merging to `main`, deploying, or modifying production infrastructure
or databases.
