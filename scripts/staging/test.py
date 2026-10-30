"""Run the real acceptance test inside the isolated Storage container."""
from start import docker,PREFIX
result=docker('exec','-w','/review',PREFIX+'storage','node','tests/integration/local-storage.mjs',check=False)
print(result.stdout,end='')
print(result.stderr,end='')
raise SystemExit(result.returncode)
