const formatter=new Intl.NumberFormat('ar-IQ')
export const salaryOptions=[500000,750000,1000000,1250000,1500000,2000000].map(amount=>({value:`${amount.toLocaleString('en-US')}${amount===2000000?'+':''} IQD`,label:`${formatter.format(amount)}${amount===2000000?' فأكثر':''} د.ع. شهرياً`}))
