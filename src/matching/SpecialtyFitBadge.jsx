import {Sparkles,ChevronDown,Check,Minus} from 'lucide-react'
import {number} from '../i18n.js'
const statusLabels={match:'متوافق',partial:'توافق جزئي',mismatch:'غير متوافق',unknown:'غير مذكور'}
export default function SpecialtyFitBadge({fit}){
 if(!fit)return null
 return <details className={`specialty-fit fit-${fit.level}`}><summary><Sparkles size={15} aria-hidden="true"/><span>{fit.score===null?'بيانات المطابقة محدودة':`${number(fit.score)}٪ توافق التخصص`}{fit.matchedSkills.length>0&&<small>{fit.matchedSkills.slice(0,2).join(' · ')}</small>}</span><ChevronDown size={13} aria-hidden="true"/></summary><div className="fit-breakdown"><p>مطابقة استرشادية للمعلومات المعلنة، وليست احتمال قبول أو اعتماداً مهنياً. الحقول غير المذكورة لا تمنح نقاطاً.</p><dl>{fit.dimensions.map(dimension=><div key={dimension.key}><dt>{dimension.status==='match'?<Check size={12} aria-hidden="true"/>:<Minus size={12} aria-hidden="true"/>}{dimension.label}</dt><dd title={dimension.detail}>{statusLabels[dimension.status]} <span>{number(Math.round(dimension.points))}/{number(dimension.weight)}</span></dd></div>)}</dl><p>تغطية البيانات القابلة للمقارنة: {number(fit.coverage)}٪</p>{fit.missingSkills.length>0&&<p>مهارات مذكورة ولم نجدها في ملفك: {fit.missingSkills.slice(0,6).join('، ')}</p>}</div></details>
}
