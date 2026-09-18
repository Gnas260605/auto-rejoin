# Auto Rejoin Pro — Project Improvement & Commerce Roadmap

> **File đề xuất:** `PROJECT_IMPROVEMENT_PLAN.md`  
> **Ngày lập kế hoạch:** 2026-09-15  
> **Phạm vi:** Nâng cấp Auto Rejoin Pro từ hệ thống license + admin hiện tại thành nền tảng thương mại có thể bán key/license và nhiều loại sản phẩm số khác, đồng thời đưa toàn bộ hệ thống qua staging và production an toàn.

---

## 0. Mục tiêu của tài liệu

Tài liệu này là **source of truth cho giai đoạn cải tiến tiếp theo** của Auto Rejoin Pro.

Mục tiêu không phải viết lại hệ thống đang chạy, mà là:

1. Giữ nguyên các phần ổn định đã hoàn thành:
   - Agent/CLI.
   - License backend.
   - Device/license enforcement.
   - Admin license dashboard.
   - Signed update.
   - MySQL integration.
   - Production preflight hiện có.
2. **Đảm bảo tính tương thích và khả năng hoạt động liên tục ngay lập tức**:
   - Duy trì **Cloudflare Tunnel (TryCloudflare & Named Tunnel)** làm môi trường Gateway đang chạy (Active Pilot / Dev Gateway) để bạn bè, tester và pilot users hiện tại có thể tiếp tục kích hoạt key, mua key, chạy tool Termux bình thường mà không bị gián đoạn.
   - Hỗ trợ kiến trúc mạng kép (Dual Topology): vừa chạy được ngay qua Cloudflare Tunnel trên máy dev/pilot, vừa sẵn sàng chuyển giao lên Cloud VPS / Production Domain.
3. Xây thêm lớp **Commerce** để bán:
   - Auto Rejoin Pro license.
   - Digital key khác.
   - File/download.
   - Subscription.
   - Dịch vụ.
   - Các sản phẩm số mới trong tương lai.
4. Tạo **Customer Portal** để khách tự quản lý đơn hàng, license và thiết bị.
5. Đưa payment từ mức unit test sang staging/production thực tế.
6. Hoàn thành physical pilot và các production gates còn thiếu.
7. Chuẩn hóa testing, observability, security, deployment và vận hành.
8. Tránh hard-code hệ thống chỉ dành cho một sản phẩm.

---

# 1. Baseline hiện tại của dự án

## 1.1 Trạng thái đã xác minh từ repository

Repository hiện tại đã có cấu trúc tương đối trưởng thành:

```text
admin/
bin/
keys/
lib/
nginx/
scripts/
server/
tests/
```

Các thành phần đã có:

- Bash/Termux agent.
- `bin/roblox-manager`.
- Safe config loader.
- Android command abstraction.
- Structured logging.
- Process locks, cooldown, backoff.
- Monitor state machine.
- Setup wizard.
- Profile system.
- Safe APK installer.
- License client.
- License server.
- MySQL database.
- Admin authentication.
- Admin license dashboard.
- Signed update manifest.
- Support bundle với secret redaction.
- Production preflight.
- PayOS webhook signature unit tests.

Theo `PROJECT_PROGRESS.md`, dự án đã hoàn thành đến **Phase 5C** ở mức automated/infrastructure.

Theo `PRODUCTION_READINESS_STATUS.md`, trạng thái thực tế mới nhất là:

```text
STAGING_READY_WITH_BLOCKERS
```

Các blocker chính hiện tại:

- Chưa hoàn thành staging production environment.
- Chưa hoàn thành PayOS replay/integration test trên staging/production.
- Chưa hoàn thành physical UGPhone/Termux pilot 24–72h.
- Chưa hoàn thành signed update drill với host HTTPS thật.
- Chưa hoàn thành VPS/domain/TLS deployment.
- Chưa hoàn thành backup/restore drill trên môi trường gần production.
- Chưa thực hiện live rate-limit / webhook abuse tests.
- Chưa đủ điều kiện go-live.

---

## 1.2 Kiến trúc hiện tại cần GIỮ

Backend hiện tại sử dụng:

```text
Node.js
Express
MySQL
mysql2/promise
Zod
Helmet
express-rate-limit
JWT / HttpOnly Cookie
React + Vite Admin
Tailwind CSS
```

**Không nên đổi sang Fastify/PostgreSQL/Next.js chỉ vì roadmap cũ từng đề xuất.**

Lý do:

- Express/MySQL hiện tại đã có test.
- License flow đã tích hợp.
- Admin đã hoạt động.
- MySQL integration đã pass.
- Thay stack lúc này làm tăng rủi ro mà chưa tạo giá trị kinh doanh trực tiếp.

Nguyên tắc:

> **Extend the existing architecture, do not rewrite stable components without measurable benefit.**

---

# 2. Vấn đề cần giải quyết tiếp theo

Dự án hiện đã mạnh ở phần **license infrastructure**, nhưng còn thiếu lớp sản phẩm thương mại hoàn chỉnh.

## 2.1 Các gap chính

### Gap A — Chưa có Product Catalog thực sự

Hiện license plan và entitlement chủ yếu phục vụ Auto Rejoin.

Nếu sau này thêm:

- Tool B.
- Premium configuration.
- Digital serial key.
- Download pack.
- Setup service.
- Monthly subscription.

thì không nên thêm hàng loạt:

```js
if (product === "AUTO_REJOIN") {}
if (product === "TOOL_B") {}
if (product === "KEY_X") {}
```

Cần một product model chung.

---

### Gap B — Order và Payment chưa trở thành state machine hoàn chỉnh

Cần đảm bảo:

```text
ORDER CREATED
    ↓
PENDING_PAYMENT
    ↓
PAYMENT VERIFIED BY SERVER
    ↓
PAID
    ↓
FULFILLING
    ↓
FULFILLED
    ↓
COMPLETED
```

Không được:

```text
Customer clicks "I paid"
        ↓
Show key immediately
```

---

### Gap C — Chưa có Fulfillment Engine

Sau khi thanh toán thành công, hệ thống cần tự quyết định cách giao sản phẩm.

Ví dụ:

```text
LICENSE       -> Create Auto Rejoin license
DIGITAL_KEY   -> Reserve one inventory key
DOWNLOAD      -> Create authorized download
SERVICE       -> Create service ticket/order
SUBSCRIPTION  -> Create/extend entitlement
```

---

### Gap D — Chưa có Customer Portal

Khách hàng cần tự xem:

- Orders.
- Payment status.
- Purchased products.
- License status.
- Expiry.
- Device usage.
- Reset/revoke device theo policy.
- Download.
- Changelog.
- Support.

---

### Gap E — Admin mới thiên về license

Admin hiện tại đã quản lý license tốt.

Cần mở rộng thành commerce admin:

- Products.
- Variants.
- Orders.
- Payments.
- Fulfillments.
- Customers.
- Inventory.
- Coupons.
- Releases.
- Reports.

---

# 3. Product Vision

Auto Rejoin Pro nên được định vị thành:

> **Digital Product & License Commerce Platform**

Không phải:

> Website bán duy nhất một Auto Rejoin key.

Kiến trúc đúng sẽ cho phép thêm sản phẩm mới bằng dữ liệu/configuration thay vì sửa toàn bộ hệ thống.

---

# 4. Target Architecture

```text
                         ┌───────────────────────┐
                         │   Public Storefront   │
                         │ React + Tailwind      │
                         └───────────┬───────────┘
                                     │
                                     │ HTTPS
                                     ▼
┌──────────────────┐       ┌────────────────────────────┐
│ Customer Portal  │──────▶│      Express Backend       │
│ React + Tailwind │       │                            │
└──────────────────┘       │ /api/v1/store/*            │
                           │ /api/v1/customer/*         │
┌──────────────────┐       │ /api/v1/admin/*            │
│ Admin Dashboard  │──────▶│ /api/v1/licenses/*         │
│ existing admin/  │       └──────────────┬─────────────┘
└──────────────────┘                      │
                                          ▼
                              ┌────────────────────────┐
                              │ Commerce Service Layer │
                              ├────────────────────────┤
                              │ Products               │
                              │ Orders                 │
                              │ Payments               │
                              │ Fulfillment            │
                              │ Customer Auth          │
                              └───────────┬────────────┘
                                          │
                         ┌────────────────┼────────────────┐
                         ▼                ▼                ▼
                  License Service   Digital Keys      Downloads
                  existing core     encrypted         authorized
                         │
                         ▼
                 Existing license DB
```

### 4.1 Kiến trúc Cổng kết nối Kép (Dual Gateway & Deployment Topology)

Để đảm bảo **người dùng, bạn bè và tester hiện tại vẫn dùng bình thường** trong khi hệ thống đang tiến hành nâng cấp lên Production, dự án áp dụng mô hình 2 cổng Gateway song song:

```text
[Termux / Android Client / Web Browser]
                   │
                   ├──▶ (Mode A - Đang chạy hiện tại): Cloudflare Quick Tunnel (trycloudflare.com / named tunnel)
                   │        └─▶ Localhost Backend (Port 3000) & Vite Proxy (Port 5173) + MySQL Local
                   │        └─▶ Lợi ích: Chạy tức thì, 0 đồng, có HTTPS, bạn bè dùng được ngay lập tức.
                   │
                   └──▶ (Mode B - Production Staging Target): Cloud VPS / Dedicated Server
                            └─▶ Nginx Reverse Proxy (Port 80/443 + SSL Certbot / Cloudflare Proxy)
                            └─▶ PM2 Cluster / Systemd (Port 3000) + Cloud MySQL Database
                            └─▶ Lợi ích: Chạy 24/24 độc lập không phụ thuộc máy cá nhân, tên miền riêng.
```

**Nguyên tắc tương thích tuyệt đối cho Client (`setup.sh` & `bin/roblox-manager`)**:
- Client nhận biến môi trường `AUTO_REJOIN_LICENSE_API` động. Dù truyền URL Cloudflare (`https://*.trycloudflare.com`) hay Domain VPS (`https://api.yourdomain.com`), Client đều tự động xác thực và kích hoạt thành công.
- Không hard-code URL cố định trong client scripts.
- Duy trì cơ chế **72h Offline Grace Period** của client để nếu Cloudflare Tunnel bị gián đoạn hoặc đổi URL tạm thời, tool trên điện thoại của bạn bè vẫn tiếp tục treo Roblox mà không bị văng.

---

# 5. Architectural Principles

## 5.1 Không phá license security invariant hiện tại

License hiện tại:

- Raw key chỉ hiển thị khi tạo.
- Database lưu HMAC hash + prefix/last4.
- Không log raw key.
- Token lưu hash.

**Tiếp tục giữ nguyên.**

Đối với customer purchase:

- Raw Auto Rejoin license key được reveal một lần sau fulfillment.
- Customer phải lưu key.
- Portal về sau chỉ hiển thị masked form.
- Nếu khách làm mất key:
  - Không decrypt key cũ.
  - Thực hiện secure license replacement flow.
  - Revoke old license.
  - Generate new license.
  - Audit đầy đủ.

---

## 5.2 Digital key bên thứ ba là trường hợp khác

Nếu bán key có sẵn do supplier cung cấp, bắt buộc phải lưu key để giao.

Không lưu plaintext.

Đề xuất:

```text
AES-256-GCM encryption
APP_INVENTORY_ENCRYPTION_KEY from environment
unique IV per key
authentication tag
never log plaintext
```

Database:

```text
encrypted_secret
iv
auth_tag
secret_last4
status
```

---

## 5.3 Payment provider chỉ xác nhận payment

Payment provider không được tự quyết định logic giao hàng.

Flow:

```text
Payment Webhook
     ↓
Verify Signature
     ↓
Validate Amount / Currency / Order
     ↓
Idempotency Check
     ↓
Payment = SUCCESS
     ↓
Order = PAID
     ↓
Fulfillment Service
```

---

## 5.4 Backend là source of truth

Frontend không được tự quyết định:

- giá sản phẩm;
- trạng thái order;
- order đã thanh toán hay chưa;
- license duration;
- device limit;
- discount final;
- quyền download;
- fulfillment status.

Tất cả được xác định server-side.

---

# 6. Product Model

## 6.1 Product types

Bắt đầu với enum:

```text
LICENSE
DIGITAL_KEY
DOWNLOAD
SERVICE
SUBSCRIPTION
```

Có thể mở rộng sau.

---

## 6.2 Product

Ví dụ:

```json
{
  "id": 1,
  "slug": "auto-rejoin-pro",
  "name": "Auto Rejoin Pro",
  "type": "LICENSE",
  "status": "ACTIVE",
  "shortDescription": "Session reliability tool for Android/UGPhone",
  "fulfillmentType": "LICENSE",
  "isPublic": true
}
```

---

## 6.3 Product Variant

Không lưu giá trực tiếp duy nhất trên product.

Ví dụ:

```text
Auto Rejoin Pro
├── 7 Days / 1 Device
├── 30 Days / 1 Device
├── 30 Days / 3 Devices
├── 90 Days / 3 Devices
└── Lifetime / 1 Device
```

Variant fields:

```text
id
product_id
sku
name
price
currency
duration_days
max_devices
max_instances
inventory_policy
is_active
metadata_json
created_at
updated_at
```

---

# 7. Database Roadmap

Không sửa trực tiếp migration cũ đã chạy.

Tạo migration mới tuần tự.

Ví dụ:

```text
00x_create_customer_users.sql
00x_create_products.sql
00x_create_product_variants.sql
00x_create_orders.sql
00x_create_order_items.sql
00x_create_payments.sql
00x_create_payment_events.sql
00x_create_fulfillments.sql
00x_create_license_order_links.sql
00x_create_digital_key_inventory.sql
00x_create_downloads.sql
00x_create_customer_sessions.sql
00x_create_coupons.sql
```

---

## 7.1 users

```text
id
email
username nullable
password_hash
email_verified_at
status
created_at
updated_at
```

Status:

```text
ACTIVE
LOCKED
DISABLED
```

---

## 7.2 products

```text
id
slug UNIQUE
name
type
status
short_description
description
thumbnail_url
is_public
sort_order
created_at
updated_at
```

---

## 7.3 product_variants

```text
id
product_id FK
sku UNIQUE
name
price_minor
currency
duration_days nullable
max_devices nullable
max_instances nullable
metadata_json nullable
is_active
created_at
updated_at
```

**Tiền nên lưu integer minor units.**

Ví dụ 399.000 VND:

```text
399000
```

Không dùng float.

---

## 7.4 orders

```text
id
order_code UNIQUE
user_id nullable
customer_email
status
currency
subtotal_minor
discount_minor
total_minor
payment_status
fulfillment_status
created_at
paid_at
completed_at
cancelled_at
updated_at
```

---

## 7.5 order_items

Snapshot dữ liệu lúc checkout.

```text
id
order_id
product_id
variant_id
product_name_snapshot
variant_name_snapshot
sku_snapshot
quantity
unit_price_minor
line_total_minor
fulfillment_type
metadata_json
```

Không lấy lại giá hiện tại của product để tính order cũ.

---

## 7.6 payments

```text
id
order_id
provider
provider_payment_id
provider_reference
amount_minor
currency
status
created_at
confirmed_at
updated_at
```

Status:

```text
PENDING
SUCCESS
FAILED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

---

## 7.7 payment_events

Dùng cho webhook idempotency/audit.

```text
id
provider
provider_event_id UNIQUE
event_type
payload_hash
processing_status
received_at
processed_at
```

Nếu provider không có event ID ổn định:

```text
idempotency_key = SHA256(canonical_event_fields)
```

---

## 7.8 fulfillments

```text
id
order_item_id
type
status
attempt_count
last_error_code
fulfilled_at
created_at
updated_at
```

Status:

```text
PENDING
PROCESSING
FULFILLED
FAILED
CANCELLED
```

---

## 7.9 license_order_links

Liên kết commerce và license core.

```text
id
order_item_id UNIQUE
license_id UNIQUE
created_at
```

Không thêm commerce fields trực tiếp vào bảng `licenses` nếu không cần thiết.

---

## 7.10 digital_key_inventory

```text
id
product_variant_id
encrypted_secret
iv
auth_tag
secret_last4
status
reserved_order_item_id nullable
reserved_at nullable
sold_at nullable
created_at
```

Status:

```text
AVAILABLE
RESERVED
SOLD
DISABLED
```

---

# 8. Order State Machine

## 8.1 Order statuses

```text
CREATED
PENDING_PAYMENT
PAID
FULFILLING
COMPLETED
CANCELLED
REFUNDED
FAILED
```

Allowed transitions:

```text
CREATED
  -> PENDING_PAYMENT
  -> CANCELLED

PENDING_PAYMENT
  -> PAID
  -> CANCELLED
  -> FAILED

PAID
  -> FULFILLING

FULFILLING
  -> COMPLETED
  -> FAILED

COMPLETED
  -> REFUNDED
```

Không cho frontend truyền tùy ý status mới.

---

## 8.2 Transition function

Tạo một service duy nhất:

```text
transitionOrder(orderId, expectedCurrentStatus, nextStatus, context)
```

Dùng transaction.

Nếu trạng thái hiện tại không đúng:

```text
ORDER_STATE_CONFLICT
```

---

# 9. Fulfillment Engine

## 9.1 Interface chung

Pseudo design:

```js
fulfillmentRegistry = {
  LICENSE: fulfillLicense,
  DIGITAL_KEY: fulfillDigitalKey,
  DOWNLOAD: fulfillDownload,
  SERVICE: fulfillService,
  SUBSCRIPTION: fulfillSubscription
}
```

---

## 9.2 LICENSE fulfillment

Flow:

```text
Order PAID
   ↓
Fulfillment begins
   ↓
Read purchased variant
   ↓
Map duration/maxDevices/maxInstances
   ↓
Call existing license service internally
   ↓
Create license
   ↓
Link order_item -> license_id
   ↓
Return raw key ONCE
   ↓
Mark fulfillment FULFILLED
```

Bắt buộc trong DB transaction hoặc có compensation strategy.

Nếu license create thành công nhưng fulfillment update lỗi:

- Không create license thứ hai khi retry.
- Lookup bằng `order_item_id`.
- Reuse existing link.

=> Fulfillment phải **idempotent**.

---

## 9.3 DIGITAL_KEY fulfillment

Atomic reservation:

```sql
SELECT id
FROM digital_key_inventory
WHERE product_variant_id = ?
  AND status = 'AVAILABLE'
LIMIT 1
FOR UPDATE;
```

Sau đó:

```text
AVAILABLE -> RESERVED -> SOLD
```

Nếu không còn key:

```text
OUT_OF_STOCK
```

Order không được đánh `COMPLETED`.

---

## 9.4 DOWNLOAD fulfillment

Không trả direct permanent public URL.

Tạo:

```text
download entitlement
expires_at
max_downloads
```

Endpoint:

```text
POST /api/v1/customer/downloads/:id/request
```

Server verify quyền rồi tạo short-lived signed URL hoặc streaming token.

---

## 9.5 SERVICE fulfillment

Tạo service ticket:

```text
WAITING_ASSIGNMENT
ASSIGNED
IN_PROGRESS
COMPLETED
CANCELLED
```

Không tự hoàn thành order nếu cần thao tác staff.

---

# 10. API Design

Giữ namespace tách biệt.

## 10.1 Public Store API

```text
GET  /api/v1/store/products
GET  /api/v1/store/products/:slug
GET  /api/v1/store/products/:slug/variants
POST /api/v1/store/checkout
GET  /api/v1/store/orders/:orderCode/status
```

Không trả secret/internal fields.

---

## 10.2 Customer Auth API

```text
POST /api/v1/customer/auth/register
POST /api/v1/customer/auth/login
POST /api/v1/customer/auth/logout
GET  /api/v1/customer/auth/me
POST /api/v1/customer/auth/forgot-password
POST /api/v1/customer/auth/reset-password
```

Cookie:

```text
HttpOnly
Secure in production
SameSite=Lax or Strict
short-lived session
```

---

## 10.3 Customer Order API

```text
GET /api/v1/customer/orders
GET /api/v1/customer/orders/:id
```

Authorization:

```text
order.user_id === authenticated_user.id
```

Không bao giờ nhận `userId` từ frontend rồi tin vào nó.

---

## 10.4 Customer License API

```text
GET  /api/v1/customer/licenses
GET  /api/v1/customer/licenses/:id
GET  /api/v1/customer/licenses/:id/devices
POST /api/v1/customer/licenses/:id/devices/:deviceId/revoke
POST /api/v1/customer/licenses/:id/replace-key
```

`replace-key` phải:

- Re-auth hoặc recent-auth.
- Rate limit nghiêm ngặt.
- Có audit.
- Revoke old entitlement.
- Generate new key.
- One-time reveal.

---

## 10.5 Admin Commerce API

```text
GET    /api/v1/admin/products
POST   /api/v1/admin/products
GET    /api/v1/admin/products/:id
PATCH  /api/v1/admin/products/:id

GET    /api/v1/admin/products/:id/variants
POST   /api/v1/admin/products/:id/variants
PATCH  /api/v1/admin/variants/:id

GET    /api/v1/admin/orders
GET    /api/v1/admin/orders/:id

GET    /api/v1/admin/payments
GET    /api/v1/admin/payments/:id

GET    /api/v1/admin/fulfillments
POST   /api/v1/admin/fulfillments/:id/retry

GET    /api/v1/admin/customers
GET    /api/v1/admin/customers/:id

POST   /api/v1/admin/inventory/import
GET    /api/v1/admin/inventory
```

Không cho admin sửa trực tiếp `PAID` nếu không có explicit privileged workflow.

Manual override phải:

- require role;
- require reason;
- audit old/new value;
- lưu actor;
- không bypass fulfillment invariant.

---

# 11. Frontend Structure

Khuyến nghị không nhồi storefront vào `admin/`.

```text
admin/        # existing internal admin
storefront/   # public storefront + customer portal
server/
```

Nếu muốn deploy đơn giản hơn, `storefront/` dùng:

```text
React
Vite
Tailwind CSS
React Router
TanStack Query
Zod
```

Không cần đổi toàn bộ sang Next.js trong giai đoạn này.

SEO có thể tối ưu sau bằng SSR/static rendering nếu thực sự cần.

---

# 12. Public Storefront Pages

## 12.1 Home

Sections:

```text
Hero
Featured products
Why Auto Rejoin Pro
How it works
Pricing
Compatibility
Security / Signed updates
FAQ
Changelog
CTA
```

Không thiết kế giống dashboard admin.

---

## 12.2 Product Detail

Hiển thị:

- Product name.
- Value proposition.
- Features.
- Supported platform.
- Requirements.
- Limitations.
- Variant selector.
- Price.
- License duration.
- Device limit.
- Update policy.
- Support policy.
- FAQ.
- Purchase CTA.

---

## 12.3 Checkout

Không hỏi quá nhiều.

MVP:

```text
Email
Selected variant
Order summary
Coupon optional
Payment method
```

Frontend lấy authoritative quote từ server.

---

## 12.4 Payment Waiting

State:

```text
WAITING FOR PAYMENT
VERIFYING PAYMENT
PAYMENT SUCCESS
FULFILLING PRODUCT
COMPLETED
FAILED
```

Polling có backoff hoặc SSE/WebSocket sau.

Không poll mỗi 500ms.

---

# 13. Customer Portal

Route proposal:

```text
/account
/account/orders
/account/orders/:id
/account/licenses
/account/licenses/:id
/account/downloads
/account/support
/account/security
```

Dashboard cards:

```text
Active licenses
Orders
Devices in use
Expiring soon
Latest release
```

---

# 14. Admin Dashboard Improvement

Giữ license management hiện tại.

Thêm sidebar:

```text
Dashboard
Products
Variants
Orders
Payments
Fulfillments
Customers
Licenses
Devices
Digital Inventory
Releases
Coupons
Audit Logs
System
```

---

## 14.1 Admin Dashboard KPI

Không cần analytics phức tạp ban đầu.

MVP:

```text
Revenue today
Revenue 7d
Paid orders
Pending payments
Fulfillment failures
Active licenses
Expiring licenses
Digital key stock
```

---

# 15. Payment Architecture

## 15.1 Provider adapter

Không hard-code PayOS vào order service.

```text
server/src/modules/payments/providers/
    payos.provider.js
```

Interface:

```text
createPayment(order)
verifyWebhook(request)
normalizeWebhook(payload)
getPaymentStatus(reference)
```

Sau này thêm provider khác mà không đổi business logic.

---

## 15.2 Webhook invariants

Webhook handler phải:

1. Verify signature trước.
2. Parse event.
3. Check idempotency.
4. Lookup order by server-created reference.
5. Check amount.
6. Check currency.
7. Check order current state.
8. Persist payment event.
9. Mark payment.
10. Transition order.
11. Trigger fulfillment.
12. Return deterministic response.

---

## 15.3 Không tin redirect URL

Customer quay lại trang:

```text
/payment/success
```

không có nghĩa payment đã thành công.

Frontend phải hỏi backend.

Backend chỉ tin:

- verified webhook;
- hoặc provider API verification server-to-server.

---

# 16. Customer Authentication

## MVP

Email + password.

Requirements:

```text
bcrypt/argon2
minimum password policy
rate-limited login
HttpOnly session
CSRF consideration
password reset token hashed in DB
email enumeration protection
```

## Later

Có thể thêm:

```text
Google OAuth
Passkey
2FA
```

Không làm trước khi commerce MVP ổn định.

---

# 17. Security Requirements

## P0 — bắt buộc

- Không log raw license key.
- Không log digital inventory secret.
- Không log payment secret.
- Không commit `.env`.
- Production `COOKIE_SECURE=true`.
- CORS allowlist.
- Rate limit enabled.
- HTTPS only.
- Webhook signature required.
- Webhook idempotency required.
- SQL prepared statements.
- Zod validation.
- Role-based admin authorization.
- Audit all sensitive admin actions.
- CSP/Helmet review.
- Dependency audit.
- Database least privilege.
- Separate production DB user.
- Encrypted backups.
- Restore drill.

---

## P1

- Admin 2FA.
- Customer recent-auth for sensitive actions.
- Key replacement cooldown.
- Fraud velocity checks.
- Suspicious payment/order alerts.
- IP/device anomaly logging with privacy limits.
- Session revocation.
- Login history.

---

## P2

- WAF/CDN.
- Centralized secret manager.
- SIEM integration.
- Automated key rotation.
- SSO for internal admin.

---

# 18. Privacy Model

Chỉ thu dữ liệu thật sự cần thiết.

Không lưu:

- Roblox password.
- Raw Roblox cookie.
- Unrelated device data.
- Sensitive local content.

Customer records chỉ nên chứa:

```text
email
account auth data
orders
licenses
device identifier necessary for license enforcement
support history
```

Device ID trong UI tiếp tục mask như admin hiện tại.

---

# 19. Repository Structure sau cải tiến

```text
auto-rejoin/
│
├── admin/
│   └── existing admin + commerce pages
│
├── storefront/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── products/
│   │   │   ├── checkout/
│   │   │   ├── orders/
│   │   │   ├── licenses/
│   │   │   └── account/
│   │   ├── pages/
│   │   └── routes/
│   └── package.json
│
├── server/
│   └── src/
│       ├── modules/
│       │   ├── auth/
│       │   ├── products/
│       │   ├── orders/
│       │   ├── payments/
│       │   ├── fulfillment/
│       │   ├── customers/
│       │   ├── inventory/
│       │   └── downloads/
│       │
│       ├── routes/
│       ├── middleware/
│       ├── services/
│       └── repositories/
│
├── bin/
├── lib/
├── tests/
└── docs/
```

Không bắt buộc refactor toàn bộ backend cũ ngay.

Module mới có thể triển khai dần.

---

# 20. Roadmap đề xuất mới

---

# Phase 6A — Commerce Foundation

## Mục tiêu

Tạo nền tảng dữ liệu sản phẩm và order nhưng chưa cần mở bán public.

## Tasks

### Database

- [ ] `users`
- [ ] `products`
- [ ] `product_variants`
- [ ] `orders`
- [ ] `order_items`
- [ ] migrations rollback strategy
- [ ] indexes
- [ ] FK constraints

### Backend

- [ ] Product repository.
- [ ] Product service.
- [ ] Public product API.
- [ ] Admin product CRUD.
- [ ] Variant CRUD.
- [ ] Order quote service.
- [ ] Order creation service.
- [ ] Snapshot pricing.

### Admin

- [ ] Product list.
- [ ] Create/edit product.
- [ ] Variant management.
- [ ] Activate/deactivate product.

## Exit Criteria

- [ ] Admin tạo được Auto Rejoin Pro product.
- [ ] Admin tạo được ít nhất 3 variants.
- [ ] Public API chỉ trả active/public products.
- [ ] User không thể sửa giá qua request.
- [ ] Order snapshot đúng giá server.
- [ ] Unit tests pass.
- [ ] MySQL integration tests pass.

---

# Phase 6B — Payment State Machine

## Mục tiêu

Checkout thực tế + PayOS staging.

## Tasks

### Backend

- [ ] `payments`.
- [ ] `payment_events`.
- [ ] PayOS provider adapter.
- [ ] Checkout endpoint.
- [ ] Payment creation.
- [ ] Signature verification.
- [ ] Amount verification.
- [ ] Currency verification.
- [ ] Idempotency.
- [ ] Order transitions.
- [ ] Payment reconciliation command.

### Testing

- [ ] valid webhook.
- [ ] invalid signature.
- [ ] missing signature.
- [ ] wrong amount.
- [ ] duplicate webhook.
- [ ] webhook arrives twice concurrently.
- [ ] payment for cancelled order.
- [ ] unknown order.
- [ ] stale payment.
- [ ] provider timeout.

## Exit Criteria

- [ ] Duplicate webhook không tạo duplicate order action.
- [ ] Client không thể fake `PAID`.
- [ ] PayOS staging payment end-to-end PASS.
- [ ] Payment event audit đầy đủ.
- [ ] Reconciliation phát hiện trạng thái lệch.

---

# Phase 6C — Fulfillment Engine

## Mục tiêu

Thanh toán thành công tự động giao Auto Rejoin license.

## Tasks

- [ ] `fulfillments`.
- [ ] `license_order_links`.
- [ ] fulfillment registry.
- [ ] idempotent job.
- [ ] retry policy.
- [ ] failure classification.
- [ ] admin retry.
- [ ] one-time raw key response.
- [ ] masked key storage/display.

## Critical Tests

### Test 1

```text
Payment success
-> license created once
-> fulfillment fulfilled
-> order completed
```

### Test 2

```text
Same webhook x5
-> exactly one license
```

### Test 3

```text
Server crashes after license creation
before fulfillment update
-> retry reuses existing license
-> no duplicate license
```

### Test 4

```text
License DB temporarily unavailable
-> fulfillment FAILED/retryable
-> order not completed
```

## Exit Criteria

- [ ] Exactly-once business outcome.
- [ ] Retry safe.
- [ ] No plaintext key in DB logs.
- [ ] Order cannot become COMPLETED before fulfillment succeeds.

---

# Phase 6D — Public Storefront

## Mục tiêu

Khách có thể xem sản phẩm, checkout và nhận kết quả.

## Pages

- [ ] Home.
- [ ] Product detail.
- [ ] Pricing.
- [ ] Checkout.
- [ ] Payment waiting.
- [ ] Payment result.
- [ ] One-time license reveal.
- [ ] Terms.
- [ ] Privacy.
- [ ] Refund/support policy.

## UX

- [ ] Responsive mobile.
- [ ] Loading states.
- [ ] Error states.
- [ ] Retry safe.
- [ ] No sensitive data in URL.
- [ ] No raw key in analytics.

## Exit Criteria

Một khách mới có thể:

```text
Open website
-> choose product
-> choose 30-day plan
-> checkout
-> pay
-> server verifies payment
-> license created
-> key shown once
```

không cần admin can thiệp.

---

# Phase 6E — Customer Portal

## Mục tiêu

Biến người mua thành account user có self-service.

## Tasks

- [ ] Registration.
- [ ] Login/logout.
- [ ] Forgot/reset password.
- [ ] Order history.
- [ ] License list.
- [ ] License detail.
- [ ] Masked key.
- [ ] Expiry.
- [ ] Devices.
- [ ] Device reset.
- [ ] Latest release.
- [ ] Support entry point.

## Security

- [ ] Ownership checks.
- [ ] customer/admin auth separation.
- [ ] Session revocation.
- [ ] brute-force protection.
- [ ] sensitive action audit.

## Exit Criteria

Khách A không thể bằng bất kỳ API nào đọc:

- order của khách B;
- license của khách B;
- device của khách B.

---

# Phase 6F — Multi-Product Fulfillment

## Mục tiêu

Không còn chỉ bán Auto Rejoin.

## Add

### DIGITAL_KEY

- [ ] encrypted inventory.
- [ ] bulk import.
- [ ] atomic reserve.
- [ ] stock count.
- [ ] one-time reveal.
- [ ] admin disable.

### DOWNLOAD

- [ ] download asset metadata.
- [ ] entitlement.
- [ ] signed/short-lived URL.
- [ ] download limit.

### SERVICE

- [ ] service order.
- [ ] status.
- [ ] assignment.
- [ ] notes/audit.

## Exit Criteria

Có thể thêm một sản phẩm mới trong admin mà không sửa checkout core.

---

# Phase 6G — Commerce Admin

## Mục tiêu

Admin điều hành toàn bộ store.

## Pages

- [ ] Commerce overview.
- [ ] Products.
- [ ] Variants.
- [ ] Orders.
- [ ] Payments.
- [ ] Fulfillments.
- [ ] Customers.
- [ ] Inventory.
- [ ] Releases.
- [ ] Coupons later.
- [ ] Audit.

## Roles

Đề xuất:

```text
super_admin
operations
support
finance
viewer
```

Permissions:

```text
products.read
products.write
orders.read
payments.read
payments.override
fulfillment.retry
licenses.manage
customers.read
inventory.manage
audit.read
```

Không chỉ check:

```js
role === "admin"
```

---

# Phase 6H — Production Gate Completion

Đây là phase bắt buộc trước go-live.

## Environment

- [ ] VPS.
- [ ] Domain.
- [ ] TLS.
- [ ] Nginx.
- [ ] PM2/systemd.
- [ ] firewall.
- [ ] MySQL private access.
- [ ] production DB credentials.
- [ ] secure environment variables.

## Current preflight blockers phải được giải quyết

- [ ] `NODE_ENV=production`
- [ ] production DB name.
- [ ] `COOKIE_SECURE=true`
- [ ] `RATE_LIMIT_ENABLED=true`

## Database

- [ ] migration staging.
- [ ] migration production.
- [ ] backup.
- [ ] encrypted off-host backup.
- [ ] restore drill.
- [ ] restore timing measured.

## Payment

- [ ] real staging checkout.
- [ ] duplicate webhook replay.
- [ ] invalid webhook.
- [ ] provider outage simulation.

## Signed Update

- [ ] HTTPS artifact host.
- [ ] valid manifest drill.
- [ ] tampered artifact rejection.
- [ ] rollback drill.

## Device

- [ ] 3–5 physical pilot users.
- [ ] 24–72h soak.
- [ ] Root environment.
- [ ] non-root environment where supported.
- [ ] network disconnect/reconnect.
- [ ] license offline grace.
- [ ] support bundle verified.

## Exit Criteria

Go-live chỉ khi:

```text
No unresolved P0
No unresolved P1
Payment E2E PASS
Restore drill PASS
Signed update drill PASS
Physical pilot PASS
HTTPS admin/store PASS
Production preflight PASS
```

---

# Phase 7A — Controlled Launch

Không mở 100% ngay.

Rollout:

```text
Internal
   ↓
5 pilot users
   ↓
20 customers
   ↓
50 customers
   ↓
Public
```

Mỗi stage cần quan sát:

```text
payment success rate
fulfillment success rate
license activation success
support volume
server error rate
device incidents
refund requests
```

Rollback nếu có P0/P1.

---

# Phase 7B — Growth Features

Chỉ làm sau khi core commerce ổn định.

## Candidate features

- Coupons.
- Affiliate/referral.
- Subscription auto-renew.
- Email notifications.
- Expiry reminders.
- Upgrade/downgrade plans.
- Bundles.
- Gift codes.
- Customer reviews.
- Knowledge base.
- Support ticket system.
- Revenue charts.
- Tax/invoice integration nếu cần.
- Multi-language.
- SEO landing pages.

Không ưu tiên những thứ này trước payment + fulfillment reliability.

---

# 21. First 12 Pull Requests nên làm theo thứ tự

## PR-01 — Commerce DB schema

```text
products
variants
orders
order_items
```

Không UI.

---

## PR-02 — Product API

```text
public list/detail
admin CRUD
```

---

## PR-03 — Order quote + create

Server authoritative pricing.

---

## PR-04 — Payment schema + provider abstraction

Không fulfillment.

---

## PR-05 — PayOS staging E2E

Webhook + idempotency.

---

## PR-06 — Fulfillment base

Generic interface + jobs.

---

## PR-07 — Auto Rejoin License Fulfillment

Order -> existing license service.

---

## PR-08 — Storefront MVP

Product -> checkout.

---

## PR-09 — Payment result + one-time license reveal

Full purchase E2E.

---

## PR-10 — Customer authentication

Accounts + sessions.

---

## PR-11 — Customer orders/licenses portal

Self-service.

---

## PR-12 — Commerce admin extension

Orders/payments/fulfillments.

---

# 22. CI/CD Improvement

Mỗi PR phải chạy:

```text
Backend lint/check
Backend unit tests
MySQL integration tests where applicable
Admin build
Storefront build
npm audit
Shell syntax tests
Shell tests in Linux CI
```

GitHub Actions proposal:

```text
ci-backend.yml
ci-admin.yml
ci-storefront.yml
ci-shell.yml
security-audit.yml
```

Không để tình trạng shell regression chỉ không chạy vì local Windows.

CI Linux phải đảm nhiệm gate này.

---

# 23. Testing Pyramid

## Unit

Test service/business rules.

Ví dụ:

```text
pricing
discount calculation
order transitions
payment normalization
fulfillment decision
entitlement mapping
```

---

## Integration

MySQL thật `_test`.

Test:

```text
transaction
concurrency
SELECT FOR UPDATE
unique constraints
idempotency
inventory reservation
```

---

## HTTP Contract

Test:

```text
auth
validation
status codes
error shape
ownership
RBAC
```

---

## E2E

Core E2E:

```text
store
-> checkout
-> mock/staging payment
-> webhook
-> fulfillment
-> license
-> activation
```

---

## Security Tests

- Auth bypass.
- IDOR.
- SQL injection payloads.
- XSS payloads.
- forged webhook.
- replay webhook.
- brute force.
- rate limit.
- CSRF where relevant.
- admin permission escalation.
- secret leakage.

---

# 24. Observability

## Structured Logs

Mỗi request nên có:

```text
request_id
route
status
duration_ms
user_id if applicable
order_id if applicable
```

Không log secrets.

---

## Business Events

Log event names:

```text
ORDER_CREATED
PAYMENT_CREATED
PAYMENT_CONFIRMED
PAYMENT_REJECTED
FULFILLMENT_STARTED
FULFILLMENT_SUCCEEDED
FULFILLMENT_FAILED
LICENSE_CREATED_FROM_ORDER
DEVICE_REVOKED_BY_CUSTOMER
```

---

## Metrics

### System

```text
HTTP 5xx rate
latency p95
DB connection usage
process memory
CPU
```

### Commerce

```text
checkout_started
payment_success_rate
payment_confirmation_latency
fulfillment_success_rate
fulfillment_latency
orders_failed
inventory_low
```

### License

```text
activation_success_rate
validation_error_rate
device_limit_rate
expired_license_count
```

---

# 25. Alerting

P0 alert:

```text
payment confirmed but fulfillment failures spike
database unavailable
license validation unavailable
all payment webhook verification fails
```

P1:

```text
5xx > threshold
fulfillment queue growing
inventory below threshold
backup failed
```

---

# 26. Backup Policy

Minimum:

```text
Daily DB backup
Retention 7/30 days
Off-host copy
Encryption
Restore test monthly
```

Quan trọng:

> Backup chưa bao giờ restore thử thì chưa được xem là backup đáng tin cậy.

Record:

```text
backup timestamp
backup size
checksum
restore duration
restore result
```

---

# 27. Release Strategy

## Server/Admin/Storefront

Semantic version:

```text
MAJOR.MINOR.PATCH
```

Deploy flow:

```text
PR
-> CI
-> staging
-> smoke test
-> production
```

Không deploy trực tiếp từ local laptop nếu tránh được.

---

## Agent

Tiếp tục signed update hiện tại.

Channels:

```text
stable
beta
canary
```

Production customer mặc định:

```text
stable
```

---

# 28. Environment Separation & Gateway Strategy

Bắt buộc phân tách rõ ràng các môi trường:

```text
1. Development / Live Pilot (Cloudflare Tunnel)
   - Host: Local Machine + cloudflared tunnel
   - Gateway: https://*.trycloudflare.com (hoặc named tunnel cá nhân)
   - Database: MySQL Localhost
   - Mục đích: Bạn bè, tester thử nghiệm tính năng ngay lập tức, không tốn chi phí hạ tầng.

2. Test / CI
   - Host: GitHub Actions / Local Test Runner
   - Database: MySQL Ephemeral (_test)
   - Mục đích: Chạy automated tests, migration check, linting, preflight.

3. Staging
   - Host: Cloud VPS (Staging subdomain)
   - Database: Cloud MySQL Staging DB
   - Mục đích: Test end-to-end webhook thanh toán PayOS thật, stress-test 24-72h.

4. Production
   - Host: Cloud VPS / Cluster + Nginx + Cloudflare CDN
   - Database: Cloud MySQL Production DB (có backup định kỳ)
   - Mục đích: Vận hành thương mại chính thức 24/24.
```

Không dùng chung:

- DB.
- payment credentials.
- JWT secrets.
- encryption keys.
- webhook secrets.
- domains.

---

# 29. Environment Variables mới dự kiến

Ví dụ:

```text
# Customer auth
CUSTOMER_JWT_SECRET=
CUSTOMER_SESSION_TTL=

# Commerce
STORE_BASE_URL=
ORDER_EXPIRY_MINUTES=

# Payment
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=

# Inventory encryption
INVENTORY_ENCRYPTION_KEY=

# Email later
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=

# Downloads
DOWNLOAD_SIGNING_SECRET=
DOWNLOAD_URL_TTL_SECONDS=
```

Không đưa giá trị thật vào repo.

---

# 30. Error Code Standard

Dùng canonical machine-readable code.

Ví dụ:

```json
{
  "error": {
    "code": "ORDER_NOT_PAYABLE",
    "message": "Order cannot be paid in its current state"
  },
  "requestId": "..."
}
```

Common codes:

```text
PRODUCT_NOT_FOUND
VARIANT_NOT_AVAILABLE
ORDER_NOT_FOUND
ORDER_STATE_CONFLICT
PAYMENT_SIGNATURE_INVALID
PAYMENT_AMOUNT_MISMATCH
PAYMENT_ALREADY_PROCESSED
FULFILLMENT_FAILED
OUT_OF_STOCK
LICENSE_NOT_OWNED
DEVICE_NOT_OWNED
RATE_LIMITED
UNAUTHORIZED
FORBIDDEN
```

Frontend dựa vào `code`, không parse text message.

---

# 31. Concurrency Scenarios phải test

## Payment double delivery

Hai webhook tới cùng lúc.

Expected:

```text
1 payment success
1 state transition
1 fulfillment
1 license
```

---

## Inventory last key

Hai khách mua key cuối cùng.

Expected:

```text
only one transaction reserves key
other receives OUT_OF_STOCK / manual recovery
```

---

## Device reset race

Hai request reset cùng device.

Expected:

```text
safe idempotent result
```

---

# 32. Admin Audit Requirements

Audit fields:

```text
id
admin_user_id
action
resource_type
resource_id
before_json redacted
after_json redacted
reason nullable
ip
created_at
```

Audit:

- product price changes.
- payment override.
- order cancellation.
- fulfillment retry.
- license revoke.
- device reset.
- inventory import.
- key disable.
- customer account lock.

---

# 33. Business Rules

## Pricing

- Server owns price.
- Historical order price immutable.
- Admin price change does not mutate old orders.

## License Duration

Duration starts:

```text
at fulfillment time
```

hoặc:

```text
at first activation
```

Phải chọn **một policy rõ ràng**.

### Khuyến nghị

MVP:

```text
starts at fulfillment/payment time
```

vì đơn giản, audit rõ.

Sau này có thể thêm:

```text
ACTIVATE_ON_FIRST_USE
```

như variant policy.

---

# 34. Refund Policy Technical Design

Không tự xóa lịch sử order.

Refund:

```text
COMPLETED
-> REFUNDED
```

License policy:

```text
refund success
-> revoke associated license
```

Nhưng chỉ khi business policy yêu cầu.

Tất cả phải audit.

---

# 35. Support Workflow

Khách gửi support bundle.

Admin/support không được yêu cầu:

- Roblox password.
- raw cookie.
- license key nguyên vẹn nếu không cần.

Support ticket có thể gắn:

```text
customer_id
order_id
license_id
severity
status
```

---

# 36. Security Boundary của Auto Rejoin

Tiếp tục giữ những tính năng đã disabled by design:

- Không raw Roblox cookie injection.
- Không raw cookie export.
- Không CAPTCHA bypass.
- Không third-party key bypass.
- Không arbitrary remote shell.

Nếu thêm remote management sau này:

> Chỉ dùng allowlisted commands.

Ví dụ:

```text
restart_app
collect_diagnostics
refresh_license
check_update
```

Không:

```text
execute_shell("...")
```

---

# 37. Physical Pilot Plan trước Commerce Public Launch

Hiện physical pilot vẫn là blocker.

Pilot:

```text
3–5 users
24–72 hours
multiple UGPhone instances
network interruption
Roblox crash simulation
backend restart
license server interruption
signed update test
```

Theo dõi:

```text
rejoin success rate
false recovery rate
restart storm
license validation
offline grace
CPU/RAM
log volume
support issues
```

Exit:

```text
0 P0
0 unresolved P1
known P2 documented
```

---

# 38. Definition of Done cho mỗi feature

Một feature chỉ `DONE` khi:

- [ ] Code complete.
- [ ] Validation.
- [ ] Authorization.
- [ ] Unit tests.
- [ ] Integration tests nếu DB.
- [ ] Error states.
- [ ] Logs không leak secret.
- [ ] Audit nếu sensitive.
- [ ] Documentation.
- [ ] CI PASS.
- [ ] Staging smoke test.
- [ ] Rollback considered.

Không dùng:

```text
"UI chạy được" = DONE
```

---

# 39. Definition of Production Ready

Chỉ đánh dấu production ready khi:

## Application

- [ ] backend production preflight PASS.
- [ ] admin build PASS.
- [ ] storefront build PASS.
- [ ] shell tests PASS.
- [ ] audit PASS.

## Payment

- [ ] real E2E PASS.
- [ ] replay PASS.
- [ ] invalid signature PASS.
- [ ] reconciliation PASS.

## Infrastructure

- [ ] HTTPS.
- [ ] DB backup.
- [ ] restore drill.
- [ ] monitoring.
- [ ] alerting.

## Product

- [ ] physical pilot PASS.
- [ ] update rollback PASS.
- [ ] customer purchase PASS.
- [ ] key fulfillment PASS.
- [ ] license activation PASS.

## Documentation

- [ ] Terms.
- [ ] Privacy.
- [ ] Refund/support.
- [ ] Install.
- [ ] Customer FAQ.
- [ ] Incident runbook.

---

# 40. Things NOT to do

## Không rewrite toàn bộ backend

Không migrate stack chỉ vì "production nên dùng X".

Current Express/MySQL stack có thể production tốt nếu được vận hành đúng.

---

## Không hard-code Auto Rejoin vào commerce core

Sai:

```js
if (order.product === "AUTO_REJOIN_30_DAY") {
  createKey(...)
}
```

Đúng:

```text
product variant
-> fulfillment_type
-> fulfillment registry
```

---

## Không cho frontend xác nhận payment

Sai:

```text
POST /orders/:id/mark-paid
```

public customer route.

---

## Không lưu raw Auto Rejoin key chỉ để tiện UI

Giữ hash-only invariant.

---

## Không build 20 feature cùng lúc

Ưu tiên:

```text
Product
-> Order
-> Payment
-> Fulfillment
-> Storefront
-> Customer Portal
```

---

## Không mở public trước physical pilot

Automated PASS != real-world production PASS.

---

# 41. KPIs sau launch

## Product

```text
License activation success > 99%
Fulfillment success > 99.5%
```

## Commerce

```text
Payment -> fulfillment p95 < 15s
Duplicate license issuance = 0
Incorrect-price orders = 0
```

## Reliability

```text
Critical API uptime target >= 99.9%
```

## Support

```text
P0 acknowledgment immediate operational response
P1 tracked and prioritized
```

Không đặt KPI quá đẹp nếu chưa có dữ liệu baseline.

Đo trước, đặt target sau.

---

# 42. Suggested 6-Week Execution Order

> Đây là thứ tự ưu tiên, không phải cam kết thời gian cứng.

## Week 1

```text
Commerce schema
Product CRUD
Variant CRUD
Order quote/create
```

## Week 2

```text
Payment adapter
PayOS staging
Webhook idempotency
Order state machine
```

## Week 3

```text
Fulfillment engine
Auto Rejoin license fulfillment
Full purchase integration tests
```

## Week 4

```text
Public storefront
Checkout
One-time key reveal
```

## Week 5

```text
Customer auth
Orders
Licenses
Devices
```

## Week 6

```text
Commerce admin
Physical pilot
Production gates
Deployment drill
```

Nếu blocker production xuất hiện thì **không chuyển phase chỉ để giữ lịch**.

Fix blocker trước.

---

# 43. Immediate Next Actions

Thứ tự nên làm ngay:

## Action 1

Tạo branch:

```bash
git checkout -b feature/commerce-foundation
```

---

## Action 2

Không sửa `licenses` migration cũ.

Tạo migration commerce mới.

---

## Action 3

Implement:

```text
products
product_variants
orders
order_items
```

---

## Action 4

Seed sản phẩm đầu tiên:

```text
Auto Rejoin Pro
```

Variants:

```text
7 days / 1 device
30 days / 1 device
30 days / 3 devices
```

Giá để config qua admin/database, không hard-code trong frontend.

---

## Action 5

Tạo Product API.

---

## Action 6

Tạo Order Quote + Create API.

---

## Action 7

Sau khi test hoàn tất mới nối PayOS.

---

# 44. Prompt mẫu để giao cho AI Coding Agent

Có thể sử dụng prompt sau cho từng phase:

```text
You are working on the Auto Rejoin Pro repository.

Before changing code:
1. Read PROJECT_IMPROVEMENT_PLAN.md.
2. Read PRODUCTION_READINESS_STATUS.md.
3. Read PROJECT_PROGRESS.md.
4. Read SERVER_ARCHITECTURE.md.
5. Read ADMIN_ARCHITECTURE.md.
6. Inspect existing migrations, tests, conventions and response shapes.

Rules:
- Do not rewrite the existing license backend.
- Keep Express + MySQL.
- Preserve raw-license-key one-time-display and hash-only storage invariants.
- Use prepared SQL statements.
- Validate API input with the project's existing validation approach.
- Do not log secrets.
- Add tests before declaring completion.
- Every database change must be a new migration.
- Preserve backwards compatibility unless the task explicitly requires a breaking change.
- Payment state is server-authoritative.
- Fulfillment must be idempotent.
- Do not add arbitrary remote shell execution.
- Do not bypass existing safety boundaries.

Task:
Implement Phase 6A — Commerce Foundation from PROJECT_IMPROVEMENT_PLAN.md.

Deliver:
1. Code changes.
2. New migrations.
3. Unit tests.
4. MySQL integration tests.
5. API contract summary.
6. Security considerations.
7. Files changed.
8. Commands to verify.
9. Remaining blockers.

Do not start Phase 6B until every Phase 6A exit criterion passes.
```

---

# 45. Documentation Files nên có sau Phase 6

```text
PROJECT_IMPROVEMENT_PLAN.md
COMMERCE_ARCHITECTURE.md
PAYMENT_ARCHITECTURE.md
FULFILLMENT_ARCHITECTURE.md
CUSTOMER_PORTAL_ARCHITECTURE.md
STORE_DEPLOYMENT_CHECKLIST.md
PAYMENT_INCIDENT_RUNBOOK.md
BACKUP_RESTORE_RUNBOOK.md
COMMERCE_SECURITY_CHECKLIST.md
```

Không cần tạo tất cả ngay ngày đầu.

Tạo khi module tương ứng bắt đầu.

---

# 46. Source of Truth Priority

Hiện repository có nhiều roadmap ở các thời điểm khác nhau.

Khi tài liệu mâu thuẫn, ưu tiên:

```text
1. PRODUCTION_READINESS_STATUS.md
2. PROJECT_PROGRESS.md
3. PROJECT_IMPROVEMENT_PLAN.md (file này, cho Commerce Phase 6+)
4. Architecture docs hiện tại
5. Roadmap cũ
```

Lý do:

Một số kế hoạch cũ mô tả tương lai như:

```text
Fastify
PostgreSQL
Next.js
```

trong khi implementation thực tế hiện nay đã đi theo:

```text
Express
MySQL
React/Vite
```

Không nên quay lại roadmap cũ làm phá implementation đã pass test.

---

# 47. Final Target State

Khi roadmap này hoàn thành, hệ thống mong muốn là:

```text
Customer visits storefront
        ↓
Chooses any digital product
        ↓
Server calculates price
        ↓
Order created
        ↓
Customer pays
        ↓
Verified webhook
        ↓
Idempotent payment processing
        ↓
Generic fulfillment engine
        ↓
License / Key / Download / Service
        ↓
Customer portal
        ↓
Admin monitoring + audit
```

Và Auto Rejoin client:

```text
Install
   ↓
Activate legitimate license
   ↓
Server entitlement validation
   ↓
Run within plan limits
   ↓
Signed updates
   ↓
Support bundle
```

---

# 48. Success Criteria của toàn bộ cải tiến

Dự án được xem là đạt mục tiêu thương mại hóa khi:

1. Admin thêm được sản phẩm mới mà không cần sửa checkout core.
2. Khách mua Auto Rejoin hoàn toàn tự động.
3. Key chỉ được giao sau payment verification server-side.
4. Duplicate webhook không tạo duplicate license.
5. Customer A không truy cập được dữ liệu Customer B.
6. Admin actions quan trọng có audit.
7. Auto Rejoin raw key không lưu plaintext.
8. Digital third-party key được mã hóa at rest.
9. Payment, fulfillment và license có E2E tests.
10. Physical pilot pass.
11. Backup restore pass.
12. Signed update drill pass.
13. Production preflight pass.
14. Không còn blocker P0/P1 khi go-live.
15. Sau này thêm key/download/service không cần viết lại kiến trúc.

---

# 49. Repository References dùng để lập kế hoạch

Kế hoạch này được xây dựng dựa trên trạng thái repository tại thời điểm 2026-09-15, đặc biệt:

- Repository: `https://github.com/Gnas260605/auto-rejoin`
- `SERVER_ARCHITECTURE.md`
- `ADMIN_ARCHITECTURE.md`
- `PROJECT_PROGRESS.md`
- `PRODUCTION_READINESS_STATUS.md`
- `PROJECT_PLAN.md`

Các trạng thái runtime/production cần luôn được kiểm tra lại trước mỗi release vì repository có thể thay đổi sau ngày lập tài liệu.

---

# 50. Kết luận

Ưu tiên tiếp theo của Auto Rejoin Pro **không phải viết thêm thật nhiều feature cho agent**.

Ưu tiên đúng là:

```text
1. Hoàn thành physical/staging production gates.
2. Xây Commerce Foundation.
3. Làm Payment State Machine.
4. Làm Idempotent Fulfillment.
5. Bán Auto Rejoin license tự động.
6. Xây Customer Portal.
7. Mở rộng Multi-Product.
8. Launch có kiểm soát.
```

Nguyên tắc quan trọng nhất:

> **Measure → Analyze → Improve.**

Không chuyển sang phase tiếp theo chỉ vì phase trước “gần xong”.

Nếu một exit criterion thất bại:

```text
STOP
-> identify root cause
-> fix
-> retest
-> only then continue
```

Đây là cách biến Auto Rejoin Pro từ một tool có license thành một sản phẩm thương mại có quy trình, khả năng mở rộng và chất lượng production thực sự.
