import {useEffect,useRef,useState} from 'react'
import {ChevronLeft,ChevronRight,ZoomIn,ZoomOut,RotateCcw} from 'lucide-react'
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import {number} from '../i18n.js'
GlobalWorkerOptions.workerSrc=workerUrl

// Render local bytes to canvas. No external document URL, PDF scripts or links
// are executed, and the file is never uploaded for preview.
export default function PdfCanvasViewer({blob,name}){
 const container=useRef(null),canvas=useRef(null)
 const [document,setDocument]=useState(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[width,setWidth]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[pageText,setPageText]=useState('')
 useEffect(()=>{
  const update=()=>setWidth(container.current?.clientWidth||0)
  const observer=new ResizeObserver(update);observer.observe(container.current);update()
  return()=>observer.disconnect()
 },[])
 useEffect(()=>{
  let active=true,task
  setDocument(null);setLoading(true);setError('');setPage(1);setZoom(1)
  blob.arrayBuffer().then(bytes=>{
   if(!active)return
   task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,enableXfa:false})
   return task.promise
  }).then(pdf=>{if(active&&pdf)setDocument(pdf)}).catch(failure=>{if(active){setError(failure.name==='PasswordException'?'السيرة الذاتية محمية بكلمة مرور. يمكنك تنزيلها أو إرفاق نسخة غير محمية.':'تعذر عرض هذا الملف. يمكنك تنزيله للاطلاع عليه.');setLoading(false)}})
  return()=>{active=false;if(task)task.destroy().catch(()=>{})}
 },[blob])
 useEffect(()=>{
  if(!document||!width)return
  let active=true,renderTask
  setLoading(true);setError('');setPageText('')
  async function render(){
   try{
    const pdfPage=await document.getPage(page)
    if(!active)return
    const original=pdfPage.getViewport({scale:1}),scale=Math.max(160,width-24)/original.width*zoom
    const viewport=pdfPage.getViewport({scale}),ratio=Math.min(window.devicePixelRatio||1,2),surface=canvas.current
    surface.width=Math.floor(viewport.width*ratio);surface.height=Math.floor(viewport.height*ratio)
    surface.style.width=`${viewport.width}px`;surface.style.height=`${viewport.height}px`
    renderTask=pdfPage.render({canvas:surface,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]})
    await renderTask.promise
    if(active)setLoading(false)
    const text=await pdfPage.getTextContent()
    if(active)setPageText(text.items.map(item=>item.str||'').join(' '))
   }catch(failure){if(active&&failure.name!=='RenderingCancelledException'){setError('تعذر عرض هذه الصفحة. يمكنك تنزيل السيرة الذاتية.');setLoading(false)}}
  }
  render()
  return()=>{active=false;if(renderTask)renderTask.cancel()}
 },[document,page,width,zoom])
 return <div className="talent-pdf-reader"><div className="talent-pdf-toolbar"><div><button aria-label="الصفحة السابقة" disabled={!document||page<=1||loading} onClick={()=>setPage(value=>value-1)}><ChevronRight size={17}/></button><span aria-live="polite">الصفحة {number(page)} {document&&`من ${number(document.numPages)}`}</span><button aria-label="الصفحة التالية" disabled={!document||page>=document.numPages||loading} onClick={()=>setPage(value=>value+1)}><ChevronLeft size={17}/></button></div><div><button aria-label="تصغير الصفحة" disabled={!document||zoom<=.75||loading} onClick={()=>setZoom(value=>Math.max(.75,value-.25))}><ZoomOut size={17}/></button><button aria-label="ملاءمة الصفحة" disabled={!document||loading} onClick={()=>setZoom(1)}><RotateCcw size={16}/></button><button aria-label="تكبير الصفحة" disabled={!document||zoom>=2||loading} onClick={()=>setZoom(value=>Math.min(2,value+.25))}><ZoomIn size={17}/></button></div></div>{error&&<p className="form-message" role="alert">{error}</p>}<div className="talent-pdf-canvas" ref={container} aria-busy={loading}>{loading&&<p className="talent-pdf-loading" role="status">جارٍ عرض الصفحة…</p>}<canvas ref={canvas} role="img" aria-label={`الصفحة ${number(page)} من السيرة الذاتية: ${name}`} style={{visibility:loading||error?'hidden':'visible'}}/></div>{pageText&&<p className="sr-only" aria-label="نص صفحة السيرة الذاتية">{pageText}</p>}</div>
}
