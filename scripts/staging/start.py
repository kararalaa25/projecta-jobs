"""Start a disposable local Auth/PostgREST/Storage stack. Never reads production credentials."""
import base64,hashlib,hmac,json,os,secrets,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
STATE=Path('/tmp/projecta-local-staging')
DOCKER=['docker','--host=unix:///var/run/docker.sock']
PREFIX='projecta-stage-'
def docker(*args,input=None,check=True):
    env=os.environ.copy()
    for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
    return subprocess.run(DOCKER+list(args),input=input,text=True,capture_output=True,check=check,env=env)
def envfile(name,values):
    path=STATE/(name+'.env');path.write_text('\n'.join(f'{k}={v}' for k,v in values.items())+'\n');path.chmod(0o600);return str(path)
def main():
    STATE.mkdir(mode=0o700,exist_ok=True)
    if (STATE/'state.json').exists():raise SystemExit('Existing staging state found; stop that stack before creating another.')
    images=json.loads((ROOT/'scripts/staging/images.json').read_text())
    secret=secrets.token_hex(32);password=secrets.token_hex(24);gateway=52345
    def jwt(role):
        enc=lambda d:base64.urlsafe_b64encode(json.dumps(d,separators=(',',':')).encode()).rstrip(b'=')
        raw=enc({'alg':'HS256','typ':'JWT'})+b'.'+enc({'role':role,'iss':'projecta-local-staging','iat':int(time.time()),'exp':int(time.time())+86400})
        return (raw+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),raw,hashlib.sha256).digest()).rstrip(b'=')).decode()
    state={'url':f'http://127.0.0.1:{gateway}','anon':jwt('anon'),'service':jwt('service_role'),'password':password,'jwtSecret':secret,'containers':[],'network':PREFIX+'net'}
    def save():
        path=STATE/'state.json';path.write_text(json.dumps(state));path.chmod(0o600)
    docker('network','create','--internal','--label','projecta.staging=true',state['network']);save()
    def run(name,image,values,port,extra=()):
        full=PREFIX+name
        docker('run','-d','--name',full,'--label','projecta.staging=true','--network',state['network'],'--env-file',envfile(name,values),*extra,image)
        state['containers'].append(full);state[name+'Port']=port;save()
    run('db',images['db'],{'POSTGRES_PASSWORD':password},5432)
    for _ in range(40):
        if docker('exec',PREFIX+'db','pg_isready','-h','127.0.0.1','-U','postgres',check=False).returncode==0:break
        time.sleep(.25)
    else:raise RuntimeError('Staging PostgreSQL startup timed out')
    bootstrap=f"""
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password '{password}';
grant anon,authenticated,service_role to authenticator;
create role supabase_auth_admin login noinherit password '{password}';
create role supabase_storage_admin login noinherit bypassrls password '{password}';
grant anon,authenticated,service_role to supabase_storage_admin;
create schema auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path=auth,public;
create schema storage authorization supabase_storage_admin;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant all on schema public to service_role;
create extension if not exists pgcrypto;
create extension if not exists \"uuid-ossp\";
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role')$$;
create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
alter function auth.uid() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;
alter function auth.jwt() owner to supabase_auth_admin;
"""
    docker('exec','-i',PREFIX+'db','psql','-U','postgres','-v','ON_ERROR_STOP=1',input=bootstrap)
    no_proxy='localhost,127.0.0.1,'+','.join(PREFIX+s for s in ['db','rest','auth','storage'])
    run('auth',images['auth'],{'GOTRUE_API_HOST':'0.0.0.0','GOTRUE_API_PORT':'9999','API_EXTERNAL_URL':state['url']+'/auth/v1','GOTRUE_SITE_URL':state['url'],'GOTRUE_DB_DRIVER':'postgres','GOTRUE_DB_DATABASE_URL':f'postgres://supabase_auth_admin:{password}@{PREFIX}db:5432/postgres','GOTRUE_JWT_SECRET':secret,'GOTRUE_JWT_AUD':'authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated','GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_MAILER_AUTOCONFIRM':'false','GOTRUE_SMTP_HOST':'127.0.0.1','GOTRUE_SMTP_PORT':'1','GOTRUE_DISABLE_SIGNUP':'true','NO_PROXY':no_proxy},9999)
    run('rest',images['rest'],{'PGRST_DB_URI':f'postgres://authenticator:{password}@{PREFIX}db:5432/postgres','PGRST_DB_SCHEMAS':'public,storage','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':secret,'PGRST_SERVER_PORT':'3000','NO_PROXY':no_proxy},3000)
    code_mounts=[]
    for name in ['api','server','config','src','tests','node_modules','package.json']:
        code_mounts+=['--mount',f'type=bind,src={ROOT/name},dst=/review/{name},readonly']
    run('storage',images['storage'],{'ANON_KEY':state['anon'],'SERVICE_KEY':state['service'],'AUTH_JWT_SECRET':secret,'DATABASE_URL':f'postgres://supabase_storage_admin:{password}@{PREFIX}db:5432/postgres','POSTGREST_URL':f'http://{PREFIX}rest:3000','STORAGE_PUBLIC_URL':state['url'],'REQUEST_ALLOW_X_FORWARDED_PATH':'true','FILE_SIZE_LIMIT':'5242880','STORAGE_BACKEND':'file','FILE_STORAGE_BACKEND_PATH':'/var/lib/storage','TENANT_ID':'projecta-local','GLOBAL_S3_BUCKET':'projecta-local','REGION':'local','ENABLE_IMAGE_TRANSFORMATION':'false','NO_PROXY':no_proxy},5000,extra=(*code_mounts,'--mount',f'type=bind,src={STATE}/state.json,dst=/run/projecta-stage.json,readonly'))
    print('Local staging containers created. Credentials are ephemeral and private. State:',STATE/'state.json')
if __name__=='__main__':
    try:main()
    except subprocess.CalledProcessError as e:raise SystemExit(f'Staging setup command failed (exit {e.returncode}); inspect redacted component status, never dump env files.')
