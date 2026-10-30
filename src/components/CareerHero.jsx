import {ArrowUpLeft,BriefcaseMedical,Send,LockKeyhole,MapPin,Layers3,HeartPulse} from 'lucide-react'
import {number} from '../i18n'

export default function CareerHero({onBrowse,onPost,specialties}){
 return <section className="career-hero" aria-labelledby="career-title">
  <div className="hero-orbit" aria-hidden="true"/>
  <div className="career-hero-copy">
   <span className="career-eyebrow"><span/> مجتمع مهني للرعاية الصحية في العراق</span>
   <p className="career-kicker" lang="en" dir="ltr">PROJECTA · MEDICAL CAREERS</p>
   <h1 id="career-title">خطوتك القادمة،<br/><span>في مكان يقدّر كفاءتك.</span></h1>
   <p className="career-description">مساحة تجمع المتخصصين بالفرص. اكتشف إعلانات العيادات، تابع وظائف التليجرام، وقدّم سيرتك الذاتية بثقة.</p>
   <div className="career-hero-actions"><button className="primary hero-browse" onClick={()=>onBrowse('jobs')}>استكشف فرص العمل <ArrowUpLeft size={18}/></button><button className="hero-secondary" onClick={onPost}>أبحث عن كفاءة لفريقي <BriefcaseMedical size={18}/></button></div>
   <div className="career-coverage"><span><MapPin size={15}/>{number(18)} محافظة عراقية</span><span><Layers3 size={15}/>{number(specialties)} تخصصات مهنية</span></div>
  </div>
  <div className="career-hero-panel">
   <div className="career-panel-heading"><span className="career-panel-icon"><HeartPulse size={24}/></span><div><span className="panel-overline">مسارك المهني يبدأ هنا</span><h2>كل فرصة، في مساحتها.</h2></div></div>
   <button className="career-pathway" onClick={()=>onBrowse('jobs')}><span className="pathway-icon"><BriefcaseMedical size={23}/></span><span><strong>وظائف المنصة</strong><small>فرص مباشرة من العيادات والمؤسسات</small></span><ArrowUpLeft size={18}/></button>
   <button className="career-pathway" onClick={()=>onBrowse('telegram')}><span className="pathway-icon"><Send size={22}/></span><span><strong>وظائف التليجرام</strong><small>منشورات القنوات، مصنّفة لسهولة البحث</small></span><ArrowUpLeft size={18}/></button>
   <div className="career-privacy"><LockKeyhole size={20}/><div><strong>سيرتك الذاتية، بخصوصية.</strong><p>ارفع PDF أو DOCX عند التقديم. ملفات خاصة وروابط تنزيل مؤقتة.</p></div></div>
  </div>
 </section>
}
