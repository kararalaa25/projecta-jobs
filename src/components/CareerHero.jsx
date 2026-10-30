import {ArrowUpLeft,BriefcaseMedical,Send,MapPin,Layers3} from 'lucide-react'
import {number} from '../i18n'

export default function CareerHero({onBrowse,onPost,specialties}){
 return <section className="career-hero" aria-labelledby="career-title">
  <div className="career-hero-copy">
   <span className="career-eyebrow"><span/> للرعاية الصحية في العراق</span>
   <h1 id="career-title">خطوتك القادمة،<br/><span>في الرعاية الصحية.</span></h1>
   <p className="career-description">مساحة تجمع الكفاءات الطبية بالفرص المناسبة. اكتشف وظائف العيادات والمؤسسات، وتابع فرص المجتمع الطبي، وخذ خطوتك المهنية التالية.</p>
   <div className="career-hero-actions"><button className="primary hero-browse" onClick={()=>onBrowse('jobs')}>استكشف فرص العمل <ArrowUpLeft size={18}/></button><button className="hero-secondary" onClick={onPost}>أبحث عن كفاءة <BriefcaseMedical size={18}/></button></div>
   <button className="hero-telegram-link" onClick={()=>onBrowse('telegram')}><Send size={15}/> اكتشف وظائف التليجرام <ArrowUpLeft size={14}/></button>
   <div className="career-coverage"><span><MapPin size={15}/>{number(18)} محافظة عراقية</span><span><Layers3 size={15}/>{number(specialties)} تخصصات مهنية</span></div>
  </div>
  <figure className="career-hero-visual">
   <img src="/images/medical-specialist.jpg" alt="متخصصة طبية تراجع المراجع الطبية في بيئة عمل صحية" width="1920" height="1080" fetchPriority="high" decoding="async"/>
  </figure>
 </section>
}
