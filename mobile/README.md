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
flutter build apk --release --target-platform android-arm64 \
  --dart-define=JADWALI_SUPABASE_ANON_KEY="$JADWALI_SUPABASE_ANON_KEY"
```

The APK is written to `build/app/outputs/flutter-apk/app-release.apk`. The project currently uses Android debug signing for sideloading. Configure a private release key in Gradle before Play Store distribution.

## Screenshot imports

The distributed APK uses the **Flutter app** Supabase project and its `jadwali-vision` Edge Function. Supply the project's public legacy `anon` JWT as `JADWALI_SUPABASE_ANON_KEY` when rebuilding. The JWT is a client key. The AI Gateway credential belongs only in the Supabase Edge Function secret `JADWALI_AI_GATEWAY_API_KEY`. Set `JADWALI_SUPABASE_URL` to target a different project.

The Edge Function reuses the website scanner. Apply `supabase/migrations/20261121023000_jadwali_scan_quota.sql` from the repository root. Then run `node supabase/jadwali/build-edge.mjs > /tmp/jadwali-vision.ts` and deploy that file as the `jadwali-vision` function with JWT verification enabled. The backend allows 40 scan requests per UTC day across the app. It does not save images or timetable data.

In **More → Screenshot scanner**, a blank override uses Supabase when built with the client key. Enter the HTTPS origin of an active Jadwali website to use its `/api/vision` endpoint instead. This custom endpoint does not receive the Supabase client key. The app shows the destination before uploading selected images.

Manual scheduling, attendance, and the timetable work offline. Use **Export → Back up data** to save a JSON backup and **More → Restore a backup** to load it on another device.
