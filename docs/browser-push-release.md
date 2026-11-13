# Bombim00 Web v1.2.0

The Chrome Web Push button is in Settings. Settings also links to the existing Android APK release. Push subscriptions are private to the selected devices. The Worker sends only to validated Chrome Push endpoints. It keeps delivery history and does not replay unresolved deliveries.

Before releasing, apply the additive D1 migration `0002_browser_push.sql` to the production Worker database. Store the VAPID public key, private P-256 scalar (base64url), HTTPS contact subject and a random device enrollment code as Worker secrets named `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` and `WEB_PUSH_ENROLLMENT`. Set the production Pages service binding `CHECKER` to `bombim00-lottery-checker`. Pages Functions route requests through this binding so the Worker can keep its existing Cloudflare Access protection. Share the enrollment code through a private channel.

After release, enroll Chrome on Android, tap the test button and close the tab immediately. Verify the system notification and that tapping it opens the results page. Verify a new scheduled alert or lottery result on the same device, and verify that a previously sent or unresolved result does not repeat. Then retire the old ntfy follow-up automation and secrets. If rollback is needed, revert the release commit through GitHub and leave the new D1 table and delivery history in place.
