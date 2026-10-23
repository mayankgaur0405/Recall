Pod::Spec.new do |s|
  s.name           = 'RecallNative'
  s.version        = '1.0.0'
  s.summary        = 'Recall native share session bridge'
  s.description    = 'Stores share-target session state for the Recall app and iOS Share Extension.'
  s.author         = 'Recall'
  s.homepage       = 'https://github.com'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.{h,m,mm,swift,hpp,cpp}'
end
