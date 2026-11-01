import {MapPin,GraduationCap,CalendarDays} from 'lucide-react'
import {ar} from '../i18n.js'
import SpecialtyBadge from '../components/SpecialtyBadge'
import {courseDate,courseTime} from './data.js'
import {CourseRegistration} from './CourseCard'
export default function CourseDetails({course,now}){
 return <div className="course-details"><p className="course-context">{course.source==='demo'?'هذا برنامج توضيحي بموعد ومدرب تجريبيين، وليس إعلاناً عن فعالية فعلية.':course.source==='platform'?'برنامج منشور على المنصة. تحقق من الجهة المنظمة والتفاصيل قبل التسجيل.':'هذا البرنامج محفوظ على جهازك. المعلومات والمؤهلات مدخلة محلياً ولم تُراجعها المنصة.'}</p><SpecialtyBadge role={course.role}/><p>{course.description}</p><h3><CalendarDays size={17} aria-hidden="true"/> الموعد — توقيت بغداد</h3><p>{courseDate(course.startsAt)} · {courseTime(course.startsAt)}<br/>{courseDate(course.endsAt)} · {courseTime(course.endsAt)}</p><h3><GraduationCap size={17} aria-hidden="true"/> المدرب والمؤهلات المعلنة</h3><p>{course.instructor}<br/>{course.credentials}</p><h3><MapPin size={17} aria-hidden="true"/> المكان</h3><p>{ar(course.city)} · {course.venue||'الموقع التفصيلي غير معلن'}</p><p className="course-context">لا نؤكد منح نقاط CME أو اعتماداً مهنياً لهذا البرنامج. تحقق من الجهة المنظمة قبل التسجيل.</p><CourseRegistration course={course} now={now}/></div>
}
