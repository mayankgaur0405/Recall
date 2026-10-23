import ExpoModulesCore

public class RecallNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RecallNative")

    Function("setSession") { (payload: [String: String]) in
      SessionStore.save(payload: payload)
    }

    Function("clearSession") {
      SessionStore.clearSession()
    }

    Function("setPendingUrl") { (url: String) in
      SessionStore.setPendingUrl(url)
    }

    Function("consumePendingUrl") { () -> String? in
      SessionStore.consumePendingUrl()
    }
  }
}
