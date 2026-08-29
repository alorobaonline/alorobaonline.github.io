# Agent context index

This file is the **index of all project instructions**. Read it first, then open only the `agc-*` files that match the current task.

Cursor loads this index through `.cursor/rules/agc-index.mdc`.

## How to use

1. Read this index.
2. Open the matching `agc-*` file(s) under `.agents/`.
3. Prefer facts in these files over assumptions about frameworks, routing, or backends that are not in this repo.
4. When you add or change a durable convention, update the relevant `agc-*` file and add a row here.

## Instruction files

| File                                         | When to read                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| [agc-overview.md](agc-overview.md)           | Any new session, product questions, orientation, or before changing user-facing flows |
| [agc-tech-stack.md](agc-tech-stack.md)       | Before adding libraries, changing hosting, auth, storage, or build/deploy assumptions |
| [agc-main-services.md](agc-main-services.md) | Before touching a page, Firestore collection, Cloud Run function, or order/staff flow |

## Working rules

- This repo is a **static multi-page HTML app**. There is no bundler, `package.json`, or shared JS/CSS source tree.
- Each `*.html` page is self-contained (inline CSS + JS). Keep changes local to the page unless a behavior is shared by design (Firebase project, collections, order statuses).
- Do not invent a React/Next/Vite/Express architecture. Do not add a build step unless the task explicitly asks for one.
- Customers use **phone OTP**. Staff use **email/password** plus `staffRoles`. Do not mix the two auth models.
- Order statuses are Arabic strings. Keep the existing status vocabulary; do not replace it with English enums unless a migration is requested.
- Never copy Firebase keys, Cloudinary presets, or Cloud Run URLs into new public docs. Point to the existing page constants instead.
- Cloud Functions live **outside this repo** (Cloud Run, `europe-west1`). This repo only stores the callable URLs and the HTML clients.

## Page map

| Page                                                | Audience              | Role gate                                      |
| --------------------------------------------------- | --------------------- | ---------------------------------------------- |
| `index.html`                                        | Customers             | Phone OTP (storefront)                         |
| `admin.html`                                        | Store owner / manager | `admin`                                        |
| `kitchen.html`                                      | Kitchen / packing     | `admin` or `kitchen`                           |
| `driver.html`                                       | Drivers               | `admin` or `driver`                            |
| `inventory.html`                                    | Stock / costs         | `admin` or `inventory`                         |
| `bundle.html`                                       | Bundle offers         | `admin` or `bundle`                            |
| `analytics.html`                                    | Owner analytics       | `admin`                                        |
| `attendance.html`                                   | Employees + admin     | Employee PIN/login; admin settings via `admin` |
| `cancel-order.html`                                 | Customers             | Public form                                    |
| `privacy.html`, `privacy-policy.html`, `terms.html` | Public legal          | None                                           |
