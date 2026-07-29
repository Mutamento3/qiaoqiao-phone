package dev.qiaoqiao.phone

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.webkit.WebView
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.ConsoleMessage
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import android.webkit.WebViewClient
import dev.qiaoqiao.phone.bridge.WebAppInterface
import dev.qiaoqiao.phone.prefs.AppPrefs
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader

    // v1.10.232: 加载诊断状态 (启动后记住, 写 SharedPreferences, 下次启动 Toast 出来)
    private var isPageFinished = false
    private var lastLoadedUrl = ""
    private var resourceErrorCount = 0
    private var httpErrorCount = 0

    private val loadTimeoutHandler = Handler(Looper.getMainLooper())
    private val loadTimeoutRunnable = Runnable {
        Toast.makeText(
            this,
            "PWA 加载中, 请稍候…\n(首次启动需要几秒钟)",
            Toast.LENGTH_LONG
        ).show()
        Log.w(TAG, "WebView load timeout (5s) — still loading or stuck")
    }

    private val notifPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            startProactiveServiceIfReady()
            requestBatteryWhitelist()
        } else {
            Toast.makeText(this, R.string.perm_notification_rationale, Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        setupWebView()

        webView.setInitialScale(90)

        handleNotificationIntent(intent)

        // v1.10.232: 启动时显示上一次的加载诊断, 让用户知道上次为什么卡住
        val prevDiag = AppPrefs.lastLoadDiag
        val prevErr = AppPrefs.lastLoadError
        if (prevErr.isNotBlank()) {
            Toast.makeText(this, "上次加载出错:\n$prevErr", Toast.LENGTH_LONG).show()
        } else if (prevDiag.isNotBlank() && prevDiag.contains("TIMEOUT")) {
            Toast.makeText(this, "上次加载卡住:\n$prevDiag", Toast.LENGTH_LONG).show()
        }

        // v1.10.232: 清掉上次状态 (诊断读完后清掉, 避免每次启动都显示)
        AppPrefs.lastLoadError = ""
        AppPrefs.lastLoadDiag = ""

        val loadStartTime = System.currentTimeMillis()
        loadTimeoutHandler.postDelayed(loadTimeoutRunnable, 5000)

        // v1.10.232: 30 秒硬超时 (5s soft Toast + 30s hard 标记"卡在加载")
        loadTimeoutHandler.postDelayed({
            if (!isPageFinished) {
                val diag = "TIMEOUT(30s)\nurl=${lastLoadedUrl}\nresourceErrors=${resourceErrorCount}\nhttpErrors=${httpErrorCount}"
                AppPrefs.lastLoadDiag = diag
                runOnUiThread {
                    Toast.makeText(this, "加载超时 (30s):\n$diag", Toast.LENGTH_LONG).show()
                }
            }
        }, 30000)

        // WebViewAssetLoader: AndroidX 官方方案.
        // 把 APK 内 assets/ 映射到 https://appassets.androidplatform.net/assets/...,
        // 自动处理 MIME type, 无 file:// CORS 问题, 所有 Android 版本一致.
        // Vite base 设为 './', 相对路径 ./assets/xxx.js 正确解析为
        // https://appassets.androidplatform.net/assets/assets/xxx.js
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        lastLoadedUrl = webView.url ?: "https://appassets.androidplatform.net/assets/index.html"

        requestPermissionsIfNeeded()
        checkForUpdates()
    }

    private fun setupWebView() {
        // WebViewAssetLoader: 用 AssetsPathHandler 把 /assets/ 映射到 APK assets 目录.
        // 它内部会自动设置正确的 MIME type (.js → text/javascript, .css → text/css 等).
        // v1.10.251 FIX: 之前套的 removePrefix("assets/") 是反的, 把
        // path="assets/main.js" 错剥成 "main.js" → 找 assets/main.js → 404.
        // 标准 AssetsPathHandler 内部直接 assets.open(path), 收到 "assets/main.js"
        // 就能正确读 APK 里的 assets/assets/main.js. 直接用标准 handler, 不再自定义.
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false
        }

        // 不用 androidx.webkit.WebViewClientCompat — 1.10+ 把 onReceivedError / onReceivedHttpError 标成 final 不能 override
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val uri = request.url
                // 1) 先走 WebViewAssetLoader (标准路径)
                val fromLoader = assetLoader.shouldInterceptRequest(uri)
                if (fromLoader != null) return fromLoader

                // 2) Fallback: WebViewAssetLoader 返回 null 时, 手动从 assets 读.
                //    这种情况通常是 path 对不上 handler 的前缀 (e.g. /assets/assets/main.js
                //    被 handler 剥掉 /assets/ 后剩 assets/main.js, 若 handler 内部再剥一层就会错).
                //    这里直接把 URL path 里跟在 /assets/ 后面的部分当作 assets 内相对路径,
                //    不再让 AssetsPathHandler 二次处理.
                if (uri.host == "appassets.androidplatform.net") {
                    val fullPath = uri.path ?: return null
                    // 剥掉开头的 /assets/ (如果存在), 其余部分就是 assets 内的相对路径
                    val rel = fullPath.removePrefix("/assets/").removePrefix("/res/")
                    if (rel.isNotBlank()) {
                        try {
                            val inputStream = assets.open(rel)
                            val mime = guessMimeType(rel)
                            Log.d(TAG, "Fallback load: $fullPath -> assets/$rel ($mime)")
                            return WebResourceResponse(mime, "UTF-8", inputStream)
                        } catch (e: Exception) {
                            Log.e(TAG, "Fallback failed: $fullPath -> assets/$rel", e)
                        }
                    }
                }
                return null
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                Log.d(TAG, "WebView onPageStarted: $url")
                lastLoadedUrl = url ?: ""
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "WebView onPageFinished: $url")
                isPageFinished = true
                lastLoadedUrl = url ?: ""
                loadTimeoutHandler.removeCallbacks(loadTimeoutRunnable)

                // v1.10.232: 详细诊断 — 页面加载完立刻 evaluateJavascript 检查 DOM 状态,
                // 写 SharedPreferences, 下次启动 Toast 出来 (用户不用 logcat 也能看到)
                Handler(Looper.getMainLooper()).postDelayed({
                    webView.evaluateJavascript("""
                        (function(){
                            var app=document.getElementById('app');
                            var splash=document.getElementById('native-splash');
                            var cs=app?app.children.length:0;
                            var rs=document.readyState;
                            var sb=splash?getComputedStyle(splash).opacity:'none';
                            return JSON.stringify({
                                readyState: rs,
                                appChildren: cs,
                                appExists: !!app,
                                splashOpacity: sb,
                                title: document.title
                            });
                        })();
                    """.trimIndent()) { result ->
                        val safe = result?.replace("\"", "'") ?: "null"
                        AppPrefs.lastLoadDiag = "URL=${lastLoadedUrl}\nDOM=${safe}\nerrCount=${resourceErrorCount}\nhttpErrCount=${httpErrorCount}"
                        if (result != null && (result.contains("\"appChildren\":0") || result.contains("\"appExists\":false"))) {
                            runOnUiThread {
                                Toast.makeText(
                                    this@MainActivity,
                                    "Vue 未挂载:\n${safe}",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        }
                    }
                }, 3000)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                resourceErrorCount++
                val msg = "url=${request.url} code=${error.errorCode} desc=${error.description}"
                Log.e(TAG, "WebView onReceivedError: $msg")
                AppPrefs.lastLoadError = msg
                // 第一次资源加载失败立刻 Toast, 显示完整信息
                if (resourceErrorCount == 1) {
                    runOnUiThread {
                        Toast.makeText(
                            this@MainActivity,
                            "资源加载失败: code=${error.errorCode}\n${msg}",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }

            @Deprecated("Deprecated in API 23, but some devices still call this")
            override fun onReceivedError(view: WebView, errorCode: Int, description: String, failingUrl: String) {
                resourceErrorCount++
                val msg = "deprecated-url=$failingUrl code=$errorCode desc=$description"
                Log.e(TAG, "WebView onReceivedError (deprecated): $msg")
                AppPrefs.lastLoadError = msg
                if (resourceErrorCount == 1) {
                    runOnUiThread {
                        Toast.makeText(
                            this@MainActivity,
                            "资源加载失败(旧版): code=$errorCode\n$failingUrl",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse
            ) {
                httpErrorCount++
                val msg = "HTTP url=${request.url} status=${errorResponse.statusCode}"
                Log.w(TAG, "WebView onReceivedHttpError: $msg")
                // HTTP 错误不一定是致命的 (CDN/PWA 上可能有), 不覆盖 lastLoadError,
                // 但累加 httpErrorCount, onPageFinished 时一起写 diag
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                // appassets.androidplatform.net (本地 PWA) + pages.dev (线上) 交给 WebView
                return if (url.startsWith("https://appassets.androidplatform.net/") ||
                    url.startsWith(BuildConfig.PWA_URL)) {
                    false
                } else {
                    // 外链用浏览器打开
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                }
            }
        }

        webView.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage?): Boolean {
                if (msg != null) {
                    Log.d(
                        "ChillyWebView",
                        "[${msg.messageLevel()}] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})"
                    )
                }
                return true
            }
        }

        webView.addJavascriptInterface(
            WebAppInterface(this),
            JS_BRIDGE_NAME
        )
    }

    private fun handleNotificationIntent(intent: Intent?) {
        if (intent == null) return
        val charName = intent.getStringExtra(dev.qiaoqiao.phone.notif.Notifier.EXTRA_CHARACTER_NAME)
        val content = intent.getStringExtra(dev.qiaoqiao.phone.notif.Notifier.EXTRA_MESSAGE_CONTENT)
        if (charName != null && content != null) {
            // TODO: 注入 JS, 让 PWA 把这条消息存到 chatStore
        }
    }

    private fun requestPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val perm = Manifest.permission.POST_NOTIFICATIONS
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                notifPermLauncher.launch(perm)
                return
            }
        }
        startProactiveServiceIfReady()
        requestBatteryWhitelist()
    }

    private fun startProactiveServiceIfReady() {
        if (AppPrefs.proactiveEnabled && AppPrefs.isConfigured()) {
            ProactiveMessageService.start(this)
        }
    }

    private fun requestBatteryWhitelist() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(android.os.PowerManager::class.java)
            if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.parse("package:$packageName"))
                try {
                    startActivity(intent)
                } catch (_: Exception) {}
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    private fun checkForUpdates() {
        val localVersion = BuildConfig.VERSION_NAME
        Thread {
            try {
                val client = OkHttpClient.Builder()
                    .connectTimeout(5, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.SECONDS)
                    .build()
                val req = Request.Builder()
                    .url("https://api.github.com/repos/chilly520/qiaoqiao-phone/releases/latest")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use
                    val body = resp.body?.string() ?: return@use
                    val json = JSONObject(body)
                    val tagName = json.optString("tag_name", "")
                    val htmlUrl = json.optString("html_url", "")
                    val remoteVer = tagName.removePrefix("v").removeSuffix("-native")
                    if (remoteVer.isNotEmpty() && isNewerVersion(remoteVer, localVersion)) {
                        val js = """
                            (function(){
                              try {
                                window.dispatchEvent(new CustomEvent('chilly-update-available', {
                                  detail: { version: ${jsString(remoteVer)}, url: ${jsString(htmlUrl)} }
                                }));
                              } catch(e) {}
                            })();
                        """.trimIndent()
                        runOnUiThread { webView.evaluateJavascript(js, null) }
                    }
                }
            } catch (_: Exception) {}
        }.start()
    }

    private fun jsString(s: String): String {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
    }

    private fun guessMimeType(path: String): String {
        return when {
            path.endsWith(".html") -> "text/html"
            path.endsWith(".js") -> "text/javascript"
            path.endsWith(".css") -> "text/css"
            path.endsWith(".json") -> "application/json"
            path.endsWith(".png") -> "image/png"
            path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
            path.endsWith(".svg") -> "image/svg+xml"
            path.endsWith(".ico") -> "image/x-icon"
            path.endsWith(".woff") -> "font/woff"
            path.endsWith(".woff2") -> "font/woff2"
            path.endsWith(".ttf") -> "font/ttf"
            path.endsWith(".mp3") -> "audio/mpeg"
            path.endsWith(".mp4") -> "video/mp4"
            path.endsWith(".wav") -> "audio/wav"
            path.endsWith(".webp") -> "image/webp"
            path.endsWith(".gif") -> "image/gif"
            path.endsWith(".pdf") -> "application/pdf"
            path.endsWith(".wasm") -> "application/wasm"
            else -> "application/octet-stream"
        }
    }

    private fun isNewerVersion(remote: String, local: String): Boolean {
        val r = remote.split(".").mapNotNull { it.toIntOrNull() }
        val l = local.split(".").mapNotNull { it.toIntOrNull() }
        for (i in 0 until maxOf(r.size, l.size)) {
            val rv = r.getOrElse(i) { 0 }
            val lv = l.getOrElse(i) { 0 }
            if (rv > lv) return true
            if (rv < lv) return false
        }
        return false
    }

    companion object {
        const val JS_BRIDGE_NAME = "ChillyNative"
        private const val TAG = "ChillyMainActivity"
    }
}
