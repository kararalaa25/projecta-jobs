"""Shared 18-governorate catalog and conservative role/location matching."""
import json,re
from pathlib import Path
CATALOG=json.loads((Path(__file__).parent/'config/iraq.json').read_text())
GOVERNORATES=CATALOG['governorates']
ROLE_IDS=tuple(r['id'] for r in CATALOG['roles'])
def normalize(value):
    return re.sub(r'\s+',' ',re.sub(r'[\u064b-\u065f\u0670\u0640]','',value).translate(str.maketrans({'أ':'ا','إ':'ا','آ':'ا','ة':'ه','ى':'ي','_':' '})).casefold())
def locations(text):
    value=normalize(text);found=[]
    for governorate in GOVERNORATES:
        positions=[]
        for alias in governorate['aliases']:
            match=re.search(r'(?<!\w)(?:و?ب|و?في|و)?'+re.escape(normalize(alias))+r'(?!\w)',value)
            if match:
                prefix=value[max(0,match.start()-25):match.start()]
                explicit=bool(re.search(r'(?:الموقع|العنوان|المحافظه|مكان العمل|العمل في)\s*[:/\-]?\s*$',prefix))
                positions.append((not explicit,match.start()))
        if positions:found.append((min(positions),governorate['id']))
    return [g for _,g in sorted(found)]
PATTERNS=json.loads((Path(__file__).parent/'config/job-role-rules.json').read_text())['patterns']
def classify_roles(text):
    value=normalize(text)
    # Consume assistants first so “مساعدة طبيب أسنان” does not become a dentist.
    assistant=re.compile(PATTERNS['Assistants & Techs'])
    spans=[m.span() for m in assistant.finditer(value)]
    found=[]
    for role,pattern in PATTERNS.items():
        matches=list(re.finditer(pattern,value))
        if role in ('Dentists','General Physicians'):matches=[m for m in matches if not any(start<=m.start()<end for start,end in spans)]
        if role in ('Dentists','General Physicians','Pharmacists'):matches=[m for m in matches if not re.search(r'(?:عياده|لعياده|خريج|خريجه|خريجي|شهاده|بكالوريوس|لزياره|زياره|التواصل مع|التعامل مع|للتعامل مع|مراجعه|تستهدف)\s*$',value[max(0,m.start()-45):m.start()])]
        if role in ('Dentists','General Physicians','Pharmacists') and re.search(PATTERNS['Medical Reps'],value):
            matches=[m for m in matches if not re.search(r'(?:خريج|خريجه|خريجي|شهاده|بكالوريوس)\s*$',value[max(0,m.start()-20):m.start()])]
            if re.search(r'للعمل\s*مندوب',value):matches=[]
        if role=='Assistants & Techs' and re.search(PATTERNS['Medical Reps'],value):
            matches=[m for m in matches if not re.fullmatch(r'مختبر(?:ات)?',m.group())]
        if matches:found.append((matches[0].start(),role))
    return [role for _,role in sorted(found)]
