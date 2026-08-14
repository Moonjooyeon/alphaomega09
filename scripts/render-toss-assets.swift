import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let outDir = root.appendingPathComponent("assets/toss", isDirectory: true)
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

extension NSColor {
    convenience init(hex: UInt32) {
        let red = CGFloat((hex >> 16) & 0xff) / 255
        let green = CGFloat((hex >> 8) & 0xff) / 255
        let blue = CGFloat(hex & 0xff) / 255
        self.init(calibratedRed: red, green: green, blue: blue, alpha: 1)
    }
}

func withContext(_ size: CGFloat, draw: (CGContext) -> Void) -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(size),
        pixelsHigh: Int(size),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let context = NSGraphicsContext.current!.cgContext
    context.translateBy(x: 0, y: size)
    context.scaleBy(x: 1, y: -1)
    draw(context)
    NSGraphicsContext.restoreGraphicsState()

    return rep
}

func fill(_ color: NSColor, in rect: CGRect, radius: CGFloat = 0, context: CGContext) {
    context.setFillColor(color.cgColor)
    let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
    context.addPath(path)
    context.fillPath()
}

func strokeRect(_ color: NSColor, rect: CGRect, radius: CGFloat, width: CGFloat, context: CGContext) {
    context.setStrokeColor(color.cgColor)
    context.setLineWidth(width)
    let inset = width / 2
    let path = CGPath(
        roundedRect: rect.insetBy(dx: inset, dy: inset),
        cornerWidth: radius,
        cornerHeight: radius,
        transform: nil
    )
    context.addPath(path)
    context.strokePath()
}

func strokeLine(_ color: NSColor, from: CGPoint, to: CGPoint, width: CGFloat, context: CGContext) {
    context.setStrokeColor(color.cgColor)
    context.setLineWidth(width)
    context.setLineCap(.square)
    context.move(to: from)
    context.addLine(to: to)
    context.strokePath()
}

func strokeCircle(_ color: NSColor, center: CGPoint, radius: CGFloat, width: CGFloat, context: CGContext) {
    context.setStrokeColor(color.cgColor)
    context.setLineWidth(width)
    context.strokeEllipse(in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
}

func fillCircle(_ color: NSColor, center: CGPoint, radius: CGFloat, context: CGContext) {
    context.setFillColor(color.cgColor)
    context.fillEllipse(in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
}

func centeredText(
    _ text: String,
    y: CGFloat,
    size: CGFloat,
    weight: NSFont.Weight,
    color: NSColor,
    width: CGFloat = 600
) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let font = NSFont.systemFont(ofSize: size, weight: weight)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .paragraphStyle: paragraph
    ]
    let rect = CGRect(x: 0, y: y, width: width, height: size * 1.35)
    NSString(string: text).draw(in: rect, withAttributes: attrs)
}

func save(_ rep: NSBitmapImageRep, name: String) throws {
    let url = outDir.appendingPathComponent(name)
    let data = rep.representation(using: .png, properties: [:])!
    try data.write(to: url, options: .atomic)
    print(url.path)
}

func drawIcon() throws {
    let rep = withContext(600) { context in
        fill(NSColor(hex: 0xF7F7F1), in: CGRect(x: 0, y: 0, width: 600, height: 600), context: context)
        fill(NSColor(hex: 0xFCFCF8), in: CGRect(x: 42, y: 42, width: 516, height: 516), radius: 76, context: context)
        strokeRect(NSColor(hex: 0xC8D2C4), rect: CGRect(x: 42, y: 42, width: 516, height: 516), radius: 76, width: 8, context: context)

        strokeLine(NSColor(hex: 0x161A15), from: CGPoint(x: 300, y: 116), to: CGPoint(x: 300, y: 170), width: 17, context: context)
        strokeLine(NSColor(hex: 0x161A15), from: CGPoint(x: 300, y: 430), to: CGPoint(x: 300, y: 484), width: 17, context: context)
        strokeLine(NSColor(hex: 0x161A15), from: CGPoint(x: 116, y: 300), to: CGPoint(x: 170, y: 300), width: 17, context: context)
        strokeLine(NSColor(hex: 0x161A15), from: CGPoint(x: 430, y: 300), to: CGPoint(x: 484, y: 300), width: 17, context: context)
        strokeCircle(NSColor(hex: 0x161A15), center: CGPoint(x: 300, y: 300), radius: 150, width: 17, context: context)
        strokeCircle(NSColor(hex: 0x314E43), center: CGPoint(x: 300, y: 300), radius: 88, width: 12, context: context)
        fillCircle(NSColor(hex: 0x9B303A), center: CGPoint(x: 300, y: 300), radius: 30, context: context)
    }
    try save(rep, name: "character-report-icon-600.png")
}

func drawThumbnail() throws {
    let rep = withContext(600) { context in
        fill(NSColor(hex: 0xF2F4EC), in: CGRect(x: 0, y: 0, width: 600, height: 600), context: context)
        fill(NSColor(hex: 0xFCFCF8), in: CGRect(x: 36, y: 36, width: 528, height: 528), radius: 56, context: context)
        strokeRect(NSColor(hex: 0xBFCBBB), rect: CGRect(x: 36, y: 36, width: 528, height: 528), radius: 56, width: 6, context: context)
        strokeLine(NSColor(hex: 0xD9DED3), from: CGPoint(x: 92, y: 150), to: CGPoint(x: 508, y: 150), width: 4, context: context)
        strokeLine(NSColor(hex: 0xD9DED3), from: CGPoint(x: 92, y: 450), to: CGPoint(x: 508, y: 450), width: 4, context: context)

        strokeLine(NSColor(hex: 0x161A15), from: CGPoint(x: 300, y: 116), to: CGPoint(x: 300, y: 160), width: 12, context: context)
        strokeLine(NSColor(hex: 0x161A15), from: CGPoint(x: 300, y: 272), to: CGPoint(x: 300, y: 316), width: 12, context: context)
        strokeLine(NSColor(hex: 0x161A15), from: CGPoint(x: 184, y: 216), to: CGPoint(x: 228, y: 216), width: 12, context: context)
        strokeLine(NSColor(hex: 0x161A15), from: CGPoint(x: 372, y: 216), to: CGPoint(x: 416, y: 216), width: 12, context: context)
        strokeCircle(NSColor(hex: 0x161A15), center: CGPoint(x: 300, y: 216), radius: 86, width: 12, context: context)
        strokeCircle(NSColor(hex: 0x314E43), center: CGPoint(x: 300, y: 216), radius: 48, width: 8, context: context)
        fillCircle(NSColor(hex: 0x9B303A), center: CGPoint(x: 300, y: 216), radius: 17, context: context)

        NSGraphicsContext.current!.cgContext.scaleBy(x: 1, y: -1)
        NSGraphicsContext.current!.cgContext.translateBy(x: 0, y: -600)
        centeredText("캐릭터 리포트", y: 190, size: 58, weight: .heavy, color: NSColor(hex: 0x161A15))
        centeredText("CHARACTER REPORT", y: 147, size: 24, weight: .bold, color: NSColor(hex: 0x314E43))
        centeredText("창작 캐릭터 감별 결과지", y: 88, size: 22, weight: .semibold, color: NSColor(hex: 0x6E776B))
    }
    try save(rep, name: "character-report-thumbnail-600.png")
}

try drawIcon()
try drawThumbnail()
