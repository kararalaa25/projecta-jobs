import {Sparkles,ChevronDown,Check,Minus,ChevronUp} from 'lucide-react'
import {number} from '../i18n.js'
const statusLabels={match:'متوافق',partial:'توافق جزئي',mismatch:'غير متوافق',unknown:'غير مذكور'}
const scoreTone=(score)=>score===null?'neutral':score>=75?'high':score>=45?'medium':'low'
export default function SpecialtyFitBadge({fit}){
 if(!fit)return null
 const tone=scoreTone(fit.score)
 const scoreLabel=fit.score===null?'بيانات المطابقة محدودة':`${number(fit.score)}٪`
 const matched=fit.matchedSkills.slice(0,2).join(' · ')
 return <details className={`specialty-fit fit-${fit.level} tone-${tone}`} data-tone={tone}>
  <summary>
   <span className="fit-score-pill" data-tone={tone}>
    <Sparkles size={15} aria-hidden="true"/>
    <b>{scoreLabel}</b>
    <small>توافق التخصص</small>
   </span>
   <span className="fit-summary">
    <span>{fit.score===null?'بيانات المطابقة محدودة':`${number(fit.score)}٪ توافق التخصص`}</span>
    {matched&&<small>{matched}</small>}
   </span>
   <ChevronDown size={13} aria-hidden="true" className="fit-chevron"/>
  </summary>
  <div className="fit-breakdown">
   <p className="fit-disclaimer">مطابقة استرشادية للمعلومات المعلنة، وليست احتمال قبول أو اعتماداً مهنياً. الحقول غير المذكورة لا تمنح نقاطاً.</p>
   <dl>
    {fit.dimensions.map(dimension=>
     <div key={dimension.key} className={`fit-row ${dimension.status==='match'?'is-match':''}`}>
      <dt>
       {dimension.status==='match'?<Check size={12} aria-hidden="true"/>:<Minus size={12} aria-hidden="true"/>}
       {dimension.label}
      </dt>
      <dd title={dimension.detail}>
       {statusLabels[dimension.status]}
       <span>{number(Math.round(dimension.points))}/{number(dimension.weight)}</span>
      </dd>
     </div>
    )}
   </dl>
   <p className="fit-coverage">تغطية البيانات القابلة للمقارنة: {number(fit.coverage)}٪</p>
   {fit.missingSkills.length>0&&<p className="fit-missing"> Skills مذكورة في الإعلان و لم نجدها في الملف: {fit.missingSkills.slice(0,6).join('، ')}</p>}
  </div>
 </details>
}