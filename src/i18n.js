import catalog from '../config/iraq.json' with { type: 'json' }
export const roles=['All roles',...catalog.roles.map(r=>r.id)]
export const cities=['All cities',...catalog.governorates.map(g=>g.id)]
const legacyCities={Mosul:'Nineveh',Hillah:'Babylon',Kut:'Wasit',Amarah:'Maysan',Nasiriyah:'Dhi Qar',Diwaniyah:'Al-Qadisiyyah',Samawah:'Al-Muthanna'}
export const canonicalRole=value=>catalog.legacyRoles[value]||value
export const canonicalCity=value=>legacyCities[value]||catalog.governorates.find(g=>g.ar===value||g.aliases.includes(value))?.id||value
const labels={
 ...Object.fromEntries(catalog.roles.map(r=>[r.id,r.ar])),...Object.fromEntries(catalog.governorates.map(g=>[g.id,g.ar])),
 'All roles':'جميع التخصصات','All cities':'جميع المحافظات','Any schedule':'جميع أنواع الدوام','Full-time':'دوام كامل','Part-time':'دوام جزئي','Contract':'عقد مؤقت','Internship':'تدريب',
 'City not specified':'المحافظة غير محددة','Salary not specified':'الراتب غير محدد','Schedule not specified':'الدوام غير محدد','Telegram community':'مجتمع تليغرام','Healthcare employer':'مؤسسة صحية','Telegram post':'منشور من تليغرام','Job offer':'فرصة عمل','Just now':'الآن',
}
export const ar=value=>labels[canonicalRole(canonicalCity(value))]||String(value||'').replace(/IQD/g,'د.ع.').replace(/expected/g,'المتوقع')
export const number=value=>new Intl.NumberFormat('ar-IQ').format(value)

export function installCatalog(entries){
 if(!Array.isArray(entries))return
 for(const entry of entries)if(typeof entry.id==='string'&&typeof entry.label==='string')labels[entry.id]=entry.label
 roles.splice(0,roles.length,'All roles',...entries.filter(e=>e.kind==='role'&&e.active).map(e=>e.id))
 cities.splice(0,cities.length,'All cities',...entries.filter(e=>e.kind==='location'&&e.active).map(e=>e.id))
}
