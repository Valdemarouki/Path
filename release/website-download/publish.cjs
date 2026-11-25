'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {setTimeout: wait} = require('node:timers/promises');
const verifier = path.resolve('verifier/desktop/windows-updates');
const {verifyRelease, feed} = require(path.join(verifier, 'release.cjs'));
const {verifyFile} = require(path.join(verifier, 'engine.cjs'));

const repository = 'Valdemarouki/Path';
const tag = 'path-windows-updates';
const installer = 'Path.Installer.exe';
const manifest = 'windows-update.sigstore.json';
const stableURL = 'https://github.com/' + repository + '/releases/download/' + tag + '/' + installer;
const api = 'repos/' + repository + '/releases/';

function gh(...args) {
  return execFileSync('gh', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']});
}
function channel() {
  return JSON.parse(gh('api', api + 'tags/' + tag));
}
function rename(asset, name) {
  gh('api', '--method', 'PATCH', api + 'assets/' + asset.id, '-f', 'name=' + name);
}
function remove(asset) {
  gh('api', '--method', 'DELETE', api + 'assets/' + asset.id);
}
function download(url, file) {
  execFileSync('curl', ['--fail', '--silent', '--show-error', '--location',
    '--proto', '=https', '--proto-redir', '=https', '--retry', '3', '--retry-all-errors',
    '--max-time', '240', '--output', file, url], {stdio: 'inherit'});
}
function matches(asset, release) {
  return asset?.state === 'uploaded' && asset.size === release.size && asset.digest === 'sha256:' + release.sha256;
}
function findAsset(deployment, name) {
  return deployment.assets.find(asset => asset.name === name);
}

async function publish(directory) {
  let current = channel();
  const feedAsset = findAsset(current, manifest);
  assert.ok(feedAsset?.state === 'uploaded' && feedAsset.size <= 128 * 1024, 'Missing signed desktop channel');
  const metadata = path.join(directory, manifest);
  download(feed + '?asset=' + feedAsset.id, metadata);
  const bytes = fs.readFileSync(metadata);
  assert.equal('sha256:' + createHash('sha256').update(bytes).digest('hex'), feedAsset.digest);
  const release = verifyRelease(JSON.parse(bytes));
  console.log('Signed channel:', release.version, release.sha256);

  if (!matches(findAsset(current, installer), release)) {
    const stageName = 'path-site-staged-' + release.sha256 + '.exe';
    let staged = findAsset(current, stageName);
    if (!matches(staged, release)) {
      const local = path.join(directory, stageName);
      download(release.url, local);
      await verifyFile(local, release);
      if (staged) remove(staged);
      gh('release', 'upload', tag, local, '--repo', repository);
    }
    current = channel();
    staged = findAsset(current, stageName);
    assert.ok(matches(staged, release), 'Uploaded installer differs from the signed release');
    if (findAsset(current, manifest)?.id !== feedAsset.id) return false;

    // Upload the complete replacement before changing the public name.
    const previous = findAsset(current, installer);
    if (previous) rename(previous, 'path-site-previous-' + previous.id + '.exe');
    try {
      rename(staged, installer);
    } catch (error) {
      const active = findAsset(channel(), installer);
      if (!active && previous) rename(previous, installer);
      if (!matches(active, release)) throw error;
    }
  }

  const actual = path.join(directory, 'public.exe');
  for (let attempt = 0; ; attempt++) {
    try {
      download(stableURL, actual);
      await verifyFile(actual, release);
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await wait(6000);
    }
  }
  current = channel();
  if (findAsset(current, manifest)?.id !== feedAsset.id) return false;
  assert.ok(matches(findAsset(current, installer), release));
  for (const asset of current.assets) {
    if (/^path-site-(?:previous-\d+|staged-[0-9a-f]{64})\.exe$/.test(asset.name)) remove(asset);
  }
  console.log('Public download verified:', stableURL, release.version, release.size, release.sha256);
  return true;
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'path-website-download-'));
  try {
    // Each run reads the current signed channel, including retries of older runs.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (await publish(directory)) return;
        throw Error('The signed channel changed during publication');
      } catch (error) {
        if (attempt === 3) throw error;
        console.warn('Retrying website download publication:', error.message);
        await wait(3000);
      }
    }
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
