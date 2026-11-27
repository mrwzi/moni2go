# Android app

The Android shell uses the same deployed moni2go web app at
`https://moni2go.vercel.app`. It does not contain a second copy of the money
logic or a second data store: accounts, budgets, transactions, and Supabase
sync continue to use the existing application.

## Build a debug APK

Requirements:

- Android SDK with API 36 and build-tools 36
- JDK 21

From the repository root:

```powershell
npm install
npm run android:apk
```

The installable debug APK is created at:

`android/app/build/outputs/apk/debug/app-debug.apk`

Install it on a connected Android device with:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

This debug APK is for testing and direct installation. A Play Store release
needs a separately managed signing key and release build; no signing key is
stored in this repository.
