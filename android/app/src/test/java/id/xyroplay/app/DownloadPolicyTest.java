package id.xyroplay.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class DownloadPolicyTest {
    @Test public void sanitizesNamesAndBoundsLength() {
        assertEquals("_bad_name_.zip", DownloadPolicy.cleanFilename("../bad/name?.zip"));
        assertEquals("download.bin", DownloadPolicy.cleanFilename("..."));
        assertEquals(120, DownloadPolicy.cleanFilename(new String(new char[130]).replace('\0', 'x')).length());
    }
    @Test public void capsBase64BeforeDecode() {
        assertFalse(DownloadPolicy.encodedSizeExceedsLimit(13_981_016, 10 * 1024 * 1024));
        assertTrue(DownloadPolicy.encodedSizeExceedsLimit(14_000_000, 10 * 1024 * 1024));
    }
    @Test public void allowsOnlyExplicitMimeTypes() {
        assertEquals("image/png", DownloadPolicy.validMime("IMAGE/PNG"));
        assertEquals("application/json", DownloadPolicy.validMime("application/json"));
        assertEquals("text/plain", DownloadPolicy.validMime("text/plain"));
        assertNull(DownloadPolicy.validMime("text/html"));
        assertNull(DownloadPolicy.validMime("image/svg+xml"));
    }
    @Test public void requiresExactTrustedOriginAndDocumentAllowlist() {
        assertTrue(DownloadPolicy.isTrustedOrigin("https://appassets.androidplatform.net/assets/index.html"));
        assertTrue(DownloadPolicy.isTrustedOrigin("https://appassets.androidplatform.net:443/anything"));
        assertFalse(DownloadPolicy.isTrustedOrigin("https://appassets.androidplatform.net.evil/"));
        assertFalse(DownloadPolicy.isTrustedOrigin("https://user@appassets.androidplatform.net/"));
        assertFalse(DownloadPolicy.isTrustedOrigin("https://appassets.androidplatform.net:444/"));
        assertTrue(DownloadPolicy.isTrustedDocument("/assets/deletion.html"));
        assertTrue(DownloadPolicy.isTrustedDocument("/assets/recovery.html"));
        assertTrue(DownloadPolicy.isTrustedDocument("/assets/site.css"));
        assertTrue(DownloadPolicy.isTrustedDocument("/assets/release.js"));
        assertTrue(DownloadPolicy.isTrustedDocument("/assets/account-pages.js"));
        assertFalse(DownloadPolicy.isTrustedDocument("/assets/other.html"));
    }
}
