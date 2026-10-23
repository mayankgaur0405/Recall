import Foundation

enum SessionStore {
  static let suiteName = "group.com.recall.app"
  static let accessTokenKey = "accessToken"
  static let refreshTokenKey = "refreshToken"
  static let apiUrlKey = "apiUrl"
  static let supabaseUrlKey = "supabaseUrl"
  static let supabaseAnonKeyKey = "supabaseAnonKey"
  static let pendingUrlKey = "pendingUrl"

  static var defaults: UserDefaults? {
    UserDefaults(suiteName: suiteName)
  }

  static func save(payload: [String: String]) {
    guard let defaults else { return }
    defaults.set(payload["accessToken"] ?? payload["accessToken".lowercased()], forKey: accessTokenKey)
    defaults.set(payload["refreshToken"], forKey: refreshTokenKey)
    defaults.set(payload["apiUrl"], forKey: apiUrlKey)
    defaults.set(payload["supabaseUrl"], forKey: supabaseUrlKey)
    defaults.set(payload["supabaseAnonKey"], forKey: supabaseAnonKeyKey)
    defaults.synchronize()
  }

  static func clearSession() {
    guard let defaults else { return }
    defaults.removeObject(forKey: accessTokenKey)
    defaults.removeObject(forKey: refreshTokenKey)
    defaults.synchronize()
  }

  static func setPendingUrl(_ url: String) {
    defaults?.set(url, forKey: pendingUrlKey)
    defaults?.synchronize()
  }

  static func consumePendingUrl() -> String? {
    let value = defaults?.string(forKey: pendingUrlKey)
    defaults?.removeObject(forKey: pendingUrlKey)
    defaults?.synchronize()
    return value
  }
}
