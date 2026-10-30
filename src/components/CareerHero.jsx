import {BriefcaseMedical,Send} from 'lucide-react'

export default function CareerHero({onBrowse}){
 return <section className="career-hero reference-hero" aria-labelledby="career-title">
  <div className="career-hero-backdrop" aria-hidden="true"><img src="/images/medical-specialist.jpg" alt="" width="1920" height="1080" fetchPriority="high" decoding="async"/><div className="hero-gradient-overlay"/></div>
  <div className="hero-content-shell"><div className="career-hero-copy">
   <span className="career-eyebrow"><span/> للكفاءات الطبية في العراق</span>
   <h1 id="career-title"><span>خطوتك القادمة،</span><br/>في الرعاية الصحية.</h1>
   <p className="career-description">بروجكتا مساحتك لاكتشاف فرص العمل الطبية وبناء مسيرتك المهنية. فرص العيادات، وظائف التليجرام، والكفاءات الصحية، في مكان واحد.</p>
   <div className="career-hero-actions">
    <button className="hero-stream-button" onClick={()=>onBrowse('jobs')}><BriefcaseMedical size={24}/><span><small>فرص العيادات والمؤسسات</small><strong>وظائف المنصة</strong></span></button>
    <button className="hero-stream-button" onClick={()=>onBrowse('telegram')}><Send size={24}/><span><small>من قنوات المجتمع الطبي</small><strong>وظائف التليجرام</strong></span></button>
   </div>
  </div></div>
 </section>
}
