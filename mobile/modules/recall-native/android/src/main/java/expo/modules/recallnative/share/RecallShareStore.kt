package expo.modules.recallnative.share

import android.content.Context
import java.util.regex.Pattern

data class ShareSession(
  val accessToken: String,
  val refreshToken: String,
  val apiUrl: String,
  val supabaseUrl: String,
  val supabaseAnonKey: String
)

object RecallShareStore {
  private const val PREFS = "recall_share"
  private val REEL_PATH = Pattern.compile(
    "https?://(?:www\\.)?instagram\\.com/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)",
    Pattern.CASE_INSENSITIVE
  )
  private val SHARE_PATH = Pattern.compile(
    "https?://(?:www\\.)?instagram\\.com/share/(?:reel|p)/([A-Za-z0-9_-]+)",
    Pattern.CASE_INSENSITIVE
  )
  private val SHORT_PATH = Pattern.compile(
    "https?://(?:www\\.)?instagr\\.am/(?:reel|p)/([A-Za-z0-9_-]+)",
    Pattern.CASE_INSENSITIVE
  )

  fun extractUrl(text: String?): String? {
    if (text.isNullOrBlank()) return null
    val share = SHARE_PATH.matcher(text)
    if (share.find()) return canonical(share.group(1)!!)
    val reel = REEL_PATH.matcher(text)
    if (reel.find()) return canonical(reel.group(1)!!)
    val short = SHORT_PATH.matcher(text)
    if (short.find()) return canonical(short.group(1)!!)
    return null
  }

  private fun canonical(code: String) = "https://www.instagram.com/reel/$code/"

  fun setSession(
    context: Context,
    accessToken: String?,
    refreshToken: String?,
    apiUrl: String?,
    supabaseUrl: String?,
    supabaseAnonKey: String?
  ) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("access_token", accessToken)
      .putString("refresh_token", refreshToken)
      .putString("api_url", apiUrl)
      .putString("supabase_url", supabaseUrl)
      .putString("supabase_anon_key", supabaseAnonKey)
      .apply()
  }

  fun clearSession(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .remove("access_token")
      .remove("refresh_token")
      .apply()
  }

  fun getSession(context: Context): ShareSession? {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val access = prefs.getString("access_token", null)
    val refresh = prefs.getString("refresh_token", null)
    val apiUrl = prefs.getString("api_url", null)
    val supabaseUrl = prefs.getString("supabase_url", null)
    val anon = prefs.getString("supabase_anon_key", null)
    if (access.isNullOrBlank() || refresh.isNullOrBlank() || apiUrl.isNullOrBlank()) return null
    return ShareSession(access, refresh, apiUrl, supabaseUrl ?: "", anon ?: "")
  }

  fun setPendingUrl(context: Context, url: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("pending_url", url)
      .apply()
  }

  fun consumePendingUrl(context: Context): String? {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val url = prefs.getString("pending_url", null)
    prefs.edit().remove("pending_url").apply()
    return url
  }

  fun updateTokens(context: Context, accessToken: String, refreshToken: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("access_token", accessToken)
      .putString("refresh_token", refreshToken)
      .apply()
  }
}
