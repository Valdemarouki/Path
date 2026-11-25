"""Create a runner-only older client. The release artifact never includes this transport."""
import json
import os
import sys
from pathlib import Path
from prepare import pack, unpack

if os.getenv('GITHUB_ACTIONS') != 'true' or os.getenv('RUNNER_OS') != 'Windows':
    raise SystemExit('Disposable Windows runner required')
source, destination, bundle, setup = (Path(value).resolve() for value in sys.argv[1:])
entries = unpack(source.read_bytes())
package = json.loads(entries['package.json'])
latest = package['version']
package['version'] = '2.0.0-rc.22'
entries['package.json'] = json.dumps(package).encode()
base = 'https://github.com/Valdemarouki/Path/releases/download/'
paths = {base+'path-windows-updates/windows-update.sigstore.json':str(bundle),
         base+'path-windows-'+latest+'/Path.Installer.exe':str(setup)}
fixture = """
const qaTrace = %s;
const record = line => require('node:fs').appendFileSync(qaTrace,line+'\\n');
const {WindowsUpdater: QaUpdater} = require('./windows-updates/engine.cjs');
for (const action of ['checkForUpdates','downloadUpdate','verifyReady']) {
  const method = QaUpdater.prototype[action];
  QaUpdater.prototype[action] = async function(...args) {
    try { return await method.apply(this,args); }
    catch (error) {
      for (let detail=error; detail; detail=detail.cause) record(action+' '+detail.code+' '+detail.message);
      throw error;
    }
  };
}
globalThis.fetch = async url => {
  const files = %s;
  if (!Object.hasOwn(files,url)) throw Error('Unexpected fixture request');
  return new Response(require('node:stream').Readable.toWeb(require('node:fs').createReadStream(files[url])));
};
""" % (json.dumps(str(bundle.parent/"qa-transport.log")),json.dumps(paths))
entries['main.cjs'] = fixture.encode() + entries['main.cjs']
destination.write_bytes(pack(entries))
