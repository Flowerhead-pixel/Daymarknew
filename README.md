# Daymark

A personal goals, time and progress tracker. It runs in your browser, works offline, can be installed like an app on Android and desktop, and keeps all data on your own device. No account, no server.

## Run it on your computer

You need Node.js 18 or newer (https://nodejs.org, choose "LTS").

```
cd daymark
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

## Check that everything works

```
npm test        # 28 automatic checks of the calculations
npm run build   # type-checks everything and builds the installable app into dist/
npm run preview # serves the built app at http://localhost:4173 (offline mode only works here, not in "npm run dev")
```

## Put it on the internet so you can install it on your phone

Phones only allow installing and offline mode over **https**, so the app needs a web address. Free static hosts work well. You upload the **`dist`** folder created by `npm run build`; nothing else.

See DEPLOY.md for step-by-step options.

## Android APK file

See **APK.md**: GitHub builds the APK for you in a browser, no Android Studio needed.

## Install it as an app

- **Android (Chrome):** open your web address, tap the menu (three dots), choose **Install app** (or **Add to Home screen**).
- **Desktop (Chrome or Edge):** click the install icon at the right of the address bar, or menu, **Install Daymark**.

## Your data (please read)

- Data is stored **in this browser on this device**. Your phone and your computer have **separate** data.
- To move or protect your data, use **Settings, Export backup**, and keep the `.json` file somewhere safe. **Import backup** restores it on any device.
- The data belongs to the exact web address. If you move the app to a different address, the new one starts empty. **Export a backup first**, then import it there.
- Clearing "site data" in the browser deletes your data. Daymark asks the browser to protect it, and Settings shows whether that was granted, but a backup is the real safety net. Export one every so often.

## Where things are

```
src/db        database types, setup, backup and restore
src/lib       calculations (dates, progress, deadlines, analytics, weekly review, assessment, timer)
src/components  shared pieces (forms, cards, charts, timer bar)
src/pages     one file per screen
public        app icons
```

## Phone check-list (about 5 minutes)

1. Install it and open it from the home screen icon (it opens without the browser bar).
2. Create a goal, log 30 minutes, check the goal's progress moved.
3. Start the timer, lock the phone for a minute, unlock: the time kept running.
4. Turn on airplane mode, open the app, add a session. It should work.
5. Settings, Export backup, and check the file is saved.
