package id.xyroplay.app;

import android.net.Uri;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Pure download validation shared by the WebView save bridge and unit tests. */
public final class DownloadPolicy {
    private static final Set<String> MIME_TYPES = new HashSet<>(Arrays.asList(
        "text/plain", "application/json", "application/zip", "application/vnd.android.package-archive", "application/octet-stream",
        "image/png", "image/jpeg", "image/webp", "image/gif",
        "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm",
        "video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/mpeg"
    ));
    private DownloadPolicy() {}
    public static boolean isTrustedOrigin(Uri uri) {
        return uri != null && isTrustedOrigin(uri.toString());
    }
    public static boolean isTrustedOrigin(String value) {
        try {
            java.net.URI uri = new java.net.URI(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
        } catch (java.net.URISyntaxException | NullPointerException exception) { return false; }
    }
    public static boolean isTrustedDocument(String path) {
        if (path == null) return false;
        return path.equals("/assets/index.html") || path.equals("/assets/privacy.html") || path.equals("/assets/deletion.html") || path.equals("/assets/recovery.html")
            || path.matches("/assets/(app|config|events|spotify|downloads|release|account-pages)\\.[A-Za-z0-9]+")
            || path.matches("/assets/(brand)\\.[A-Za-z0-9]+") || path.equals("/assets/site.css") || path.matches("/assets/site\\.[A-Za-z0-9]+\\.css");
    }
    public static String validMime(String mime) { if (mime == null) return null; String normalized = mime.trim().toLowerCase(Locale.ROOT); return MIME_TYPES.contains(normalized) ? normalized : null; }
    public static boolean encodedSizeExceedsLimit(int chars, int maxBytes) { return chars < 0 || ((long) chars + 3L) / 4L * 3L > maxBytes + 2L; }
    public static String cleanFilename(String raw) {
        String value = raw == null ? "download.bin" : raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        while (value.startsWith(".")) value = value.substring(1);
        if (value.isEmpty()) value = "download.bin";
        return value.length() > 120 ? value.substring(0, 120) : value;
    }
}
