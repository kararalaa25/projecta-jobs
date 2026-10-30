"""Remove only labelled disposable projecta-stage resources and their temporary files."""
import shutil
from start import docker,STATE,PREFIX
for name in ['storage','rest','auth','db']:
    container=PREFIX+name
    result=docker('inspect','--format','{{index .Config.Labels "projecta.staging"}}',container,check=False)
    if result.returncode==0 and result.stdout.strip()=='true':
        docker('stop','--time','3',container,check=False);docker('rm','-v',container,check=False)
result=docker('network','inspect','--format','{{index .Labels "projecta.staging"}}',PREFIX+'net',check=False)
if result.returncode==0 and result.stdout.strip()=='true':docker('network','rm',PREFIX+'net',check=False)
if str(STATE)=='/tmp/projecta-local-staging':shutil.rmtree(STATE,ignore_errors=True)
print('Disposable staging resources removed.')
