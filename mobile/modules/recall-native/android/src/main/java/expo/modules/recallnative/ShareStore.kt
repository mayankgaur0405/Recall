package expo.modules.recallnative

import android.content.Context

object ShareStore {
  private const val PREFS = "recall_share"
  const val KEY_ACCESS = "accessToken"
  const val KEY_REFRESH = "refreshToken"
  const val KEY_API = "apiUrl"
  const val KEY_SUPABASE = "supabaseUrl"
  const val KEY_ANON = "supabaseAnonKey"
  const val KEY_PENDING = "pendingUrl"

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveSession(
    context: Context,
    accessToken: String,
    refreshToken: String,
    apiUrl: String,
    supabaseUrl: String,
    supabaseAnonKey: String,
  ) {
    prefs(context).edit()
      .putString(KEY_ACCESS, accessToken)
      .putString(KEY_REFRESH, refreshToken)
      .putString(KEY_API, apiUrl)
      .putString(KEY_SUPABASE, supabaseUrl)
      .putString(KEY_ANON, supabaseAnonKey)
      .apply()
  }

  fun clearSession(context: Context) {
    prefs(context).edit()
      .remove(KEY_ACCESS)
      .remove(KEY_REFRESH)
      .apply()
  }

  fun accessToken(context: Context): String? =
    prefs(context).getString(KEY_ACCESS, null)
      ?: prefs(context).getString("access_token", null)

  fun refreshToken(context: Context): String? =
    prefs(context).getString(KEY_REFRESH, null)
      ?: prefs(context).getString("refresh_token", null)

  fun apiUrl(context: Context): String =
    (prefs(context).getString(KEY_API, null)
      ?: prefs(context).getString("api_url", null)).orEmpty().trimEnd('/')

  fun supabaseUrl(context: Context): String =
    (prefs(context).getString(KEY_SUPABASE, null)
      ?: prefs(context).getString("supabase_url", null)).orEmpty().trimEnd('/')

  fun anonKey(context: Context): String? =
    prefs(context).getString(KEY_ANON, null)
      ?: prefs(context).getString("supabase_anon_key", null)

  fun setPendingUrl(context: Context, url: String) {
    prefs(context).edit()
      .putString(KEY_PENDING, url)
      .putString("pending_url", url)
      .apply()
  }

  fun consumePendingUrl(context: Context): String? {
    val value = prefs(context).getString(KEY_PENDING, null)
      ?: prefs(context).getString("pending_url", null)
    prefs(context).edit()
      .remove(KEY_PENDING)
      .remove("pending_url")
      .apply()
    return value
  }

  fun peekPendingUrl(context: Context): String? =
    prefs(context).getString(KEY_PENDING, null)
      ?: prefs(context).getString("pending_url", null)
}
