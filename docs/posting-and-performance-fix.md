# Publishing reliability and feed responsiveness

The production posting error was reproduced in a rolled-back transaction: `job_offers.publisher_id` references the legacy `job_users` table, but authenticated accounts had no compatibility rows. First-time publishers therefore failed with `job_offers_publisher_id_fkey` (`23503`).

Both normal publishing and administrative manual-post creation now provision the missing publisher before inserting an offer. The operation ignores existing IDs and never overwrites existing account records. Compatibility rows store the public advertiser label and a unique non-deliverable `.invalid` placeholder; private Auth email, contact numbers, credentials and verification claims are not copied into a legacy table with broader read access. Auth remains the identity and verification authority. No schema migration or permission change is required.

Temporary contracts now use the existing `locum_temp` database value. Their public metadata retains the human-readable contract classification. Publication failures log only a bounded backend error code, never submitted contact details or post contents. The modal heading stays available while long forms scroll.

## Feed performance

The former client waited for all sequential 200-row requests before displaying any jobs. A baseline production browser check with an active matching profile showed the first card at 7.95 seconds and the complete feed at 7.98 seconds in this test environment. These are scripted lab observations through the session proxy, not field Core Web Vitals or a universal speed guarantee.

The first page now renders immediately. The first API response supplies an exact pagination count so remaining requests can run two at a time without speculative requests beyond the archive. Older responses retain the sequential compatibility path. Every page is deduplicated by job ID, and initial partial snapshots reconcile concurrent socket changes. Background refreshes retain the current full feed until their final replacement snapshot is available, so counts and cards do not collapse back to 200 every minute. Public responses remain uncached.

A benchmark over the same 1,143 production job records took 2,133 ms for matching before the change. Caching compiled aliases and guarding expensive regular expressions reduced the cold pass to approximately 541 ms. Repeated reconciliation of new objects with unchanged matching fields took 7 ms. Cached features are keyed by all relevant content; edits and even in-place preference mutations invalidate the correct entries. The shared job cache is bounded to 2,000 entries, and per-object caches use weak references.

Search-index objects are reused for unchanged jobs. Identical platform polling results no longer force a complete re-index. The hero image is preloaded directly from the HTML document to remove its JavaScript discovery delay. Brand colors, typography and the hero artwork are preserved.

## Validation

Unit tests exercise first-time and repeated publishing, privacy-preserving compatibility rows, publisher failures, contract mappings, progressive rendering, bounded parallelism, old API compatibility, background reconciliation and edited matching inputs. Browser tests submit screenshot-equivalent fields through the actual publish handler with mocked storage, verify successful cards, and check the scrollable dialog controls. Production SQL checks verify publisher/offer constraints under the service role and roll back all test writes. No fictitious public offers are left behind.
