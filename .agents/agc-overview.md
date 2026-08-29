# Project overview

**العروبة أونلاين** (Aloroba Online) is a mobile-first Arabic grocery store for Super Market Aloroba. Customers shop on the phone, pay cash or card-on-delivery settings, and choose **home delivery** or **store pickup**. Staff fulfill orders from separate kitchen, driver, inventory, and admin screens.

Live site: [https://alorobaonline.github.io/](https://alorobaonline.github.io/)  
Git remote: `alorobaonline/alorobaonline.github.io` (GitHub Pages).  
Firebase project: `alorobaonline`.  
Brand: RTL Arabic, green `#6BA516` / `#1b4d2e`, Cairo + Poppins, logo in `logo.png`.

## What the product does

1. **Customer storefront** (`index.html`) — catalog, search, categories, bundles, coupons, cart, checkout, phone verification, live order tracking, PWA install (`manifest.json`).
2. **Operations** — kitchen prepares and marks orders ready; drivers pick up, navigate, and complete deliveries; inventory edits stock, barcodes, costs, and supplier ledgers.
3. **Commerce admin** — products, categories, offer groups, bundles, delivery zones/fees, banners, business hours, WhatsApp, staff accounts, sales reports.
4. **Growth / compliance** — visitor analytics, marketing opt-in, 14-day cancel form, privacy and terms pages.

Store location context in legal copy: Rahat (رهط). Contact used in UI: `0546288791` / WhatsApp `972546288791`.

## Architecture in one paragraph

Every screen is a standalone HTML file hosted on GitHub Pages. Pages load Firebase JS SDK from the CDN, talk to **Cloud Firestore** in real time, and call **Cloud Run** HTTPS functions in `europe-west1` for privileged actions (create order, OTP, staff management, visit logging). Product images go to **Cloudinary**. There is no app server, no shared module folder, and no mobile native wrapper in this repo.

## Order lifecycle

Statuses are stored as Arabic strings on `orders` documents:

| Status                               | Meaning          | Typical owner                   |
| ------------------------------------ | ---------------- | ------------------------------- |
| `جديد` (`new` still accepted)        | Just placed      | Kitchen + admin                 |
| `قيد التحضير`                        | Being packed     | Kitchen                         |
| `جاهز للتوصيل`                       | Ready for driver | Driver                          |
| `قيد التوصيل`                        | Out for delivery | Driver (writes `orderTracking`) |
| `جاهز للاستلام`                      | Ready for pickup | Kitchen / customer              |
| `مكتمل` (`delivered` still accepted) | Done             | Sales stats                     |
| `ملغية`                              | Cancelled        | Driver / admin                  |

Fulfillment is either delivery (zones, GPS, Leaflet live map) or pickup (pickup hours + ETA minutes).

## People and access

- **Customers** verify with Firebase phone OTP, then place orders and view history through Cloud Run (`get-my-orders`, `get-customer-profile`).
- **Staff** sign in with email/password. Roles live in Firestore `staffRoles/{email}` as an array: `admin`, `kitchen`, `driver`, `inventory`, `bundle`. `admin` opens every staff page.
- **Hourly employees** use `attendance.html` (clock in/out, geo radius) via `employee-login` and collections `employees` / `attendanceLogs`.

## Product constraints

- UI is phone-width (~480px). Desktop is a centered column, not a separate layout.
- Copy and labels are Arabic. Keep Arabic status strings and RTL (`dir="rtl"`).
- Cart and some session data use `localStorage`.
- Sensitive writes (new orders, OTP, staff CRUD) must stay on Cloud Run — do not move them to direct client `addDoc` on `orders` unless that is an explicit migration.
