'use strict';
const {app} = require('electron');
const path = require('node:path');
const {WindowsUpdater} = require('./windows-updates/engine.cjs');

// Installed as update-engine.cjs only in the Windows Installer distribution.
class PathUpdater extends WindowsUpdater {
  constructor() {
    super({cache: path.join(app.getPath('userData'), 'updates', 'packages'), version: app.getVersion()});
  }
}
module.exports = {PathUpdater};
