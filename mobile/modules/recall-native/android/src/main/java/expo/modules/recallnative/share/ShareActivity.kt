package expo.modules.recallnative.share

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle

/**
 * Translucent share-target entry. Starts [ShareSaveService] and finishes immediately
 * so Instagram can remain in the foreground.
 */
class ShareActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    dispatch(intent)
    finish()
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    dispatch(intent)
    finish()
  }

  private fun dispatch(intent: Intent?) {
    val text = extractSharedText(intent)
    val service = Intent(this, ShareSaveService::class.java).putExtra(ShareSaveService.EXTRA_SHARED_TEXT, text)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForegroundService(service)
    } else {
      startService(service)
    }
  }

  private fun extractSharedText(intent: Intent?): String {
    if (intent == null) return ""
    intent.getStringExtra(Intent.EXTRA_TEXT)?.let { if (it.isNotBlank()) return it }
    intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.let { if (it.isNotBlank()) return it.toString() }
    val clip = intent.clipData
    if (clip != null && clip.itemCount > 0) {
      val item = clip.getItemAt(0)
      item.text?.toString()?.let { if (it.isNotBlank()) return it }
      item.uri?.toString()?.let { if (it.isNotBlank()) return it }
    }
    intent.dataString?.let { if (it.isNotBlank()) return it }
    return ""
  }
}
