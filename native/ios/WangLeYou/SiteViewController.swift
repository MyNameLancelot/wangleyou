import UIKit
import WebKit

final class SiteViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private static let siteURL = URL(string: "https://mynamelancelot.github.io/wangleyou/")!
    private let progress = UIProgressView(progressViewStyle: .bar)
    private let errorPanel = UIStackView()
    private var webView: WKWebView!
    private var progressObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 7 / 255, green: 38 / 255, blue: 52 / 255, alpha: 1)
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])

        progress.translatesAutoresizingMaskIntoConstraints = false
        progress.tintColor = UIColor(red: 0.98, green: 0.85, blue: 0.56, alpha: 1)
        view.addSubview(progress)
        NSLayoutConstraint.activate([
            progress.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
            progress.topAnchor.constraint(equalTo: webView.topAnchor)
        ])
        progressObservation = webView.observe(\.estimatedProgress, options: [.initial, .new]) { [weak self] webView, _ in
            self?.progress.progress = Float(webView.estimatedProgress)
        }

        errorPanel.axis = .vertical
        errorPanel.spacing = 16
        errorPanel.alignment = .center
        errorPanel.translatesAutoresizingMaskIntoConstraints = false
        errorPanel.backgroundColor = view.backgroundColor
        let message = UILabel()
        message.text = "网站暂时无法连接\n请检查网络后重试"
        message.numberOfLines = 2
        message.textAlignment = .center
        message.textColor = .white
        message.font = .preferredFont(forTextStyle: .headline)
        let retry = UIButton(type: .system)
        retry.setTitle("重新连接", for: .normal)
        retry.tintColor = UIColor(red: 0.98, green: 0.85, blue: 0.56, alpha: 1)
        retry.addTarget(self, action: #selector(retrySite), for: .touchUpInside)
        errorPanel.addArrangedSubview(message)
        errorPanel.addArrangedSubview(retry)
        view.addSubview(errorPanel)
        NSLayoutConstraint.activate([
            errorPanel.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
            errorPanel.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
            errorPanel.topAnchor.constraint(equalTo: webView.topAnchor),
            errorPanel.bottomAnchor.constraint(equalTo: webView.bottomAnchor)
        ])
        errorPanel.isHidden = true
        loadSite()
    }

    private func loadSite() {
        errorPanel.isHidden = true
        progress.isHidden = false
        webView.load(URLRequest(url: Self.siteURL))
    }

    @objc private func retrySite() { loadSite() }

    private static func isSite(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https"
            && url.host?.lowercased() == "mynamelancelot.github.io"
            && url.port == nil
            && url.user == nil
            && (url.path == "/wangleyou" || url.path.hasPrefix("/wangleyou/"))
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if Self.isSite(url) { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated && url.scheme?.lowercased() == "https" {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard navigationAction.targetFrame == nil, let url = navigationAction.request.url else { return nil }
        if Self.isSite(url) { webView.load(navigationAction.request) }
        else if navigationAction.navigationType == .linkActivated && url.scheme?.lowercased() == "https" {
            UIApplication.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        errorPanel.isHidden = true
        progress.isHidden = false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        progress.isHidden = true
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame,
           let response = navigationResponse.response as? HTTPURLResponse,
           response.statusCode >= 400 {
            progress.isHidden = true
            errorPanel.isHidden = false
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showError(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showError(error)
    }

    private func showError(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        progress.isHidden = true
        errorPanel.isHidden = false
    }

    deinit { progressObservation?.invalidate() }
}
