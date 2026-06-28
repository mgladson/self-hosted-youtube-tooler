# C4 Code — data

## Overview

The `data/` directory contains flat JSON files used as file-system-backed configuration and state stores. These files are read and written directly by the API at runtime — there is no database table backing them. They serve as a lightweight, zero-infrastructure alternative for data that changes infrequently and does not require relational queries.

---

## Files

### `data/admins.json`

**Purpose**: Defines the list of authorised admin users and their privilege tier. Checked by the API's authentication guard when a request reaches an admin-only route.

**Schema**:
```json
Array<{
  email: string,   // Admin's email address (matched against session identity)
  tier: string     // Privilege level: "super_admin" | "admin"
}>
```

**Current content**:
```json
[
  { "email": "admin@example.com",  "tier": "super_admin" },
  { "email": "test@pixelcart.com", "tier": "admin" }
]
```

**Notes**:
- `super_admin` is expected to carry elevated capabilities (e.g. access to security dashboards, ability to manage other admins).
- `admin` is the standard administrative tier.
- Adding or removing admins requires editing this file and restarting / hot-reloading the API process.

---

### `data/banner.json`

**Purpose**: Controls a site-wide announcement banner displayed on the storefront. Managed via the Admin UI.

**Schema**:
```json
{
  "active": boolean,     // Whether the banner is shown
  "text": string,        // Banner message text
  "imageUrl": string,    // Optional image URL to display in the banner
  "linkUrl": string,     // Optional CTA link URL
  "linkLabel": string,   // Optional CTA link label text
  "updatedAt": string    // ISO 8601 timestamp of last update (empty string if never set)
}
```

**Current content** (default/reset state):
```json
{
  "active": false,
  "text": "",
  "imageUrl": "",
  "linkUrl": "",
  "linkLabel": "",
  "updatedAt": ""
}
```

**Notes**:
- When `active` is `false`, the storefront does not render a banner regardless of the other fields.
- The API route `GET /api/banner` serves this file's content; `POST /api/banner` (admin-only) writes updates back.

---

### `data/pages.json`

**Purpose**: Controls the availability state of static content pages on the storefront. Each page can be individually toggled between live and "under construction" mode.

**Schema**:
```json
{
  "pages": {
    [slug: string]: {
      "underConstruction": boolean  // true = show placeholder; false = show real content
    }
  },
  "updatedAt": string  // ISO 8601 timestamp of last update (empty string if never set)
}
```

**Known page slugs** (current content):

| Slug | Under Construction |
|---|---|
| `privacy-policy` | false |
| `terms-of-service` | false |
| `refund-policy` | false |
| `changelog` | false |
| `roadmap` | false |

**Current content**:
```json
{
  "pages": {
    "privacy-policy":   { "underConstruction": false },
    "terms-of-service": { "underConstruction": false },
    "refund-policy":    { "underConstruction": false },
    "changelog":        { "underConstruction": false },
    "roadmap":          { "underConstruction": false }
  },
  "updatedAt": ""
}
```

**Notes**:
- The storefront's `[slug]` dynamic route reads this config to decide whether to render the page content or a "coming soon" placeholder.
- The API route `GET /api/pages` serves this; `POST /api/pages` (admin-only) writes updates.

---

### `data/newsletter.json`

**Purpose**: Stores the newsletter opt-in subscriber list and whether the newsletter feature is enabled.

**Schema**:
```json
{
  "enabled": boolean,        // Whether the newsletter sign-up form is shown on the storefront
  "subscribers": Array<any>, // Subscriber records (email addresses or subscriber objects)
  "updatedAt": string        // ISO 8601 timestamp of last update (empty string if never set)
}
```

**Current content** (default state):
```json
{
  "enabled": true,
  "subscribers": [],
  "updatedAt": ""
}
```

**Notes**:
- Subscribers are accumulated in-file as the array grows. For large volumes this would need to migrate to a database table.
- When `enabled` is `false`, the API rejects new subscriptions and the storefront hides the sign-up form.
- The API route `POST /api/newsletter` appends to `subscribers`; `GET /api/newsletter` (admin-only) returns the full list.

---

### `data/banned-ips.json`

**Purpose**: Runtime IP blocklist. Requests from IPs in this list are rejected by the API's bot-detector / security plugin before reaching any route handler.

**Schema**:
```json
Array<string>   // IPv4 or IPv6 addresses to block
```

**Current content**: `[]` (empty — no IPs are currently banned)

**Notes**:
- The API loads this file at startup and (depending on implementation) may watch it for changes.
- IPs can be added via the Admin security dashboard or manually by editing the file.
- See also `data/banned-ips.json.example` for the expected format.

---

### `data/banned-ips.json.example`

**Purpose**: Example file showing the format for `banned-ips.json`. Committed to the repository for documentation purposes; not loaded by the application.

**Content**: `[]` (empty array, demonstrating the JSON array format)

---

### `data/sanctions-blocklist.json`

**Purpose**: A blocklist used by the API's sanctions-check plugin to screen orders or user activity against a list of sanctioned entities (countries, individuals, or IP ranges as applicable).

**Schema**:
```json
Array<any>   // Sanctioned entity records (structure determined by the sanctions plugin consumer)
```

**Current content**: `[]` (empty — no entries currently loaded)

**Notes**:
- Consumed by `api/src/plugins/sanctions.ts`.
- In production this file would be populated with official OFAC or equivalent sanctions data.
- An empty array means sanctions checking passes all requests (no entities are blocked).

---

## Summary Table

| File | Mutable at runtime | Admin-writable | Purpose |
|---|---|---|---|
| `admins.json` | No (requires deploy) | No | Admin user registry and tier assignments |
| `banner.json` | Yes | Yes | Storefront announcement banner config |
| `pages.json` | Yes | Yes | Per-page construction/live toggle |
| `newsletter.json` | Yes | Yes (read) / Storefront (write) | Subscriber list and feature flag |
| `banned-ips.json` | Yes | Yes | Runtime IP blocklist |
| `banned-ips.json.example` | No | No | Format reference only |
| `sanctions-blocklist.json` | No (requires deploy/update) | No | Sanctions screening data |
