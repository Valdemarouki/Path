'use strict';
const fs = require('node:fs');
const path = require('node:path');
const [asar,bundle] = process.argv.slice(2);
try {
  const {verifyRelease} = require(path.join(asar,'windows-updates','release.cjs'));
  const raw = JSON.parse(fs.readFileSync(bundle));
  const release = verifyRelease(raw);
  const changed = structuredClone(raw);
  changed.dsseEnvelope.payload = Buffer.from('{}').toString('base64');
  require('node:assert/strict').throws(() => verifyRelease(changed),{code:'UPDATE_SIGNATURE'});
  console.log('Signature verified inside the actual packaged Electron runtime:', release.version);
} catch (error) {
  for (let detail = error; detail; detail = detail.cause) {
    console.error(detail.code, detail.message, detail.stack);
  }
  const crypto = require('node:crypto');
  const keys = crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const bytes = Buffer.from('Path verifier diagnostic');
  const signature = crypto.sign('sha256',bytes,keys.privateKey);
  for (const digest of [undefined,'sha256']) {
    try {console.error('P-256 verification, digest',String(digest),crypto.verify(digest,bytes,keys.publicKey,signature));}
    catch (err) {console.error('P-256 verification, digest',String(digest),err.message);}
  }
  process.exitCode = 1;
}
