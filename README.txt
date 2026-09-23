Kilo Oway GPS + Android Permission Fix

1. Replace app.js in GitHub with this app.js.
2. Replace .github/workflows/build-apk.yml with build-apk.yml.
3. Add this CSS at the end of style.css:
   .bottom-nav { display: none !important; }
4. Commit all changes.
5. GitHub Actions will build Kilo-Oway-APK.
6. Install the new APK.
7. On first launch, Android should show Location permission.
   Choose Precise location / While using the app.

This fixes the foreground Android location permission problem and
keeps the GPS distance filter so stationary GPS drift is not added
to kilometers.
