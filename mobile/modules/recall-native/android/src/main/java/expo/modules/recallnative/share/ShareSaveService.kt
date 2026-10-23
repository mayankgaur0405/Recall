package expo.modules.recallnative.share

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.Log
import expo.modules.recallnative.ReelUrl
import expo.modules.recallnative.ShareStore
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class ShareSaveService : Service() {
  private val executor = Executors.newSingleThreadExecutor()

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    val working = notification("Saving to Post Vault…", ongoing = true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(WORKING_ID, working, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(WORKING_ID, working)
    }

    val raw = intent?.getStringExtra(EXTRA_SHARED_TEXT).orEmpty()
    executor.execute {
      try {
        handleShare(raw)
      } catch (t: Throwable) {
        Log.e(TAG, "Unhandled exception in background share execution: ${t.javaClass.simpleName}: ${t.message}", t)
      } finally {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf(startId)
      }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    executor.shutdownNow()
    super.onDestroy()
  }

  private fun handleShare(raw: String) {
    Log.d(TAG, "Processing incoming share payload. Length: ${raw.length}")
    val url = ReelUrl.extract(raw)
    if (url == null) {
      Log.w(TAG, "Incoming share text did not contain a supported Instagram Reel link.")
      notifyResult("Not an Instagram Reel link")
      return
    }
    Log.i(TAG, "Extracted Instagram Reel URL: $url")

    val apiUrl = ShareStore.apiUrl(this)
    var access = ShareStore.accessToken(this)
    val refresh = ShareStore.refreshToken(this)
    val supabaseUrl = ShareStore.supabaseUrl(this)
    val anonKey = ShareStore.anonKey(this)

    if (access.isNullOrBlank()) {
      Log.w(TAG, "No user session stored. Stashing pending Reel URL and prompting sign in.")
      ShareStore.setPendingUrl(this, url)
      notifyResult("Sign in to Post Vault to finish saving")
      openMainApp()
      return
    }

    // Step 1: Attempt save via primary backend API if configured
    if (apiUrl.isNotBlank()) {
      Log.i(TAG, "Attempting save via backend API: $apiUrl/api/reels/ingest")
      try {
        var result = postIngest(apiUrl, access, url)
        if (result.code == 401 && !refresh.isNullOrBlank()) {
          Log.i(TAG, "Backend returned 401. Attempting token refresh...")
          val refreshed = refreshAccessToken(refresh)
          if (refreshed != null) {
            access = refreshed
            result = postIngest(apiUrl, access, url)
          }
        }

        Log.i(TAG, "Backend API returned HTTP status: ${result.code}")
        when {
          result.code in 200..299 -> {
            val duplicate = result.body.optBoolean("duplicate", false)
            Log.i(TAG, "Backend ingest succeeded (duplicate=$duplicate)")
            notifyResult(if (duplicate) "Already in Post Vault ✓" else "Reel saved to Post Vault ✓")
            return
          }
          result.code == 400 -> {
            val errorMsg = result.body.optString("error", "That share did not include a valid Reel link")
            Log.w(TAG, "Backend rejected link (HTTP 400): $errorMsg")
            notifyResult(errorMsg)
            return
          }
          result.code == 401 -> {
            Log.w(TAG, "Backend authentication failed (HTTP 401).")
            // Allow fall-through to try direct Supabase with token refresh
          }
          else -> {
            Log.w(TAG, "Backend ingest returned HTTP ${result.code}: ${result.body.optString("error")}. Attempting direct database fallback...")
          }
        }
      } catch (e: Exception) {
        Log.w(TAG, "Backend ingest connection failed (${e.javaClass.simpleName}: ${e.message}). Falling back to direct Supabase ingestion...")
      }
    }

    // Step 2: Resilient fallback to direct Supabase REST API (accessible via public HTTPS)
    if (supabaseUrl.isNotBlank() && !anonKey.isNullOrBlank() && !access.isNullOrBlank()) {
      Log.i(TAG, "Attempting direct Supabase ingestion to: $supabaseUrl/rest/v1/reels")
      try {
        var directResult = postSupabaseDirect(supabaseUrl, anonKey, access, url)
        if (directResult.code == 401 && !refresh.isNullOrBlank()) {
          Log.i(TAG, "Direct Supabase returned 401. Refreshing token...")
          val refreshed = refreshAccessToken(refresh)
          if (refreshed != null) {
            access = refreshed
            directResult = postSupabaseDirect(supabaseUrl, anonKey, access, url)
          }
        }

        Log.i(TAG, "Direct Supabase returned HTTP status: ${directResult.code}")
        when {
          directResult.code in 200..299 -> {
            Log.i(TAG, "Direct Supabase save succeeded! Reel saved to database.")
            notifyResult("Reel saved to Post Vault ✓")
            return
          }
          directResult.code == 409 || directResult.body.toString().contains("23505") -> {
            Log.i(TAG, "Reel already exists in Supabase database (unique conflict 409).")
            notifyResult("Already in Post Vault ✓")
            return
          }
          directResult.code == 401 -> {
            Log.w(TAG, "Direct Supabase auth failed (HTTP 401). Prompting sign in.")
            ShareStore.setPendingUrl(this, url)
            notifyResult("Sign in to Post Vault to finish saving")
            openMainApp()
            return
          }
          else -> {
            Log.w(TAG, "Direct Supabase save returned HTTP ${directResult.code}: ${directResult.body}")
          }
        }
      } catch (e: Exception) {
        Log.e(TAG, "Direct Supabase save failed with network exception: ${e.javaClass.simpleName}: ${e.message}")
      }
    }

    // Step 3: All network attempts failed (e.g. offline / no connection)
    Log.e(TAG, "Unable to save Reel over the network. Stashing URL for retry when Recall opens.")
    ShareStore.setPendingUrl(this, url)
    notifyResult("Network error. The Reel link was kept for retry.")
  }

  private fun postIngest(apiUrl: String, accessToken: String, url: String): HttpResult {
    val body = JSONObject().put("url", url).toString()
    return requestJson("POST", "$apiUrl/api/reels/ingest", body, mapOf("Authorization" to "Bearer $accessToken"))
  }

  private fun postSupabaseDirect(
    supabaseUrl: String,
    anonKey: String,
    accessToken: String,
    url: String,
  ): HttpResult {
    val userId = extractUserIdFromJwt(accessToken)
    val bodyJson = JSONObject().apply {
      put("source_url", url)
      put("source_platform", "instagram")
      put("title", "Saving Reel…")
      put("summary", "This Reel was saved from mobile. Full analysis will run on the server.")
      put("processing_status", "pending")
      if (!userId.isNullOrBlank()) {
        put("user_id", userId)
      }
    }
    val endpoint = "$supabaseUrl/rest/v1/reels"
    return requestJson(
      "POST",
      endpoint,
      bodyJson.toString(),
      mapOf(
        "apikey" to anonKey,
        "Authorization" to "Bearer $accessToken",
        "Prefer" to "return=representation"
      )
    )
  }

  private fun extractUserIdFromJwt(token: String): String? {
    return try {
      val parts = token.split(".")
      if (parts.size < 2) return null
      val payloadBytes = Base64.decode(
        parts[1],
        Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP
      )
      val json = JSONObject(String(payloadBytes, Charsets.UTF_8))
      val sub = json.optString("sub", "")
      if (sub.isNotBlank()) sub else null
    } catch (e: Exception) {
      Log.w(TAG, "Could not extract user_id from JWT payload: ${e.message}")
      null
    }
  }

  private fun refreshAccessToken(refreshToken: String): String? {
    val supabaseUrl = ShareStore.supabaseUrl(this)
    val anon = ShareStore.anonKey(this) ?: return null
    if (supabaseUrl.isBlank()) return null
    return try {
      Log.d(TAG, "Requesting refreshed token from Supabase Auth...")
      val body = JSONObject().put("refresh_token", refreshToken).toString()
      val result = requestJson(
        "POST",
        "$supabaseUrl/auth/v1/token?grant_type=refresh_token",
        body,
        mapOf("apikey" to anon, "Authorization" to "Bearer $anon"),
      )
      if (result.code !in 200..299) {
        Log.w(TAG, "Token refresh failed with HTTP ${result.code}")
        return null
      }
      val access = result.body.optString("access_token", "")
      val nextRefresh = result.body.optString("refresh_token", refreshToken)
      if (access.isBlank()) return null
      ShareStore.saveSession(
        this,
        access,
        nextRefresh,
        ShareStore.apiUrl(this),
        supabaseUrl,
        anon,
      )
      Log.i(TAG, "Successfully refreshed and saved updated session tokens.")
      access
    } catch (e: Exception) {
      Log.w(TAG, "Token refresh network exception: ${e.javaClass.simpleName}: ${e.message}")
      null
    }
  }

  private fun requestJson(
    method: String,
    url: String,
    body: String,
    headers: Map<String, String>,
  ): HttpResult {
    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
      requestMethod = method
      connectTimeout = 15000
      readTimeout = 20000
      doOutput = true
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("Accept", "application/json")
      headers.forEach { (k, v) -> setRequestProperty(k, v) }
    }
    conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
    val code = conn.responseCode
    val stream = if (code in 200..299) conn.inputStream else conn.errorStream
    val text = stream?.bufferedReader()?.readText().orEmpty()
    conn.disconnect()
    val json = try {
      if (text.isBlank()) JSONObject() else JSONObject(text)
    } catch (_: Exception) {
      JSONObject()
    }
    return HttpResult(code, json)
  }

  private fun openMainApp() {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return
    launch.data = Uri.parse("recall://share-retry")
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    startActivity(launch)
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(CHANNEL_ID, "Post Vault saves", NotificationManager.IMPORTANCE_DEFAULT)
    channel.description = "Confirms when a Reel is saved from Instagram"
    manager.createNotificationChannel(channel)
  }

  private fun notification(text: String, ongoing: Boolean = false): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setSmallIcon(android.R.drawable.stat_sys_upload_done)
      .setContentTitle("Post Vault")
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setOngoing(ongoing)
      .setAutoCancel(!ongoing)
      .setContentIntent(openAppPendingIntent())
      .build()
  }

  private fun openAppPendingIntent(): PendingIntent {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: Intent()
    launch.data = Uri.parse("recall://share-retry")
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getActivity(this, 0, launch, flags)
  }

  private fun notifyResult(text: String) {
    val manager = getSystemService(NotificationManager::class.java) ?: return
    try {
      manager.notify(RESULT_ID, notification(text))
    } catch (_: SecurityException) {
      // Notification permission denied — the save itself may still have succeeded.
    }
  }

  data class HttpResult(val code: Int, val body: JSONObject)

  companion object {
    const val EXTRA_SHARED_TEXT = "extra_shared_text"
    private const val TAG = "RecallShare"
    private const val CHANNEL_ID = "recall-saves"
    private const val WORKING_ID = 4101
    private const val RESULT_ID = 4102
  }
}
