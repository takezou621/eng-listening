require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'WatchBridge'
  s.version        = package['version']
  s.summary        = 'WatchConnectivity bridge for Mimitore'
  s.description    = 'Local Expo module bridging React Native and the Apple Watch companion app via WatchConnectivity.'
  s.author         = 'Takeshi Kawai'
  s.homepage       = 'https://33eigo.win/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
end
