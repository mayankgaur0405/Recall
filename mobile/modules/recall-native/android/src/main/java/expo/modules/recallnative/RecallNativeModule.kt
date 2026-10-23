package expo.modules.recallnative

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SessionPayload : Record {
  @Field var accessToken: String = ""
  @Field var refreshToken: String = ""
  @Field var apiUrl: String = ""
  @Field var supabaseUrl: String = ""
  @Field var supabaseAnonKey: String = ""
}

class RecallNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RecallNative")

    Function("setSession") { payload: SessionPayload ->
      val context = requireContext()
      ShareStore.saveSession(
        context,
        payload.accessToken,
        payload.refreshToken,
        payload.apiUrl,
        payload.supabaseUrl,
        payload.supabaseAnonKey,
      )
    }

    Function("clearSession") {
      ShareStore.clearSession(requireContext())
    }

    Function("setPendingUrl") { url: String ->
      ShareStore.setPendingUrl(requireContext(), url)
    }

    Function("consumePendingUrl") {
      ShareStore.consumePendingUrl(requireContext())
    }
  }

  private fun requireContext() =
    appContext.reactContext?.applicationContext
      ?: appContext.currentActivity?.applicationContext
      ?: throw IllegalStateException("Recall native module has no Android context yet.")
}
