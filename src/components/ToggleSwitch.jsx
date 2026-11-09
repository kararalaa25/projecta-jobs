/**
 * ToggleSwitch — Linear-style pill toggle with smooth animation.
 * Renders a visually distinct toggle that replaces the native checkbox
 * for the verified credentials filter in the sidebar.
 *
 * Usage:
 *   <ToggleSwitch checked={onlyVerified} onChange={setOnlyVerified} id="verified-toggle" />
 */
export default function ToggleSwitch({checked, onChange, id, 'aria-labelledby': labelledBy}) {
  return (
    <label className="toggle-switch" htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        aria-labelledby={labelledBy}
        aria-checked={checked}
        role="switch"
      />
      <span className="toggle-switch-track" aria-hidden="true"/>
    </label>
  )
}
