import Foundation

enum ShareSession {
  static let suiteName = "group.com.recall.app"

  static var defaults: UserDefaults? {
    UserDefaults(suiteName: suiteName)
  }

  static var accessToken: String? { defaults?.string(forKey: "accessToken") }
  static var refreshToken: String? { defaults?.string(forKey: "refreshToken") }
  static var apiUrl: String {
    (defaults?.string(forKey: "apiUrl") ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
  }
  static var supabaseUrl: String {
    (defaults?.string(forKey: "supabaseUrl") ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
  }
  static var anonKey: String? { defaults?.string(forKey: "supabaseAnonKey") }

  static func setPendingUrl(_ url: String) {
    defaults?.set(url, forKey: "pendingUrl")
    defaults?.synchronize()
  }

  static func saveTokens(access: String, refresh: String) {
    defaults?.set(access, forKey: "accessToken")
    defaults?.set(refresh, forKey: "refreshToken")
    defaults?.synchronize()
  }
}
