"""One-shot real local acceptance test; always removes disposable services afterward."""
import subprocess,sys
from pathlib import Path
from start import ROOT,STATE
HERE=Path(__file__).resolve().parent
if (STATE/'state.json').exists():raise SystemExit('A staging stack already exists. Stop it explicitly before running a new one.')
code=0
try:
    for script in ['start.py','migrate.py','test.py']:
        result=subprocess.run([sys.executable,str(HERE/script)],cwd=ROOT)
        if result.returncode:
            code=result.returncode
            subprocess.run([sys.executable,str(HERE/'status.py')],cwd=ROOT)
            break
finally:subprocess.run([sys.executable,str(HERE/'stop.py')],cwd=ROOT)
raise SystemExit(code)
