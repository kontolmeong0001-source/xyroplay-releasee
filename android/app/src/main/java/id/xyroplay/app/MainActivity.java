package id.xyroplay.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.JavaScriptReplyProxy;
import java.io.OutputStream;
import java.util.Collections;
import java.util.Locale;
import java.util.regex.Pattern;
import android.util.Base64;

public final class MainActivity extends Activity {
    private static final int PHOTO_REQUEST = 1001, SAVE_REQUEST = 1002;
    private static final int MAX_BYTES = 10 * 1024 * 1024;
    private static final int MAX_MESSAGE_CHARS = 14_100_000;
    private WebView webView;
    private ValueCallback<Uri[]> photoCallback;
    private byte[] pendingBytes;
    private String pendingFilename, pendingMime, pendingRequestId;
    private JavaScriptReplyProxy pendingReply;

    private static boolean isTrustedOrigin(Uri uri) { return DownloadPolicy.isTrustedOrigin(uri); }
    private static boolean isLocalDocument(Uri uri) { return DownloadPolicy.isTrustedOrigin(uri) && DownloadPolicy.isTrustedDocument(uri.getPath()); }
    private boolean isCurrentTrustedPage(WebView view) { return view == webView && isLocalDocument(Uri.parse(view.getUrl() == null ? "" : view.getUrl())); }
    private void openExternal(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); } catch (android.content.ActivityNotFoundException ignored) { }
    }
    private void replySave(String outcome, String detail) {
        JavaScriptReplyProxy reply = pendingReply;
        pendingReply = null;
        if (reply != null && webView != null) {
            try { reply.postMessage("{\"id\":" + org.json.JSONObject.quote(pendingRequestId == null ? "" : pendingRequestId) + ",\"outcome\":" + org.json.JSONObject.quote(outcome) + ",\"detail\":" + org.json.JSONObject.quote(detail == null ? "" : detail) + "}"); } catch (RuntimeException ignored) { }
        }
        pendingRequestId = null;
    }
    private void clearPending() { pendingBytes = null; pendingFilename = null; pendingMime = null; pendingReply = null; pendingRequestId = null; }
    private void requestSave(String json, JavaScriptReplyProxy reply) {
        if (json == null || json.length() > MAX_MESSAGE_CHARS) { reply.postMessage("{\"id\":\"\",\"outcome\":\"error\",\"detail\":\"File is too large\"}"); return; }
        String requestId = "";
        try {
            org.json.JSONObject o = new org.json.JSONObject(json);
            if (!"save".equals(o.optString("type"))) return;
            String id = o.optString("id", "");
            requestId = id;
            if (pendingBytes != null) { reply.postMessage("{\"id\":" + org.json.JSONObject.quote(id) + ",\"outcome\":\"error\",\"detail\":\"Penyimpanan lain masih berlangsung\"}"); return; }
            String mime = DownloadPolicy.validMime(o.optString("mime", "application/octet-stream"));
            if (mime == null) { reply.postMessage("{\"id\":" + org.json.JSONObject.quote(id) + ",\"outcome\":\"error\",\"detail\":\"Unsupported file type\"}"); return; }
            String encoded = o.getString("data");
            if (DownloadPolicy.encodedSizeExceedsLimit(encoded.length(), MAX_BYTES)) throw new IllegalArgumentException("File exceeds 10 MiB");
            byte[] decoded = Base64.decode(encoded, Base64.DEFAULT);
            if (decoded.length == 0 || decoded.length > MAX_BYTES) throw new IllegalArgumentException("File exceeds 10 MiB");
            pendingBytes = decoded; pendingFilename = DownloadPolicy.cleanFilename(o.optString("filename", "download.bin")); pendingMime = mime; pendingReply = reply; pendingRequestId = id;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(pendingMime).putExtra(Intent.EXTRA_TITLE, pendingFilename);
            startActivityForResult(intent, SAVE_REQUEST);
        } catch (Exception e) { reply.postMessage("{\"id\":" + org.json.JSONObject.quote(requestId) + ",\"outcome\":\"error\",\"detail\":" + org.json.JSONObject.quote(e.getMessage() == null ? "Unable to save file" : e.getMessage()) + "}"); clearPending(); }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings s = webView.getSettings(); s.setJavaScriptEnabled(true); s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setAllowFileAccessFromFileURLs(false); s.setAllowUniversalAccessFromFileURLs(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); s.setSafeBrowsingEnabled(true); s.setDomStorageEnabled(true); s.setJavaScriptCanOpenWindowsAutomatically(false); s.setSupportMultipleWindows(false);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "xyroSaveBridge", Collections.singleton("https://appassets.androidplatform.net"), new WebViewCompat.WebMessageListener() {
                @Override public void onPostMessage(WebView view, WebMessageCompat message, Uri sourceOrigin, boolean isMainFrame, JavaScriptReplyProxy replyProxy) {
                    if (!isMainFrame || !isTrustedOrigin(sourceOrigin) || !isCurrentTrustedPage(view) || message.getData() == null) return;
                    requestSave(message.getData(), replyProxy);
                }
            });
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) { return loader.shouldInterceptRequest(request.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (isLocalDocument(request.getUrl())) return false;
                if (request.isForMainFrame()) openExternal(request.getUrl());
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (isLocalDocument(Uri.parse(url)) && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) view.evaluateJavascript("(function(){var pending={};window.xyroSaveBridge.onmessage=function(e){var r;try{r=JSON.parse(e.data);}catch(_){return;}var p=pending[r.id];if(!p)return;delete pending[r.id];if(r.outcome==='saved')p.resolve({saved:true});else p.reject(new Error(r.detail|| (r.outcome==='cancel'?'Save cancelled':'Unable to save file')));};window.xyroSaveBlob=function(blob,filename){return new Promise(function(resolve,reject){if(!blob||blob.size>10485760){reject(new Error('File exceeds 10 MiB'));return;}if(!window.xyroSaveBridge){reject(new Error('File saving is unavailable'));return;}var reader=new FileReader();reader.onerror=function(){reject(reader.error||new Error('File read failed'));};reader.onload=function(){var id=String(Date.now())+'-'+Math.random().toString(36).slice(2);pending[id]={resolve:resolve,reject:reject};try{window.xyroSaveBridge.postMessage(JSON.stringify({type:'save',id:id,filename:filename||'download.bin',mime:blob.type||'application/octet-stream',data:String(reader.result).split(',')[1]}));}catch(e){delete pending[id];reject(e);}};reader.readAsDataURL(blob);});};})();", null);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (photoCallback != null) photoCallback.onReceiveValue(null);
                photoCallback = callback;
                boolean json = false; for (String a : params.getAcceptTypes()) if (a != null && a.toLowerCase(Locale.ROOT).contains("json")) json = true;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(json ? "application/json" : "image/*");
                if (!json) intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/png", "image/jpeg", "image/webp"});
                try { startActivityForResult(intent, PHOTO_REQUEST); } catch (android.content.ActivityNotFoundException e) { callback.onReceiveValue(null); photoCallback = null; }
                return true;
            }
        });
        webView.setDownloadListener((url, ua, disposition, mime, length) -> { if (url != null && url.startsWith("https://")) openExternal(Uri.parse(url)); });
        webView.setOnApplyWindowInsetsListener((view, insets) -> { if (android.os.Build.VERSION.SDK_INT >= 30) { android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()); view.setPadding(bars.left,bars.top,bars.right,bars.bottom); } else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom()); return insets; });
        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PHOTO_REQUEST && photoCallback != null) { Uri picked = resultCode == RESULT_OK && data != null ? data.getData() : null; photoCallback.onReceiveValue(picked == null ? null : new Uri[]{picked}); photoCallback = null; }
        if (requestCode == SAVE_REQUEST && pendingBytes != null) {
            if (resultCode != RESULT_OK || data == null || data.getData() == null) { replySave("cancel", "Save cancelled"); clearPending(); return; }
            try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "w")) {
                if (out == null) throw new java.io.IOException("Could not open destination");
                out.write(pendingBytes);
                out.flush();
                // try-with-resources closes the output before reporting success.
            } catch (Exception e) { replySave("error", "Could not save file: " + (e.getMessage() == null ? "write failed" : e.getMessage())); clearPending(); return; }
            replySave("saved", ""); clearPending();
        }
    }
    @Override public void onBackPressed() {
        if (webView == null) { finish(); return; }
        webView.evaluateJavascript("typeof window.xyroHandleBack==='function' && !!window.xyroHandleBack()", value -> {
            if ("true".equals(value)) return;
            if (webView != null && webView.canGoBack()) webView.goBack(); else finish();
        });
    }
    @Override protected void onDestroy() { if (photoCallback != null) photoCallback.onReceiveValue(null); if (pendingBytes != null) clearPending(); if (webView != null) { webView.stopLoading(); webView.destroy(); } super.onDestroy(); }
}
