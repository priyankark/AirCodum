// Owned full-screen stimulus; never reads or modifies another application's content.
import AppKit
import Foundation
final class Surface: NSView {
    var moving = false
    var tick = 0
    override var isFlipped: Bool { true }
    override func draw(_ dirtyRect: NSRect) {
        NSColor(calibratedRed: 0.05, green: 0.08, blue: 0.13, alpha: 1).setFill(); bounds.fill()
        for row in 0..<12 { for column in 0..<20 {
            let phase = moving ? tick : 0
            let hue = CGFloat((row * 23 + column * 11 + phase) % 360) / 360
            NSColor(calibratedHue: hue, saturation: 0.7, brightness: 0.75, alpha: 1).setFill()
            NSRect(x: 30 + column * 90, y: 150 + row * 65, width: 80, height: 55).fill()
        } }
        let title = "Rusty Robot • AirCodum frame benchmark • " + (moving ? "Motion 30 Hz" : "Static desktop")
        title.draw(at: NSPoint(x: 32, y: 32), withAttributes: [.font: NSFont.monospacedSystemFont(ofSize: 28, weight: .bold), .foregroundColor: NSColor.white])
        "Owned synthetic content · 1440-wide JPEG · quality 85 · target 30 FPS".draw(at: NSPoint(x: 32, y: 88), withAttributes: [.font: NSFont.systemFont(ofSize: 22), .foregroundColor: NSColor.white])
    }
}
final class Target: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    let surface = Surface()
    func applicationDidFinishLaunching(_ note: Notification) {
        window = NSWindow(contentRect: NSScreen.screens[0].frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.level = .screenSaver; window.contentView = surface
        window.makeKeyAndOrderFront(nil); NSApplication.shared.activate(ignoringOtherApps: true)
        Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { _ in
            if self.surface.moving { self.surface.tick += 1; self.surface.needsDisplay = true }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { print("ready"); fflush(stdout) }
        DispatchQueue.global().async {
            while let line = readLine() { DispatchQueue.main.async {
                self.surface.moving = line == "motion"; self.surface.tick = 0; self.surface.needsDisplay = true
            } }
            DispatchQueue.main.async { NSApplication.shared.terminate(nil) }
        }
    }
}
let app = NSApplication.shared; app.setActivationPolicy(.regular)
let target = Target(); app.delegate = target; app.run()
