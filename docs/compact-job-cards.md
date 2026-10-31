# Compact cards and search cleanup

1 November 2026, Asia/Baghdad.

- Removed the minimum monthly salary slider, React state, filter predicate,
  reset/dependency handling and unused slider CSS. Salary information remains
  available in cards and full details.
- Search now has a simple keyword/location/action grid. Input and select focus
  use a soft surface without internal borders or outlines. The search button
  retains a subtle keyboard focus ring.
- Feature, about/mission, contact, guide and career-path cards use gentle lift,
  soft shadows and Projecta cyan borders. Featured path cards retain their scale.
  Reduced-motion preferences disable movement.
- Job cards use one compact identity row, a short summary, inline salary/location/
  schedule facts, pastel specialty badges and a consistent footer. Long company
  names have an ellipsis and full-name tooltip. Duplicate phone and schedule rows
  were consolidated.
- Call, WhatsApp, Telegram, original source and application actions use labeled
  icons. Contact links preserve normalized Iraqi phone numbers and safe external
  URLs. Mobile actions have 44px targets. A visible full-post/full-profile action
  opens uncropped details; the original Telegram source remains accessible.

Validation: clean Vite build; all 71 Node tests passing; browser checks at 320,
375, 390, 680, 768, 1024 and 1440px without horizontal overflow. Checks covered
minimal search focus while typing, live filtering, contact destinations and
accessible names, save and application actions, complete multiline post text,
candidate details, five content-card hover types, reduced motion and no uncaught
browser errors. Browser data was synthetic; no production data was changed.
