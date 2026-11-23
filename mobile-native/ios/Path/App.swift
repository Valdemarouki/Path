import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = PlannerController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class PlannerController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private static let host = "path-mobile-stfqgdvl.waldek-path.workers.dev"
    private static let entry = URL(string: "https://" + host + "/open/")!
    private let web = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
    private let shell = Bundle.main.url(forResource: "shell", withExtension: "html").flatMap { try? Data(contentsOf: $0) }
    private var nextSimulatedURL: URL?
    private var shellNavigation: WKNavigation?
    private var sharingDownload: URL?

    private func isFirstParty(_ url: URL) -> Bool {
        let domains = [Self.host, "account.pathyourday.com", "stfqgdvltwprzzcuocsv.supabase.co"]
        return url.scheme == "https" && url.user == nil && url.password == nil &&
            (url.port == nil || url.port == 443) && domains.contains(url.host?.lowercased() ?? "")
    }
    private func isEntry(_ url: URL) -> Bool {
        guard let path = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedPath else { return false }
        return isFirstParty(url) && url.host == Self.host && ["/open/", "/app/"].contains(path)
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        let background = UIColor(white: 0.064, alpha: 1)
        view.backgroundColor = background
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = background
        web.scrollView.backgroundColor = background
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        showShell(at: Self.entry)
    }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    private func showShell(at url: URL) {
        guard let shell, let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "text/html; charset=utf-8", "Cache-Control":"no-store"]) else {
            web.load(URLRequest(url: url))
            return
        }
        nextSimulatedURL = url
        shellNavigation = web.loadSimulatedRequest(URLRequest(url: url), response: response, responseData: shell)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload { decisionHandler(.download); return }
        if action.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }
        if !isFirstParty(url) {
            decisionHandler(.cancel)
            if action.navigationType == .linkActivated && url.scheme == "https" { UIApplication.shared.open(url) }
            return
        }
        if action.targetFrame == nil { decisionHandler(.cancel); webView.load(action.request); return }
        if shell != nil && isEntry(url) && action.request.httpMethod == "GET" {
            if nextSimulatedURL == url { nextSimulatedURL = nil }
            else { decisionHandler(.cancel); showShell(at: url); return }
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        nextSimulatedURL = nil
        if let url = webView.url, shell != nil, isEntry(url), navigation !== shellNavigation {
            showShell(at: url)
            return
        }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--path-smoke") {
            let script = "({bundled:document.querySelector('meta[name=path-native-shell]')?.content==='preview-1', origin:location.origin, locks:!!navigator.locks, login:!!document.querySelector('#personal-account form')})"
            webView.evaluateJavaScript(script) { value, _ in
                guard let value, let bytes = try? JSONSerialization.data(withJSONObject: value) else { return }
                let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                try? bytes.write(to: dir.appendingPathComponent("native-smoke.json"), options: .atomic)
            }
        }
        #endif
    }
    private func retry(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled || presentedViewController != nil { return }
        let alert = UIAlertController(title: "Path", message: "This page could not be opened.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title:"Retry", style:.default) { _ in self.showShell(at: Self.entry) })
        alert.addAction(UIAlertAction(title:"Cancel", style:.cancel))
        present(alert, animated:true)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { retry(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { retry(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { showShell(at: Self.entry) }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
}

extension PlannerController: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let name = URL(fileURLWithPath: suggestedFilename).lastPathComponent
            guard !name.isEmpty, name != ".", name != ".." else { completionHandler(nil); return }
            sharingDownload = dir.appendingPathComponent(name)
            completionHandler(sharingDownload)
        } catch { completionHandler(nil) }
    }
    func downloadDidFinish(_ download: WKDownload) {
        guard let file = sharingDownload else { return }
        sharingDownload = nil
        let share = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        share.popoverPresentationController?.sourceView = view
        share.completionWithItemsHandler = { _, _, _, _ in try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        present(share, animated: true)
    }
}
