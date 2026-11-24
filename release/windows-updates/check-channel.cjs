'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {readRelease, verifyRelease, isNewer} = require('../../desktop/windows-updates/release.cjs');
const [previous, candidate] = process.argv.slice(2);
(async () => {
  const next = verifyRelease(JSON.parse(fs.readFileSync(candidate)));
  if (previous !== '--public') {
    const old = verifyRelease(JSON.parse(fs.readFileSync(previous)));
    assert.ok(isNewer(next.version,old.version) || (next.version === old.version && next.sha256 === old.sha256), 'Refusing to roll back or replace a published build');
    return;
  }
  for (let attempt=0; attempt<8; attempt++) {
    try {
      const live = (await readRelease()).release;
      assert.deepEqual(live,next);
      console.log('Public desktop channel verified:',live.version,live.sha256);
      return;
    } catch (err) { if (attempt===7) throw err; await new Promise(resolve=>setTimeout(resolve,6000)); }
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
