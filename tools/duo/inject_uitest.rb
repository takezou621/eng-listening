require 'xcodeproj'

# 生成済みプロジェクト (ios/app.xcodeproj) に UI テストターゲットを注入する。
# ios/ は prebuild の生成物 (git 管理外) なので、検証のたびにこのスクリプトで足す。
project = Xcodeproj::Project.open('ios/app.xcodeproj')
app_target = project.targets.find { |t| t.name == 'app' }
raise 'app target not found' unless app_target

existing = project.targets.find { |t| t.name == 'appUITests' }
if existing
  existing.build_configurations.each do |config|
    config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
    config.build_settings['PRODUCT_NAME'] = 'appUITests'
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.takezou.englistening.uitests'
    config.build_settings['TEST_TARGET_NAME'] = 'app'
  end
  project.save
  puts 'appUITests target already exists (settings refreshed)'
else
  test_target = project.new_target(:ui_test_bundle, 'appUITests', :ios, '15.1', nil, :swift)
  group = project.main_group.new_group('appUITests', 'appUITests')
  file_ref = group.new_file('appUITests/DuoSmokeTests.swift')
  test_target.add_file_references([file_ref])
  test_target.add_dependency(app_target)
  test_target.build_configurations.each do |config|
    s = config.build_settings
    s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.takezou.englistening.uitests'
    s['TEST_TARGET_NAME'] = 'app'
    s['SWIFT_VERSION'] = '5.0'
    s['CODE_SIGN_STYLE'] = 'Automatic'
    s['DEVELOPMENT_TEAM'] = '4B873Q67MK'
    s['TARGETED_DEVICE_FAMILY'] = '1'
    s['GENERATE_INFOPLIST_FILE'] = 'YES'
    s['PRODUCT_NAME'] = 'appUITests'
  end
  project.save
  puts 'appUITests target injected'
end

# duo-smoke スキーム (無ければ作る): app を起動対象、appUITests をテスト対象にする
scheme_path = 'ios/app.xcodeproj/xcshareddata/xcschemes/duo-smoke.xcscheme'
if File.exist?(scheme_path)
  puts 'duo-smoke scheme already exists'
else
  scheme = Xcodeproj::XCScheme.new
  scheme.add_build_target(app_target)
  scheme.add_test_target(project.targets.find { |t| t.name == 'appUITests' })
  scheme.set_launch_target(app_target)
  scheme.save_as('ios/app.xcodeproj', 'duo-smoke')
  puts 'duo-smoke scheme created'
end
