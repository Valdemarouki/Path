package com.pathyourday.path;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.util.Collections;

public final class MainActivity extends Activity {
    static final String HOST = "path-mobile-stfqgdvl.waldek-path.workers.dev";
    static final String ENTRY = "https://" + HOST + "/open/";
    private WebView web;
    private ValueCallback<Uri[]> fileChoice;
    private AlertDialog problem;

    private static boolean firstParty(Uri url) {
        if (!"https".equals(url.getScheme()) || url.getUserInfo() != null ||
                (url.getPort() != -1 && url.getPort() != 443)) return false;
        String host = url.getHost();
        return HOST.equals(host) || "account.pathyourday.com".equals(host) ||
                "stfqgdvltwprzzcuocsv.supabase.co".equals(host);
    }
    private static boolean isEntry(Uri url) {
        return firstParty(url) && HOST.equals(url.getHost()) &&
                ("/open/".equals(url.getPath()) || "/app/".equals(url.getPath()));
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (android.os.Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16,16,18));
        setContentView(web);
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets v = insets.getInsets(WindowInsets.Type.systemBars() |
                        WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(v.left, v.top, v.right, v.bottom);
            }
            return insets;
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri url = request.getUrl();
                if (firstParty(url)) return false;
                if (request.hasGesture() && "https".equals(url.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,url)); } catch (ActivityNotFoundException ignored) {}
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest r) {
                if (!r.isForMainFrame() || !"GET".equals(r.getMethod()) || !isEntry(r.getUrl())) return null;
                try {
                    return new WebResourceResponse("text/html","UTF-8",200,"OK",
                            Collections.singletonMap("Cache-Control","no-store"),getAssets().open("shell.html"));
                } catch (IOException unavailable) { return null; }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest r, WebResourceError error) {
                if (r.isForMainFrame()) offerRetry();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> result, FileChooserParams p) {
                if (fileChoice != null) fileChoice.onReceiveValue(null);
                fileChoice = result;
                try { startActivityForResult(p.createIntent(), 7); }
                catch (ActivityNotFoundException err) { fileChoice.onReceiveValue(null); fileChoice=null; }
                return true;
            }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(ENTRY);
    }
    private void offerRetry() {
        if (isFinishing() || (problem != null && problem.isShowing())) return;
        problem = new AlertDialog.Builder(this).setMessage("Path could not open this page.")
                .setPositiveButton("Retry",(dialog,button)->web.loadUrl(ENTRY))
                .setNegativeButton(android.R.string.cancel,null).show();
    }
    @Override protected void onActivityResult(int code,int result,Intent data) {
        super.onActivityResult(code,result,data);
        if (code==7 && fileChoice!=null) {
            fileChoice.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));
            fileChoice=null;
        }
    }
    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); web.saveState(state); }
    @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); }
    @Override protected void onDestroy() {
        if (fileChoice != null) fileChoice.onReceiveValue(null);
        if (problem != null) problem.dismiss();
        web.destroy(); super.onDestroy();
    }
}
