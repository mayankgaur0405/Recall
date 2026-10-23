const fs = require('fs')
const path = require('path')
const {
  withDangerousMod,
  withXcodeProject,
  withEntitlementsPlist,
  withAndroidManifest,
} = require('expo/config-plugins')

const SHARE_EXT_NAME = 'ShareExtension'
const APP_GROUP = 'group.com.recall.app'

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

function withIosShareFiles(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const dest = path.join(mod.modRequest.platformProjectRoot, SHARE_EXT_NAME)
      const src = path.join(mod.modRequest.projectRoot, 'native/ios/ShareExtension')
      copyDir(src, dest)
      return mod
    },
  ])
}

function withIosAppGroup(config) {
  return withEntitlementsPlist(config, (mod) => {
    const groups = new Set(mod.modResults['com.apple.security.application-groups'] || [])
    groups.add(APP_GROUP)
    mod.modResults['com.apple.security.application-groups'] = [...groups]
    return mod
  })
}

function withIosShareTarget(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults
    if (project.pbxTargetByName(SHARE_EXT_NAME)) {
      return mod
    }

    const bundleId = config.ios?.bundleIdentifier || 'com.recall.app'
    const extensionBundleId = `${bundleId}.ShareExtension`
    const projectName = mod.modRequest.projectName || 'Recall'
    const iosRoot = mod.modRequest.platformProjectRoot

    const target = project.addTarget(SHARE_EXT_NAME, 'app_extension', SHARE_EXT_NAME, extensionBundleId)
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid)
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid)
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid)

    const mainTarget = project.getFirstTarget()
    if (mainTarget?.uuid) {
      try {
        project.addBuildPhase(
          [],
          'PBXCopyFilesBuildPhase',
          'Embed Foundation Extensions',
          mainTarget.uuid,
          'app_extension'
        )
      } catch (error) {
        console.warn('[withRecallShare] Could not add embed phase automatically:', error.message)
      }
    }

    const group = project.addPbxGroup(
      [
        'ShareViewController.swift',
        'ReelUrl.swift',
        'ShareSession.swift',
        'Info.plist',
        'ShareExtension.entitlements',
      ],
      SHARE_EXT_NAME,
      SHARE_EXT_NAME
    )
    const events = project.hash.project.objects.PBXProject
    const projectUuid = Object.keys(events)[0]
    if (events[projectUuid]?.mainGroup) {
      project.addToPbxGroup(group.uuid, events[projectUuid].mainGroup)
    }

    const shareDir = path.join(iosRoot, SHARE_EXT_NAME)
    for (const file of ['ShareViewController.swift', 'ReelUrl.swift', 'ShareSession.swift']) {
      if (fs.existsSync(path.join(shareDir, file))) {
        project.addSourceFile(file, { target: target.uuid }, group.uuid)
      }
    }

    const configurations = project.pbxXCBuildConfigurationSection()
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings
      if (!buildSettings) continue
      if (configurations[key].name && project.pbxTargetByName(SHARE_EXT_NAME)) {
        const comment = configurations[key].buildSettings.PRODUCT_NAME
        if (comment === `"${SHARE_EXT_NAME}"` || buildSettings.PRODUCT_BUNDLE_IDENTIFIER === `"${extensionBundleId}"`) {
          applyShareBuildSettings(buildSettings, extensionBundleId, projectName)
        }
      }
    }

    const nativeTargets = project.pbxNativeTargetSection()
    for (const key of Object.keys(nativeTargets)) {
      const nativeTarget = nativeTargets[key]
      if (nativeTarget.name === SHARE_EXT_NAME || nativeTarget.productName === SHARE_EXT_NAME) {
        const cfgListId = nativeTarget.buildConfigurationList
        const cfgList = project.pbxXCConfigurationList()[cfgListId]
        if (!cfgList?.buildConfigurations) continue
        for (const cfg of cfgList.buildConfigurations) {
          const settings = configurations[cfg.value]?.buildSettings
          if (settings) applyShareBuildSettings(settings, extensionBundleId, projectName)
        }
      }
    }

    return mod
  })
}

function applyShareBuildSettings(buildSettings, extensionBundleId, projectName) {
  buildSettings.INFOPLIST_FILE = `${SHARE_EXT_NAME}/Info.plist`
  buildSettings.CODE_SIGN_ENTITLEMENTS = `${SHARE_EXT_NAME}/ShareExtension.entitlements`
  buildSettings.PRODUCT_BUNDLE_IDENTIFIER = extensionBundleId
  buildSettings.SWIFT_VERSION = '5.0'
  buildSettings.TARGETED_DEVICE_FAMILY = '"1"'
  buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '16.0'
  buildSettings.GENERATE_INFOPLIST_FILE = 'NO'
  buildSettings.CLANG_ENABLE_MODULES = 'YES'
  buildSettings.SKIP_INSTALL = 'YES'
  buildSettings.LD_RUNPATH_SEARCH_PATHS = '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"'
  buildSettings.PRODUCT_NAME = SHARE_EXT_NAME
  buildSettings.CODE_SIGN_STYLE = 'Automatic'
}

function withAndroidNetworkSecurityConfig(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const resXmlDir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml')
      fs.mkdirSync(resXmlDir, { recursive: true })
      const dest = path.join(resXmlDir, 'network_security_config.xml')
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`
      fs.writeFileSync(dest, xml, 'utf8')
      return mod
    },
  ])
}

function withAndroidShareFallback(config) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0]
    if (!app) return mod
    app.$ = app.$ || {}
    app.$['android:usesCleartextTraffic'] = 'true'
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config'
    app.activity = app.activity || []
    const exists = app.activity.some((item) =>
      String(item.$?.['android:name'] || '').endsWith('.share.ShareActivity')
    )
    if (!exists) {
      app.activity.push({
        $: {
          'android:name': 'expo.modules.recallnative.share.ShareActivity',
          'android:exported': 'true',
          'android:excludeFromRecents': 'true',
          'android:finishOnTaskLaunch': 'true',
          'android:noHistory': 'true',
          'android:taskAffinity': '',
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        },
        'intent-filter': [
          {
            $: { 'android:label': 'Recall' },
            action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [{ $: { 'android:mimeType': 'text/plain' } }],
          },
        ],
      })
    }

    app.service = app.service || []
    const serviceExists = app.service.some((item) =>
      String(item.$?.['android:name'] || '').endsWith('.share.ShareSaveService')
    )
    if (!serviceExists) {
      app.service.push({
        $: {
          'android:name': 'expo.modules.recallnative.share.ShareSaveService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync',
        },
      })
    }
    return mod
  })
}

function withRecallShare(config) {
  config = withIosShareFiles(config)
  config = withIosAppGroup(config)
  config = withIosShareTarget(config)
  config = withAndroidNetworkSecurityConfig(config)
  config = withAndroidShareFallback(config)
  return config
}

module.exports = withRecallShare
