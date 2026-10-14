# Shoe Shop POS & Business Management System
## Software Requirements & Technical Specification — Phase 1 (Updated Scope)

**Audience:** Development Team | **Version:** 1.1 (Phase 1 Scope Amendment) | **Status:** Baseline Specification for Implementation  
**Companion Document:** Client Summary (3-page business version)

---

### Conventions Used in This Document
- **`[R]`** = Mandatory Phase 1 requirement.
- **`[P2]`** = Phase 2, out of Phase 1 scope. Data model must not block it.
- **`[DECISION REQUIRED]`** = Business input needed; do not assume. Consolidated in Section 27.
- *No business logic or field contract is left ambiguous. Field names represent the API contract; implementation details belong to the engineering team.*

---

## 1. System Overview

A multi-shop footwear POS and business management application for one business operating two retail shops (branches: **Shop 1** and **Shop 2**). 

The system provides:
1. Fast, barcode-driven billing at the sales counter.
2. Cashier shift sessions with opening/closing cash drawer reconciliation.
3. Customer returns, size exchanges, and refund processing.
4. Integrated shoe repair management (reception, intake invoice/claim slip printing, lifecycle tracking, and completion billing).
5. Shop-level inventory with inter-branch stock transfers between Shop 1 and Shop 2.
6. Purchasing, supplier accounts with an immutable transaction ledger, and cheque lifecycle management.
7. Role-based access control and comprehensive financial and inventory reporting.

### 1.1 Technology Stack [R]

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| **Frontend** | Next.js (App Router) + TypeScript | Responsive desktop/tablet-first; POS & Returns desk optimised for 1024px+ touch and fast keyboard navigation. |
| **UI** | Tailwind CSS + shadcn/ui | Radix UI primitives. Component library selection finalized. |
| **Auth** | Firebase Authentication | Email/password; custom claims encode user `role` and `allowedShopIds`. |
| **Database** | Cloud Firestore (Native mode) | Regional or Multi-region `[DECISION REQUIRED]`. |
| **File Storage** | Firebase Storage | Product pictures, receipt logos, cheque scans, repair shoe defect photos. |
| **Server Logic** | Firebase Cloud Functions (2nd Gen) | All writes modifying stock, cash drawer, repairs, ledgers, and payments. |
| **Hosting** | Firebase Hosting or Vercel | `[DECISION REQUIRED]`. |

### 1.2 Core Architectural Principles [R]

1. **PRODUCT MASTER $\neq$ STOCK:** A Product describes the shoe model. A Variant describes an exact sellable unit (Product + Colour + Size + Barcode/SKU). Stock exists strictly for a `(variantId, shopId)` pair.
2. **Mandatory Shop Context:** Every operational record (*sales, sale items, returns, repairs, transfers, purchases, stock movements, supplier transactions, cashier shifts*) must carry an immutable `shopId`.
3. **Derived Supplier Balances:** Supplier outstanding balance is always derived as $\sum \text{Credit} - \sum \text{Debit}$. Hand-editing balances is strictly forbidden.
4. **Append-Only Immutability:** Financial and stock records are never hard-deleted. Corrections are executed as compensating reversal records referencing `reversalOfId`.
5. **Enforced Shift Cash Integrity:** Cash sales, cash refunds, and repair cash intake cannot occur without an active, open cashier shift. Discrepancies between calculated cash and physical drawer counts are audited upon shift closure.
6. **Two-Stage Inter-Shop Transfers:** Stock transferred between Shop 1 and Shop 2 leaves the origin shop into an explicit `IN_TRANSIT` state before being accepted into destination inventory. Stock is never destroyed or made negative.
7. **Service Invoicing for Shoe Repairs:** Shoes accepted for repair are tracked service entities. Repair intake generates an immediate claim invoice / tag with barcode; repair delivery generates a finalized tax/service invoice and settles drawer revenue.
8. **Security Enforcement:** Client checks exist for UX only. All invariants are enforced server-side via Firestore Security Rules and 2nd Gen Cloud Functions.

### 1.3 Entity Relationship Summary

```
Company
├── Shop 1
└── Shop 2

Brand ────────┐
Category ─────┼──> Product ──> ProductVariant (Colour + Size + SKU + Barcode)
Colour ───────┤                      │
Size ─────────┘                      ├──> Inventory (variant + shop)
                                     ├──> StockMovement (variant + shop + type + ref)
                                     ├──> SaleItem ──> Sale (shop, cashier, shiftId, invoiceNumber)
                                     │                  │
                                     │                  ├──> Return (originalSaleId, refundAmount, items)
                                     │                  └──> SizeExchange (returnItem + newSaleItem)
                                     ├──> StockTransferItem ──> StockTransfer (originShop -> destShop)
                                     └──> PurchaseItem ──> Purchase (shop, supplier)

CashierShift (shop, cashier, openingFloat, cashSales, cashRefunds, drawerExpected, drawerCounted)
ShoeRepairOrder (shop, customer, brand/model, issue, intakeInvoiceNo, advancePaid, status, finalInvoiceNo)
Supplier ──> SupplierTransaction (ledger; derived balance)
         ──> SupplierPayment ──> Cheque (PENDING / CLEARED / BOUNCED / CANCELLED)
AuditLog (write-once log for all sensitive actions)
```

---

## 2. Phase 1 Modules

| ID | Module | Scope | Dependencies |
| :--- | :--- | :--- | :--- |
| **A** | Authentication & Authorization | `[R]` Mandatory Phase 1 | — |
| **B** | Shop/Branch Management | `[R]` Mandatory Phase 1 | A |
| **C** | User & Role Management | `[R]` Mandatory Phase 1 | A, B |
| **D** | Product Master Management | `[R]` Mandatory Phase 1 | C |
| **E** | Product Variant Management | `[R]` Mandatory Phase 1 | D |
| **F** | Barcode / SKU Management | `[R]` Mandatory Phase 1 | E |
| **G** | Inventory / Stock Management | `[R]` Mandatory Phase 1 | B, E |
| **H** | Cashier Shifts & Cash Drawer | `[R]` **Added to Phase 1** | A, B, C |
| **I** | POS / Billing & Invoicing | `[R]` Mandatory Phase 1 | F, G, H |
| **J** | Customer Returns, Exchanges & Refunds | `[R]` **Added to Phase 1** | G, H, I |
| **K** | Shoe Repair Management & Invoicing | `[R]` **Added to Phase 1** | A, B, H, J |
| **L** | Inter-Shop Stock Transfers (Shop 1 $\leftrightarrow$ Shop 2) | `[R]` **Added to Phase 1** | B, G |
| **M** | Supplier Master Management | `[R]` Mandatory Phase 1 | C |
| **N** | Purchasing Management | `[R]` Mandatory Phase 1 | G, M |
| **O** | Supplier Accounts & Ledger | `[R]` Mandatory Phase 1 | M, N |
| **P** | Supplier Payments | `[R]` Mandatory Phase 1 | O |
| **Q** | Cheque Management | `[R]` Mandatory Phase 1 | P |
| **R** | Operational & Financial Reports | `[R]` Mandatory Phase 1 | G, H, I, J, K, L, N, O, Q |
| **S** | Audit-Sensitive Transaction Logging | `[R]` Mandatory Phase 1 | All operational modules |

---

## 3. User Roles & Permissions

Permissions are discrete string keys stored in role documents. The user profile holds the `roleId` and an array of `allowedShopIds`.

### 3.1 Permission Keys

| Category | Permission Key | Meaning |
| :--- | :--- | :--- |
| **POS** | `pos.access` | Access billing interface |
| **POS** | `pos.sale.create` | Complete checkout transaction |
| **POS** | `pos.discount.apply` | Apply line or bill level discount |
| **POS** | `pos.sale.cancel` | Cancel a completed sale (supervisor reversal) |
| **POS** | `pos.invoice.reprint` | Reprint past sales invoice |
| **Cash Drawer** | `shift.open` | Open cashier shift and input cash float |
| **Cash Drawer** | `shift.close` | Close cashier shift and submit cash count |
| **Cash Drawer** | `shift.view.own` / `shift.view.all` | View shift reconciliation reports |
| **Returns** | `returns.create` | Process return, size exchange, or refund |
| **Returns** | `returns.approve` | Authorize return without original receipt or override policy |
| **Returns** | `returns.view` | View historical return slips |
| **Repairs** | `repair.create` | Accept shoe for repair, record deposit, print intake invoice |
| **Repairs** | `repair.status.update` | Update repair status (under repair, ready for pickup) |
| **Repairs** | `repair.deliver` | Complete repair pickup, collect final payment, print invoice |
| **Repairs** | `repair.view` | View repair job list and history |
| **Transfers** | `transfer.create` | Initiate inter-shop transfer request/dispatch |
| **Transfers** | `transfer.receive` | Acknowledge receipt of stock at destination branch |
| **Transfers** | `transfer.view` | View inter-branch transfers and in-transit records |
| **Inventory** | `inventory.view` | View stock on hand for permitted shops |
| **Inventory** | `inventory.adjust` | Submit manual stock corrections (damage, loss, manual in/out) |
| **Products** | `product.view` / `create` / `update` | Product master and variant catalog administration |
| **Purchasing** | `purchase.view` / `create` / `cancel` | Supplier purchase entry and management |
| **Suppliers** | `supplier.view` / `create` / `update` | Supplier profile management |
| **Suppliers** | `supplier.ledger.view` | View and export supplier transaction statement |
| **Suppliers** | `supplier.adjustment.create` | Create debit/credit adjustments |
| **Payments** | `payment.create` / `cancel` | Record payments to suppliers |
| **Cheques** | `cheque.view` / `create` / `status.update` | Manage cheque register and transitions |
| **Cheques** | `cheque.reversal.authorize` | Authorize post-clearing bounce/cancellation |
| **Reports** | `report.sales` / `inventory` / `financial` | View business analytics |
| **Admin** | `shop.manage` / `user.manage` / `settings` | System-wide administrative control |
| **Audit** | `audit.view` | View write-once audit log entries |

### 3.2 Default Role Matrix

| Permission Area | SUPER ADMIN | SHOP MANAGER | CASHIER |
| :--- | :--- | :--- | :--- |
| **Shop Scope** | All Shops + Consolidated | Assigned Shop(s) only | Assigned Shop only |
| **POS Access & Sales** | Yes | Yes | Yes |
| **Discounting** | Full | Up to Shop Cap (e.g. 15%) | Grantable (e.g. max 5%) |
| **Cashier Shift Open/Close** | Yes | Yes | Yes (Own Register) |
| **Drawer Reconciliation** | All Shifts | Assigned Shop Shifts | Own Shift only |
| **Customer Returns & Refunds** | Yes | Yes | Yes (Standard Return) |
| **Exchange Processing** | Yes | Yes | Yes |
| **Shoe Repair Intake & Invoice**| Yes | Yes | Yes |
| **Shoe Repair Delivery & Billing**| Yes | Yes | Yes |
| **Stock Transfer Dispatch** | Yes | Yes | Grantable only |
| **Stock Transfer Receive** | Yes | Yes | Yes (Counter Staff) |
| **Inventory View** | All Shops | Assigned Shop | Assigned Shop (Read-only) |
| **Stock Adjustments** | Full | Reason Required | No |
| **Supplier Purchasing & Ledger**| Full | Grantable | No |
| **Supplier Payments & Cheques** | Full | Grantable (Option A) | No |
| **Audit Log Viewing** | Full | No | No |

---

## 4. Multi-Shop Architecture

### 4.1 Data Isolation & Classification

```
┌────────────────────────────────────────────────────────────────────────┐
│                   COMPANY-LEVEL (Master Records)                       │
│ companies, shops, users, roles, categories, brands, colors, sizes,     │
│ products, productVariants, suppliers                                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
       ┌───────────────────────────┴───────────────────────────┐
       ▼                                                       ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│     SHOP 1 (Operational)        │   │     SHOP 2 (Operational)        │
│ inventory (shop1_*)             │   │ inventory (shop2_*)             │
│ sales, saleItems, returns       │   │ sales, saleItems, returns       │
│ cashierShifts, repairOrders     │   │ cashierShifts, repairOrders     │
│ purchases, supplierPayments     │   │ purchases, supplierPayments     │
│ stockMovements (shop1)          │   │ stockMovements (shop2)          │
└────────────────┬────────────────┘   └────────────────┬────────────────┘
                 │                                     │
                 └───────────► stockTransfers ◄────────┘
                        (originShopId ↔ destShopId)
```

1. **Company-Level Master Data:** Shared globally. Items exist once in the master catalog.
2. **Shop-Level Operational Data:** Tied to `shopId`. Cashiers and Shop Managers are scoped via token custom claims (`allowedShopIds`). Queries without matching `shopId` are rejected by Firestore Security Rules.
3. **Inter-Shop Stock Transfers:** Transfer documents store both `originShopId` and `destinationShopId`, allowing both branches to see pending incoming and outgoing transfers.

---

## 5. Product & Variant Data Model

A sellable shoe is strictly identified by its **Variant**.

### 5.1 `products`
- `id` (string): Auto-generated ID.
- `name` (string): Shoe model name (e.g., "Air Max Supreme").
- `brandId` (string): Reference to `brands`.
- `categoryId` (string): Reference to `categories`.
- `gender` (enum): `MEN`, `WOMEN`, `UNISEX`, `KIDS`.
- `imagePath` (string, optional): Firebase Storage path.
- `active` (boolean): Soft deactivation.
- `createdAt`, `updatedAt`, `createdBy`.

### 5.2 `productVariants`
- `id` (string): Auto-generated ID.
- `productId` (string): Reference to `products`.
- `colorId` (string): Reference to `colors`.
- `sizeId` (string): Reference to `sizes`.
- `sku` (string): Unique business identifier (e.g. `NIK-AIRMAX-BLK-42`).
- `barcode` (string): Unique barcode string (EAN-13 or Code128).
- `barcodeSource` (enum): `MANUFACTURER`, `INTERNAL`.
- `referenceCostPrice` (number): Current baseline purchase cost.
- `sellingPrice` (number): Active retail shelf price.
- `productNameCache`, `brandNameCache`, `colorNameCache`, `sizeLabelCache` (string): Denormalized snapshot strings for lightning-fast POS rendering and receipt printing.
- `active` (boolean).

---

## 6. Inventory & Stock Movement Engine

### 6.1 `inventory`
Document ID is deterministic: `{shopId}_{variantId}`.
- `id` (string): `{shopId}_{variantId}`.
- `shopId` (string): `shop1` or `shop2`.
- `variantId` (string): Reference to `productVariants`.
- `productId` (string): Denormalized for filtering.
- `quantityOnHand` (integer): Authoritative on-hand quantity.
- `reorderLevel` (integer): Threshold for low stock alert.
- `lastMovementAt` (timestamp).

### 6.2 `stockMovements` (Append-Only)
- `id` (string): Auto-ID.
- `shopId`, `variantId`, `productId` (string).
- `type` (enum): Detailed in Section 6.3.
- `quantity` (integer): Always positive.
- `direction` (enum): `IN` or `OUT`.
- `quantityBefore`, `quantityAfter` (integer): Complete audit trail.
- `reason` (string): Mandatory for adjustments, returns, and damages.
- `referenceType` (enum): `SALE`, `PURCHASE`, `ADJUSTMENT`, `RETURN`, `TRANSFER`, `REPAIR`.
- `referenceId` (string): ID of the driving transaction.
- `userId` (string): Staff member responsible.
- `createdAt` (timestamp): Server timestamp.

### 6.3 Movement Types — Phase 1 Scope

| Movement Type | Direction | Phase 1 Status | Triggered By |
| :--- | :--- | :--- | :--- |
| `PURCHASE_IN` | `IN` | **Implemented [R]** | Supplier purchase receipt |
| `SALE_OUT` | `OUT` | **Implemented [R]** | POS checkout completion |
| `ADJUSTMENT_IN` | `IN` | **Implemented [R]** | Manual physical audit correction |
| `ADJUSTMENT_OUT` | `OUT` | **Implemented [R]** | Manual physical audit shrinkage |
| `DAMAGE` | `OUT` | **Implemented [R]** | Defective / unsellable stock removal |
| `RETURN_IN` | `IN` | **Implemented [R]** | Customer return approved for restocking |
| `TRANSFER_OUT` | `OUT` | **Implemented [R]** | Stock dispatched from source shop |
| `TRANSFER_IN` | `IN` | **Implemented [R]** | Stock received at destination shop |

---

## 7. Purchasing & Supplier Management

*(Maintained as specified in baseline document)*
- **Purchases:** Supplier + Shop + Purchase Items $\rightarrow$ Atomically increments stock (`PURCHASE_IN`) and posts liability credit to supplier ledger.
- **Supplier Ledger:** Running balance derived dynamically ($\sum \text{Credit} - \sum \text{Debit}$).
- **Cheques (Phase 1 Mandatory `[R]`):** Full state engine: `PENDING` $\rightarrow$ `CLEARED` (posts debit payment) or `BOUNCED` / `CANCELLED`. Bounced cleared cheques post reversing credit.

---

## 8. POS / Billing & Invoicing

### 8.1 Workflow
```
[Verify Open Cashier Shift]
        ↓
[Scan Barcode / Fast Search] ──> [Resolve Variant & Check Shop Stock]
        ↓
[Add to Cart] ──> [Apply Authorized Discount]
        ↓
[Select Payment Method] (Cash / Card / Transfer / Split)
        ↓
[Atomic Sale Transaction] ──> Deduct Stock (SALE_OUT)
                          ──> Increment Shift Cash Totals
                          ──> Generate Unique Invoice SHOP001-INV-XXXXXX
                          ──> Print Thermal Receipt (ESC/POS or Browser Print)
```

### 8.2 Shift Requirement
The POS checkout interface is strictly locked unless the logged-in cashier has an active `OPEN` shift for the selected terminal/shop.

---

## 9. Cashier Shifts & Cash Drawer Management — Phase 1 [R]

To guarantee financial accountability and prevent drawer discrepancies, cashier shifts and cash drawer opening/closing are fully integrated into Phase 1.

### 9.1 Shift Lifecycle & Business Rules

```
┌──────────────┐     Cash Sales (+)     ┌──────────────┐     Physical Cash Count      ┌──────────────┐
│  SHIFT OPEN  │ ──> Cash Refunds (-) ──> │ SHIFT ACTIVE │ ──> Expected vs Counted   ──> │ SHIFT CLOSED │
│ (Enter Float)│     Repair Cash (+)    │  (In Store)  │     Calculate Discrepancy   │ (Print Z-Rep)│
└──────────────┘                        └──────────────┘                             └──────────────┘
```

1. **Shift Opening:**
   - Cashier enters their designated opening cash float (e.g. $100.00 / Rs. 10,000).
   - System records `cashierShifts` document with status `OPEN`.
   - The cash drawer opens via POS kick command.
2. **Operational Real-Time Accumulation:**
   - Every **Cash Sale** completed increments `cashSales` on the shift.
   - Every **Card / Transfer Sale** increments `cardSales` / `transferSales` for reconciliation.
   - Every **Cash Refund** processed through the returns module decrements cash on hand (`cashRefunds`).
   - Every **Cash Repair Deposit or Final Pickup Payment** increments `repairCashIn`.
3. **Shift Closing & Blind Count Reconciliation:**
   - Cashier triggers "Close Shift / Cash Drawer".
   - Cashier performs a physical count of currency in the drawer and inputs the denomination breakdown or total `actualCashCounted`.
   - **System Computes Expected Cash:**
     $$\text{Expected Cash} = \text{Opening Float} + \text{Cash Sales} + \text{Repair Cash In} - \text{Cash Refunds} - \text{Cash Payouts}$$
   - **Variance Computed:**
     $$\text{Variance} = \text{Actual Cash Counted} - \text{Expected Cash}$$
   - If $|\text{Variance}| > 0$, notes/reasons are mandatory. Discrepancies exceeding a defined threshold `[DECISION REQUIRED]` require Manager Override.
   - Generates and prints the **Z-Report (Shift Summary Receipt)**.
   - Shift status moves to `CLOSED`. POS is locked until the next shift is initiated.

### 9.2 `cashierShifts` Schema

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Auto-ID or deterministic `{shopId}_{shiftNumber}` |
| `shiftNumber` | string | Sequential per shop: `SHOP001-SFT-000123` |
| `shopId` | string | Mandatory shop scope |
| `cashierId` | string | Firebase Auth UID of cashier |
| `cashierNameCache` | string | Staff display name |
| `openedAt` | timestamp | Shift start time |
| `closedAt` | timestamp \| null | Shift end time |
| `openingFloat` | number | Starting cash placed in drawer |
| `cashSales` | number | Sum of cash sales during shift |
| `cardSales` | number | Sum of card transactions |
| `transferSales` | number | Sum of electronic bank transfers |
| `cashRefunds` | number | Sum of cash paid out for customer returns |
| `repairCashIn` | number | Sum of cash deposits and pickup payments collected |
| `cashPayouts` | number | Authorized petty cash / drawer expenses |
| `expectedCash` | number | Computed total that should be in drawer |
| `actualCashCounted`| number | Physically counted cash submitted by cashier |
| `variance` | number | `actualCashCounted - expectedCash` (Negative = Shortage, Positive = Overage) |
| `status` | enum | `OPEN`, `CLOSED` |
| `closingNotes` | string \| null | Cashier explanation for any variance |
| `supervisorOverrideId` | string \| null | UID of supervisor approving discrepancy |

---

## 10. Customer Returns, Size Exchanges & Refunds — Phase 1 [R]

Customer returns and exchanges are first-class workflows implemented directly at the counter.

### 10.1 Business Rules & Workflows

1. **Receipt Lookup:**
   - Returns are initiated by scanning the original invoice barcode or looking up `invoiceNumber` or customer phone number.
   - System retrieves the original sale items, quantity sold, historical selling price charged, and discount applied.
2. **Return Validation:**
   - Total returned quantity cannot exceed `(quantitySold - previouslyReturnedQuantity)`.
   - Items past the configured return window (e.g. 14 days `[DECISION REQUIRED]`) require manager authorization (`returns.approve`).
3. **Item Routing (Restock vs Damage):**
   - **Sellable Condition:** Re-enters inventory immediately. Creates `RETURN_IN` stock movement for that variant in the active shop.
   - **Defective / Damaged:** Does not re-enter sellable stock. Creates `DAMAGE` stock movement with recorded customer defect notes.
4. **Settlement Modes:**
   - **Direct Refund:** Settle via Cash (decrements current shift drawer balance), Card Refund reversal, or Store Credit voucher.
   - **Size / Variant Exchange:**
     - Return item is credited at the original price paid.
     - Cashier selects the replacement variant (e.g. Size 42 exchanged for Size 43).
     - If prices match: Balance due = $0.00.
     - If replacement price is higher: Customer pays difference (added to shift).
     - If replacement price is lower: Partial refund issued to customer.
     - Generates an Exchange Invoice referencing the original invoice and the replacement item.
5. **Print Documentation:**
   - Immediate thermal or A4 print of **Return / Exchange Receipt** detailing original invoice reference, returned item(s), restocked status, and net refund or exchange settlement.

### 10.2 `returns` Schema

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Auto-ID |
| `returnNumber` | string | Sequential: `SHOP001-RET-000045` |
| `shopId` | string | Shop where return is physically processed |
| `originalSaleId` | string | Reference to original `sales` document |
| `originalInvoiceNumber` | string | Original receipt identifier |
| `cashierId` | string | Staff processing return |
| `shiftId` | string | Active cashier shift receiving the financial adjustment |
| `type` | enum | `RETURN_REFUND`, `SIZE_EXCHANGE` |
| `items` | array | Array of return line items (see below) |
| `subtotalRefund` | number | Gross return value |
| `exchangeNewSaleId`| string \| null | Reference to new linked sale if size exchange |
| `netRefundAmount` | number | Amount returned to customer |
| `refundMethod` | enum | `CASH`, `ORIGINAL_CARD`, `STORE_CREDIT`, `EVEN_EXCHANGE` |
| `notes` | string | Return reason |
| `createdAt` | timestamp | Server timestamp |

**`items` array sub-schema:**
```json
{
  "variantId": "var_123",
  "quantity": 1,
  "unitPriceRefunded": 4500,
  "condition": "NEW_RESELLABLE" | "DEFECTIVE",
  "restocked": true,
  "reason": "SIZE_FIT" | "DEFECT" | "CUSTOMER_CHOICE"
}
```

---

## 11. Shoe Repair Management & Invoicing — Phase 1 [R]

A dedicated repair service system embedded directly into the **Returns & Exchanges desk interface**. It manages customer repair shoe intake, claim invoice printing, physical shoe tagging, workshop tracking, and final delivery billing.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               RETURNS & EXCHANGES COUNTER INTERFACE                             │
│  [ Process Customer Return ]   [ Size Exchange ]   [ ✦ Receive Shoe for Repair ]│
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         ▼
                             [ SHOE REPAIR INTAKE ]
          - Customer Details (Name, Phone, WhatsApp)
          - Shoe Details (Brand, Model, Size, Colour, External/Store-Bought)
          - Defect Diagnosis & Service Tasks (Sole, Stitching, Heel, Polish)
          - Promised Delivery Date & Estimated Charge
          - Optional Advance Cash/Card Deposit
                                         │
                                         ▼
                   ┌───────────────────────────────────────────┐
                   │  ATOMIC SAVE & INVOICE PRINTING           │
                   │  1. Print Customer Intake Invoice / Slip  │
                   │  2. Print Physical Shoe Attachment Tag    │
                   │  3. Post Advance Deposit to Active Shift  │
                   └─────────────────────┬─────────────────────┘
                                         │
                                         ▼
                     [ REPAIR LIFECYCLE MANAGEMENT SCREEN ]
    [RECEIVED] ──► [UNDER_REPAIR] ──► [READY_FOR_PICKUP] ──► [DELIVERED & PAID]
                                         │
                                         ▼
                           [ FINAL PICKUP & BILLING ]
          - Collect Remaining Balance (Cash / Card)
          - Print Final Repair Tax/Settlement Invoice
          - Mark Order COMPLETED; Post Revenue to Active Shift
```

### 11.1 Repair Intake & Customer Invoicing

1. **Intake Entry:**
   - Accessed via a prominent button within the Returns & Exchange POS view: **"Receive Shoe for Repair"**.
   - **Customer Information:** Name, Mobile Phone (primary key for lookup), WhatsApp, Address (optional).
   - **Shoe Specification:**
     - Brand & Model Description (Free text or catalog select).
     - Color & Size.
     - Origin: Checkbox for "Purchased from our shop" (with optional invoice lookup) vs "External Customer Shoe".
   - **Defect Description & Work Required:** Detailed description (e.g. "Left sole detached from toe; heel rubber worn out, replace both heels").
   - **Condition & Visual Evidence:** Pre-existing wear marks, scratches; optional camera capture upload to Firebase Storage.
   - **Charges & Deposits:**
     - Estimated Total Repair Fee.
     - Advance Deposit Paid (if any).
     - Balance Payable on Delivery.
     - Payment Method for Deposit (`CASH`, `CARD`, `TRANSFER`). Cash deposits atomically increment `repairCashIn` on the cashier's current open shift.
   - **Promised Completion Date.**
2. **Immediate Invoice & Tag Generation [R]:**
   - **Customer Intake Invoice / Claim Slip:**
     - Printed immediately via POS thermal printer or 80mm/A4 slip.
     - Contains: Shop Name, Address, Branch Phone, Unique Repair Ticket No (`SHOP001-REP-000102`), Ticket Barcode/QR code, Customer Name/Phone, Intake Date, Promised Date, Shoe Description, Work Order details, Advance Paid, Estimated Balance Due, Terms & Conditions (e.g., "Shoes not collected within 30 days..."), and Cashier Signature line.
   - **Shoe Attachment Tag:**
     - Compact waterproof/thermal tag with Barcode, Repair Number, Customer Name, and Short Issue Note to be affixed physically to the shoe pair.

### 11.2 Repair Lifecycle Tracking

The management desk provides a central status board for filtering and handling all repair shoes:
- **`RECEIVED`:** Shoe safely stored at shop counter, waiting for cobbler/technician.
- **`UNDER_REPAIR`:** Shoe transferred to workshop or in active service.
- **`READY_FOR_PICKUP`:** Repair successfully finished, inspected, and waiting at the shop branch. Customer notification triggered (SMS/WhatsApp template `[DECISION REQUIRED]`).
- **`COMPLETED` / `DELIVERED`:** Customer returned claim slip, settled remaining balance, and collected shoes.
- **`UNREPAIRABLE` / `CANCELLED`:** Cannot be repaired. Advance refunded or credited; shoes returned.

### 11.3 Delivery, Final Settlement & Completion Invoicing

1. **Claim Verification:** Staff scans barcode from customer's intake slip or searches by customer phone number.
2. **Billing Finalization:**
   - Confirms actual work done. Cashier can adjust final charge if parts were needed (with supervisor authorization if exceeding estimate).
   - Displays: Total Cost $-$ Advance Paid $=$ Final Amount Due.
   - Cashier selects payment method for balance (`CASH`, `CARD`, etc.).
   - Cash received is credited to the active cashier's shift.
3. **Print Final Repair Invoice:**
   - System prints the official **Repair Completion & Settlement Invoice** confirming receipt of full payment, warranty terms (if any), and release of merchandise.
4. Document moves to `DELIVERED` status and is permanently archived.

### 11.4 `repairOrders` Schema

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Auto-ID |
| `repairNumber` | string | Deterministic/Sequential: `SHOP001-REP-000102` |
| `shopId` | string | Receiving shop branch |
| `intakeCashierId` | string | Staff who checked in the shoe |
| `intakeShiftId` | string | Active cashier shift receiving the advance payment |
| `customerName` | string | Customer full name |
| `customerPhone` | string | Primary phone contact (indexed for search) |
| `customerAddress` | string \| null | Customer residential address |
| `shoeBrand` | string | e.g. "Clarks", "Nike", "Leather Loafer" |
| `shoeModel` | string | Model name / style description |
| `shoeSize` | string | Size |
| `shoeColor` | string | Color description |
| `isStorePurchased` | boolean | Whether item was originally bought in this shop |
| `linkedSaleId` | string \| null | Original sale ID if store purchased |
| `issueDescription` | string | Full diagnosis of required repair work |
| `photoUrls` | array of strings | Storage paths of intake photos |
| `estimatedCost` | number | Quoted service fee |
| `advancePaid` | number | Advance collected at intake |
| `finalCost` | number | Final total service fee billed |
| `balanceDue` | number | `finalCost - advancePaid` |
| `status` | enum | `RECEIVED`, `UNDER_REPAIR`, `READY_FOR_PICKUP`, `DELIVERED`, `CANCELLED` |
| `receivedAt` | timestamp | Date & time shoe was handed in |
| `promisedDate` | timestamp | Promised ready date |
| `completedAt` | timestamp \| null | When repair work was finished |
| `deliveredAt` | timestamp \| null | When customer picked up and paid |
| `deliveryCashierId` | string \| null | Cashier who completed pickup |
| `deliveryShiftId` | string \| null | Shift receiving final balance |
| `deliveryPaymentMethod` | enum \| null | `CASH`, `CARD`, `TRANSFER` |
| `notes` | string | Internal workshop notes |
| `statusHistory` | array | Append-only audit trail: `[{from, to, at, by, notes}]` |

---

## 12. Inter-Shop Stock Transfers — Phase 1 [R]

Enables seamless inventory rebalancing between **Shop 1** and **Shop 2** with rigorous transit accountability.

### 12.1 Transfer Lifecycle

```
[Shop 1: Create Transfer] ──► Deduct Shop 1 Stock (TRANSFER_OUT)
                          ──► Status: IN_TRANSIT
                          ──► Print Transfer Dispatch Note
                                    │
                                    ▼
                         [ Physical Goods In Transit ]
                                    │
                                    ▼
[Shop 2: Receive & Verify] ──► Increment Shop 2 Stock (TRANSFER_IN)
                           ──► If Discrepancy: Log DAMAGE / SHORTAGE
                           ──► Status: RECEIVED (Complete)
```

1. **Step 1: Initiation & Dispatch (Origin Shop):**
   - Source shop staff selects destination shop and items/quantities.
   - Cloud Function validates that source shop `quantityOnHand >= transferQuantity`.
   - **Atomic State Update:**
     - Source shop `inventory.quantityOnHand -= quantity`.
     - Appends `TRANSFER_OUT` record in `stockMovements` for origin shop.
     - Creates `stockTransfers` document with status `IN_TRANSIT`.
   - Prints **Stock Transfer Dispatch Note** to accompany the physical shoe boxes.
2. **Step 2: Receipt & Verification (Destination Shop):**
   - Destination shop opens "Incoming Transfers" view.
   - Staff scans incoming barcodes or enters the `transferNumber`.
   - Staff verifies counted quantities against dispatched manifest.
   - **Atomic Acceptance:**
     - Destination shop `inventory.quantityOnHand += receivedQuantity`.
     - Appends `TRANSFER_IN` record in `stockMovements` for destination shop.
     - If `receivedQuantity < dispatchedQuantity`: Compensating `DAMAGE` / `LOST_IN_TRANSIT` movement is logged with mandatory reason.
     - Transfer status updated to `RECEIVED`.

### 12.2 `stockTransfers` Schema

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Auto-ID |
| `transferNumber` | string | Sequential: `TRF-000089` |
| `sourceShopId` | string | Origin branch (`shop1` / `shop2`) |
| `destinationShopId`| string | Destination branch (`shop1` / `shop2`) |
| `status` | enum | `DISPATCHED`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED` |
| `items` | array | Array of transfer lines (see below) |
| `totalQuantity` | integer | Total pairs in transfer |
| `dispatchedBy` | string | User ID of dispatcher |
| `dispatchedAt` | timestamp | Dispatch timestamp |
| `receivedBy` | string \| null | User ID of receiver |
| `receivedAt` | timestamp \| null | Receipt timestamp |
| `discrepancyNotes` | string \| null | Explanation if items were damaged or missing |

**`items` array sub-schema:**
```json
{
  "variantId": "var_987",
  "productId": "prod_456",
  "dispatchedQuantity": 5,
  "receivedQuantity": 5,
  "variantDescriptionCache": "Adidas Samba - White - 42"
}
```

---

## 13. Sales Data Models

### 13.1 `sales`
- `id` (string): Auto-ID.
- `invoiceNumber` (string): Unique per-shop sequential string (`SHOP001-INV-000001`).
- `shopId` (string): Origin shop.
- `cashierId`, `cashierNameCache` (string).
- `shiftId` (string): **Mandatory foreign key to active `cashierShifts`**.
- `customerName`, `customerPhone` (string, optional).
- `subtotal`, `discount`, `taxAmount`, `total` (number).
- `payments[]` (array): `[{method: 'CASH'|'CARD'|'BANK_TRANSFER'|'OTHER', amount: number, reference?: string}]`.
- `amountReceived`, `changeGiven` (number, cash only).
- `returnStatus` (enum): `NONE`, `PARTIALLY_RETURNED`, `FULLY_RETURNED`.
- `returnedAmount` (number): Default 0.
- `status` (enum): `COMPLETED`, `CANCELLED`.
- `cancelledAt`, `cancelledBy`, `cancelReason`.
- `idempotencyKey` (string): Client UUID preventing duplicate submission.
- `createdAt`, `saleDate` (timestamp).

### 13.2 `saleItems`
- `id`, `saleId`, `shopId` (string).
- `variantId`, `productId` (string).
- `quantity` (integer): Quantity purchased.
- `returnedQuantity` (integer): Accumulated returns (default 0).
- `unitSellingPrice` (number): Frozen price charged.
- `unitCostPrice` (number): Frozen reference cost at time of sale.
- `discount` (number): Line-level discount.
- `lineTotal` (number): `(quantity * unitSellingPrice) - discount`.
- `variantDescriptionCache` (string).

---

## 14. Operational Reports & Dashboards — Phase 1 [R]

### 14.1 Complete Report Register

| Module | Report Name | Data Source | Primary Filters | Output Formats |
| :--- | :--- | :--- | :--- | :--- |
| **Sales** | Daily Sales Summary | `sales` | Date, Shop, Cashier | Screen, CSV, Print |
| **Sales** | Sales by Payment Method | `sales.payments[]` | Date Range, Shop | Screen, CSV |
| **Cashier** | Cash Drawer Shift Reconciliation | `cashierShifts` | Date Range, Shop, Cashier | Screen, CSV, Z-Report Print |
| **Returns** | Returns & Refunds Ledger | `returns` | Date Range, Shop, Reason | Screen, CSV |
| **Repairs** | Shoe Repair Operations & Dues | `repairOrders` | Status, Date Range, Shop | Screen, CSV, PDF Claim |
| **Transfers**| Inter-Shop Transfer History | `stockTransfers` | Date Range, Origin, Destination | Screen, CSV |
| **Inventory**| Current Stock on Hand | `inventory` | Shop, Brand, Category | Screen, CSV |
| **Inventory**| Low Stock Alert | `inventory` (qty $\le$ reorder) | Shop | Screen, CSV |
| **Inventory**| Stock Movement Audit Log | `stockMovements` | Date Range, Shop, Variant, Type | Screen, CSV |
| **Purchases**| Purchase History & Bills | `purchases` | Date Range, Shop, Supplier | Screen, CSV |
| **Supplier** | Supplier Statement & Ledger | `supplierTransactions` | Supplier, Date Range, Shop | Screen, CSV, PDF Statement |
| **Cheques** | Cheque Register & Due Dates | `cheques` | Status, Bank, Date Range | Screen, CSV, PDF Register |

### 14.2 Real-Time Management Dashboard

- **Today's Net Sales:** $\sum \text{sales.total} - \sum \text{returns.netRefundAmount}$ for selected shop.
- **Cash Drawer Status:** Open shifts counter with real-time expected cash.
- **Active Repair Orders:** Breakdown by status (`Received: 4`, `Under Repair: 3`, `Ready for Pickup: 2`).
- **In-Transit Transfers:** Number of pairs currently in transit between branches.
- **Total Physical Stock:** Total pairs on hand across variants.
- **Supplier Outstanding Balance:** Sourced from `supplierBalances` aggregate cache.
- **Pending Cheque Exposure:** Total value of un-cleared issued cheques.

---

## 15. Audit & Financial Safety

### 15.1 `auditLogs` Collection (Write-Once)
Contains: `id`, `userId`, `userEmailCache`, `action`, `entityType`, `entityId`, `shopId`, `before`, `after`, `reason`, `ipAddress`, `userAgent`, `createdAt`.

### 15.2 Mandatory Audited Actions `[R]`
`SALE_CREATE`, `SALE_CANCEL`, `INVOICE_REPRINT`, `SHIFT_OPEN`, `SHIFT_CLOSE`, `SHIFT_OVERRIDE`, `RETURN_CREATE`, `EXCHANGE_CREATE`, `REPAIR_CREATE`, `REPAIR_STATUS_CHANGE`, `REPAIR_DELIVER`, `TRANSFER_DISPATCH`, `TRANSFER_RECEIVE`, `STOCK_ADJUSTMENT`, `PURCHASE_CREATE`, `PURCHASE_CANCEL`, `SUPPLIER_PAYMENT_CREATE`, `CHEQUE_CREATE`, `CHEQUE_STATUS_CHANGE`, `PRICE_CHANGE`.

---

## 16. Firestore Data Architecture & Indexes

### 16.1 Collection Architecture

```
Top-Level Collections (Indexed by shopId):
├── companies
├── shops
├── users
├── roles
├── categories, brands, colors, sizes
├── products, productVariants
├── variantKeys, barcodeKeys, skuKeys (Uniqueness guards)
├── inventory
├── stockMovements
├── cashierShifts
├── sales, saleItems
├── returns
├── repairOrders
├── stockTransfers
├── purchases, purchaseItems
├── suppliers, supplierBalances, supplierTransactions, supplierPayments
├── cheques
├── counters
└── auditLogs
```

### 16.2 Counters Collection Strategy
To prevent invoice collision and guarantee gapless, collision-safe numbering:
- `counters/{shopId}_invoice` $\rightarrow$ `SHOP001-INV-XXXXXX`
- `counters/{shopId}_shift` $\rightarrow$ `SHOP001-SFT-XXXXXX`
- `counters/{shopId}_return` $\rightarrow$ `SHOP001-RET-XXXXXX`
- `counters/{shopId}_repair` $\rightarrow$ `SHOP001-REP-XXXXXX`
- `counters/transfer` $\rightarrow$ `TRF-XXXXXX`

---

## 17. Firebase Security & Cloud Function Matrix

| Operation | Execution Path | Authorization & Invariant Validation |
| :--- | :--- | :--- |
| **Read Master Catalog / Stock** | Direct Firestore Read | Token `allowedShopIds` checked against document `shopId`. |
| **Complete POS Sale** | Cloud Function (`completeSale`) | Validates active shift, verifies stock sufficiency, updates drawer, decrements stock atomically. |
| **Open / Close Shift** | Cloud Function (`manageShift`) | Ensures 1 active shift per cashier; verifies cash count; calculates variance. |
| **Customer Return / Exchange** | Cloud Function (`processReturn`) | Validates returnable qty; writes `RETURN_IN` movement; updates drawer if cash. |
| **Shoe Repair Intake** | Cloud Function (`createRepairOrder`) | Issues ticket number; records deposit on active shift; stores customer profile. |
| **Shoe Repair Delivery** | Cloud Function (`deliverRepairOrder`) | Collects remaining balance; credits cashier shift; marks completed. |
| **Dispatch Stock Transfer** | Cloud Function (`dispatchTransfer`) | Verifies origin stock sufficiency; writes `TRANSFER_OUT`; sets `IN_TRANSIT`. |
| **Receive Stock Transfer** | Cloud Function (`receiveTransfer`) | Validates items; increments destination stock (`TRANSFER_IN`); closes transfer. |
| **Purchase Receipt** | Cloud Function (`createPurchase`) | Increments stock (`PURCHASE_IN`); posts supplier credit ledger transaction. |
| **Cheque Status Transition** | Cloud Function (`updateChequeStatus`)| State machine validation; posts debit ledger entry on `CLEARED`. |

---

## 18. Atomic Cloud Function Execution Paths

### 18.1 Sale Completion (`completeSale`)
1. Validate client `idempotencyKey`.
2. Validate cashier has an `OPEN` shift in `cashierShifts`.
3. Read all `inventory` documents for cart items (all reads before writes).
4. Assert `quantityOnHand >= cartQty` for every line.
5. Increment `counters/{shopId}_invoice` to get `invoiceNumber`.
6. Batch write:
   - Create `sales` document (storing `shiftId`).
   - Create all `saleItems` documents.
   - Decrement `quantityOnHand` on `inventory`.
   - Append `SALE_OUT` records on `stockMovements`.
   - Increment `cashSales` (or card/transfer) on `cashierShifts`.
   - Write `auditLogs`.

### 18.2 Return & Exchange Execution (`processReturn`)
1. Read original `sales` and `saleItems` documents; assert eligibility and available quantity.
2. If cash refund: Assert cashier has an active `OPEN` shift.
3. Increment `counters/{shopId}_return` to get `returnNumber`.
4. Batch write:
   - Create `returns` document.
   - Update `saleItems.returnedQuantity` and `sales.returnStatus`.
   - If restocked: Increment destination `inventory` and append `RETURN_IN` movement.
   - If damaged: Append `DAMAGE` movement.
   - If cash refund: Increment `cashRefunds` on active `cashierShifts`.
   - If size exchange: Link new sale creation atomically.
   - Write `auditLogs`.

### 18.3 Repair Intake & Invoice Execution (`createRepairOrder`)
1. Assert cashier has an active `OPEN` shift if advance cash deposit is paid.
2. Increment `counters/{shopId}_repair` to get `repairNumber`.
3. Batch write:
   - Create `repairOrders` document with status `RECEIVED`.
   - If advance deposit > 0: Increment `repairCashIn` on `cashierShifts`.
   - Write `auditLogs`.
4. Return `repairNumber` and printable invoice data payload to client.

### 18.4 Repair Final Delivery Execution (`deliverRepairOrder`)
1. Read `repairOrders` document; assert status is `READY_FOR_PICKUP` or `RECEIVED`.
2. Assert active `OPEN` shift exists for receiving cashier.
3. Calculate remaining balance: `finalCost - advancePaid`.
4. Batch write:
   - Update `repairOrders`: status = `DELIVERED`, `deliveredAt = now()`, `balanceDue = 0`.
   - Credit active `cashierShifts.repairCashIn` with the balance collected.
   - Write `auditLogs`.
5. Return delivery confirmation and final receipt payload.

### 18.5 Inter-Shop Transfer Dispatch & Receipt
- **Dispatch:** Inside transaction: Check origin `inventory.quantityOnHand >= qty` $\rightarrow$ decrement origin inventory $\rightarrow$ append `TRANSFER_OUT` movement $\rightarrow$ create `stockTransfers` document with status `IN_TRANSIT`.
- **Receive:** Inside transaction: Increment destination `inventory.quantityOnHand += qty` $\rightarrow$ append `TRANSFER_IN` movement $\rightarrow$ update `stockTransfers` status to `RECEIVED`.

---

## 19. UI & Navigation Structure

```
App Shell Navigation
├── Dashboard (Consolidated or Branch Overview)
├── POS / Billing
│    ├── New Sale (Barcode scan, cart, payment)
│    ├── Sales History & Invoice Reprint
│    ├── Returns & Exchanges Desk (Direct return, size swap, refund)
│    └── Shoe Repair Desk (Intake, claim ticket printing, status board, pickup billing)
├── Cash Drawer & Shifts
│    ├── Current Shift (Status, float, live drawer figures)
│    ├── Open / Close Shift (Cash count entry, variance note, Z-report print)
│    └── Shift Reconciliation History
├── Inventory Management
│    ├── Stock on Hand
│    ├── Inter-Shop Transfers (Dispatch, In-Transit, Receive)
│    ├── Stock Movements Log
│    ├── Adjustments (Damages, write-offs)
│    └── Low Stock Alerts
├── Purchasing & Suppliers
│    ├── Purchase Entry & History
│    ├── Supplier Profiles & Ledgers
│    ├── Supplier Payments
│    └── Cheque Register
├── Reports & Analytics
│    ├── Sales & Returns Reports
│    ├── Cashier & Shift Z-Reports
│    ├── Shoe Repair Operations Report
│    ├── Transfer Audit Report
│    ├── Inventory Valuation
│    └── Cheque & Supplier Exposure
└── Administration
     ├── Shops Management (Shop 1, Shop 2)
     ├── Users & Role Permissions
     ├── Product & Variant Master
     └── Barcode Label Designer / Print
```

---

## 20. Validation Rules

| # | Rule | Enforced Where |
| :--- | :--- | :--- |
| **V1** | Barcode unique across company | Client + `barcodeKeys` guard + Cloud Function |
| **V2** | SKU unique across company | Client + `skuKeys` guard + Cloud Function |
| **V3** | `(productId, colorId, sizeId)` unique | `variantKeys` guard transaction |
| **V4** | Selling price $\ge 0$; cost $\ge 0$ | Client + Cloud Function |
| **V5** | Sale quantity $\le$ Shop `quantityOnHand` | Sale Cloud Function (authoritative) |
| **V6** | POS checkout blocked without an active `OPEN` shift | POS Client + Sale Cloud Function |
| **V7** | Cashier can have at most one active `OPEN` shift | Shift Cloud Function |
| **V8** | Shift close requires physical cash count submission | Shift Cloud Function |
| **V9** | Return quantity cannot exceed `(quantitySold - returnedQuantity)` | Return Cloud Function |
| **V10** | Cash refund cannot exceed available cash in active shift drawer | Return Cloud Function |
| **V11** | Repair intake requires customer name, phone, and shoe description | Client + Repair Cloud Function |
| **V12** | Repair delivery requires balance due to be settled or cleared | Delivery Cloud Function |
| **V13** | Transfer dispatch quantity $\le$ origin shop `quantityOnHand` | Transfer Cloud Function |
| **V14** | Transfer cannot be received more than once | Transfer Cloud Function |
| **V15** | Cross-shop access restricted by token `allowedShopIds` | Firestore Rules + All Functions |
| **V16** | Completed sales and repairs cannot be hard-deleted | Firestore Security Rules |
| **V17** | Cheque cannot move `CLEARED` $\rightarrow$ `PENDING` | Cheque Cloud Function |
| **V18** | Supplier balance cannot be directly edited by client | Firestore Security Rules |

---

## 21. Future Phases — Explicitly Out of Phase 1

The following items are deferred to **Phase 2**; data models must not block their addition:
- Operating store expenses (rent, utility petty cash ledger).
- Advanced automated customer loyalty points and SMS campaign marketing.
- Advanced FIFO/Weighted-Average dynamic inventory costing.
- Multi-currency transactions and cross-border exchange rates.
- Offline POS offline-first SQLite sync engine.

---

## 22. Development Order & Implementation Roadmap

```
Stage 1: Foundation (Next.js, Tailwind, shadcn/ui, Layout Shell)
Stage 2: Firebase Setup (Auth, Firestore, Storage, Emulators)
Stage 3: Authentication & Shop Scoping (Custom Claims, Shop Selector)
Stage 4: Product Master, Variants & Barcode System
Stage 5: Inventory Engine & Stock Movements
Stage 6: Cashier Shifts & Cash Drawer Management [Phase 1 Scope]
Stage 7: POS Billing, Invoicing & Receipt Printing
Stage 8: Customer Returns, Exchanges & Refunds [Phase 1 Scope]
Stage 9: Shoe Repair Management & Invoicing System [Phase 1 Scope]
Stage 10: Inter-Shop Stock Transfers (Shop 1 ↔ Shop 2) [Phase 1 Scope]
Stage 11: Purchasing & Supplier Master
Stage 12: Supplier Ledger, Payments & Cheque Management
Stage 13: Operational Reports & Z-Reports
Stage 14: Security Hardening, Rules Validation & Emulator Test Suite
Stage 15: Production Deployment & Go-Live
```

---

## 23. End-to-End Test Scenarios

| Scenario ID | Test Flow | Expected Behavior |
| :--- | :--- | :--- |
| **E2E-SHF-01** | Open Shift with $100 float $\rightarrow$ Sell $50 cash $\rightarrow$ Close with $150 counted | Shift status moves to `CLOSED`; `variance = 0`; Z-report prints correctly. |
| **E2E-POS-01** | Attempt checkout without active shift | Checkout button disabled; server function throws `UNAUTHORIZED_NO_ACTIVE_SHIFT`. |
| **E2E-RET-01** | Return 1 pair from past sale $\rightarrow$ Restock condition | Stock increments $+1$ (`RETURN_IN`); cash drawer decrements by refund value; receipt prints. |
| **E2E-EXC-01** | Size exchange (Size 41 for Size 42) | Size 41 returned to stock; Size 42 deducted; differential payment settled; exchange invoice printed. |
| **E2E-REP-01** | Repair intake: Customer shoe $\rightarrow$ $20 estimate, $10 advance cash | Ticket `SHOP001-REP-000001` created; customer intake invoice printed; $10 posted to active shift drawer. |
| **E2E-REP-02** | Repair completion: Mark ready $\rightarrow$ Customer pays $10 balance cash | Remaining $10 collected; shift drawer credited $+10$; final tax invoice printed; status `DELIVERED`. |
| **E2E-TRF-01** | Transfer 5 pairs from Shop 1 to Shop 2 | Shop 1 stock $-5$ (`TRANSFER_OUT`); status `IN_TRANSIT`; Shop 2 receives $\rightarrow$ Shop 2 stock $+5$ (`TRANSFER_IN`). |
| **E2E-ISO-01** | Cashier assigned to Shop 1 attempts to read or write Shop 2 records | Operation rejected by Firestore Security Rules with permission denied. |

---

## 24. Business Decisions Required Before Final Go-Live

| # | Business Decision | Impacted Feature | Recommendation |
| :--- | :--- | :--- | :--- |
| **1** | Return policy window (e.g. 7 days, 14 days, 30 days) | Returns Module | 14 days with original receipt |
| **2** | Cashier drawer discrepancy tolerance limit before manager override | Cashier Shifts | $\pm \$5.00$ or local currency equivalent |
| **3** | Unclaimed repair shoe policy duration | Repair Invoices | 30 days disclaimer printed on slip |
| **4** | Thermal receipt printer model (ESC/POS 80mm vs 58mm) | POS, Returns, Repairs | 80mm standard ESC/POS |
| **5** | Barcode format for internally issued barcodes | Barcodes / Repairs | Code128 |
| **6** | Cheque accounting rule (Option A vs Option B) | Cheque Module | Option A (Reduce liability on clearing) |

---
*Document Version 1.1 — Formally Approved for Development Implementation.*
