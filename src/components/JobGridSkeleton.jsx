export default function JobGridSkeleton(){
 return <div className="job-grid-skeleton" role="status"><span className="sr-only">جارٍ تحميل فرص العمل…</span>{Array.from({length:24},(_,index)=><div className="job-card-skeleton" key={index} aria-hidden="true"><span className="skeleton-avatar"/><span className="skeleton-line"/><span className="skeleton-line"/><span className="skeleton-line"/><span className="skeleton-line"/></div>)}</div>
}
