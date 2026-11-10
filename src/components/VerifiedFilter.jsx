import {useId} from 'react'
export default function VerifiedFilter({checked,onChange}){
 const help=useId()
 return <div className="verified-filter"><label><span>عضوية موثقة فقط</span><input type="checkbox" role="switch" checked={checked} onChange={event=>onChange(event.target.checked)} aria-describedby={help}/><span className="verified-switch" aria-hidden="true"/></label><small id={help}>عضوية مهنية أو ترخيص منشأة راجعته إدارة المنصة.</small></div>
}
