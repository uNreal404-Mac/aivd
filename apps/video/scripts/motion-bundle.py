"""Compare unique gzip JS bytes of the homepage's initial Next App Router chunks."""
import argparse
import gzip
import json
from pathlib import Path

def homepage_js(build):
    manifest=json.loads((build/"app-build-manifest.json").read_text())["pages"]
    entries=("/layout","/[locale]/layout","/[locale]/(marketing)/layout","/[locale]/(marketing)/page")
    required=entries[0],entries[2],entries[3]
    if any(key not in manifest for key in required):
        raise ValueError("Missing homepage route entries")
    paths={path for entry in entries for path in manifest.get(entry,[]) if path.endswith(".js")}
    return {name:len(gzip.compress((build/name).read_bytes(),compresslevel=9,mtime=0)) for name in sorted(paths)}

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("before",type=Path)
parser.add_argument("after",type=Path)
args=parser.parse_args()
before=homepage_js(args.before)
after=homepage_js(args.after)
delta=sum(after.values())-sum(before.values())
print(json.dumps({"method":"unique emitted homepage layout+page JS; gzip level 9 per file","before_bytes":sum(before.values()),"after_bytes":sum(after.values()),"delta_bytes":delta,"limit_bytes":40*1024,"before_chunks":before,"after_chunks":after},indent=2))
if delta>40*1024:raise SystemExit(1)
