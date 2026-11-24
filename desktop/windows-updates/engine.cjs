'use strict';

const {EventEmitter, once} = require('node:events');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {Readable, Transform} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {readRelease, verifyRelease, isNewer, invalid, get} = require('./release.cjs');

async function verifyFile(file, release) {
  if ((await fsp.stat(file)).size !== release.size) throw invalid();
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== release.sha256) throw invalid();
}

class WindowsUpdater extends EventEmitter {
  constructor({cache, version, fetchImpl = fetch}) {
    super();
    this.cache = cache;
    this.version = version;
    this.fetchImpl = fetchImpl;
    this.release = null;
    this.receipt = path.join(cache, 'ready.json');
  }
  select(release, bundle) {
    this.release = release;
    this.bundle = bundle;
    this.file = path.join(this.cache, release.sha256 + '.exe');
  }
  async restore() {
    try {
      if ((await fsp.stat(this.receipt)).size > 128 * 1024) throw invalid();
      const bundle = JSON.parse(await fsp.readFile(this.receipt, 'utf8'));
      const release = verifyRelease(bundle);
      if (!isNewer(release.version, this.version)) {
        await fsp.unlink(path.join(this.cache, release.sha256 + '.exe')).catch(() => {});
        await fsp.unlink(this.receipt);
        return;
      }
      this.select(release, bundle);
      await this.verifyReady();
      this.emit('update-downloaded', {version: release.version});
    } catch (err) {
      this.release = null;
      if (err.code !== 'ENOENT') await fsp.unlink(this.receipt).catch(() => {});
    }
  }
  async checkForUpdates() {
    this.release = null;
    const {release, bundle} = await readRelease(this.fetchImpl);
    if (!isNewer(release.version, this.version)) return {isUpdateAvailable: false};
    this.select(release, bundle);
    return {isUpdateAvailable: true, updateInfo: {version: release.version}};
  }
  async verifyReady() {
    if (!this.release || !isNewer(this.release.version, this.version)) throw invalid();
    await verifyFile(this.file, this.release);
  }
  async downloadUpdate() {
    const release = this.release;
    if (!release) throw invalid();
    await fsp.mkdir(this.cache, {recursive: true});
    // The single-instance app owns this directory. Remove only its old downloads.
    for (const entry of await fsp.readdir(this.cache)) {
      if (/^[0-9a-f]{64}\.(exe|part)$/.test(entry) && entry !== path.basename(this.file)) {
        await fsp.unlink(path.join(this.cache, entry)).catch(() => {});
      }
    }
    let cached = false;
    try { await this.verifyReady(); cached = true; } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'UPDATE_SIGNATURE') throw err;
    }
    if (!cached) {
      const pending = path.join(this.cache, release.sha256 + '.part');
      try {
        const response = await get(release.url, AbortSignal.timeout(20 * 60 * 1000), this.fetchImpl);
        let written = 0, last = -1;
        const meter = new Transform({transform: (chunk, _encoding, done) => {
          written += chunk.length;
          if (written > release.size) return done(invalid());
          const percent = Math.floor(100 * written / release.size);
          if (percent !== last) this.emit('download-progress', {percent});
          last = percent;
          done(null, chunk);
        }});
        await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(pending, {flags: 'wx'}));
        await verifyFile(pending, release);
        await fsp.rename(pending, this.file);
      } finally { await fsp.unlink(pending).catch(() => {}); }
    }
    await fsp.writeFile(this.receipt + '.tmp', JSON.stringify(this.bundle));
    await fsp.rename(this.receipt + '.tmp', this.receipt);
    this.emit('update-downloaded', {version: release.version});
  }
  async quitAndInstall() {
    const installer = spawn(this.file, ['--apply-path-update', String(process.pid)], {
      detached: true, stdio: 'ignore', windowsHide: true, shell: false
    });
    await once(installer, 'spawn');
    installer.unref();
    require('electron').app.quit();
  }
}

module.exports = {WindowsUpdater, verifyFile};
