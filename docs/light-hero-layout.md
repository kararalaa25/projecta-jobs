# Light image-led landing layout

31 October 2026, Asia/Baghdad. This revision supersedes the dark hero described
in the earlier design audit, following the owner's explicit white/light direction.

- Removed the navy hero container, decorative rings and glass pathway panel.
- Added a large medical-specialist photograph alongside the Arabic headline on
  desktop, with an open white background and generous vertical spacing. Mobile
  stacks the headline, full-width actions and photograph.
- Replaced the floating pill navigation with a flat, white, border-separated
  header. Projecta branding and internal home navigation are preserved.
- Uses locally served Inter for Latin text and Tajawal for Arabic. The optimized
  WOFF files are derived from fonts already in the repository; their existing
  `INTER-OFL.txt` and `TAJAWAL-OFL.txt` licenses remain in `public/fonts`.
- Keeps the two job streams, filtering, profiles, private resume attachment and
  authenticated publication behavior. No database or authentication changes.

Reference inspected: https://www.remedyplatform.com/. The hero photograph was
retrieved from the user-specified reference at
https://www.remedyplatform.com/assets/hero-medical-xARd6KJH.jpg and is served from
`public/images/medical-specialist.jpg`, without hotlinking. It is an illustrative
medical photo, not a representation of a registered Projecta member. No Remedy
logo, identity, testimonials, app-store links or medical-education copy is reused.

The reference currently uses a full-width photo overlay; this implementation
follows the owner's more specific request for a bright side-by-side composition.
It should not be described as a pixel-identical copy of a different live theme.

Verification: Vite build, existing Node tests and real-browser checks for the
light background, absence of the old dark panel, loaded local image/fonts,
desktop image/headline positioning, 320–1440 px sizing, hero navigation, both job
streams, candidate profiles and public API responses. Hosted verification checks
the exact release identifier before reporting deployment complete.
