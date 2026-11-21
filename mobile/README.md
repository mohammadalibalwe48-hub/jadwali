# Jadwali for Android

Jadwali's native Flutter app lives in this directory. The web app and its Vercel deployment are built from the repository root.

## Run locally

Use Flutter 3.50.1, Java 17 or newer, Android SDK 36, and NDK 28.2.13676358.

```sh
flutter pub get
flutter analyze
flutter test
flutter run
```

## Build an APK

```sh
flutter build apk --release --target-platform android-arm64
```

The APK is written to `build/app/outputs/flutter-apk/app-release.apk`. The project currently uses Android debug signing for sideloading. Configure a private release key in Gradle before Play Store distribution.

## Screenshot imports

Enter the HTTPS origin of an active Jadwali website under **More → Screenshot scanner**. The Android app calls the existing `/api/vision` endpoint after you review the destination and approve sending the selected screenshots. The server must have image scanning configured. A distributor can supply the initial origin with `--dart-define=JADWALI_VISION_ORIGIN=https://your-jadwali-domain`.

Manual scheduling, attendance, and the timetable work offline. Use **Export → Back up data** to save a JSON backup and **More → Restore a backup** to load it on another device.
