"""Print only local component state and redacted failure logs."""
import json,re
from start import docker,STATE,PREFIX

def status():
    state=json.loads((STATE/'state.json').read_text()) if (STATE/'state.json').exists() else {}
    for name in ['db','auth','rest','storage']:
        result=docker('inspect','--format','{{.State.Status}}',PREFIX+name,check=False)
        print(name,result.stdout.strip() or 'not created')
        if result.returncode==0 and result.stdout.strip()!='running':
            logs=docker('logs','--tail','12',PREFIX+name,check=False);value=logs.stdout+logs.stderr
            for key in ['anon','service','password','jwtSecret']:
                if state.get(key):value=value.replace(state[key],'[redacted]')
            value=re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+','[redacted-token]',value)
            print(value[-4000:])
if __name__=='__main__':status()
