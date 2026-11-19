/**
 * application-status.js
 * Shared application pipeline status definitions.
 * Plain JS (no JSX) so this can be imported by both React components
 * and Node test files without a JSX transform.
 */

/** Human-readable Arabic labels for each application pipeline stage */
import {applicationStatus as pipelineStatus} from '../../config/application-status.js'
export const applicationStatus = {...pipelineStatus,pending:pipelineStatus.submitted}

/** CSS state class suffix for each pipeline stage */
export const applicationStateClass = {
 submitted:   'state-submitted',
 pending:     'state-submitted',
 reviewing:   'state-viewed',
 viewed:      'state-viewed',
 shortlisted: 'state-shortlisted',
 accepted:    'state-accepted',
 archived:    'state-archived',
 rejected:    'state-rejected'
}

/** Lucide icon name for each pipeline stage (resolved at component level) */
export const applicationStatusIcon = {
 submitted:   'Clock3',
 pending:     'Clock3',
 reviewing:   'Eye',
 viewed:      'Eye',
 shortlisted: 'Sparkles',
 accepted:    'CheckCircle2',
 archived:    'Archive',
 rejected:    'XCircle'
}

/** Applicant-facing view: every in-flight stage is simply "under review". */
export function applicantStatusKey(status){
 return status==='accepted'?'accepted':status==='rejected'||status==='archived'?'rejected':'pending'
}

/** Arabic label for the three applicant-facing status keys. */
export function applicantStatusLabel(key){
 return key==='accepted'?'مقبول':key==='rejected'?'غير مقبول':'قيد المراجعة'
}
