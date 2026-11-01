import {Component,Suspense} from 'react'

export function ContentLoading(){return <p className="content-loading" role="status">جارٍ تحميل المحتوى…</p>}
class ContentError extends Component{
 state={failed:false}
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className="content-loading" role="alert"><p>تعذر تحميل هذا القسم. يرجى تحديث الصفحة والمحاولة مجدداً.</p><button className="primary" onClick={()=>window.location.reload()}>تحديث الصفحة</button></div>:this.props.children}
}
// The dialog shell remains mounted while its optional content loads.
export default function AsyncContent({children,fallback=<ContentLoading/>}){return <ContentError><Suspense fallback={fallback}>{children}</Suspense></ContentError>}
