import Foundation

enum ReelUrl {
  static func extract(_ input: String?) -> String? {
    guard var text = input?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
      return nil
    }

    let patterns = [
      #"https?://(?:www\.)?instagram\.com/share/(?:reel|p)/([A-Za-z0-9_-]+)"#,
      #"https?://(?:www\.)?instagram\.com/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)"#,
      #"https?://(?:www\.)?instagr\.am/(?:reel|p)/([A-Za-z0-9_-]+)"#,
    ]

    for pattern in patterns {
      if let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) {
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        if let match = regex.firstMatch(in: text, options: [], range: range),
           match.numberOfRanges > 1,
           let shortRange = Range(match.range(at: 1), in: text) {
          return "https://www.instagram.com/reel/\(text[shortRange])/"
        }
      }
    }
    return nil
  }
}
