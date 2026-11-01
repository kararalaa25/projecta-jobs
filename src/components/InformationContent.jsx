import {BookOpen,Library,BriefcaseMedical,MapPin,Bookmark,Smartphone,Users,ShieldCheck,Lightbulb,Eye,Target} from 'lucide-react'
function FeatureIcon({Icon,text,id,className}){
 return <span className={`${className} has-tooltip`} tabIndex={0} role="img" aria-label={text} aria-describedby={id}><Icon size={27} aria-hidden="true"/><span className="icon-tooltip" role="tooltip" id={id}>{text}</span></span>
}

const features=[
 [BookOpen,'فرص مباشرة من العيادات','إعلانات واضحة تتضمن عنوان الوظيفة ووصفها والراتب المتوقع والموقع ورقم التواصل.'],
 [Library,'وظائف التليجرام','تابع منشورات القنوات الطبية في قسم مستقل، مع رابط المنشور الأصلي ووسائل التواصل المتاحة.'],
 [BriefcaseMedical,'تخصصك، وفرصتك','أطباء أسنان، صيادلة، مندوبون علميون، مساعدون، أطباء عامون، وإدارة وسكرتارية.'],
 [MapPin,'كل المحافظات العراقية','ابحث في بغداد وكربلاء وبابل والنجف وأربيل، مع خيارات تصفية تغطي المحافظات الثماني عشرة.'],
 [Bookmark,'فرصك المحفوظة','احتفظ بالإعلانات التي تهمك على هذا الجهاز، وعد إليها من قائمة المحفوظات.'],
 [Smartphone,'أينما كنت','تجربة متجاوبة تتيح لك استعراض الفرص والتواصل من الهاتف أو الجهاز اللوحي أو الحاسوب.'],
 [Users,'مجتمع من الكفاءات','استكشف قسم الباحثين عن عمل. تظهر النماذج التوضيحية والملفات المحلية بتسميات واضحة.'],
 [ShieldCheck,'سيرتك الذاتية بخصوصية','ارفع ملف PDF أو DOCX عند التقديم على فرصة مباشرة، مع تخزين خاص وروابط تنزيل مؤقتة.'],
]
export function ProjectaFeatures({compact=false}){return <section className={compact?"information-content information-features":"reference-features full-bleed"} id="features" aria-labelledby="features-title"><div className="reference-container"><div className="reference-section-heading"><span>لماذا تختار بروجكتا</span><h2 id="features-title">كل ما تحتاجه لخطوتك المهنية</h2><p>تجربة واضحة تجمع فرص العمل والكفاءات في القطاع الصحي العراقي.</p></div><div className="reference-feature-grid">{features.map(([Icon,title,description],index)=><article className="reference-card feature-card" key={title}><FeatureIcon className="reference-feature-icon" Icon={Icon} text={description} id={`feature-tip-${index}`}/><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>}
export function ProjectaAbout({compact=false}){const cards=[[Lightbulb,'رسالتنا','تقريب الكفاءات الطبية من الفرص المناسبة، وتسهيل التواصل بين المتخصصين والعيادات والمؤسسات الصحية في العراق.'],[Eye,'رؤيتنا','مساحة مهنية واضحة تساعدك على استكشاف خياراتك وبناء الخطوة التالية في مسيرتك، مع الفصل بين الإعلانات المباشرة ومصادر المجتمع.'],[Target,'هدفنا','تقديم معلومات وظيفية منظمة حسب التخصص والمحافظة والدوام، مع احترام خصوصية المتقدمين وإبقاء المعلومات غير المذكورة واضحة.']];return <section className={compact?"information-content information-about":"reference-about full-bleed"} id="projecta-about" aria-labelledby="about-title"><div className="reference-container"><div className="reference-section-heading"><h2 id="about-title">عن بروجكتا</h2><p>فرص أفضل للكفاءات. وفِرق أفضل للرعاية.</p></div><div className="reference-about-grid">{cards.map(([Icon,title,text],index)=><article className="reference-card about-card" id={index===0?'our-message':undefined} key={title}><FeatureIcon className="reference-about-icon" Icon={Icon} text={title} id={`about-tip-${index}`}/><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>}
