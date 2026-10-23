import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
  private let statusLabel = UILabel()
  private let spinner = UIActivityIndicatorView(style: .medium)

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.98, green: 0.98, blue: 0.97, alpha: 1)
    configureChrome()
    Task { await processShare() }
  }

  private func configureChrome() {
    spinner.translatesAutoresizingMaskIntoConstraints = false
    spinner.startAnimating()
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.text = "Saving to Recall…"
    statusLabel.textColor = UIColor(red: 0.11, green: 0.10, blue: 0.09, alpha: 1)
    statusLabel.font = .systemFont(ofSize: 17, weight: .semibold)
    statusLabel.textAlignment = .center
    statusLabel.numberOfLines = 0

    view.addSubview(spinner)
    view.addSubview(statusLabel)
    NSLayoutConstraint.activate([
      spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -24),
      statusLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 16),
      statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
    ])
  }

  private func processShare() async {
    let raw = await loadSharedText()
    guard let url = ReelUrl.extract(raw) else {
      await finish(message: "Not an Instagram Reel link", success: false)
      return
    }

    let apiUrl = ShareSession.apiUrl
    var access = ShareSession.accessToken
    if apiUrl.isEmpty || access == nil || access?.isEmpty == true {
      ShareSession.setPendingUrl(url)
      await finish(message: "Open Recall and sign in to finish saving.", success: false, openHost: true)
      return
    }

    do {
      var result = try await ingest(apiUrl: apiUrl, token: access!, url: url)
      if result.status == 401, let refresh = ShareSession.refreshToken {
        if let next = try await refreshAccess(refreshToken: refresh) {
          access = next
          result = try await ingest(apiUrl: apiUrl, token: next, url: url)
        }
      }

      if result.status == 401 {
        ShareSession.setPendingUrl(url)
        await finish(message: "Open Recall and sign in to finish saving.", success: false, openHost: true)
        return
      }

      if (200...299).contains(result.status) {
        let duplicate = result.json?["duplicate"] as? Bool ?? false
        await finish(message: duplicate ? "Already in Recall ✓" : "Reel saved to Recall ✓", success: true)
        return
      }

      if result.status == 400 {
        let error = result.json?["error"] as? String ?? "That share did not include a Reel link"
        await finish(message: error, success: false)
        return
      }

      ShareSession.setPendingUrl(url)
      let error = result.json?["error"] as? String ?? "Could not save Reel. It was kept for retry."
      await finish(message: error, success: false)
    } catch {
      ShareSession.setPendingUrl(url)
      await finish(message: "Network error. The Reel link was kept for retry.", success: false)
    }
  }

  private func finish(message: String, success: Bool, openHost: Bool = false) async {
    await MainActor.run {
      spinner.stopAnimating()
      spinner.isHidden = true
      statusLabel.text = message
      statusLabel.textColor = success
        ? UIColor(red: 0.11, green: 0.10, blue: 0.09, alpha: 1)
        : UIColor(red: 0.73, green: 0.11, blue: 0.11, alpha: 1)
    }
    if openHost {
      openHostApp()
    }
    try? await Task.sleep(nanoseconds: success ? 900_000_000 : 1_600_000_000)
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }

  private func openHostApp() {
    guard let url = URL(string: "recall://login") else { return }
    var responder: UIResponder? = self
    let selector = sel_registerName("openURL:")
    while let current = responder {
      if current.responds(to: selector) {
        current.perform(selector, with: url)
        break
      }
      responder = current.next
    }
  }

  private func loadSharedText() async -> String {
    var chunks: [String] = []
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
      return ""
    }
    for item in items {
      if let text = item.attributedContentText?.string, !text.isEmpty {
        chunks.append(text)
      }
      for provider in item.attachments ?? [] {
        if let value = await loadString(from: provider) {
          chunks.append(value)
        }
      }
    }
    return chunks.joined(separator: "\n")
  }

  private func loadString(from provider: NSItemProvider) async -> String? {
    let types = [UTType.url.identifier, UTType.plainText.identifier, "public.file-url"]
    for type in types where provider.hasItemConformingToTypeIdentifier(type) {
      let loaded: String? = await withCheckedContinuation { continuation in
        provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
          continuation.resume(returning: stringify(item))
        }
      }
      if let loaded, !loaded.isEmpty {
        return loaded
      }
    }
    return nil
  }

  private func ingest(apiUrl: String, token: String, url: String) async throws -> HttpResult {
    guard let endpoint = URL(string: "\(apiUrl)/api/reels/ingest") else {
      throw URLError(.badURL)
    }
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.timeoutInterval = 20
    request.httpBody = try JSONSerialization.data(withJSONObject: ["url": url])
    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    return HttpResult(status: status, json: json)
  }

  private func refreshAccess(refreshToken: String) async throws -> String? {
    let supabase = ShareSession.supabaseUrl
    guard !supabase.isEmpty, let anon = ShareSession.anonKey,
          let endpoint = URL(string: "\(supabase)/auth/v1/token?grant_type=refresh_token") else {
      return nil
    }
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(anon, forHTTPHeaderField: "apikey")
    request.setValue("Bearer \(anon)", forHTTPHeaderField: "Authorization")
    request.timeoutInterval = 15
    request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200...299).contains(status),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let access = json["access_token"] as? String, !access.isEmpty else {
      return nil
    }
    let nextRefresh = json["refresh_token"] as? String ?? refreshToken
    ShareSession.saveTokens(access: access, refresh: nextRefresh)
    return access
  }
}

private func stringify(_ item: NSSecureCoding?) -> String? {
  if let url = item as? URL { return url.absoluteString }
  if let text = item as? String { return text }
  if let data = item as? Data { return String(data: data, encoding: .utf8) }
  return nil
}

private struct HttpResult {
  let status: Int
  let json: [String: Any]?
}
