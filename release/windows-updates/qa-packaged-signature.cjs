'use strict';
const fs = require('node:fs');
const path = require('node:path');
const [asar,bundle] = process.argv.slice(2);
try {
  const {verifyRelease} = require(path.join(asar,'windows-updates','release.cjs'));
  const release = verifyRelease(JSON.parse(fs.readFileSync(bundle)));
  console.log('Signature verified inside the actual packaged Electron runtime:', release.version);
} catch (error) {
  for (let detail = error; detail; detail = detail.cause) {
    console.error(detail.code, detail.message, detail.stack);
  }
  process.exitCode = 1;
}
