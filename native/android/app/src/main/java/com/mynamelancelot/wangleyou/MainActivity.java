package com.mynamelancelot.wangleyou;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.Message;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String SITE = "https://mynamelancelot.github.io/wangleyou/";
    private FrameLayout root;
    private WebView webView;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    static boolean isSite(Uri uri) {
        String path = uri.getPath();
        return "https".equalsIgnoreCase(uri.getScheme())
                && "mynamelancelot.github.io".equalsIgnoreCase(uri.getHost())
                && uri.getPort() == -1 && uri.getUserInfo() == null
                && path != null && (path.equals("/wangleyou") || path.startsWith("/wangleyou/"));
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(7, 38, 52));
        getWindow().setNavigationBarColor(Color.BLACK);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7, 38, 52));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 35 && fullscreenView == null) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                root.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                root.setPadding(0, 0, 0, 0);
            }
            return insets;
        });
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 38, 52));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.getSettings().setSupportMultipleWindows(true); // Only user-initiated links are routed below.
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!request.isForMainFrame()) return false;
                if (isSite(uri)) return false;
                if (request.hasGesture() && "https".equalsIgnoreCase(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
                    catch (Exception ignored) { /* No browser installed. */ }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showError();
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!isSite(Uri.parse(url))) { view.stopLoading(); showError(); return; }
                errorPanel.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView source, boolean dialog, boolean userGesture, Message resultMsg) {
                if (!userGesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        Uri uri = request.getUrl();
                        if (isSite(uri)) webView.loadUrl(uri.toString());
                        else if ("https".equalsIgnoreCase(uri.getScheme())) {
                            try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
                            catch (Exception ignored) { /* No browser installed. */ }
                        }
                        view.destroy();
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view;
                fullscreenCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
                webView.setVisibility(View.GONE);
                root.setPadding(0, 0, 0, 0);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
            @Override public void onHideCustomView() { leaveFullscreen(); }
        });
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this);
        FrameLayout.LayoutParams progressLayout = new FrameLayout.LayoutParams(48, 48, android.view.Gravity.CENTER);
        root.addView(progress, progressLayout);
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(android.view.Gravity.CENTER);
        errorPanel.setBackgroundColor(Color.rgb(7, 38, 52));
        TextView message = new TextView(this);
        message.setText("网站暂时无法连接\n请检查网络后重试");
        message.setTextColor(Color.WHITE);
        message.setTextSize(18);
        message.setGravity(android.view.Gravity.CENTER);
        errorPanel.addView(message);
        Button retry = new Button(this);
        retry.setText("重新连接");
        retry.setOnClickListener(v -> webView.loadUrl(SITE));
        errorPanel.addView(retry);
        errorPanel.setVisibility(View.GONE);
        root.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (state == null) webView.loadUrl(SITE);
        else webView.restoreState(state);
    }

    private void showError() {
        progress.setVisibility(View.GONE);
        errorPanel.setVisibility(View.VISIBLE);
    }

    private void leaveFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        webView.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(0);
        root.requestApplyInsets();
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
    }

    @Override public void onBackPressed() {
        if (fullscreenView != null) { leaveFullscreen(); return; }
        webView.evaluateJavascript("Boolean(document.querySelector('.yarl__root'))", value -> {
            if (isDestroyed()) return;
            if ("true".equals(value)) {
                webView.evaluateJavascript("var target=document.querySelector('.yarl__slide_current.yarl__slide, .yarl__slide_current .yarl__slide_wrapper'); if (target) { var r=target.getBoundingClientRect(); var o={bubbles:true,cancelable:true,composed:true,pointerId:1,pointerType:'touch',isPrimary:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}; target.dispatchEvent(new PointerEvent('pointerdown',o)); target.dispatchEvent(new PointerEvent('pointerup',o)); }", null);
            } else if (webView.canGoBack()) webView.goBack();
            else MainActivity.super.onBackPressed();
        });
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        webView.saveState(out);
        super.onSaveInstanceState(out);
    }

    @Override protected void onDestroy() {
        leaveFullscreen();
        root.removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
