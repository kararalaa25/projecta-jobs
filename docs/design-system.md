# Shared Projecta hub design

Reference: https://dental-profile-hub-nea2.vercel.app/ (inspected 2026-10-30).

The jobs platform shares the hub's actual public assets and measured tokens:

- Arabic: self-hosted Cairo 400/600/700/800/900, registered as `Projecta Arabic`.
- Wordmark: self-hosted Sora 800 (Latin and extended Latin), registered as `Projecta Sora`; the dotless `ȷ` uses the same cyan dot treatment as the hub.
- Logo: the hub's `/brand/projecta-icon-light.svg`.
- Page: `#f7f9fc`; ink: `#0b1525`; muted text: `#7183a0`.
- Primary CTA: `linear-gradient(110deg, #0097b5, #1b4be3)`.
- Card border: `#e2edf7`; card radius: 19px; control radius: 13px.
- Floating white/glass pill navigation and the hub's cyan/green/blue ambient gradients.

Assets are served from this application's `public/` directory, not hotlinked at runtime. Cairo and Sora license texts are included beside the font files. The logo is the user-provided platform's existing brand asset.

`src/design-system.css` owns the shared tokens/fonts/wordmark. `src/components/JobCard.jsx` owns role/location badges and content hierarchy; `JobContactActions.jsx` keeps direct contact buttons distinct from source/full-text links. Arabic/RTL is global; original post content uses automatic text direction. Filters apply to the complete paginated feed, while cards render 24 at a time to keep large historical feeds responsive.

Validation covers exact computed colors, borders, corner radius, loaded fonts, desktop/mobile RTL, all 18 governorates, all five role filters, older feed pages, auth modals, and authenticated-only publishing guards. Actual Google/SMS delivery still depends on the Supabase provider configuration documented in README.md.
