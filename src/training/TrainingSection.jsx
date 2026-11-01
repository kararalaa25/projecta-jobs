import {useState} from 'react'
import {GraduationCap,ArrowUpLeft} from 'lucide-react'
import Modal from '../components/Modal'
import CourseCard from './CourseCard'
import CourseDetails from './CourseDetails'
import useTrainingCourses from './useTrainingCourses'
import {demoCourses,coursePhase} from './data.js'
import './training.css'
export default function TrainingSection(){
 const {courses,now}=useTrainingCourses(),[selected,setSelected]=useState(null)
 const visible=[...courses.filter(course=>coursePhase(course,now)!=='ended'),...demoCourses].slice(0,3)
 return <section className="training-section" aria-labelledby="training-title"><div className="training-container"><div className="training-section-heading"><div><span><GraduationCap size={16} aria-hidden="true"/> تطوير مهني مستمر</span><h2 id="training-title">تعلّم. تدرّب. طوّر ممارستك.</h2><p>ورش عملية وندوات ومسارات مهنية للكفاءات الطبية في العراق.</p></div><a href="/training">التدريب والورش <ArrowUpLeft size={17} aria-hidden="true"/></a></div><p className="training-demo-note">برامج ومواعيد توضيحية لتجربة التصميم، مع إمكانية إضافة برامج محلية. النماذج ليست فعاليات فعلية مفتوحة للتسجيل، ولا تعني اعتماد نقاط CME.</p><div className="course-grid">{visible.map(course=><CourseCard key={course.id} course={course} now={now} onDetails={setSelected}/>)}</div></div>{selected&&<Modal title={selected.title} onClose={()=>setSelected(null)}><CourseDetails course={selected} now={now}/></Modal>}</section>
}
