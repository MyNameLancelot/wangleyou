package com.mynamelancelot.wangleyou;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
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
import android.widget.FrameLayout;

public final class MainActivity extends Activity {
    private static final String SITE = "https://mynamelancelot.github.io/wangleyou/";
    private FrameLayout root;
    private WebView webView;
    private View statusBarScrim;
    private StartupOverlay startupOverlay;
    private boolean awaitingInitialPageStart = true;
    private boolean mainFrameError;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private static final int NORMAL_SYSTEM_UI = View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;

    static boolean isSite(Uri uri) {
        String path = uri.getPath();
        return "https".equalsIgnoreCase(uri.getScheme())
                && "mynamelancelot.github.io".equalsIgnoreCase(uri.getHost())
                && uri.getPort() == -1 && uri.getUserInfo() == null
                && path != null && (path.equals("/wangleyou") || path.startsWith("/wangleyou/"));
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.BLACK);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(NORMAL_SYSTEM_UI);
        root = new FrameLayout(this);
        root.setBackgroundColor(0xfff7f5f0);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30 && fullscreenView == null) {
                int safeTypes = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout();
                android.graphics.Insets bars = insets.getInsets(safeTypes);
                root.setPadding(bars.left, 0, bars.right, bars.bottom);
                return new WindowInsets.Builder(insets)
                        .setInsets(safeTypes, android.graphics.Insets.of(0, bars.top, 0, 0))
                        .build();
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
                if (mainFrameError) return;
                webView.setVisibility(View.VISIBLE);
                startupOverlay.hideAfterLoad(() -> {
                    statusBarScrim.setVisibility(View.VISIBLE);
                    setLoadingStatusBar(false);
                });
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showError();
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!isSite(Uri.parse(url))) { view.stopLoading(); showError(); return; }
                mainFrameError = false;
                if (awaitingInitialPageStart) awaitingInitialPageStart = false;
                else startupOverlay.showLoading();
                statusBarScrim.setVisibility(View.GONE);
                setLoadingStatusBar(true);
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
                statusBarScrim.setVisibility(View.GONE);
                root.setPadding(0, 0, 0, 0);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
            @Override public void onHideCustomView() { leaveFullscreen(); }
        });
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        webView.setVisibility(View.INVISIBLE);
        statusBarScrim = new View(this);
        statusBarScrim.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[] { 0x80000000, 0x00000000 }));
        statusBarScrim.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        root.addView(statusBarScrim, new FrameLayout.LayoutParams(-1, (int) (72 * getResources().getDisplayMetrics().density), android.view.Gravity.TOP));
        statusBarScrim.setVisibility(View.GONE);
        startupOverlay = new StartupOverlay(this, () -> webView.loadUrl(SITE));
        root.addView(startupOverlay, new FrameLayout.LayoutParams(-1, -1));
        setLoadingStatusBar(true);
        setContentView(root);
        if (state == null) webView.loadUrl(SITE);
        else webView.restoreState(state);
    }

    private void showError() {
        mainFrameError = true;
        startupOverlay.showError();
        statusBarScrim.setVisibility(View.GONE);
        setLoadingStatusBar(true);
    }

    private void setLoadingStatusBar(boolean loading) {
        int flags = Build.VERSION.SDK_INT >= 30 ? 0 : NORMAL_SYSTEM_UI;
        if (loading) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    private void leaveFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        webView.setVisibility(View.VISIBLE);
        statusBarScrim.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(Build.VERSION.SDK_INT >= 30 ? 0 : NORMAL_SYSTEM_UI);
        root.requestApplyInsets();
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
    }

    @Override public void onBackPressed() {
        if (fullscreenView != null) { leaveFullscreen(); return; }
        // 把系统返回映射到查看器已有的 Esc 契约，关闭状态仍由网页 playback 持有。
        webView.evaluateJavascript("(function(){var viewer=document.querySelector('.yarl__container'); if(!viewer) return false; viewer.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); return true})()", value -> {
            if (isDestroyed()) return;
            if ("true".equals(value)) return;
            if (webView.canGoBack()) webView.goBack();
            else MainActivity.super.onBackPressed();
        });
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        webView.saveState(out);
        super.onSaveInstanceState(out);
    }

    @Override protected void onPause() {
        if (startupOverlay != null) startupOverlay.pausePlayback();
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (startupOverlay != null) startupOverlay.resumePlayback();
    }

    @Override protected void onDestroy() {
        leaveFullscreen();
        startupOverlay.dispose();
        root.removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
