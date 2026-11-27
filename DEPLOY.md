# Putting Daymark online (free)

First build the app:

```
npm install
npm run build
```

This creates a folder called **dist**. That folder is the whole app. Upload it to any static host. The app uses relative paths, so it works at the top of a site or inside a sub-folder.

Three common free choices. Hosts change their screens now and then, so follow the host's own current instructions if a button has moved.

## Option A: Netlify (drag and drop, easiest)
1. Make a free account at netlify.com.
2. Find "Add new site", then "Deploy manually" (drag-and-drop).
3. Drag the **dist** folder onto the page.
4. You get an https address. Open it on your phone and install the app.

## Option B: Cloudflare Pages
Create a Pages project and choose "Upload assets" (direct upload). Upload the **dist** folder.

## Option C: GitHub Pages
Put the contents of **dist** in a repository and turn on Pages for it in the repository settings.

## After you publish
- Open the address on your phone and install it (see README.md).
- Updating: run `npm run build` again and upload the new **dist** folder to the same site. The next time you open Daymark online, a banner says "A new version is ready. Reload". Your data is not touched.
- Data belongs to the address. Keep using the same address, or export a backup before changing it.
