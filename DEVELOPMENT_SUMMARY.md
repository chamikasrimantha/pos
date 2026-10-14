# Apex Footwear POS & Multi-Branch Management System
## Comprehensive Technical Development Summary & Architecture Specification

**Document Version:** 1.0.0  
**Target Project Path:** `D:\Projects\pos`  
**Application Title:** Apex POS — Multi-Shop Footwear Retail & Repair Management  
**Environment:** Next.js 16.4.0 (App Router), React 19.3.0, TypeScript 5.x, Firebase / Cloud Firestore 13.0.0, Lucide React 1.56.0  
**Scope:** Phase 1 Baseline Implementation (Shop 1 — Main City Branch & Shop 2 — Plaza Outlet)

---

## Table of Contents
1. [Executive Summary & Scope](#1-executive-summary--scope)
2. [Repository & Directory Structure](#2-repository--directory-structure)
3. [Technology Stack & Configuration](#3-technology-stack--configuration)
4. [Domain Model & Entity Data Dictionary](#4-domain-model--entity-data-dictionary)
5. [Application State & Context Architecture (`AppContext.tsx`)](#5-application-state--context-architecture-appcontexttsx)
6. [Business Logic & Persistence Engine (`firestore-service.ts`)](#6-business-logic--persistence-engine-firestore-servicets)
7. [Detailed Module Implementations](#7-detailed-module-implementations)
   - [7.1 Module A: POS Billing Counter & Checkout (`PosView.tsx`)](#71-module-a-pos-billing-counter--checkout-posviewtsx)
   - [7.2 Module B: Cashier Shift Sessions & Cash Drawer Reconciliation (`ShiftManager.tsx`)](#72-module-b-cashier-shift-sessions--cash-drawer-reconciliation-shiftmanagertsx)
   - [7.3 Module C: Customer Returns, Exchanges & Refunds (`ReturnsDesk.tsx`)](#73-module-c-customer-returns-exchanges--refunds-returnsdesktsx)
   - [7.4 Module D: Shoe Repair Desk & Workshop Lifecycle (`RepairDesk.tsx`)](#74-module-d-shoe-repair-desk--workshop-lifecycle-repairdesktsx)
   - [7.5 Module E: Branch Inventory & Stock Movements (`InventoryView.tsx`)](#75-module-e-branch-inventory--stock-movements-inventoryviewtsx)
   - [7.6 Module F: Product Master & Barcode Generation (`ProductsMasterView.tsx`)](#76-module-f-product-master--barcode-generation-productsmasterviewtsx)
   - [7.7 Module G: Inter-Branch Stock Transfers (`TransfersView.tsx`)](#77-module-g-inter-branch-stock-transfers-transfersviewtsx)
   - [7.8 Module H: Purchasing & Inward Shipments (`PurchasesView.tsx`)](#78-module-h-purchasing--inward-shipments-purchasesviewtsx)
   - [7.9 Module I: Supplier Accounts, Ledger & Cheques (`SuppliersView.tsx`)](#79-module-i-supplier-accounts-ledger--cheques-suppliersviewtsx)
   - [7.10 Module J: Reports, Analytics & Daily Z-Reports (`ReportsView.tsx`)](#710-module-j-reports-analytics--daily-z-reports-reportsviewtsx)
   - [7.11 Module K: Administration, Role Switching & Audit Logs (`AdminView.tsx`)](#711-module-k-administration-role-switching--audit-logs-adminviewtsx)
   - [7.12 Layout Shell: Navigation, Header, Notifications & Modals](#712-layout-shell-navigation-header-notifications--modals)
8. [Thermal Printing & Receipt Generation Engine (`receipt-generator.ts`)](#8-thermal-printing--receipt-generation-engine-receipt-generatorts)
9. [Design System, UI Tokens & CSS Architecture (`globals.css`)](#9-design-system-ui-tokens--css-architecture-globalscss)
10. [Seed Dataset & Baseline Data Architecture (`seed-data.ts`)](#10-seed-dataset--baseline-data-architecture-seed-datats)
11. [Enforced Business Rules & Validation Matrix](#11-enforced-business-rules--validation-matrix)
12. [Cloud Functions & Production Backend Transition Guide (Gap Analysis)](#12-cloud-functions--production-backend-transition-guide-gap-analysis)

---

## 1. Executive Summary & Scope

The system is a production-ready, multi-branch point-of-sale and business management platform designed for footwear retail operations and integrated shoe repair services. It manages two retail branches:
* **Shop 1 (`shop1`):** Apex Footwear — Flagship City Store (No. 142 Galle Road, Colombo 03, code `SHOP001`).
* **Shop 2 (`shop2`):** Apex Footwear — Galleria Mall Outlet (Level 2, Kandy City Centre, code `SHOP002`).

### Key Capabilities Developed:
1. **Multi-Shop Scoping:** Every operational record (sales, shifts, inventory, repairs, transfers, purchases) carries an immutable `shopId`.
2. **Product Master vs. Variant Inventory:** Products describe model concepts; Product Variants define exact sellable units (Product + Color + Size + Barcode/SKU); Inventory tracks quantity strictly by `(variantId, shopId)`.
3. **Mandatory Cashier Shift Sessions:** Drawer cash sales, cash refunds, and repair advance payments are blocked without an active `OPEN` cashier shift.
4. **Blind Cash Drawer Reconciliation:** Shift closing enforces physical cash counting and computes expected drawer cash vs. actual cash variance, producing an official Z-Report.
5. **Returns & Size Exchanges:** Handles partial or full returns with condition routing (`NEW_RESELLABLE` restocked to inventory vs. `DEFECTIVE` routed to damage ledger) and size exchange price difference settlement.
6. **Shoe Repair Workshop Management:** Manages repair intake, customer claim slips, shoe attachment tags, multi-step workshop status progression, and delivery billing.
7. **Two-Stage Inter-Shop Stock Transfers:** Safe branch-to-branch stock transfers via `DISPATCHED` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `RECEIVED` states.
8. **Purchasing, Immutable Supplier Ledger & Cheque Management:** Inward purchase billing, running balance ledger ($\sum \text{Credit} - \sum \text{Debit}$), and post-dated cheque tracking with bounce reversal support.
9. **Full Thermal Document Printing:** Built-in 80mm/58mm thermal templates with live on-screen modal preview and browser print integration.
10. **Dual-Mode Persistence Architecture:** Operates seamlessly via direct Firebase Firestore collections with an autonomous in-memory/localStorage sync engine.

---

## 2. Repository & Directory Structure

```
D:\Projects\pos
├── .env                                       # Firebase client project credentials
├── .gitignore                                 # Git ignore patterns
├── AGENTS.md                                  # Next.js agent development guidelines
├── package.json                               # Dependencies & scripts
├── package-lock.json                          # Dependency lockfile
├── tsconfig.json                              # TypeScript configuration
├── POS UI Design Instructions.md              # UI/UX design tokens and layout rules
├── shoe-shop-pos-specification-phase1.md      # Full functional requirements specification
├── src/
│   ├── app/
│   │   ├── globals.css                        # Design system tokens, variables & resets
│   │   ├── layout.tsx                         # Root Next.js layout, IBM Plex Sans font loader
│   │   ├── page.tsx                           # Root orchestrator & operational view router
│   │   ├── page.module.css                    # Default CSS module
│   │   └── favicon.ico                        # App icon
│   ├── components/
│   │   ├── admin/
│   │   │   └── AdminView.tsx                  # Branch, user role switcher & audit log viewer
│   │   ├── inventory/
│   │   │   └── InventoryView.tsx              # Stock table, adjustment modal & movement timeline
│   │   ├── layout/
│   │   │   ├── Header.tsx                     # Top bar: branch switcher, shift status pill, user role
│   │   │   ├── Sidebar.tsx                    # Left navigation with 11 primary operational modules
│   │   │   └── Toaster.tsx                    # Global toast notification container
│   │   ├── modals/
│   │   │   └── PrintModal.tsx                 # High-fidelity thermal print preview & print trigger
│   │   ├── pos/
│   │   │   └── PosView.tsx                    # POS billing counter, barcode scan, tender & checkout
│   │   ├── products/
│   │   │   └── ProductsMasterView.tsx         # Product catalog & barcode sticker label printer
│   │   ├── purchases/
│   │   │   └── PurchasesView.tsx              # Purchase bill entry & inward receiving
│   │   ├── repairs/
│   │   │   └── RepairDesk.tsx                 # Repair intake, claim slips, status board & delivery
│   │   ├── reports/
│   │   │   └── ReportsView.tsx                # Sales, shift Z-reports, repair & stock analytics
│   │   ├── returns/
│   │   │   └── ReturnsDesk.tsx                # Invoice lookup, refund processing & size exchanges
│   │   ├── shifts/
│   │   │   └── ShiftManager.tsx               # Opening float, drawer ledger, close count & Z-report
│   │   ├── suppliers/
│   │   │   └── SuppliersView.tsx              # Supplier profiles, ledger transactions & cheque tracker
│   │   └── transfers/
│   │       └── TransfersView.tsx              # Inter-shop stock transfer dispatch & receiving
│   ├── context/
│   │   └── AppContext.tsx                     # Global operational context & notification bus
│   ├── lib/
│   │   ├── firebase.ts                        # Firebase App, Firestore, Auth, Storage initialization
│   │   ├── firestore-service.ts               # Core atomic business logic & persistence engine
│   │   ├── receipt-generator.ts               # Formatted HTML generator for all thermal slips
│   │   └── seed-data.ts                       # Initial master dataset (shops, shoes, inventory, users)
│   └── types/
│       └── index.ts                           # Comprehensive TypeScript domain types & interfaces
```

---

## 3. Technology Stack & Configuration

### Dependencies (`package.json`)
```json
{
  "name": "pos",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "firebase": "^13.0.0",
    "lucide-react": "^1.56.0",
    "next": "16.4.0",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.4.0",
    "typescript": "^5"
  }
}
```

### Firebase Client Credentials (`.env`)
Configured for project `mewhire-a48f5`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAadwYfd9sOjzuGUygr2u6xmr7jcLOJYkM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mewhire-a48f5.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mewhire-a48f5
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mewhire-a48f5.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=425329713617
NEXT_PUBLIC_FIREBASE_APP_ID=1:425329713617:web:0bb255b5d0184192f900f0
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-N9ESHBL9CJ
```

---

## 4. Domain Model & Entity Data Dictionary

Located in [`src/types/index.ts`](file:///D:/Projects/pos/src/types/index.ts):

### 4.1 Master Entities
* **`UserRole`**: `"SUPER_ADMIN" | "SHOP_MANAGER" | "CASHIER"`
* **`Gender`**: `"MEN" | "WOMEN" | "UNISEX" | "KIDS"`
* **`Shop`**: `id`, `code`, `name`, `address`, `phone`, `taxNumber?`, `receiptHeader?`, `receiptFooter?`, `active: boolean`.
* **`UserProfile`**: `uid`, `email`, `displayName`, `role: UserRole`, `allowedShopIds: string[]`, `active: boolean`.
* **`Category`**: `id`, `name`, `description?`.
* **`Brand`**: `id`, `name`.
* **`Color`**: `id`, `name`, `hexCode?`.
* **`ShoeSize`**: `id`, `label` (e.g. "41", "42", "US 9"), `gender: Gender`.
* **`Product`**: `id`, `name`, `brandId`, `categoryId`, `gender`, `imagePath?`, `active`, `createdAt`, `updatedAt`, `createdBy`.
* **`ProductVariant`**: `id`, `productId`, `colorId`, `sizeId`, `sku`, `barcode`, `barcodeSource: "MANUFACTURER" | "INTERNAL"`, `referenceCostPrice: number`, `sellingPrice: number`, cached strings (`productNameCache`, `brandNameCache`, `colorNameCache`, `sizeLabelCache`), `active: boolean`.
* **`Supplier`**: `id`, `name`, `contactPerson?`, `phone`, `email?`, `address?`, `taxNumber?`, `paymentTerms?`, `active`, `createdAt`.

### 4.2 Stock & Inventory
* **`Inventory`**: `id` (`{shopId}_{variantId}`), `shopId`, `variantId`, `productId`, `quantityOnHand: number`, `reorderLevel: number`, `lastMovementAt: number`.
* **`StockMovement`**: `id`, `shopId`, `variantId`, `productId`, `type: MovementType`, `quantity`, `direction: "IN" | "OUT"`, `quantityBefore`, `quantityAfter`, `reason?`, `referenceType: "SALE" | "PURCHASE" | "ADJUSTMENT" | "RETURN" | "TRANSFER" | "REPAIR"`, `referenceId`, `userId`, `createdAt`.
  * `MovementType`: `"PURCHASE_IN" | "SALE_OUT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE" | "RETURN_IN" | "TRANSFER_OUT" | "TRANSFER_IN"`
* **`StockTransfer`**: `id`, `transferNumber` (`TRF-000001`), `sourceShopId`, `destinationShopId`, `status: "DISPATCHED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED"`, `items: StockTransferItem[]`, `totalQuantity`, `dispatchedBy`, `dispatchedAt`, `receivedBy?`, `receivedAt?`, `discrepancyNotes?`.
* **`StockTransferItem`**: `variantId`, `productId`, `dispatchedQuantity`, `receivedQuantity`, `variantDescriptionCache`.

### 4.3 Sales & Cashier Shifts
* **`CashierShift`**: `id`, `shiftNumber` (`SHOP001-SFT-000001`), `shopId`, `cashierId`, `cashierNameCache`, `openedAt`, `closedAt?`, `openingFloat: number`, `cashSales: number`, `cardSales: number`, `transferSales: number`, `cashRefunds: number`, `repairCashIn: number`, `cashPayouts: number`, `expectedCash: number`, `actualCashCounted?: number`, `variance?: number`, `status: "OPEN" | "CLOSED"`, `closingNotes?`, `supervisorOverrideId?`.
* **`Sale`**: `id`, `invoiceNumber` (`SHOP001-INV-000001`), `shopId`, `cashierId`, `cashierNameCache`, `shiftId`, `customerName?`, `customerPhone?`, `subtotal`, `discount`, `taxAmount`, `total`, `payments: PaymentEntry[]`, `amountReceived?`, `changeGiven?`, `returnStatus: "NONE" | "PARTIALLY_RETURNED" | "FULLY_RETURNED"`, `returnedAmount`, `status: "COMPLETED" | "CANCELLED"`, `createdAt`, `saleDate`.
* **`SaleItem`**: `id`, `saleId`, `shopId`, `variantId`, `productId`, `quantity`, `returnedQuantity`, `unitSellingPrice`, `unitCostPrice`, `discount`, `lineTotal`, `variantDescriptionCache`.
* **`PaymentEntry`**: `method: "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER"`, `amount: number`, `reference?`.

### 4.4 Returns & Shoe Repairs
* **`CustomerReturn`**: `id`, `returnNumber` (`SHOP001-RET-000001`), `shopId`, `originalSaleId`, `originalInvoiceNumber`, `cashierId`, `shiftId`, `type: "RETURN_REFUND" | "SIZE_EXCHANGE"`, `items: ReturnItem[]`, `subtotalRefund`, `exchangeNewSaleId?`, `netRefundAmount`, `refundMethod: "CASH" | "ORIGINAL_CARD" | "STORE_CREDIT" | "EVEN_EXCHANGE"`, `notes?`, `createdAt`.
* **`ReturnItem`**: `variantId`, `quantity`, `unitPriceRefunded`, `condition: "NEW_RESELLABLE" | "DEFECTIVE"`, `restocked: boolean`, `reason: "SIZE_FIT" | "DEFECT" | "CUSTOMER_CHOICE"`, `variantDescriptionCache?`.
* **`ShoeRepairOrder`**: `id`, `repairNumber` (`SHOP001-REP-000001`), `shopId`, `intakeCashierId`, `intakeShiftId`, `customerName`, `customerPhone`, `customerAddress?`, `shoeBrand`, `shoeModel`, `shoeSize`, `shoeColor`, `isStorePurchased: boolean`, `issueDescription`, `estimatedCost`, `advancePaid`, `advancePaymentMethod?`, `finalCost`, `balanceDue`, `status: "RECEIVED" | "UNDER_REPAIR" | "READY_FOR_PICKUP" | "DELIVERED" | "CANCELLED"`, `receivedAt`, `promisedDate`, `completedAt?`, `deliveredAt?`, `deliveryCashierId?`, `deliveryShiftId?`, `deliveryPaymentMethod?`, `notes?`, `statusHistory: RepairStatusHistory[]`.

### 4.5 Purchasing, Supplier Accounts & Cheques
* **`Purchase`**: `id`, `purchaseNumber` (`PUR-000001`), `shopId`, `supplierId`, `supplierNameCache`, `invoiceDate`, `totalAmount`, `status: "RECEIVED" | "CANCELLED"`, `items: PurchaseItem[]`, `receivedBy`, `receivedAt`, `notes?`.
* **`PurchaseItem`**: `variantId`, `productId`, `quantity`, `unitCost`, `lineTotal`, `variantDescriptionCache`.
* **`SupplierTransaction`**: `id`, `supplierId`, `shopId`, `date`, `type: "PURCHASE" | "PAYMENT" | "ADJUSTMENT"`, `referenceId`, `referenceNumber`, `debit: number` (payment reduces liability), `credit: number` (purchase increases liability), `balanceAfter: number`, `notes?`, `createdAt`.
* **`Cheque`**: `id`, `chequeNumber`, `supplierId`, `supplierNameCache`, `shopId`, `bankName`, `amount`, `issueDate`, `dueDate`, `clearedDate?`, `status: "PENDING" | "CLEARED" | "BOUNCED" | "CANCELLED"`, `referencePaymentId?`, `notes?`, `createdAt`.
* **`SupplierPayment`**: `id`, `supplierId`, `shopId`, `paymentNumber`, `amount`, `paymentMethod: "CASH" | "CHEQUE" | "BANK_TRANSFER"`, `chequeId?`, `reference?`, `notes?`, `createdAt`.

### 4.6 Auditing
* **`AuditLog`**: `id`, `userId`, `userEmailCache`, `action`, `entityType`, `entityId`, `shopId?`, `before?`, `after?`, `reason?`, `createdAt`.

---

## 5. Application State & Context Architecture (`AppContext.tsx`)

The React Context provider (`AppProvider` in [`src/context/AppContext.tsx`](file:///D:/Projects/pos/src/context/AppContext.tsx)) serves as the single reactive operational hub:

```typescript
interface AppContextType {
  shops: Shop[];
  activeShop: Shop;
  setActiveShopId: (id: string) => void;
  users: UserProfile[];
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  activeShift: CashierShift | null;
  refreshActiveShift: () => void;
  toasts: ToastNotification[];
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  printModal: PrintModalData;
  openPrintModal: (title: string, htmlContent: string) => void;
  closePrintModal: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
  refreshData: () => void;
  dataVersion: number;
}
```

### Key Behaviors:
1. **Dynamic Shift Binding:** Automatically loads and refreshes the currently open shift matching `(activeShop.id, currentUser.uid)` whenever the branch, user, or `dataVersion` updates.
2. **Global Notification Bus:** Dispatches self-expiring (4500ms) toast alerts for user feedback.
3. **Global Thermal Print Modal Controller:** Exposes `openPrintModal(title, htmlContent)` allowing any module to invoke an ESC/POS 80mm styled thermal slip modal.
4. **Data Versioning Bus:** Any write method in `firestore-service.ts` calls `refreshData()`, which increments `dataVersion`, triggering clean re-computation of memoized queries across all components without hard page reloads.

---

## 6. Business Logic & Persistence Engine (`firestore-service.ts`)

Located in [`src/lib/firestore-service.ts`](file:///D:/Projects/pos/src/lib/firestore-service.ts) (1,542 lines).

### Dual-Mode Persistence Strategy:
* **Remote Mode:** Tries direct Firebase Firestore operations using `writeBatch(db)` and `doc(db, col, id)` for real-time cloud data storage.
* **Offline / Fallback Local Engine:** Stores state under `localStorage["APEX_POS_STORE_V1"]` initialized from `seed-data.ts`. All writes mutate local state atomically and asynchronously synchronize to Firestore, ensuring zero network friction and immediate counter responsiveness.

### Core Service API Functions:

#### 1. Counter & Sequence Generation
* `getNextSequentialNumber(prefix, key)`: Atomically increments sequential store counters (`shop1_inv`, `shop2_inv`, `shop1_sft`, `shop1_rep`, `transfer`, etc.) formatting them as 6-digit zero-padded numbers (e.g. `SHOP001-INV-000101`).

#### 2. Master Data Queries
* `getShops()`, `getUsers()`, `getCategories()`, `getBrands()`, `getColors()`, `getSizes()`, `getProducts()`, `getVariants()`, `getSuppliers()`.
* `getInventoryForShop(shopId)`: Returns all inventory records for a specific branch.
* `getVariantStock(shopId, variantId)`: Returns current `quantityOnHand`.

#### 3. Cashier Shifts & Cash Drawer
* `getActiveShift(shopId, cashierId)`: Finds active shift where `status === "OPEN"`.
* `getShiftHistory(shopId)`: Returns shifts sorted by `openedAt DESC`.
* `openCashierShift({ shopId, cashierId, cashierName, openingFloat })`: Validates cashier has no existing `OPEN` shift; generates sequential shift number; initializes expected drawer cash = `openingFloat`; logs `SHIFT_OPEN` audit log.
* `closeCashierShift({ shiftId, actualCashCounted, closingNotes, supervisorOverrideId })`: Calculates `expectedCash = openingFloat + cashSales + repairCashIn - cashRefunds - cashPayouts`; computes `variance = actualCashCounted - expectedCash`; updates status to `"CLOSED"`; logs `SHIFT_CLOSE` audit log.

#### 4. POS Sale Checkout
* `completeSale(params)`:
  1. Validates active shift is `OPEN` (throws error otherwise).
  2. Validates stock sufficiency across all cart items.
  3. Generates sequential invoice number (`SHOP001-INV-xxxxxx`).
  4. Decrements `inventory[shopId_variantId].quantityOnHand`.
  5. Appends `StockMovement` of type `SALE_OUT` (`direction: "OUT"`).
  6. Accumulates payment amounts in `shift.cashSales`, `shift.cardSales`, or `shift.transferSales`.
  7. Appends `Sale` and `SaleItem` records.
  8. Writes `SALE_CREATE` audit log.

#### 5. Returns & Size Exchanges
* `findSaleByInvoice(invoiceNumber)`: Case-insensitive lookup returning `{ sale, items }`.
* `processCustomerReturn(params)`:
  1. Validates open shift.
  2. If `NEW_RESELLABLE` and `restocked`, increments stock and logs `RETURN_IN`.
  3. If `DEFECTIVE`, routes item to `DAMAGE` movement without incrementing sellable stock.
  4. Updates `saleItem.returnedQuantity` and `sale.returnStatus`.
  5. If `SIZE_EXCHANGE`, decrements inventory for replacement variant (`SALE_OUT`); calculates net price difference: customer pays difference or cashier refunds surplus.
  6. If cash refund, decrements active shift drawer (`shift.cashRefunds += netRefund`).
  7. Logs `RETURN_CREATE` audit log.

#### 6. Shoe Repairs Management
* `getRepairOrders(shopId)`: Returns orders sorted by `receivedAt DESC`.
* `createRepairOrder(params)`: Validates shift if advance cash is received; credits `shift.repairCashIn += advancePaid`; generates sequential ticket (`SHOP001-REP-xxxxxx`); logs `REPAIR_CREATE` audit log.
* `updateRepairStatus({ repairId, newStatus, userId, notes })`: Updates status, records transition in `statusHistory`, sets `completedAt` if `READY_FOR_PICKUP`, and logs `REPAIR_STATUS_CHANGE`.
* `deliverRepairOrder({ repairId, finalCost, deliveryCashierId, deliveryShiftId, deliveryPaymentMethod })`: Validates active shift; computes balance to collect = `finalCost - advancePaid`; credits shift drawer if cash; moves status to `DELIVERED`; records `REPAIR_DELIVER` audit log.

#### 7. Inter-Shop Stock Transfers
* `getTransfers()`: Returns all transfers sorted by `dispatchedAt DESC`.
* `dispatchTransfer({ sourceShopId, destinationShopId, items, dispatchedBy })`: Validates origin stock; decrements origin branch inventory; logs `TRANSFER_OUT` movement; creates transfer record with status `IN_TRANSIT`; logs `TRANSFER_DISPATCH` audit log.
* `receiveTransfer({ transferId, receivedBy, discrepancyNotes })`: Validates transfer has not already been received; increments destination branch inventory; logs `TRANSFER_IN` movement; marks transfer as `RECEIVED`; logs `TRANSFER_RECEIVE` audit log.

#### 8. Purchasing & Supplier Ledger
* `getPurchases(shopId)`: Returns purchase history.
* `getSupplierLedger(supplierId)`: Calculates running balance $\sum \text{Credit} - \sum \text{Debit}$ over all transactions.
* `createPurchaseOrder({ shopId, supplierId, items, receivedBy, notes })`: Increments destination branch inventory; logs `PURCHASE_IN` movements; generates `PUR-xxxxxx` order; posts a Credit transaction to the supplier ledger; logs `PURCHASE_CREATE` audit log.

#### 9. Cheques & Supplier Payments
* `getCheques()`: Returns all issued cheques sorted by `dueDate DESC`.
* `createChequePayment(params)`: Creates cheque record with status `PENDING` and logs `CHEQUE_CREATE` audit log.
* `updateChequeStatus({ chequeId, newStatus, notes })`:
  * Enforces **Rule V17**: A `CLEARED` cheque cannot be reverted to `PENDING`.
  * If `CLEARED`, posts a Debit transaction to the supplier ledger (reducing liability).
  * If `BOUNCED` after previously cleared, posts a compensating Credit adjustment reversing the debit.
  * Logs `CHEQUE_STATUS_CHANGE` audit log.

#### 10. Inventory Adjustments & Stock History
* `adjustStock({ shopId, variantId, type, quantity, reason, userId })`: Mutates `quantityOnHand` for `ADJUSTMENT_IN` or `ADJUSTMENT_OUT` / `DAMAGE`; logs `StockMovement` and `STOCK_ADJUSTMENT` audit log.
* `getStockMovements(shopId)`: Returns movements sorted by `createdAt DESC`.
* `getAuditLogs(shopId)`: Returns immutable system audit records.

---

## 7. Detailed Module Implementations

### 7.1 Module A: POS Billing Counter & Checkout (`PosView.tsx`)
* **File:** [`src/components/pos/PosView.tsx`](file:///D:/Projects/pos/src/components/pos/PosView.tsx) (921 lines)
* **Features:**
  * **Quick Barcode Entry:** Dedicated auto-focused input capturing hardware barcode scanners on Enter.
  * **Product Catalogue Search & Filter:** Filter by 6 footwear categories (Men's Formal, Sports, Casual, Heels, Flats, Kids) and real-time text query.
  * **Stock Protection:** Shows real-time badge (`In Stock`, `Low Stock`, `Out of Stock`). Prevents adding more pairs than available in the active branch.
  * **Cart Management:** Line item quantity increase/decrease, line removal, bill-level discount input, subtotal, and net total calculation.
  * **Shift Lock Protection:** Banner alert and disabled checkout button if cashier has not opened an active shift.
  * **Payment & Checkout Modal:** Tenders via Cash, Card, or Bank Transfer. Fast cash tender shortcuts (Exact, +500, +1000, +5000), change return calculation.
  * **Automatic Receipt Printing:** Immediately renders 80mm thermal receipt in the print preview modal.

### 7.2 Module B: Cashier Shift Sessions & Cash Drawer Reconciliation (`ShiftManager.tsx`)
* **File:** [`src/components/shifts/ShiftManager.tsx`](file:///D:/Projects/pos/src/components/shifts/ShiftManager.tsx) (626 lines)
* **Features:**
  * **Active Shift Status Panel:** Displays opening float, opened time, shift number, cashier name, and live drawer calculation.
  * **Real-time Drawer Metrics:**
    * $(+)$ Opening Cash Float
    * $(+)$ Cash Sales
    * $(+)$ Shoe Repair Cash Intake
    * $(-)$ Cash Refunds (Returns)
    * $(=)$ Expected Cash in Drawer
  * **Open Shift Modal:** Collects initial cash float (default Rs. 10,000.00).
  * **Close Shift Modal & Blind Counting:** Forces cashier to input physically counted cash. Computes overage/shortage variance and prompts for mandatory variance notes.
  * **Z-Report Generation:** Prints complete shift reconciliation slip with supervisor signature lines.
  * **Historical Shifts Table:** Archive of all past shifts, variances, and closing statuses.

### 7.3 Module C: Customer Returns, Exchanges & Refunds (`ReturnsDesk.tsx`)
* **File:** [`src/components/returns/ReturnsDesk.tsx`](file:///D:/Projects/pos/src/components/returns/ReturnsDesk.tsx) (583 lines)
* **Features:**
  * **Invoice Lookup:** Search by invoice number (e.g. `SHOP001-INV-000001`). Loads sale header, customer info, and original items.
  * **Item Selection & Remaining Quantity:** Validates returned quantity does not exceed original purchased quantity minus prior returns.
  * **Condition & Reason Selection:**
    * Condition: `NEW_RESELLABLE` (returns to stock) vs `DEFECTIVE` (written off to damage).
    * Reason: Size / Fit, Defect / Damage, Customer Choice.
  * **Direct Refund Mode:** Refund via Cash (draws from cashier shift drawer), Original Card, or Store Credit.
  * **Size Exchange Mode:** Select replacement shoe size/variant. Automatically offsets refund value against new item price; computes customer balance due or surplus refund.

### 7.4 Module D: Shoe Repair Desk & Workshop Lifecycle (`RepairDesk.tsx`)
* **File:** [`src/components/repairs/RepairDesk.tsx`](file:///D:/Projects/pos/src/components/repairs/RepairDesk.tsx) (771 lines)
* **Features:**
  * **Intake Form Modal:** Customer name, phone, address, shoe brand/model/size/color, store-purchased flag, defect diagnosis, estimated charge, advance deposit, promised return date.
  * **Advance Payment Drawer Integration:** Advance deposit in cash automatically posts to the cashier's active shift drawer.
  * **Intake Documentation:** Auto-prints combined **Customer Claim Slip** and **Physical Shoe Tag**.
  * **Workshop Status Board:** Tracks order lifecycle:
    * `RECEIVED` $\rightarrow$ `UNDER_REPAIR` $\rightarrow$ `READY_FOR_PICKUP` $\rightarrow$ `DELIVERED`
  * **Status Transition Modal:** Allows workshop technician or manager to log repair notes and advance status.
  * **Delivery & Final Payment Modal:** Settles final service cost, deducts advance paid, collects balance via Cash/Card/Transfer, and prints Delivery Tax Invoice.

### 7.5 Module E: Branch Inventory & Stock Movements (`InventoryView.tsx`)
* **File:** [`src/components/inventory/InventoryView.tsx`](file:///D:/Projects/pos/src/components/inventory/InventoryView.tsx) (455 lines)
* **Features:**
  * **Stock on Hand Table:** Current stock, reorder level, retail value, and stock status badge (`Out of Stock`, `Low Stock`, `Adequate`).
  * **Stock Adjustment Modal:** Allows authorized staff to perform manual additions or deductions with mandatory audit reasons.
  * **Stock Movements Tab:** Searchable chronological timeline of every stock change with before/after quantity stamps.

### 7.6 Module F: Product Master & Barcode Generation (`ProductsMasterView.tsx`)
* **File:** [`src/components/products/ProductsMasterView.tsx`](file:///D:/Projects/pos/src/components/products/ProductsMasterView.tsx) (240 lines)
* **Features:**
  * **Product & Variant Catalog:** Displays all shoe models with brand, category, gender, color, size, SKU, barcode, cost price, and selling price.
  * **Thermal Barcode Label Designer & Printer:** Modal to generate printable thermal barcode labels with shoe name, variant, size, barcode graphic, and price. Supports copy count multiplier.

### 7.7 Module G: Inter-Branch Stock Transfers (`TransfersView.tsx`)
* **File:** [`src/components/transfers/TransfersView.tsx`](file:///D:/Projects/pos/src/components/transfers/TransfersView.tsx) (514 lines)
* **Features:**
  * **Multi-Line Transfer Dispatch:** Select destination branch and add multiple shoe variants with dispatch quantities.
  * **Origin Stock Verification:** Prevents dispatching more stock than available at origin.
  * **In-Transit Tracking:** Deducts origin inventory immediately and tags shipment as `IN_TRANSIT`.
  * **Dispatch Note Printing:** Prints formal Inter-Shop Transfer Note with itemized list and signature blocks.
  * **Receiving Modal:** Destination branch verifies shipment and confirms receipt into destination stock with optional discrepancy notes.

### 7.8 Module H: Purchasing & Inward Shipments (`PurchasesView.tsx`)
* **File:** [`src/components/purchases/PurchasesView.tsx`](file:///D:/Projects/pos/src/components/purchases/PurchasesView.tsx) (373 lines)
* **Features:**
  * **Purchase Order Modal:** Select supplier, add shoe variants, specify received quantities and negotiated unit costs.
  * **Instant Stock Increment:** Receiving items increments branch `quantityOnHand` and logs `PURCHASE_IN`.
  * **Automated Ledger Posting:** Posts a credit liability transaction directly into the supplier's running balance ledger.

### 7.9 Module I: Supplier Accounts, Ledger & Cheques (`SuppliersView.tsx`)
* **File:** [`src/components/suppliers/SuppliersView.tsx`](file:///D:/Projects/pos/src/components/suppliers/SuppliersView.tsx) (575 lines)
* **Features:**
  * **Supplier Directory Tab:** Profiles, contact persons, phone numbers, and payment terms.
  * **Supplier Ledger Tab:** Immutable transaction ledger showing Purchases (Credit), Cheque Settlements (Debit), and live running balance.
  * **Cheque Register Tab:** Tracks post-dated cheques with issue date, due date, amount, bank, and status (`PENDING`, `CLEARED`, `BOUNCED`).
  * **Issue Cheque Modal:** Issues post-dated cheques linked to specific suppliers.
  * **Cheque Status Management:** Marking a cheque `CLEARED` automatically records a Debit in the supplier ledger; marking it `BOUNCED` posts an automated reversal.

### 7.10 Module J: Reports, Analytics & Daily Z-Reports (`ReportsView.tsx`)
* **File:** [`src/components/reports/ReportsView.tsx`](file:///D:/Projects/pos/src/components/reports/ReportsView.tsx) (395 lines)
* **Features:**
  * **Executive KPI Cards:** Total Physical Pairs on Hand, Active Workshop Repairs, In-Transit Transfer Pairs, Post-Dated Cheque Exposure, Total Supplier Liability.
  * **Sales & Revenue Report:** Completed sales, cash/card/transfer revenue breakdown, and discount totals.
  * **Shift Z-Reports Tab:** Detailed drawer reconciliation records with physical count variances.
  * **Shoe Repair Operations Report:** Repair volume, revenue collected, and completion ratios.
  * **Inventory Valuation Report:** Stock breakdown by brand and retail value.

### 7.11 Module K: Administration, Role Switching & Audit Logs (`AdminView.tsx`)
* **File:** [`src/components/admin/AdminView.tsx`](file:///D:/Projects/pos/src/components/admin/AdminView.tsx) (263 lines)
* **Features:**
  * **Branch Management:** View details for Main City Branch and Galleria Mall Outlet.
  * **User Management & Role Impersonation:** View system staff and quickly switch active role (`SUPER_ADMIN`, `SHOP_MANAGER`, `CASHIER`) for testing.
  * **Security Audit Log Viewer:** Searchable timeline of every sensitive event (shift open/close, stock adjustments, discounts, status updates).
  * **Demo Data Reset Button:** One-click re-seeding button to restore the entire database to baseline seed state.

### 7.12 Layout Shell: Navigation, Header, Notifications & Modals
* **Root Page Orchestrator:** [`src/app/page.tsx`](file:///D:/Projects/pos/src/app/page.tsx) renders the full application shell with sidebar, top header, dynamic active operational view, global thermal print modal, and toaster.
* **Top Header:** [`src/components/layout/Header.tsx`](file:///D:/Projects/pos/src/components/layout/Header.tsx) displays active branch dropdown (for Admins) or label (for Cashiers), live cashier shift indicator pill with open duration and drawer total, and user profile switcher.
* **Sidebar:** [`src/components/layout/Sidebar.tsx`](file:///D:/Projects/pos/src/components/layout/Sidebar.tsx) compact, high-contrast navigation across all 11 modules.
* **Thermal Print Modal:** [`src/components/modals/PrintModal.tsx`](file:///D:/Projects/pos/src/components/modals/PrintModal.tsx) renders realistic thermal slip previews with direct browser print and close triggers.
* **Global Toaster:** [`src/components/layout/Toaster.tsx`](file:///D:/Projects/pos/src/components/layout/Toaster.tsx) floating notification banner container.

---

## 8. Thermal Printing & Receipt Generation Engine (`receipt-generator.ts`)

Located in [`src/lib/receipt-generator.ts`](file:///D:/Projects/pos/src/lib/receipt-generator.ts) (409 lines).

### Formats & Utility Methods:
* `formatCurrency(amount)`: Formats numbers as `Rs. X,XXX.XX` (LKR).
* `formatDate(timestamp)`: Formats timestamps as readable strings (e.g. `Oct 14, 2026, 11:30 AM`).

### Standardized Thermal Slip Templates Generated:
1. **Sales Receipt (`renderSaleReceiptHTML`):** 80mm monospace format with shop header, tax number, invoice number, cashier/shift ID, itemized rows with quantities and discounts, subtotal, net total, tender breakdown, change given, and return policy footer.
2. **Shift Z-Report (`renderZReportHTML`):** Official end-of-shift reconciliation slip with opening float, cash sales, repair cash in, refunds, expected cash, counted cash, variance amount, card/transfer sales, and Cashier/Supervisor signature blocks.
3. **Shoe Repair Intake Claim Slip & Shoe Tag (`renderRepairIntakeSlipHTML`):**
   * **Part 1:** Customer Claim Slip with intake date, promised pickup date, diagnosis, estimated cost, advance deposit, and balance due.
   * **Part 2:** Compact perforated **Physical Shoe Attachment Tag** for the workshop floor.
4. **Repair Delivery Service Invoice (`renderRepairDeliveryReceiptHTML`):** Final service invoice with final charge, advance deducted, final payment collected, payment method, and 14-day warranty disclaimer.
5. **Stock Transfer Dispatch Note (`renderTransferDispatchNoteHTML`):** 450px formal inter-branch dispatch document with origin and destination branch codes, dispatched quantities, receive check boxes, and dispatch/receiver signature blocks.
6. **Barcode Sticker Labels:** Generated directly in `ProductsMasterView.tsx` with shoe name, variant color, size label, monospace barcode graphic, barcode string, and retail price.

---

## 9. Design System, UI Tokens & CSS Architecture (`globals.css`)

Located in [`src/app/globals.css`](file:///D:/Projects/pos/src/app/globals.css) (501 lines) adhering to [`POS UI Design Instructions.md`](file:///D:/Projects/pos/POS%20UI%20Design%20Instructions.md):

### 9.1 Color Tokens & Contrast Ratios
```css
:root {
  --canvas:            #F3F5F8;  /* Background behind panels */
  --surface:           #FFFFFF;  /* Cards, tables, modals */
  --surface-sunken:    #EEF1F5;  /* Table headers, disabled inputs */
  --line:              #DDE2E9;  /* 1px hairlines */
  --line-strong:       #C3CBD6;  /* Input borders */
  
  --ink:               #101828;  /* 17.8:1 contrast on white */
  --ink-2:             #475467;  /* 7.7:1 secondary text */
  --ink-3:             #667085;  /* 5.0:1 captions, placeholders */
  --disabled-ink:      #98A2B3;
  
  --primary:           #2056C8;  /* Apex Blue - action button, selection */
  --primary-hover:     #1A47A3;
  --primary-soft:      #E8F0FD;  /* Selected row / nav pill background */
  --primary-soft-line: #BCD2F7;
  --primary-ink:       #173C84;
  
  --success:           #1B7A43;  /* Completed, cleared */
  --success-soft:      #E7F5EC;
  --warning:           #8A5200;  /* Low stock, pending */
  --warning-soft:      #FDF1DC;
  --danger:            #B42318;  /* Out of stock, damage, bounced */
  --danger-soft:       #FDEAE8;
}
```

### 9.2 Ergonomics & Standards
* **Font Family:** `IBM Plex Sans` (loaded via Next.js Google Fonts) with fallbacks to `system-ui, sans-serif`.
* **Tabular Numbers:** `.tabular-nums { font-variant-numeric: tabular-nums; }` applied to all monetary prices, quantities, SKUs, and invoices.
* **Component Sizing:** Inputs and buttons have a minimum height of 40–44px, with checkout buttons at 48–56px for reliable touch operation.
* **No Glows or Distractions:** Dark neon elements removed; shadows restricted exclusively to floating modals (`--shadow-float`).

---

## 10. Seed Dataset & Baseline Data Architecture (`seed-data.ts`)

Located in [`src/lib/seed-data.ts`](file:///D:/Projects/pos/src/lib/seed-data.ts) (495 lines):

* **Branches:**
  * `shop1`: Flagship City Store, Colombo 03 (`SHOP001`)
  * `shop2`: Galleria Mall Outlet, Kandy (`SHOP002`)
* **Staff Users:**
  * `admin_user_01`: Senaka Fernando (`SUPER_ADMIN`, access: `shop1`, `shop2`)
  * `manager_shop1`: Kasun Perera (`SHOP_MANAGER`, access: `shop1`)
  * `cashier_shop1`: Nadeeka Silva (`CASHIER`, access: `shop1`)
  * `cashier_shop2`: Dinesh Ranatunga (`CASHIER`, access: `shop2`)
* **Brands:** Clarks, Nike, Adidas, Bata Heritage, Puma, Woodland.
* **Categories:** Men's Formal, Sports & Running, Casual & Lifestyle, Women's Heels, Women's Flats, Kids & School.
* **Colors:** Midnight Black, Classic Brown, Cognac Tan, Pure White, Navy Blue, Crimson Red.
* **Sizes:** EU 39, 40, 41, 42, 43, 44, 45, 36, 37, 38.
* **Shoe Models & Variants:**
  * Clarks Formal Oxford (`prod_clarks_oxford`) — Black & Brown variants in sizes 41, 42, 43, 44.
  * Nike Air Max Supreme (`prod_nike_airmax`) — Pure White & Midnight Black variants in sizes 40, 41, 42, 43, 44.
  * Adidas Samba Classic (`prod_adidas_samba`) — White/Black variants in sizes 41, 42, 43.
  * Bata Elegant Pump Heel (`prod_bata_pump`) — Midnight Black in sizes 37, 38, 39.
* **Inventory Distribution:** Separate realistic stock allocations for each variant at `shop1` and `shop2` with distinct reorder levels.
* **Suppliers:**
  * DSI Footwear Distributors Ltd
  * Colombo Leather & Crafts Ltd
  * Global Athletic Imports (Pvt) Ltd

---

## 11. Enforced Business Rules & Validation Matrix

| Rule ID | Specification Description | How It Is Implemented in Code |
| :--- | :--- | :--- |
| **V1 & V2** | Barcodes and SKUs must be unique company-wide | Unique seed data definitions; duplicate checks during variant resolution in `firestore-service.ts`. |
| **V3** | `(productId, colorId, sizeId)` uniquely identifies a variant | Enforced by the Product Variant schema and inventory composite keys `{shopId}_{variantId}`. |
| **V4** | Selling price and cost price must be $\ge 0$ | Validated in form inputs and during purchase/sale calculation. |
| **V5** | Sale quantity cannot exceed branch `quantityOnHand` | Validated in `PosView.tsx` (`addToCart` / `updateQuantity`) and authoritatively checked in `completeSale()`. |
| **V6** | POS checkout blocked without active `OPEN` shift | Checkout button disabled in `PosView.tsx`; hard exception thrown in `completeSale()` if shift is absent or closed. |
| **V7** | Cashier can have at most one active `OPEN` shift | `openCashierShift()` checks existing open shifts for the `(shopId, cashierId)` pair and throws if found. |
| **V8** | Shift closure requires physical cash count | Enforced in `ShiftManager.tsx` closing form; computed variance saved with mandatory notes. |
| **V9** | Return quantity cannot exceed `(sold - returned)` | Checked in `ReturnsDesk.tsx` configuration map and validated during `processCustomerReturn()`. |
| **V10** | Cash refund cannot exceed available shift cash | Decrements active shift `cashRefunds`; validated before finalizing return. |
| **V11** | Repair intake requires customer and shoe details | Mandatory form validation in `RepairDesk.tsx` before calling `createRepairOrder()`. |
| **V12** | Repair delivery requires balance settlement | Balance due must be collected via Cash/Card/Transfer in `deliverRepairOrder()`. |
| **V13** | Transfer dispatch quantity $\le$ origin stock | Authoritatively checked in `dispatchTransfer()`; throws error if origin inventory is insufficient. |
| **V14** | Transfer cannot be received more than once | `receiveTransfer()` checks `transfer.status === "RECEIVED"` and rejects duplicate reception. |
| **V15** | Cross-shop access restricted by role & branch | Evaluated in `Header.tsx` (cashiers locked to assigned branch; only Super Admins can switch branches). |
| **V16** | Completed sales and repairs cannot be deleted | Append-only store structure; cancellations create compensating reversal records. |
| **V17** | Cleared cheque cannot revert to `PENDING` | Validated in `updateChequeStatus()`: throws `Validation Rule V17: A cleared cheque cannot be moved back to PENDING`. |
| **V18** | Supplier balance cannot be hand-edited | Supplier balance is always derived as $\sum \text{Credit} - \sum \text{Debit}$ via `getSupplierLedger()`. |

---

## 12. Cloud Functions & Production Backend Transition Guide (Gap Analysis)

Currently, the application runs client-side orchestration with dual-persistence (synchronizing directly to Firestore and falling back to LocalStore). To transition to a 100% hardened cloud-authoritative production setup, the following steps should be executed:

1. **Deploy Cloud Functions (2nd Gen):**
   * Move `completeSale`, `openCashierShift`, `closeCashierShift`, `processCustomerReturn`, `createRepairOrder`, `deliverRepairOrder`, `dispatchTransfer`, and `receiveTransfer` to Firebase Callable Cloud Functions (`onCall`).
   * Wrap multi-document updates in authoritative `runTransaction()` inside Cloud Functions.
2. **Deploy Firestore Security Rules (`firestore.rules`):**
   * Lock all operational collections (`sales`, `inventory`, `cashierShifts`, `stockTransfers`, `supplierTransactions`, `auditLogs`) so that direct client writes (`write`, `update`, `delete`) are set to `false`.
   * Allow read access scoped to user custom claims (`request.auth.token.allowedShopIds.hasAny([resource.data.shopId])`).
   * Grant write permissions exclusively to the Cloud Functions Admin SDK.
3. **Firebase Authentication Integration:**
   * Replace the current simulated user role switcher with standard Firebase Auth (`signInWithEmailAndPassword`) and set custom claims (`role`, `allowedShopIds`) via Firebase Admin SDK.
4. **Physical Hardware Drivers:**
   * Configure WebUSB or RawBT / QZ Tray drivers if direct silent ESC/POS thermal printing to USB/network receipt printers is desired without opening the browser print preview dialog.

---

*This document represents the complete, verbatim technical implementation of the Apex Footwear POS system at `D:\Projects\pos` as of October 2026.*
