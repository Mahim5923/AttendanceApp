# AttendPro - iOS Application

This folder contains the complete native iOS project for **AttendPro** (SwiftUI + Firebase iOS SDK) matching your updated Firebase project (`attend-pro-ced53`).

---

## 🚀 Two Ways to Run on iOS

### 1. Instant Access on iPhone / iPad (Progressive Web App - No Mac Required)
You can run and test AttendPro on your iPhone or iPad immediately without a Mac:
1. Start the local server on your computer:
   ```bash
   python -m http.server 8080 --directory web
   ```
2. Open Safari on your iPhone/iPad and navigate to your computer's local IP address: `http://<YOUR-IP>:8080` (or deploy to Firebase Hosting / Vercel for a public HTTPS URL).
3. In Safari, tap the **Share** button (`⬆️`) and select **"Add to Home Screen"**.
4. The AttendPro icon will appear on your iOS home screen! When launched, it runs in fullscreen standalone mode with full camera and GPS geofence access.

---

### 2. Native iOS App (SwiftUI & Xcode for App Store)
To build the native `.ipa` file or run in Xcode Simulator:
1. Copy the `ios/` directory to a Mac running macOS with Xcode 15+.
2. Open terminal in `ios/` and install Firebase pods:
   ```bash
   pod install
   ```
   *(Or add Firebase via Swift Package Manager: `https://github.com/firebase/firebase-ios-sdk`)*
3. Open `AttendPro.xcworkspace` in Xcode.
4. Select your Development Team in **Signing & Capabilities**.
5. Select an iOS Simulator or connected iPhone and click **Run** (`⌘R`).

---

## ⚙️ Configuration & Features
- **Bundle Identifier**: `com.attendance.attendpro`
- **Firebase Project**: `attend-pro-ced53`
- **Firebase Config**: `AttendPro/GoogleService-Info.plist`
- **Permissions**: Configured in `Info.plist` for `NSCameraUsageDescription` and `NSLocationWhenInUseUsageDescription`.
- **Database Fallback**: Connects to the `"attendance"` database with automatic fallback to `(default)`.
