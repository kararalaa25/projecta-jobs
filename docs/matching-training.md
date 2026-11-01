# Local specialty matching and clinical training

These features are implemented locally. They require no database migration, production deployment, external AI request, or background worker.

## Specialty fit

`src/matching_engine.ts` exports the typed, deterministic matching helper. It compares specialty (45 points), governorate (20), shift preferences (15), and requested skill overlap (20). English and Arabic aliases map to the shared Iraqi specialty/governorate catalog. Extra practitioner skills do not reduce the score, and negated experience requirements are excluded from skill matching.

Unknown information earns no points. A percentage is withheld if specialty is unknown or comparable data covers less than 55% of the weighted criteria. A specialty mismatch caps the result at 35%. This is an explainable preference comparison, not a trained model, hiring probability, credential verification, or clinical competency assessment.

Platform and Telegram job cards show an expandable indicator only when a matching profile is available. Candidate cards do not show job-fit indicators. The disclosure explains each criterion, missing skills, and data coverage. Existing authenticated account profile metadata can supply preferences; visitors can explicitly configure a local profile or import their own locally saved talent profile. Demo profiles are never selected automatically.

Matching preferences are saved in `localStorage`, separately scoped to each account ID or the anonymous device. They contain only name, specialty, governorate, work preferences, and skill tags. No CV, contact details, or credential status is copied. Disabling matching retains the editable draft. Changes are not synchronized to Supabase.

## Training and workshops

The homepage section links to `/training`. The directory supports instant search and governorate, specialty, format, and date-status filters. Cards and detail dialogs show Baghdad-local dates/times, instructor credentials as declared, venue, and registration/contact options.

The seven bundled courses are clearly identified fictional examples. They do not claim actual event availability or CME accreditation, and their registration actions are inactive. Locally added upcoming/ongoing courses can provide HTTPS registration links and validated Iraqi telephone/opt-in WhatsApp contacts. Ended or invalidly scheduled courses cannot accept registration through these cards.

Courses can be created, edited, and deleted on this device. Records are stored under `projecta-training-courses-v1` in `localStorage` (maximum 100 courses), with no public publishing or server persistence. Clearing browser data removes them. Future shared publishing needs a separately designed authorized backend, moderation and accreditation checks, and explicit approval for migrations/deployment.

## Validation

`npm test` covers scoring, bilingual normalization, incomplete data, account preference isolation, course validation, safe links, time conversion, filters, and local persistence. `npm run build` includes strict TypeScript checking of the matching helper. Browser checks exercise both feeds, preference editing, training search, local course CRUD, registration links, and mobile/desktop layouts while blocking external traffic.
