export default function VerifiedFilter({checked,onChange}){
  return <div className="verified-filter"><label><span>عضوية موثقة فقط</span><input type="checkbox" role="switch" checked={checked} onChange={event=>onChange(event.target.checked)}/><span className="verified-switch" aria-hidden="true"/></label></div>
}