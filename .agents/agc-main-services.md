# Main services

Services here means **HTML apps**, **Cloud Run callables**, and **Firestore collections**. All of them share Firebase project `alorobaonline`.

## HTML apps

### Customer

| File                                                | Job                                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `index.html`                                        | Store: catalog, cart, checkout, OTP, order tracking, marketing opt-in, visit analytics writes |
| `cancel-order.html`                                 | Public 14-day cancel request → `cancellationRequests`                                         |
| `privacy.html`, `privacy-policy.html`, `terms.html` | Legal pages                                                                                   |

Storefront checkout options: delivery vs pickup, cash vs Visa (toggled in `settings/paymentSettings`), coupons, spend offers, free-delivery promo, WhatsApp contact from `settings/storeSettings`.

### Staff / operations

| File              | Job                                                                        | Allowed roles             |
| ----------------- | -------------------------------------------------------------------------- | ------------------------- |
| `admin.html`      | Catalog, offers, customers, reports, store settings, staff CRUD            | `admin`                   |
| `kitchen.html`    | Active orders, prep, print, pickup ETA, mark ready / complete pickup       | `admin`, `kitchen`        |
| `driver.html`     | Ready + in-transit orders, WhatsApp, maps, GPS tracking, complete / cancel | `admin`, `driver`         |
| `inventory.html`  | Stock, barcodes, costs, Cloudinary photos, suppliers, Excel profit report  | `admin`, `inventory`      |
| `bundle.html`     | Create / edit / toggle bundle offers                                       | `admin`, `bundle`         |
| `analytics.html`  | Live visitors, funnels, coupons, abandoned carts, product views            | `admin`                   |
| `attendance.html` | Employee clock in/out + admin employee/log management                      | Employees; admin settings |

Admin tabs: home, products, bundles, offers, customers, reports, settings, staff.

## Cloud Run callables

Region: `europe-west1`. Project number in URLs: `880642361344`.

| Service URL name       | Called from                  | Purpose                                              |
| ---------------------- | ---------------------------- | ---------------------------------------------------- |
| `create-order`         | `index.html`                 | Place order (privileged write)                       |
| `get-customer-profile` | `index.html`                 | Load signed-in customer profile                      |
| `get-my-orders`        | `index.html`                 | Customer order history                               |
| `log-visit`            | `index.html`                 | Visit logging                                        |
| `subscribe-marketing`  | `index.html`                 | Marketing opt-in                                     |
| `phone-otp`            | `index.html`                 | Phone OTP helper                                     |
| `register-push-token`  | `admin.html`, `kitchen.html` | Save FCM token                                       |
| `manage-staff`         | `admin.html`                 | Create staff user / set roles (`create`, `setRoles`) |
| `employee-login`       | `attendance.html`            | Employee attendance login                            |

`kitchen.html` still has a placeholder `NOTIFY_FUNCTION_URL` (`REGION-PROJECT_ID.cloudfunctions.net/phoneOtp`). Do not treat that stub as live.

Source for these functions is **not** in this repo. Change a URL only when the deployed service URL changes.

## Firestore collections

### Catalog and merchandising

| Collection      | Used by                                   |
| --------------- | ----------------------------------------- |
| `products`      | Store, admin, inventory, kitchen, bundles |
| `categories`    | Store, admin, inventory                   |
| `bundles`       | Store, kitchen, `bundle.html`             |
| `offerGroups`   | Store, admin                              |
| `productCosts`  | Admin, inventory (cost / margin)          |
| `coupons`       | Store redeem, analytics CRUD              |
| `deliveryZones` | Store checkout, admin                     |

### Orders and tracking

| Collection             | Used by                                 |
| ---------------------- | --------------------------------------- |
| `orders`               | All fulfillment surfaces                |
| `orderTracking`        | Driver writes GPS; storefront map reads |
| `cancellationRequests` | `cancel-order.html`                     |

### Settings documents (`settings/{id}`)

| Document            | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `storeSettings`     | WhatsApp, Waze, uncategorized visibility |
| `deliverySettings`  | Default fee, pickup fee, free threshold  |
| `deliveryTiers`     | Fee tiers                                |
| `paymentSettings`   | Visa / cash toggles                      |
| `businessHours`     | Delivery hours                           |
| `pickupHours`       | Pickup hours                             |
| `banner`            | Home slides                              |
| `layout`            | Storefront layout                        |
| `freeDeliveryPromo` | Timed free-delivery campaign             |
| `spendOffers`       | Spend-X get-Y offers                     |
| `orderCounter`      | Sequential order numbers                 |
| `salesStats`        | Aggregate sales                          |
| `attendanceAdmin`   | Attendance geo / admin config            |

### Staff, HR, suppliers

| Collection             | Used by                   |
| ---------------------- | ------------------------- |
| `staffRoles`           | Role array keyed by email |
| `employees`            | Attendance roster         |
| `attendanceLogs`       | Clock in/out records      |
| `suppliers`            | Inventory                 |
| `supplierTransactions` | Inventory ledger          |

### Analytics

| Collection             | Used by                       |
| ---------------------- | ----------------------------- |
| `liveVisitors`         | Store writes; analytics reads |
| `visitorStats`         | Totals / daily                |
| `funnelStats`          | Daily funnel                  |
| `productViewStats`     | Product views                 |
| `abandonedCarts`       | Carts left behind             |
| `trafficSourceStats`   | Daily sources                 |
| `engagementStats`      | Daily engagement              |
| `marketingSubscribers` | Opt-in phones                 |
| `salesStatsDaily`      | Daily sales after complete    |

## Shared contracts to preserve

- Staff gate: read `staffRoles/{email}.roles` after Auth; `admin` bypasses page-specific roles.
- Order status strings stay Arabic (see [agc-overview.md](agc-overview.md)).
- Firebase is exposed on `window` after `firebase-ready`. New page logic should wait for that event.
- Image uploads: Cloudinary unsigned upload from admin/inventory, then store the HTTPS URL on the product.
- Do not add a second catalog or a parallel orders collection. Extend the existing documents.
