import {Instagram,Send,Youtube} from 'lucide-react'
import WhatsAppIcon from './WhatsAppIcon'

// Add an HTTPS profile/contact URL here to activate a channel when it is ready.
const channels=[
 {id:'instagram',label:'Instagram',Icon:Instagram,color:'#e1306c',href:''},
 {id:'whatsapp',label:'WhatsApp',Icon:WhatsAppIcon,color:'#25d366',href:''},
 {id:'telegram',label:'Telegram',Icon:Send,color:'#229ed9',href:''},
 {id:'youtube',label:'YouTube',Icon:Youtube,color:'#ff0000',href:''},
]

export default function SocialLinks(){
 return <div className="connect-social">
  <div className="connect-social-grid" role="group" aria-label="قنوات التواصل الاجتماعي">
   {channels.map(({id,label,Icon,color,href})=>{
    const content=<Icon size={24} strokeWidth={1.75} aria-hidden="true"/>
    return href.startsWith('https://')
     ?<a key={id} className="connect-social-card" data-social={id} style={{'--social-accent':color}} aria-label={label} title={label} href={href} target="_blank" rel="noopener noreferrer">{content}</a>
     :<button key={id} type="button" className="connect-social-card" data-social={id} style={{'--social-accent':color}} aria-label={label} title={label} aria-disabled="true" aria-describedby="connect-social-note">{content}</button>
   })}
  </div>
  <p className="connect-social-note" id="connect-social-note">قنواتنا الاجتماعية قريباً.</p>
 </div>
}
