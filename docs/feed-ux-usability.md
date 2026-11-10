# Feed usability improvements

The existing quick-apply links, trust summary logic, verified credential badges,
accessible tooltip component, skeleton loader and empty-state reset actions were
inspected and retained. The current remote main branch was also inspected; this
change does not replace its work or introduce a second verification mechanism.
No database, API, schema, dependency or credential changes are required here.

The missing interactions were:

- Mobile filters expanded inside the document, pushing results down the page.
- The verified-only switch was buried inside the sidebar.
- Card descriptions appeared before location/pay/schedule details.
- Quick apply used the same soft visual treatment as secondary contact actions.

Implemented changes:

- Reused `Modal` for a filter bottom sheet below 768px. It retains the shared
  overlay scroll lock, background inertness, focus trap, Escape/backdrop close,
  and focus restoration. The existing controls render once, in the desktop
  sidebar or mobile sheet, with the same state. Resizing to desktop dismisses
  the sheet and restores document interaction.
- Kept clear/apply actions visible at the bottom of the sheet while its controls
  scroll independently. Result counts update instantly; Apply closes the sheet
  and focuses the results heading. Clearing filters is one action.
- Moved the existing verified-only switch above the feed for both desktop and
  mobile. It is not duplicated in the sheet. A filter-count indicator and a
  quick reset make the current filtering state visible.
- Moved the existing location/pay/schedule facts ahead of descriptive text and
  improved their contrast and type weight. All original content is preserved.
- Made the existing mobile quick-apply action a solid primary button; retained
  the separate full application and contact actions.
- Added scoped press/focus feedback and short tooltip/sheet entrances, with
  animations disabled for reduced-motion preferences. Existing hover behavior,
  skeletons and encouraging empty states remain in place.

Verification:

- `npm test`: 195 passing.
- `npm run build`: successful (existing PDF viewer chunk-size warning remains).
- `npm run test:ui:feeds`: deterministic Chromium fixtures cover 375, 767, 768
  and 1280px widths, no horizontal overflow, loading skeletons, empty-state
  recovery, verified filtering, sheet clear/apply, keyboard focus trapping,
  Escape/focus restoration, resize cleanup, reduced motion, and the existing
  quick-apply and application-stage flows. No live records or notifications
  are created by these checks.
