import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// ミミトレのアプリアイコン/スプラッシュ図形をプログラム生成するスクリプト。
// 濃色背景 (ディープネイビー) に白い「耳 + 音波」のシンプルな図形を描く。
// App Store の要件: 1024x1024、アルファチャンネルなし、角丸なし、文字なし。

func drawMark(context: CGContext, rect: CGRect) {
    let w = rect.width
    let h = rect.height
    let cx = w / 2
    let cy = h / 2
    let unit = min(w, h)

    // 背景: 濃色ネイビー (#0B1220)。
    // CGColor(red:green:blue:alpha:) は generic RGB 扱いになりカラーマッチで
    // 色がずれるため、sRGB を明示して作成する
    let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!
    let navy = CGColor(colorSpace: sRGB, components: [0.043, 0.071, 0.125, 1.0])!
    context.setFillColor(navy)
    context.fill(rect)

    let white = CGColor(colorSpace: sRGB, components: [1.0, 1.0, 1.0, 1.0])!
    let lineWidth = unit * 0.055
    context.setStrokeColor(white)
    context.setLineWidth(lineWidth)
    context.setLineCap(.round)

    // --- 耳 (左寄り): 縦長楕円の輪郭 + 内側の曲線 ---
    let earCx = cx - unit * 0.10
    let earCy = cy
    let earW = unit * 0.17  // 半幅
    let earH = unit * 0.26  // 半高
    context.saveGState()
    context.translateBy(x: earCx, y: earCy)
    context.rotate(by: -0.12)
    context.strokeEllipse(in: CGRect(x: -earW, y: -earH, width: earW * 2, height: earH * 2))
    context.restoreGState()

    // 内側の曲線: 耳の穴まわり
    context.move(to: CGPoint(x: earCx + earW * 0.45, y: earCy + earH * 0.55))
    context.addCurve(to: CGPoint(x: earCx - earW * 0.15, y: earCy + earH * 0.10),
                     control1: CGPoint(x: earCx + earW * 0.35, y: earCy + earH * 0.15),
                     control2: CGPoint(x: earCx - earW * 0.05, y: earCy + earH * 0.35))
    context.strokePath()
    context.move(to: CGPoint(x: earCx - earW * 0.15, y: earCy + earH * 0.10))
    context.addCurve(to: CGPoint(x: earCx + earW * 0.10, y: earCy - earH * 0.35),
                     control1: CGPoint(x: earCx - earW * 0.45, y: earCy - earH * 0.15),
                     control2: CGPoint(x: earCx - earW * 0.10, y: earCy - earH * 0.30))
    context.strokePath()

    // --- 音波 (耳の右側に 3 本の円弧、右向き) ---
    let waveCx = earCx + earW * 0.95
    for i in 1...3 {
        let r = unit * (0.12 + 0.085 * CGFloat(i))
        let spread = 0.22 + 0.07 * CGFloat(i)
        let startAngle = -(CGFloat.pi * (0.5 - spread))
        let endAngle = CGFloat.pi * (0.5 - spread)
        let startX = waveCx + r * cos(startAngle)
        let startY = earCy + r * sin(startAngle)
        context.move(to: CGPoint(x: startX, y: startY))
        context.addArc(center: CGPoint(x: waveCx, y: earCy), radius: r,
                       startAngle: startAngle, endAngle: endAngle, clockwise: false)
        context.strokePath()
    }
}

func render(size: CGFloat, out: String) {
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
    // 8bpc RGB のビットマップコンテキストは `none` を直接サポートしないため、
    // premultipliedLast で描画した画像を noneSkipLast (アルファなし) の
    // コンテキストへ転写することでアルファチャンネルなしの PNG を作る
    let draw = CGContext(data: nil, width: Int(size), height: Int(size),
                         bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
                         bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    drawMark(context: draw, rect: rect)
    let drawn = draw.makeImage()!

    let opaque = CGContext(data: nil, width: Int(size), height: Int(size),
                           bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
                           bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    opaque.draw(drawn, in: rect)
    let image = opaque.makeImage()!

    guard let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL,
                                                     UTType.png.identifier as CFString, 1, nil) else {
        FileHandle.standardError.write("ERROR: failed to create image destination for \(out)\n".data(using: .utf8)!)
        exit(1)
    }
    CGImageDestinationAddImage(dest, image, nil)
    // Finalize が false を返した場合は書き出し失敗 (ディスク満杯等)。
    // 成功メッセージを出さず非ゼロで終了する
    if !CGImageDestinationFinalize(dest) {
        FileHandle.standardError.write("ERROR: failed to finalize PNG for \(out)\n".data(using: .utf8)!)
        exit(1)
    }
    print("wrote \(out) (\(Int(size))x\(Int(size)))")
}

// アイコン: 1024x1024 アルファなし
render(size: 1024, out: "assets/images/icon.png")
// スプラッシュ: 同じ図形を 512px で生成 (スプラッシュ背景色は app.config 側で合わせる)
render(size: 512, out: "assets/images/splash-icon.png")
