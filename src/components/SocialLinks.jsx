import {Instagram,Send,Youtube} from 'lucide-react'
import WhatsAppIcon from './WhatsAppIcon'

// Add an HTTPS profile/contact URL here to activate a channel when it is ready.
const channels=[
 {id:'instagram',label:'Instagram',Icon:Instagram,href:''},
 {id:'whatsapp',label:'WhatsApp',Icon:WhatsAppIcon,href:''},
 {id:'telegram',label:'Telegram',Icon:Send,href:''},
 {id:'youtube',label:'YouTube',Icon:Youtube,href:''},
]

export default function SocialLinks(){
 return <div className="connect-social">
  <div className="connect-social-grid" role="group" aria-label="قنوات التواصل الاجتماعي">
   {channels.map(({id,label,Icon,href})=>{
    const content=<><Icon size={24} strokeWidth={1.75} aria-hidden="true"/><span dir="ltr">{label}</span></>
    return href.startsWith('https://')
     ?<a key={id} className="connect-social-card" data-social={id} href={href} target="_blank" rel="noopener noreferrer">{content}</a>
     :<button key={id} type="button" className="connect-social-card" data-social={id} aria-disabled="true" aria-describedby="connect-social-note">{content}</button>
   })}
  </div>
  <p className="connect-social-note" id="connect-social-note">قنواتنا الاجتماعية قريباً.</p>
 </div>
}
