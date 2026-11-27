# Get the Android APK (built for you on GitHub)

You only need a browser. GitHub's free build machines compile the APK; you just upload the project and download the result.

## One-time setup

1. **Make a free account** at github.com and sign in.
2. **Create a repository:** the "+" at the top right, "New repository". Name it `daymark`. Choose **Private**. Click "Create repository".
3. **Unzip** `daymark-final.zip` on your computer. Open the unzipped `daymark` folder.
4. On the new repository page click **"uploading an existing file"**. Drag **everything inside the `daymark` folder** onto the page (all files and folders, including `src`, `public`, `assets`, `signing`, `.github`). Wait until the upload bars finish, then click **Commit changes**.
   - **Hidden folder warning:** `.github` starts with a dot and some computers hide it (Mac: press Cmd+Shift+. to show it). After uploading, check the repository's file list shows a **`.github`** folder. If it is missing, use **Add file, Create new file**, type the name `.github/workflows/build-apk.yml`, paste in the contents of `APK-workflow-copy.txt`, and commit.
5. Click the **Actions** tab. A run called **Build Android APK** starts by itself. It takes roughly 5 to 10 minutes. A green tick means done. (If GitHub asks you to enable workflows, click the green button.)

## Download the APK

- On the repository's main page, look on the right for **Releases**. Open the newest one, **Daymark APK**, and tap **Daymark.apk**.
- Backup route: open the finished run in Actions, scroll to **Artifacts**, download **Daymark-APK** (a zip containing the APK).

## Install it on your phone

1. Open the downloaded `Daymark.apk` (from your Downloads or the browser's download notice).
2. Android will ask you to allow installing from this source ("Install unknown apps"). Allow it for the app you used to download.
3. If Google Play Protect warns about an unknown developer, choose **Install anyway**. The app is yours; it is not published in the Play Store.

## Updating later

Upload the changed files to the repository (or Actions tab, Build Android APK, **Run workflow**). Each build gets a higher version number and is signed with the same key, so the new APK installs **over** the old app and **keeps your data**.

## Your data

- The APK keeps its **own** data, separate from the Chrome version of Daymark. To move across, in the old one use **Settings, Export backup**, then in the APK **Import backup**.
- **Uninstalling the app deletes its data.** Export a backup first.
- In the APK, **Export backup** opens your phone's share menu: save it to Drive or Files, or email it to yourself.

## If the build fails

Open the failed run in the Actions tab (red cross), open the step that failed, and copy the red error lines. Send them to me and I will fix it.

## Notes

- The APK is a "debug build". That is normal for a personal app and installs fine. It is signed with the key in `signing/debug.keystore`, which is a standard throwaway debug key. Do not publish this APK to others as a trusted app.
- The app needs no internet and sends no data anywhere.
