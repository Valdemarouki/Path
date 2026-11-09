# Source and local-history recovery

After committing the stage, run from the repository root:

```sh
python3 mobile/package.py
```

This produces ignored local files in docs/mobile/exports:
- path-mobile-alpha-source.tar.gz — committed mobile/ and docs/mobile/, including fonts/license, evidence and build script. No dist, browser storage, credentials or desktop files.
- path-mobile-alpha.bundle — complete reachable Git history for the local feature/path-mobile-alpha branch, including the original repository baseline. It contains no other branch refs and no browser localStorage. No remote is contacted.
- SHA256SUMS — SHA-256 of the two files above.

Use `sha256sum -c SHA256SUMS` on Linux. In PowerShell, run `Get-FileHash .\path-mobile-alpha-source.tar.gz -Algorithm SHA256` and `Get-FileHash .\path-mobile-alpha.bundle -Algorithm SHA256`; compare with SHA256SUMS. Checksum files stored beside an archive detect corruption, not malicious replacement of both.

## Windows source-only run

Install Python 3 from python.org (if not already installed); Git is not needed for the source archive. In PowerShell, in the folder containing the downloaded archive:

```powershell
tar -xzf .\path-mobile-alpha-source.tar.gz
cd .\path-mobile-alpha
py -3 mobile/build.py
py -3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
```

Open http://127.0.0.1:8010 in a current Chrome/Edge/Firefox. Stop the server with Ctrl+C. Keep this extracted folder and port stable if you want to reuse that browser origin's mobile test storage. File URLs are unsupported. No dependency installation script is required.

## Recover local Git history

With Git installed, in a separate destination directory (not over an existing checkout):

```sh
git clone --branch feature/path-mobile-alpha path-mobile-alpha.bundle Path-Mobile-Recovered
cd Path-Mobile-Recovered
git log -3 --oneline
```

This is a local bundle operation, not a GitHub clone. It restores committed source/history, not localStorage or uncommitted files. JSON export from Settings is a separate manual data backup; application import is not implemented.

## Download limitation

The current chat exposes filesystem creation/inspection but no file-attachment upload/export tool. File existence, checksum and bundle recovery can be tested locally. Downloadability via the chat renderer cannot be independently verified here; a local file link alone is not a confirmed downloadable attachment. These exports must actually be copied/downloaded to storage you control before they count as an external backup. Environment publication and application deployment are not used to distribute them.
