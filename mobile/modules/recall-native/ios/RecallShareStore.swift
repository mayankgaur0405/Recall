import Foundation

enum RecallShareStore {
  static let appGroupId = "group.com.recall.app"

  private static var defaults: UserDefaults {
    UserDefaults(suiteName: appGroupId) ?? .standard
  }

  static func setSession(
    accessToken: String?,
    refreshToken: String?,
    apiUrl: String?,
    supabaseUrl: String?,
    supabaseAnonKey: String?
  ) {
    defaults.set(accessToken, forKey: "access_token")
    defaults.set(refreshToken, forKey: "refresh_token")
    defaults.set(apiUrl, forKey: "api_url")
    defaults.set(supabaseUrl, forKey: "supabase_url")
    defaults.set(supabaseAnonKey, forKey: "supabase_anon_key")
  }

  static func clearSession() {
    defaults.removeObject(forKey: "access_token")
    defaults.removeObject(forKey: "refresh_token")
  }

  static func setPendingUrl(_ url: String) {
    defaults.set(url, forKey: "pending_url")
  }

  static func consumePendingUrl() -> String? {
    let url = defaults.string(forKey: "pending_url")
    defaults.removeObject(forKey: "pending_url")
    return url
  }
}
