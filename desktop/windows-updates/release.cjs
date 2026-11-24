'use strict';

const {bundleFromJSON} = require('@sigstore/bundle');
const {TrustedRoot} = require('@sigstore/protobuf-specs');
const {Verifier, toSignedEntity, toTrustMaterial} = require('@sigstore/verify');

const repository = 'Valdemarouki/Path';
const releases = 'https://github.com/' + repository + '/releases/download/';
const feed = releases + 'path-windows-updates/windows-update.sigstore.json';
const predicateType = 'https://pathyourday.com/attestations/windows-update/v1';
const workflow = 'https://github.com/' + repository +
  '/.github/workflows/windows-in-app-updates.yml@refs/heads/release/windows-updates';
const verifier = new Verifier(toTrustMaterial(TrustedRoot.fromJSON(require('./sigstore-root.json'))));
const allowedHosts = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

function invalid() {
  return Object.assign(new Error('Path update verification failed'), {code: 'UPDATE_SIGNATURE'});
}

function versionParts(version) {
  const match = typeof version === 'string' && /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})(?:-rc\.(0|[1-9]\d{0,4}))?$/.exec(version);
  if (!match) throw invalid();
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? Infinity : Number(match[4])];
}

function isNewer(candidate, current) {
  const a = versionParts(candidate), b = versionParts(current);
  const i = a.findIndex((n, index) => n !== b[index]);
  return i !== -1 && a[i] > b[i];
}

function verifyRelease(bundle) {
  try {
    if (bundle.dsseEnvelope?.payloadType !== 'application/vnd.in-toto+json') throw invalid();
    const signer = verifier.verify(toSignedEntity(bundleFromJSON(bundle)), {
      extensions: {issuer: 'https://token.actions.githubusercontent.com'}
    });
    if (signer.identity?.subjectAlternativeName !== workflow) throw invalid();
    const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, 'base64').toString('utf8'));
    const {version, size, platform} = statement.predicate;
    versionParts(version);
    if (statement._type !== 'https://in-toto.io/Statement/v1' || statement.predicateType !== predicateType ||
        platform !== 'win32-x64' || !Number.isSafeInteger(size) || size <= 0 || size > 512 * 1024 * 1024 ||
        statement.subject.length !== 1 || statement.subject[0].name !== 'Path.Installer.exe') throw invalid();
    const sha256 = statement.subject[0].digest.sha256;
    if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) throw invalid();
    return {version, size, sha256, url: releases + 'path-windows-' + version + '/Path.Installer.exe'};
  } catch { throw invalid(); }
}

async function get(url, signal, fetchImpl = fetch) {
  for (let redirects = 0; redirects <= 4; redirects++) {
    const next = new URL(url);
    if (next.protocol !== 'https:' || next.username || next.password || next.port || !allowedHosts.has(next.hostname)) throw invalid();
    const response = await fetchImpl(next.href, {redirect: 'manual', cache: 'no-store', signal});
    if (response.status === 200 && response.body) return response;
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (![301,302,303,307,308].includes(response.status) || !location) throw Error('Update unavailable');
    url = new URL(location, next).href;
  }
  throw invalid();
}

async function readRelease(fetchImpl) {
  const response = await get(feed, AbortSignal.timeout(25000), fetchImpl);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 128 * 1024) throw invalid();
    chunks.push(chunk);
  }
  const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return {release: verifyRelease(bundle), bundle};
}

module.exports = {readRelease, verifyRelease, isNewer, invalid, get, feed};
