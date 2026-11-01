import {BriefcaseMedical,Send} from 'lucide-react'

export default function CareerHero({onBrowse}){
 return <section className="career-hero reference-hero" aria-labelledby="career-title">
  <div className="career-hero-backdrop" aria-hidden="true"><picture>
   <source media="(max-width: 680px)" type="image/avif" srcSet="/images/medical-specialist-portrait-480.avif 480w, /images/medical-specialist-portrait-768.avif 768w" sizes="100vw" width="768" height="1366"/>
   <source media="(max-width: 680px)" type="image/webp" srcSet="/images/medical-specialist-portrait-480.webp 480w, /images/medical-specialist-portrait-768.webp 768w" sizes="100vw" width="768" height="1366"/>
   <source type="image/avif" srcSet="/images/medical-specialist-960.avif 960w, /images/medical-specialist-1280.avif 1280w, /images/medical-specialist-1920.avif 1920w" sizes="(max-aspect-ratio: 16/9) 178vh, 100vw"/>
   <source type="image/webp" srcSet="/images/medical-specialist-960.webp 960w, /images/medical-specialist-1280.webp 1280w, /images/medical-specialist-1920.webp 1920w" sizes="(max-aspect-ratio: 16/9) 178vh, 100vw"/>
   <img src="/images/medical-specialist.jpg" alt="" width="1920" height="1080" loading="eager" fetchPriority="high" decoding="async"/>
  </picture><div className="hero-gradient-overlay"/></div>
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
