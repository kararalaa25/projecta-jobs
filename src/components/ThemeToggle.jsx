import {Moon,Sun} from 'lucide-react'

/** Sun/Moon theme switch. Shares one root theme with the header and drawer. */
export default function ThemeToggle({theme,onToggle,className=''}){
 const dark=theme==='dark'
 return <button
  type="button"
  className={`theme-toggle ${className}`.trim()}
  onClick={onToggle}
  role="switch"
  aria-checked={dark}
  aria-label={dark?'التبديل إلى الوضع الفاتح':'التبديل إلى الوضع الداكن'}
  title={dark?'التبديل إلى الوضع الفاتح':'التبديل إلى الوضع الداكن'}
 >
  <Sun className="theme-toggle-sun" size={17} aria-hidden="true"/>
  <Moon className="theme-toggle-moon" size={17} aria-hidden="true"/>
 </button>
}
