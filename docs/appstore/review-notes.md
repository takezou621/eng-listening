# App Review Notes (ミミトレ / eng-listening)

審査メモの正本。`scripts/release/appstore-spec.py` が English セクションを spec の
`reviewNotes` に入れる (asc-submit が審査情報として転記する)。ASCII 換算で
4000 文字以内 (asc-submit の上限。超過すると apply が 409 を返す)。

## English (paste into App Review Notes)

Mimitore is an English listening practice app for Japanese speakers. Short
(3-minute) lessons train learners to hear natural sound changes in spoken
English (linking, reduction, flapping) with karaoke-style word highlighting.

- No account or sign-in is required. All 15 lessons are free, with no limit on
  the number of lessons per day.
- The premium subscription unlocks only the detailed weakness analysis on the
  Progress tab. Billing goes through Apple in-app purchases managed with
  RevenueCat: JPY 680 per month, or JPY 4,800 per year (the yearly plan includes
  a 7-day free trial). Subscriptions auto-renew and can be cancelled in App Store
  settings at least 24 hours before renewal.
- The microphone permission is used only to record the user's own voice for
  shadowing practice, so they can compare it with the lesson audio. Recordings
  are processed on the device only and are never transmitted to any server or
  third party. Speech recognition is not used, and every feature works without
  granting microphone access.
- All lesson audio is pre-generated AI speech (Google Cloud TTS, Neural2 voices)
  with original scripts. There is no user-generated content, no chat, no
  messaging, and no unrestricted web browsing.
- New in version 1.1: the app collects anonymous usage data with Firebase
  Analytics (Google Analytics for Firebase) — screen views, lesson completion,
  and feature usage. The data is not linked to the user's identity. Firebase
  Crashlytics collects crash diagnostics, and Firebase Performance Monitoring
  collects app performance metrics, to improve stability. The app shows no ads,
  does not use the advertising identifier (IDFA), and does not track users
  across other companies' apps or websites.

New in version 1.2: three new lessons focus on assimilation, intrusion, and weak forms — the rarer sound-change types — so learners can practice every diagnostic type. All lessons remain free and the premium paywall is unchanged.

New in version 1.3: the personal curriculum (three-step lesson order on the home screen) can now be adjusted manually — learners can pick up to three sound-change types to focus on and a difficulty level (all / beginner / intermediate). Untouched items keep the automatic recommendations. No changes to billing, pricing, accounts, or data collection in this release.

---

