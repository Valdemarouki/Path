# Path mobile preview

The Android and iOS applications bundle the Path interface validated on November 23, 2026. They keep the planner, fonts, exercise illustrations and sync client on the device. They use a persistent WebView on Android and WKWebView on iOS. The first sign-in and the first download of an account's planner require a connection. After that, both clients can start from the local checkpoint. The native app has its own session and local storage, so sign in once even if Path is already open in the browser.

The in-app document uses the existing Path Mobile HTTPS origin. The operating system's web view sends account cookies directly to the existing service. Credentials are never passed to a JavaScript/native bridge. This preview uses the existing first-party Path Accounts email/password flow.

## Build

From this directory, install esbuild 0.28.2 and run `node tools/build-shell.cjs`. The script verifies the SHA-256 of the complete bundled source and embeds the assets in `generated/shell.html`. Copy `bundle/OPEN-SOURCE-LICENSES.txt` to `generated/` for Android. The CI workflow records the actual commands.

For Android, use Java 17, Gradle 8.9 and SDK 35. Run `gradle -p android :app:assembleDebug`. The preview uses the separate application ID `com.pathyourday.path.preview` and a debug signing identity.

For iOS, run `xcodegen generate` in `ios/` and open the generated `PathPreview.xcodeproj`. The minimum version is iOS 17. CI builds a Simulator app and an unsigned device archive. A physical iPhone needs Apple development or distribution signing. TestFlight requires a team and an App Store Connect app record.
