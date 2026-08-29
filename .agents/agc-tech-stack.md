# Tech stack

This project is **vanilla HTML + CSS + JavaScript**. Do not assume npm, TypeScript, React, or a backend folder in this checkout.

## Runtime and hosting

| Layer   | Choice          | Notes                                                                   |
| ------- | --------------- | ----------------------------------------------------------------------- |
| Pages   | Static `*.html` | One file per app surface; CSS/JS inlined                                |
| Hosting | GitHub Pages    | Repo `alorobaonline.github.io`, site `https://alorobaonline.github.io/` |
| PWA     | `manifest.json` | Standalone, portrait, Arabic RTL; icon `logo.png`                       |
| Region  | `europe-west1`  | Firebase Functions / Cloud Run                                          |

There is no `package.json`, bundler, linter config, or test runner in this repo.

## Google / Firebase

Firebase JS SDK **10.8.0** (storefront and most staff pages). `bundle.html` still loads **10.7.1** — keep versions aligned when you touch that page.

Loaded from `gstatic.com` as ESM modules:

- `firebase-app`
- `firebase-firestore`
- `firebase-auth`
- `firebase-functions` (`httpsCallableFromURL`)
- `firebase-messaging` (admin + kitchen; VAPID key is still a placeholder)

Firebase project id: `alorobaonline`.  
Auth domain: `alorobaonline.firebaseapp.com`.

### Auth

| Actor               | Method                                                                              | Where                                                |
| ------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Customer            | Phone OTP (`RecaptchaVerifier`, `signInWithPhoneNumber`) plus Cloud Run `phone-otp` | `index.html`                                         |
| Staff               | Email + password (`signInWithEmailAndPassword`) + `staffRoles` gate                 | admin, kitchen, driver, inventory, bundle, analytics |
| Attendance employee | Cloud Run `employee-login`                                                          | `attendance.html`                                    |

### Data

**Cloud Firestore** is the system of record. Staff pages use `onSnapshot` heavily. Customers read catalog collections live; order create/history go through Cloud Run.

**Firebase Storage** is configured on the app but product images are uploaded to **Cloudinary** unsigned presets from the browser (admin + inventory). Prefer Cloudinary URLs over stuffing base64 into Firestore.

**Firebase Cloud Messaging** is wired in admin/kitchen (`firebase-messaging-sw.js` is referenced; confirm the worker file exists before changing push). Token registration calls Cloud Run `register-push-token`.

## Cloud Run functions

Functions are deployed **outside this repo** (comments mention Cloud Run Console, not `firebase deploy`). Clients call them with `httpsCallableFromURL` and hardcoded `https://<service>-880642361344.europe-west1.run.app` URLs.

If a URL changes, update the constant on the page that calls it. Do not invent the default `cloudfunctions.net` host — existing comments say that host is not used.

See [agc-main-services.md](agc-main-services.md) for the function list.

## Client libraries (CDN)

| Library                       | Used for            | Pages              |
| ----------------------------- | ------------------- | ------------------ |
| Leaflet 1.9.4                 | Live driver map     | `index.html`       |
| SheetJS (`xlsx` 0.18.5)       | Profit Excel export | `inventory.html`   |
| ZXing 0.20.0                  | Barcode scan        | `inventory.html`   |
| Tailwind CSS v4 browser build | Utility styling     | `bundle.html` only |
| Font Awesome 6.4              | Icons               | `bundle.html`      |
| Google Fonts                  | Cairo, Poppins      | Most pages         |

## Frontend conventions

- `lang="ar"` and `dir="rtl"` on documents.
- Mobile-first column, `max-width: 480px` (inventory ~520px).
- CSS variables: `--primary-green`, `--accent-green`.
- Firebase SDK is imported in a `<script type="module">`, then copied onto `window` (`window.db`, `window.collection`, …). The rest of the page is classic global JS and waits for `firebase-ready`.
- Cache-busting meta tags appear on the storefront and kitchen.

## What is not in this repo

- Cloud Functions / Cloud Run source (`functions/index.js` is only mentioned in comments).
- Firestore security rules and indexes.
- `firebase-messaging-sw.js` may be missing from this checkout even if pages register it.
- Native iOS/Android app code (PWA only).

When a task needs server-side changes, say so and keep HTML client contracts stable (callable payload + Firestore field names).
