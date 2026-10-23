package expo.modules.recallnative

object ReelUrl {
  private val reelPath =
    Regex("""https?://(?:www\.)?instagram\.com/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)""", RegexOption.IGNORE_CASE)
  private val sharePath =
    Regex("""https?://(?:www\.)?instagram\.com/share/(?:reel/|p/|r/)?([A-Za-z0-9_-]+)""", RegexOption.IGNORE_CASE)
  private val shortPath =
    Regex("""https?://(?:www\.)?instagr\.am/(?:reel|p)/([A-Za-z0-9_-]+)""", RegexOption.IGNORE_CASE)

  fun extract(input: String?): String? {
    if (input.isNullOrBlank()) return null
    val text = input.trim()
    sharePath.find(text)?.groupValues?.getOrNull(1)?.let { return canonical(it) }
    reelPath.find(text)?.groupValues?.getOrNull(1)?.let { return canonical(it) }
    shortPath.find(text)?.groupValues?.getOrNull(1)?.let { return canonical(it) }
    return null
  }

  private fun canonical(shortcode: String) = "https://www.instagram.com/reel/$shortcode/"
}
