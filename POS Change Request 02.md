
# Change request 02 — client-reviewed changes

**Project:** Apex POS, outlets RightWay Shoes and Mega Shoes (`D:\Projects\pos`)
**Stack:** Next.js (App Router), React, TypeScript, Firebase / Firestore, Lucide icons
**Prepared as:** the specification for Antigravity (AI coding agent)
**Scope:** 12 client requests, sorted into 11 work packages (WP1 to WP11)

---

## 0. How to use this file

1. Save this file in the project root as `CHANGE-REQUEST-02.md`. If `CHANGE-REQUEST-01.md` is also in the root, keep both; Section 0.2 says which parts of 01 this file replaces.
2. Open Antigravity in **Planning mode**. Paste **Prompt 0** (Section 10). The agent must produce an implementation plan first and wait for approval.
3. Run the work packages in this order, one at a time, committing to Git after each: **WP1, WP2, WP3, WP4, WP5, WP6, WP7, WP8, WP9, WP10, WP11**.
4. After each package run `npm run lint`, `npm run build` and the unit tests. Check the acceptance tests for that package in the browser before moving on. "Done" must mean seen working.
5. Read `AGENTS.md` first if it exists and follow it.

### 0.1 Order and dependencies

| Package | Needs | Why |
|---|---|---|
| WP1 Roles and access | none | Every other package depends on the final role rules |
| WP2 Remove shifts | WP1 | Removes the shift gate before new features are built |
| WP3 Products and catalogue | WP1 | Product types (shoes and bags), editing, quick add, label editor |
| WP4 POS price and scan popup | WP2, WP3 | Uses quick add for unknown barcodes and the no-shift POS |
| WP5 Customers and credit sales | WP2, WP4 | New payment method and customer accounts |
| WP6 Stock check and branch transfers | WP1, WP3 | Central stock view and scan-driven transfer |
| WP7 Purchasing and suppliers | WP3, WP1 | Cashier purchasing, bags, size-run entry |
| WP8 Repair desk | WP2, WP3 | Bags, warranty, estimate; no shift |
| WP9 Employees, wages and leave | WP5 | Staff credit is recovered through payroll |
| WP10 Admin review inbox and report updates | WP4 to WP9 | Admin supervision of everything cashiers can now do |
| WP11 Verification | all | Regression and final report |

### 0.2 What this file replaces in Change Request 01

| Change Request 01 item | Status now |
|---|---|
| WP5 expected drawer cash formula | **Removed.** Shifts and the cash drawer no longer exist (WP2) |
| WP3 "scan adds to cart immediately" | **Changed.** A scan now opens a quick popup with an editable price (WP4). The hardware scan detection, camera scan and beeps stay |
| WP7 and WP8 sections on shifts, variance and Z-reports | **Removed.** Replaced by the Daily Cash Summary (WP2) |
| WP6 invoice visibility, WP7 daily reports, WP8 day-end status, WP1 demo removal, WP2 barcode and label printing | **Still apply** and must work together with this file |

---

## 1. Requirements sorted

### 1.1 The 12 requests and where they are handled

| # | Client request (short) | Handled in |
|---|---|---|
| 1 | Manual price at the POS counter, popup on scan, separate price per unit when quantity is more than one | WP4 |
| 2 | Scan a product and transfer it to the other branch; stock deducted and added; central stock count for both branches | WP6 |
| 3 | Cashier inventory checking privilege | WP6 |
| 4 | Cashiers can purchase from suppliers, add new suppliers, issue purchase bill, cash bill with receipt, issue cheque only (no cheque status or supplier status); admin records everything | WP7 |
| 5 | Product catalogue for cashiers | WP3 |
| 6 | Purchasing by colour, size, brand and type (shoes, slippers); bags too; search and filter | WP3 and WP7 |
| 7 | Repair desk: warranty for shoes and bags (free service), bags accepted, billing estimate option | WP8 |
| 8 | Super Admin has no POS, cash drawer, shifts or label printing; remove manager users; Super Admin can create users and managers later | WP1 |
| 9 | Edit all product attributes; label editing at print time; add a new product manually when a scanned product is unknown; different functions for cashiers and managers | WP3 and WP4 |
| 10 | Employees, monthly salary, daily wages deducted from salary, paysheet, leave and off days with approval | WP9 |
| 11 | Remove the open shift function | WP2 |
| 12 | Credit sales; payment methods cash, card, bank transfer and credit; staff take credit as cash or products | WP5 (linked to WP9) |

### 1.2 Conflicts in the requests and how they are resolved

| ID | Conflict | Resolution used in this file |
|---|---|---|
| C1 | Request 8 says shifts and cash drawer should not be shown to the Super Admin, request 11 removes the open shift entirely | **Shifts and the cash drawer are removed for everyone.** The Super Admin also has no POS counter |
| C2 | Request 4 says cashiers can issue a cheque, then says they cannot issue a cheque or check supplier status, then says a cashier "only needs to issue a cheque" | **Cashiers can create a cheque (issue only).** They cannot see the cheque register, cheque status, supplier ledger or balance, and cannot change a cheque's status. Only the Super Admin can |
| C3 | Change Request 01 added a scanner that adds to the cart immediately; request 1 wants a popup on scan | The popup is the new behaviour. Pressing Enter confirms with the default price, so it stays fast. A setting can switch the popup off |
| C4 | Earlier plan hid cost prices from cashiers; cashiers now purchase stock and must enter unit costs | Cashiers can **enter** unit cost on a purchase and see costs on the purchase bills **they** issued. They cannot see product master cost, valuation, supplier ledger or other people's purchases |
| C5 | Request 9: cashier or admin can edit all attributes, but cashier and manager functions should differ | Cashier: quick add and descriptive attributes. Manager (later) and Super Admin: also price, barcode/SKU on stocked items, cost, deactivate. See Section 2.3 |
| C6 | Credit sales need "part paid now, rest on credit" | A sale may have two payment parts: one paid part and one credit part. General split payment stays off |
| C7 | Removing shifts removes the drawer formula and Z-report | Replaced by an informational **Daily Cash Summary** per cashier per day (no opening float, no counting) |
| C8 | Remove all manager users, but the Super Admin must be able to create managers later | Manager users are removed from the seed and database; the **Shop Manager role and its permissions stay in the code** and can be created from Admin → Users |
| C9 | Staff credit (cash or products) and monthly salary are separate requests | One customer account ledger covers both; staff accounts link to an employee, and payroll can recover the outstanding amount |
| C10 | Invoice visibility is own-only for cashiers and managers (Change Request 01) | Unchanged. The exact-invoice-number lookup inside Returns and the warranty check in the Repair Desk stay allowed within the user's own branch and are audited |

### 1.3 Decisions made for the client (change in Settings or with the client if wrong)

| ID | Decision | Default |
|---|---|---|
| D1 | Quick branch transfer is **immediate** (stock leaves one branch and enters the other in one step). The existing dispatch and receive flow stays available | Immediate |
| D2 | Price override has no lower limit by default, but every override is recorded and reported; a floor can be set in Settings | No floor |
| D3 | Credit as cash (a cash advance to a customer or staff) is recorded by the Super Admin only | Super Admin only |
| D4 | Credit purchases from suppliers (pay later), bank transfer purchases and part payments are Super Admin only; cashiers use cash or cheque | As stated |
| D5 | Products, suppliers and purchases created by cashiers are marked **Needs review** until the Super Admin reviews them. They are usable immediately | On |
| D6 | Warranty periods are set in Settings per item type (shoes, bags); a warranty claim with no matching store invoice is allowed but flagged **Unverified** | Periods to be given by client |
| D7 | Unpaid leave does not change pay automatically until the client chooses a rule; a manual deduction line exists on the payslip | No automatic deduction |
| D8 | Return approvals are off by default (no managers); returns are flagged for Super Admin review instead | Off |
| D9 | Employee records are separate from system users; an employee may optionally link to a cashier account | Optional link |

---

## 2. Roles and access

### 2.1 Roles after this change

| Role | Status |
|---|---|
| `SUPER_ADMIN` | Active. Oversight and management of everything; **no POS, no shifts, no label printing** |
| `CASHIER` | Active. Runs the counter and many day-to-day functions |
| `SHOP_MANAGER` | **Kept in the code and permissions, no users exist.** The Super Admin can create managers later from Admin → Users |

Seed users after this change: one Super Admin and the cashiers (RightWay Shoes and Mega Shoes). **No manager users.**

### 2.2 Modules each role sees

| Module (sidebar) | Super Admin | Cashier | Manager (when created) |
|---|---|---|---|
| POS Billing Counter | **Hidden** | Yes | Yes |
| Invoices | All invoices, both branches | Own invoices | Own invoices |
| Customers & Credit | Full | View, add, receive payment | Same as cashier |
| Returns & Exchanges | View, oversee | Yes | Yes |
| Repair Desk (shoes and bags) | View all, edit | Yes | Yes |
| Branch Transfers | All | Quick transfer and own-branch transfers | Same as cashier |
| Stock & Movements | Full (centralised, valuation, adjustments, movements) | **Stock check** (quantities, both branches, no cost) | Stock check plus own-branch movements |
| Product Catalog | Full editor (no label printing) | View, quick add, edit attributes, print and edit labels | Full editor and labels |
| Purchasing & Inward | All purchases, all details | Create purchase (cash bill or cheque issue); own bills only | Same as cashier |
| Suppliers & Cheques | Full | **Hidden** (new supplier can be added inside Purchasing) | Hidden |
| Employees & Payroll | Full | Hidden | Hidden |
| Reports, Daily Sales, Day-end Status | Full | "My sales" and "My day summary" only | Same as cashier |
| Review Inbox | Full | Hidden | Hidden |
| Admin & Settings | Full (users, branches, settings, audit) | Hidden | Hidden |
| **Cash Drawer & Shifts** | **Removed for everyone** | **Removed** | **Removed** |

### 2.3 Action matrix for the new and changed functions

Legend: **A** Super Admin, **C** Cashier, **M** Manager (when created). A dash means not allowed.

| Area | Action | A | C | M |
|---|---|---|---|---|
| POS | Use the counter and complete sales | — | ✔ | ✔ |
| | Override a line price, set a different price per unit | — | ✔ | ✔ |
| | Sell on credit to a registered customer | — | ✔ | ✔ |
| Customers | View customers and balances, add a customer | ✔ | ✔ | ✔ |
| | Receive a payment on account | ✔ | ✔ | ✔ |
| | Edit customer, set credit limit, adjust or write off a balance | ✔ | — | — |
| | Record a cash advance (credit as cash) | ✔ | — | — |
| Products | View and search the catalogue | ✔ | ✔ | ✔ |
| | **Quick add** a new product with variants and starting quantity | ✔ | ✔ | ✔ |
| | **Full product editor** (all fields, bulk variants, images) | ✔ | — | ✔ |
| | Edit descriptive attributes: name, brand, type, category, colour, size, gender, material, description, label name | ✔ | ✔ | ✔ |
| | Edit master selling price | ✔ | — | ✔ |
| | Edit cost price | ✔ | — | — |
| | Edit barcode or SKU of a variant that has stock or sales | ✔ | — | ✔ |
| | Set barcode on a new variant, or a variant with no stock and no sales | ✔ | ✔ | ✔ |
| | Deactivate or reactivate | ✔ | — | ✔ |
| | Add a brand, colour, size or category while adding a product | ✔ | ✔ (flagged) | ✔ |
| | Rename, merge or deactivate master values | ✔ | — | — |
| | Print and edit labels | — | ✔ | ✔ |
| Inventory | Check stock, both branches, quantities only | ✔ | ✔ | ✔ |
| | See cost, valuation, movement history, adjust stock | ✔ | — | movements own branch |
| Transfers | Quick transfer by scan, from own branch to the other | ✔ (either) | ✔ | ✔ |
| | Existing dispatch and receive flow | ✔ | own branch | own branch |
| Purchasing | Create a purchase paid by cash (print cash bill) | ✔ | ✔ | ✔ |
| | Issue a cheque for a purchase (create only) | ✔ | ✔ | ✔ |
| | Credit, bank transfer or part-paid purchase | ✔ | — | — |
| | Add a new supplier (name, phone, optional details) | ✔ | ✔ | ✔ |
| | See supplier list (name and phone only) | ✔ | ✔ | ✔ |
| | See supplier ledger, balance, payments, cheque register, change cheque status | ✔ | — | — |
| | View purchase bills | all | own | own |
| Repairs | Receive, update, deliver, set warranty and estimate | ✔ | ✔ | ✔ |
| | Edit price after intake, cancel a repair | ✔ | — | — |
| Employees | Everything in WP9 | ✔ | — | — |
| Users | Create, edit, disable, reset password for cashiers and managers | ✔ | — | — |

---

## 3. Ground rules for the agent (every work package)

1. **Do not change business logic that is not mentioned in this file** (stock rules, returns maths, supplier ledger maths, cheque rules). Do not rename existing functions or break stored data.
2. **Keep the accepted UI design** (blue and white tokens in `globals.css`, IBM Plex Sans, 44 px touch targets). New screens reuse existing components. No new colours.
3. **No internal terms in the UI:** no rule numbers, "demo", "phase", document IDs.
4. **One permission module.** Create `src/lib/permissions.ts` with permission keys, the role-to-permission map from Section 2.3, and helpers. The UI (`Can` component and `usePermission`) and the data functions both read it. Every restriction is enforced in the **data-access functions** as well as the UI. If Firestore security rules exist in the repository, update them to match.
5. **Audit everything new.** Every create, edit, price override, transfer, purchase, cheque, credit, payroll and leave action writes an audit entry with user, branch, before and after.
6. **No hard deletes** of sales, purchases, cheques, payments, payroll or leave records. Use statuses and reversals.
7. **Time zone:** all dates, days and months use **Asia/Colombo**.
8. **Responsive:** every new screen works at 1280, 1024, 768 and 390 px with no horizontal page scroll; phone layouts use cards, full-screen sheets and 16 px inputs; modals become full-screen sheets on phones.
9. **Printing:** black on white, exact page sizes in millimetres, zero margins, isolated print document, barcodes always inside the label (Change Request 01 WP2).
10. **Existing data is kept.** Add new fields with safe defaults (Section 8) and never require a manual data fix. Historical shifts, sales and repairs must still display correctly.
11. **Tests:** add Vitest unit tests for the pure logic named in each package (price splitting, credit balance, payroll maths, permission matrix, transfer stock maths, warranty check).
12. Run `npm run lint` and `npm run build` after each package. Report files changed, what was tested and anything not done.

---
## 4. Data model changes (summary)

All new fields have safe defaults so existing records keep working (Section 8).

| Collection or type | Change |
|---|---|
| `users` | Roles stay `SUPER_ADMIN`, `CASHIER`, `SHOP_MANAGER`. Add `mustChangePassword`, `linkedEmployeeId?`, `hidden?` (for retired managers who have history) |
| `categories` | Add `productType`: `FOOTWEAR` or `BAG` |
| `sizes` | Add `productType`, and `system`: `EU`, `UK`, `US`, `NONE` (bag sizes such as Small, Medium, Large, 20 inch) |
| `products` | Add `productType` (default `FOOTWEAR`), `material?`, `labelName?`, `reviewStatus` (`OK` or `NEEDS_REVIEW`), `createdBy` |
| `productVariants` | Add `attributes?` (free key-value, for example capacity), `reviewStatus`. Cost stays in a restricted field or collection |
| `sales` | Add `customerId?`, `amountPaid`, `balanceDue`, `paymentStatus` (`PAID`, `PARTIALLY_PAID`, `CREDIT`). `payments[].method` adds `CREDIT`. `shiftId` becomes optional legacy |
| `saleItems` | Add `listPrice`, `priceOverridden`, `overrideReason?`. `unitSellingPrice` is the price actually charged |
| `customers` (new) | `name`, `phone`, `type` (`REGULAR` or `STAFF`), `employeeId?`, `address?`, `creditLimit?`, `notes?`, `active`, `createdBy`, `createdAt` |
| `customerLedger` (new) | Append-only entries: `customerId`, `type`, `amount`, `direction`, `saleId?`, `referenceNumber`, `method?`, `note?`, `createdBy`, `createdAt` |
| `stockTransfers` | Add `mode` (`QUICK` or `FORMAL`), `createdBy`. Quick transfers are stored as completed in one step (status `RECEIVED`) |
| `suppliers` | Add `createdBy`, `reviewStatus`. Cashiers can create; only Super Admin edits |
| `purchases` | Add `paymentMethod` (`CASH`, `CHEQUE`, `CREDIT`, `BANK_TRANSFER`), `paymentStatus`, `issuedBy`, `reviewStatus`, `supplierBillNo?`; items carry `productType` |
| `cheques` | Add `purchaseId?`, `issuedBy`. Visible to Super Admin only |
| `repairs` (`ShoeRepairOrder`) | Add `itemType` (`FOOTWEAR` or `BAG`), `itemSubType`, generic `brand`, `model`, `sizeOrDimension`, `color` (keep old shoe fields and write both for now), `warranty` object, `estimateProvided`. `intakeShiftId` and `deliveryShiftId` become optional legacy |
| `employees` (new) | `name`, `phone`, `designation`, `branchId`, `joinDate`, `status`, `monthlySalary`, `dailyWageDefault?`, `userId?`, `notes?` |
| `salaryHistory` (new) | `employeeId`, `monthlySalary`, `effectiveFrom` |
| `employeePayments` (new) | `employeeId`, `month`, `type` (`DAILY_WAGE`, `SALARY_PAYMENT`), `amount`, `date`, `method`, `note`, `createdBy`, `reversalOfId?` |
| `leaveRecords` (new) | `employeeId`, `type`, `fromDate`, `toDate`, `days`, `status`, `requestedBy`, `decidedBy`, `reason`, `note` |
| `payrollMonths` (new) | `employeeId`, `month`, `status` (`OPEN`, `FINALISED`, `PAID`), frozen figures at finalisation |
| `settings` | New values listed in Section 6 |
| `cashierShifts` | **No longer used by the app.** Existing documents stay in the database, untouched |

---

## 5. Work packages

### 5.1 WP1. Roles, users and access

**Goal:** only a Super Admin and cashiers exist today; the Super Admin has no counter; managers can be created later; the permission matrix in Section 2 is enforced everywhere.

**Requirements**
1. Create `src/lib/permissions.ts`: permission keys, the role map from Section 2.3, `can(user, permission, context)` and a `Can` component plus `usePermission` hook. Add a unit test that checks every row of Section 2.3 for all three roles.
2. **Sidebar and routing:** apply Section 2.2. The Super Admin must not see POS Billing Counter (or reach it by changing the view or the URL). The label print buttons and label editor are hidden for the Super Admin. Cashiers must not see Suppliers & Cheques, Employees & Payroll, Review Inbox, Reports (other than their own summary), or Admin & Settings.
3. **Data-layer guards:** `completeSale` refuses a Super Admin (error "The administrator account cannot make sales"). Every other restricted function checks `can()` and refuses with a friendly message, not only the UI.
4. **Remove manager users** from `seed-data.ts` and the database. Before deleting any user check whether it is referenced by sales, repairs, returns, transfers, purchases, audit logs or invoices. If referenced, set `active: false` and `hidden: true` (never shown in lists or pickers); if not referenced, delete.
5. **Keep the `SHOP_MANAGER` role** in types, permissions and guards. Do not seed any manager.
6. **Admin → Users screen:** list with name, role, branch, status, last sign-in. **Add user:** name, email or username, role (Cashier, Shop Manager; Super Admin only with an extra confirmation), branch (Cashier and Manager belong to exactly one branch), temporary password, "must change password at first sign-in". Edit name and branch, change role, disable and enable, reset password. Guards: cannot disable or demote yourself or the last active Super Admin; creating or changing accounts must run **on the server** (a Next.js route handler with the Firebase Admin SDK, or a Cloud Function, whichever the project already uses) after verifying the caller is a Super Admin; never give admin privileges to the browser; audit every change. If the project has no real sign-in yet, build the screen and service against the existing user store and state clearly in your report which security guarantees are missing.
7. **Branch handling:** a cashier sees their branch as plain text (no switcher). The Super Admin has the switcher: All branches, RightWay Shoes, Mega Shoes.

**Acceptance tests**
- R1: The Super Admin sidebar has no POS Billing Counter and no label print actions; opening the POS view directly is refused.
- R2: A cashier sees no Suppliers & Cheques, Employees & Payroll, Review Inbox or Admin & Settings.
- R3: No manager appears in Users, dropdowns, or seed data; historical invoices issued by a former manager still display.
- R4: The Super Admin creates a Shop Manager and a Cashier; both can sign in with the temporary password and are forced to change it.
- R5: The permissions unit test passes for all rows of Section 2.3.
- R6: Calling the sale function as Super Admin is refused at the data layer.
- R7: The last Super Admin cannot be disabled or demoted.

---

### 5.2 WP2. Remove shifts and the cash drawer

**Goal:** no open shift, close shift, cash drawer, float, Z-report or drawer reconciliation anywhere. Selling and every other function work without them.

**Remove or change**
1. Sidebar item **Cash Drawer & Shifts**, `ShiftManager.tsx`, the shift status pill in `Header.tsx`, the "Open shift" banners and locked states in the POS, `activeShift` and `refreshActiveShift` in `AppContext.tsx`.
2. In `firestore-service.ts`: remove the shift requirement from `completeSale`, `processCustomerReturn`, `createRepairOrder` and `deliverRepairOrder`; remove shift accumulation (`cashSales`, `cardSales`, `transferSales`, `cashRefunds`, `repairCashIn`, `cashPayouts`); remove `openCashierShift`, `closeCashierShift`, `getActiveShift` and `getShiftHistory`. Keep the `CashierShift` type and `shiftId` fields as optional legacy so old records still load.
3. Remove `renderZReportHTML`, the Shift Z-Reports tab in `ReportsView.tsx`, and any "expected drawer cash" calculation (including `computeExpectedDrawerCash` if Change Request 01 added it).
4. In Daily Sales and Day-end Status (Change Request 01) remove the shifts sections and the open-shift highlight. Their sales, credit, refund and invoice-number checks stay.
5. Never delete existing shift documents or audit rows. Old invoices that carry a `shiftId` must still display and print.

**Add: Daily Cash Summary (informational)**
- Super Admin: Reports → **Daily Cash**, per branch, per cashier, per day. Cashier: **My day summary** on the Invoices page (own transactions only).
- Lines: cash sales (cash tendered minus change given), cash received on account (credit payments paid in cash), repair cash collected, cash refunds (returns, exchanges, repair advances), cash paid for purchases (cash bills), cash advances given. **Net cash movement** = cash in − cash out.
- No float, no counting, no variance. A print layout (A4 and 80 mm). The Super Admin can pick any date or month.

**Acceptance tests**
- S1: A cashier signs in and sells immediately with no shift step anywhere.
- S2: Searching `src/` for `openCashierShift`, `closeCashierShift`, `activeShift`, `renderZReport` and "drawer" returns only legacy type definitions.
- S3: A return, a repair intake with a cash advance, and a repair delivery all work with no shift.
- S4: An old invoice that has a `shiftId` still opens and reprints.
- S5: Daily Cash for a day equals cash in minus cash out computed by hand for a test set of transactions.

---

### 5.3 WP3. Products, catalogue, editing, quick add and label editor

**Goal:** the shop sells shoes, slippers and bags. Any product can be edited by attribute. New products can be added at the counter. Labels can be edited at print time.

**3.1 Product types and taxonomy**
- Two types: `FOOTWEAR` and `BAG`. All existing products become `FOOTWEAR` (Section 8).
- Categories belong to a type. Keep the current footwear categories and add **Slippers & Sandals** if it does not exist. Add bag categories: **Luggage bags**, **School bags**, **Travel bags**, **Travel pouches**. The Super Admin can add more.
- Sizes belong to a type. Footwear sizes stay (EU with UK shown). Bag sizes are labels such as Small, Medium, Large, 20 inch, 24 inch, 28 inch.

**3.2 Attributes by type**

| Field | Footwear | Bag |
|---|---|---|
| Type | required | required |
| Brand | required | required |
| Name | required | required |
| Category | required | required |
| Gender | optional | optional |
| Colour | required (per variant) | required (per variant) |
| Size | required, EU with UK | required, bag size label |
| Material | optional | optional |
| Capacity or other detail | not used | optional variant attribute (for example 30 L) |
| Label name (short name for stickers) | optional | optional |
| Description | optional | optional |
| Selling price | required | required |
| Barcode and SKU | required, unique | required, unique |

**3.3 Catalogue screen (cashier and Super Admin)**
- Search by name, brand, SKU or barcode. Filters: type, category, brand, colour, size, gender, active, needs review, stock status.
- List (cards on phones) showing name, brand, type, colours and sizes available, price, stock per branch (quantity only for cashiers).
- Product detail with the variants table: colour, size, SKU, barcode, price, stock at each branch, status, and actions allowed for the role.

**3.4 Editing (rules from Section 2.3)**
- **Edit product:** name, brand, type, category, gender, material, description, label name.
- **Edit variant:** colour, size, price (Manager and Super Admin), barcode and SKU (rules in Section 2.3), attributes.
- **Add variants:** a colour × size grid to add several at once; skip combinations that already exist.
- **Rules:** (product, colour, size) stays unique; SKU and barcode unique across the company; editing colour, size or names updates cached strings on variants, but **old sale, purchase and movement records keep the text they were created with**; stock and history stay linked by id; changing a barcode that has stock or sales shows a warning that printed labels will no longer match; nothing is hard-deleted (deactivate); every edit is audited with before and after.
- Adding a new brand, colour, size or category from inside a product form is allowed for cashiers, with a duplicate check (ignore case and spaces, warn on similar names) and a `NEEDS_REVIEW` flag. Only the Super Admin renames, merges or deactivates these master values.

**3.5 Quick add (cashier, manager and Super Admin)**
A short form reachable from the Catalogue, from the POS (unknown barcode, WP4) and from Purchasing (WP7):
- Type, brand (search or add), name, category, colours and sizes (multi-select creates the variants), selling price (one price or per variant), barcode (scan into the field or **Generate** an internal barcode), starting quantity at the current branch (per variant), cost price **only** when opened from Purchasing.
- Result: product and variants created with `reviewStatus = NEEDS_REVIEW`; starting quantity creates inventory and an `ADJUSTMENT_IN` movement with reason "New product added at counter"; audit entry; the product is sellable immediately.
- The **full editor** (all fields, images, reorder level, cost, bulk variants) is for Manager and Super Admin only. Cashiers never see it.

**3.6 Label printing and editor (cashier and manager only; hidden for Super Admin)**
- "Print labels" opens a **Label editor**: choose variants and copies; label size preset (from `print-config.ts`); switches for outlet name, product name, colour, size, price, barcode bars and **barcode number**; editable text for the name line and one extra line (applies to this print only); optional "Save as this product's label name"; a live preview at exact millimetre size; Print.
- Offer "Print labels" after a quick add and after a purchase is received (using the received quantities).
- Print quality, fit and barcode rules follow Change Request 01 WP2 (vector barcode, number under the bars, nothing outside the label).

**3.7 Bulk tools (priority P2, Super Admin)**
CSV import and export of products and variants with a dry run that reports duplicates before anything is written.

**Acceptance tests**
- P1: A bag product with colour and bag-size variants can be created, found with the Bag filter, purchased, sold and labelled.
- P2: A cashier edits a product's colour, size, brand and category; the old invoices still show the old text; stock is unchanged.
- P3: A cashier cannot change the master selling price, cost, or the barcode of a variant with stock (control disabled and refused by the data function).
- P4: A cashier adds a brand that already exists with different capitalisation and is warned, not duplicated.
- P5: Quick add creates a product flagged for review with starting stock and a movement.
- P6: Duplicate barcode, SKU, or (product, colour, size) is refused with a clear message.
- P7: The label editor prints a label with bars and the barcode number inside the label; the name line can be edited for one print without changing the product.
- P8: The Super Admin sees no label print buttons anywhere.
- P9: Filtering by type, brand, colour and size narrows the list correctly on desktop and at 390 px width.

---

### 5.4 WP4. POS: manual price, price per unit, and the scan popup

**Goal:** every product has a fixed (catalogue) price but the cashier can set a different price for any product on the sale, including a different price for each pair when buying more than one. A scan opens a quick popup where the price can be edited.

**4.1 Cart model**
- A cart line is identified by **variant + unit price**. Quantity changes act on one line. If a line has quantity 3 and the cashier gives the three pairs different prices, the cart shows separate lines, each with its own price and quantity.
- Each line stores `listPrice` (catalogue price), `unitSellingPrice` (price charged), `priceOverridden`. The stored `SaleItem` keeps the existing one-price-per-line shape, so returns, refunds and reports keep working.

**4.2 Line price editor**
- Each cart line shows the catalogue price and an **Edit price** control (cart lines use the layout from Change Request 01 WP4).
- The editor is a modal (full-screen sheet on phones) showing product, colour, size, current quantity N, and the catalogue price clearly marked as the fixed price.
- If N = 1: one price field.
- If N > 1: a switch **Same price for all N pairs** or **Different price for each pair**. The second mode lists pair 1 to N with a price field each, all prefilled with the catalogue price, and shows the live total and the difference from the catalogue total.
- Validation: numbers only, greater than 0, two decimals; optional reason (Negotiated, Damaged item, Special customer, Other) which becomes mandatory only if the Settings switch is on.
- Applying the editor regroups the lines (equal prices merge into one line with a quantity).

**4.3 Scan popup**
- Any scan of a **known** product (hardware or camera) opens a compact popup (full-screen sheet on phones): product name, colour, size, stock at this branch, the **fixed price**, a **price field prefilled with it and selected**, a quantity stepper (default 1), the "Different price for each pair" switch when quantity is above 1, and the buttons **Add to sale** (Enter) and **Cancel** (Esc).
- Fast path: scan, then Enter adds one pair at the catalogue price. To change the price type it over the selected value, then Enter.
- Scans that arrive while the popup is open: the same variant adds 1 to the popup quantity; a different variant is queued and its popup opens next, with a small "N more waiting" label.
- Stock is checked inside the popup against stock minus what is already in the cart ("Only N in stock").
- Tapping a product tile in the catalogue keeps adding at the catalogue price (the line's Edit price control is available).
- Settings: `scanPriceDialog` (default on; off adds immediately at the catalogue price) and a per-device toggle in the POS header, "Ask price on scan".

**4.4 Unknown barcode**
A scan that matches no product opens a popup "No product found for this barcode" with: **Add as new product** (opens Quick add from WP3 with the barcode prefilled; on save it flows into the price popup and the cart), **Link to an existing product** (search a variant that has no barcode and assign this one, if the role may), and Cancel. The failure beep from Change Request 01 plays.

**4.5 Control and reporting**
- Every overridden line is audited (`PRICE_OVERRIDE`: user, branch, product, catalogue price, price charged, reason).
- Optional floor in Settings: `priceFloorMode` (`NONE`, `PERCENT_OF_LIST`, `COST`) and `priceFloorValue`. When set, `completeSale` enforces it on the server side of the data layer (the cashier never sees cost; the message is "This price is too low"). Default: none.
- Daily Sales and Review Inbox list overrides (count, total below and above catalogue, by cashier).
- Bill-level discount keeps working on the total of the lines after overrides.
- Returns refund the price actually charged.
- Customer-facing receipts show the price charged and no override wording.

**Acceptance tests**
- X1: Scan a product, press Enter: one pair is added at the catalogue price.
- X2: Scan, type 17,500, press Enter: the line shows 17,500 and is marked overridden in the saved sale.
- X3: Quantity 3: set pair prices 18,900, 18,000 and 17,500: the cart shows three lines and the total is the sum.
- X4: Two pairs with "same price" 18,000 merge into one line with quantity 2.
- X5: Two quick scans of the same variant while the popup is open give quantity 2 in the popup.
- X6: A scan of an unknown barcode offers Add as new product; after saving, the new product reaches the cart at the entered price.
- X7: With the floor set to 90% of list, a cashier entering 80% is refused; with no floor it is accepted and appears in the override report.
- X8: A return of a line sold at an overridden price refunds that price.
- X9: With `scanPriceDialog` off, a scan adds immediately.
- X10: The popup and price editor work on a phone with the on-screen keyboard (fields visible, 16 px text).

---

### 5.5 WP5. Customers and credit sales

**Goal:** the POS accepts Cash, Card, Bank transfer and **Credit**. Credit sales are tracked per customer, can be part paid, and can be collected later. Staff can take credit as products or cash.

**5.1 Customers**
- New **Customers & Credit** module: list with search (name, phone), balance, type (Regular or Staff), status.
- Quick add inside the POS payment panel: name and phone. Staff customers are linked to an employee (WP9) and are created by the Super Admin or automatically when an employee is created.
- Fields and rules in Section 4. Phone is unique when entered.

**5.2 Credit at the POS**
1. The payment panel offers Cash, Card, Bank transfer, Credit (and Other if it exists today).
2. Choosing **Credit** requires a customer (search or add). The panel shows the customer's current balance and credit limit.
3. **Paid now** (optional, default 0) with its method (cash, card, bank transfer); the credit part is the rest and updates live.
4. If the customer has a credit limit and balance plus the credit part would exceed it, the sale is blocked with "Credit limit reached". Only the Super Admin changes limits.
5. `payments` holds at most two entries in this case: the paid part (if any) and one `CREDIT` entry. Other combinations stay unavailable.
6. The sale stores `customerId`, `amountPaid`, `balanceDue` and `paymentStatus` (`PAID`, `PARTIALLY_PAID`, `CREDIT`). A ledger entry `CREDIT_SALE` is written in the same operation.

**5.3 Customer ledger**
Append-only entries: `CREDIT_SALE` (increases), `CASH_ADVANCE` (increases), `PAYMENT_RECEIVED` (decreases), `RETURN_ADJUSTMENT` (decreases), `SALARY_RECOVERY` (decreases), `ADJUSTMENT` and `WRITE_OFF` (Super Admin only). Balance is always **derived** from the entries, never edited. Corrections are new entries.

**5.4 Receiving payments**
- Customer account page: balance, aged breakdown, ledger table, credit invoices list, **Receive payment**.
- Receive payment: amount, method (cash, card, bank transfer), reference, note. The amount is applied to the **oldest unpaid credit invoices first**, updating each invoice's `amountPaid`, `balanceDue` and `paymentStatus`. A receipt prints, showing the invoices settled.
- Cashiers and the Super Admin can receive payments.

**5.5 Cash advance (credit as cash)**
Super Admin only: choose a customer (usually Staff), amount, date and note. It writes `CASH_ADVANCE` and a printable voucher, and counts as cash out in the Daily Cash Summary. (Decision D3.)

**5.6 Returns on credit invoices**
If the returned invoice still has a balance due, the refund first **reduces the unpaid balance** (a `RETURN_ADJUSTMENT` ledger entry and the invoice balance), and only the remainder is refunded in the normal way. Exchanges follow the same rule.

**5.7 Invoices and reports**
- Invoices show a payment status badge (Paid, Part paid, Credit) and can be filtered by it. A credit invoice prints "CREDIT SALE", the customer name and phone, the balance due and a signature line.
- Daily Sales and Day-end Status: takings lines for Cash, Card, Bank transfer and **Credit (not collected)**, plus a separate **Payments received on account**.
- New report **Outstanding credit**: by customer with age bands (0 to 30, 31 to 60, 61 to 90, over 90 days), staff credits marked, printable; customer statement print.

**Acceptance tests**
- C1: A credit sale with no customer is refused; with a customer it creates a `CREDIT` payment and a ledger entry.
- C2: A sale of 20,000 with 5,000 paid now in cash and the rest on credit gives `PARTIALLY_PAID`, balance 15,000.
- C3: Receiving 10,000 settles the oldest credit invoice first and updates its status; the receipt lists the invoices.
- C4: A credit limit stops a sale that would exceed it.
- C5: Returning goods from a credit invoice reduces the balance before refunding cash.
- C6: A cashier cannot record a cash advance, adjust or write off a balance; the Super Admin can.
- C7: The customer's balance equals the sum of ledger entries after a mixed sequence of actions.
- C8: Reports show Credit (not collected) and Payments received on account separately, and the Outstanding credit report matches the ledger.

---
### 5.6 WP6. Stock check for cashiers, central stock and branch transfers

**Goal:** cashiers can check stock in both branches; the Super Admin sees one centralised stock view; a product can be scanned and moved to the other branch, deducting from one and adding to the other.

**6.1 Stock check (cashier)**
- **Stock & Movements** opens as **Stock check** for cashiers: search (name, brand, SKU, barcode), the same filters as the catalogue, results showing product, colour, size, quantity at **this branch**, quantity at **the other branch**, and a stock badge. No cost, no value, no movement history, no adjustment. Scanning a barcode here shows the result without any popup. Cards on phones.
- In the POS search results, an item with no stock here shows "Other branch: N".

**6.2 Central stock (Super Admin)**
- One table, one row per variant: RightWay Shoes, Mega Shoes, **Total**, reorder level, value (Super Admin only). Filters by type, brand, category, colour, size, stock status. Summary cards: total units per branch and in total. CSV export. Existing adjustments and movement history stay Super Admin only.

**6.3 Quick transfer (scan to transfer)**
- **Branch Transfers → Quick transfer.** Header: **From** (the user's branch; fixed for cashiers) → **To** (the other branch). The Super Admin may choose either direction.
- The scan field is always focused; hardware scans and phone camera scans (Change Request 01 hook) add the variant to the list, or add 1 if already listed. Manual search is also available. Unknown barcode: "No product found for this barcode". Each line has a quantity stepper (cannot exceed stock at the source) and a remove button. Optional note.
- **Transfer now** opens a confirmation ("RightWay Shoes to Mega Shoes: N items, M units"). On confirm, in **one atomic operation**: stock is deducted at the source, added at the destination (creating the destination inventory record if it does not exist), a `TRANSFER_OUT` and a `TRANSFER_IN` movement are written for every line, a transfer record is stored with `mode = QUICK`, status `RECEIVED`, dispatched and received quantities equal, a transfer number from the existing sequence, and an audit entry. Stock is re-checked inside the operation; a duplicate click does nothing (idempotency key).
- A transfer note prints (the existing dispatch note layout, marked "Completed transfer").
- Transfers never change the combined total of both branches. Add a unit test that checks `source + destination` before and after.
- The existing dispatch and receive flow stays available under a **Formal transfers** tab with its current behaviour. Cashiers can use it for their own branch only.
- History: cashiers see transfers involving their branch; the Super Admin sees all, with filters.

**Acceptance tests**
- T1: A cashier at RightWay scans three different products, sets quantities, transfers to Mega Shoes: source stock falls, destination stock rises by the same amounts, and the central view shows an unchanged total.
- T2: A quantity above source stock cannot be entered or submitted.
- T3: Submitting twice (double click) creates one transfer.
- T4: A transfer of a variant that has no inventory record at the destination creates it.
- T5: A cashier can open Stock check, sees both branches' quantities, and sees no cost, value, movements or adjust action.
- T6: The Super Admin's central stock total equals the sum of both branches; CSV matches.
- T7: Quick transfer works on a phone with camera scan.

---

### 5.7 WP7. Purchasing and suppliers for cashiers (shoes, slippers and bags)

**Goal:** cashiers can buy new stock from suppliers, add a new supplier, and issue a cash bill (with a printed receipt) or a cheque. They cannot see supplier status, ledger or cheque status. The Super Admin sees and records everything.

**7.1 Screens**
- **Cashier:** New purchase, My purchases (own bills only, with reprint).
- **Super Admin:** New purchase (any branch), All purchases with filters (branch, supplier, date, issued by, payment method, review status), purchase detail, Mark reviewed. Supplier ledger, balances, payments and the cheque register stay in **Suppliers & Cheques** (Super Admin only).

**7.2 Supplier selection and quick add**
- Supplier picker with search (name, phone). Cashiers see supplier **name and phone only**.
- **Add new supplier** (cashier, manager, Super Admin): name and phone required; contact person and address optional. Duplicate check on name and phone (ignore case and spaces). New suppliers are flagged `NEEDS_REVIEW`. Only the Super Admin edits or deactivates suppliers.

**7.3 Adding goods**
- **Product picker** with search (name, brand, SKU, barcode, camera or hardware scan) and filters: **type** (Footwear, Bags, All), category (shoes, slippers and sandals, luggage bags, school bags, travel bags, travel pouches and others), brand, colour, size, gender.
- **Size-run grid:** after choosing a product, a grid with colours as rows and sizes as columns; type a quantity in each cell; one unit cost for the whole product by default, with an option for a cost per colour. Works for shoes (EU sizes) and bags (bag size labels).
- **Single-line mode** for a single variant, and scan-to-add (each scan adds 1).
- **Product not in the catalogue:** "Add new product" opens Quick add (WP3) with the cost field shown. Cashiers cannot change the master selling price of an existing product from here.
- Lines table: description (type, brand, name, colour, size), quantity, unit cost, line total, remove. Header fields: supplier, supplier bill number (optional), date (cashiers: today; Super Admin: any date), branch (cashier: own; Super Admin: choose), notes.
- Warning (not a block) when a unit cost differs from the previous purchase by more than the percentage in Settings (default 25%); the purchase is flagged for review. The warning does not display the previous cost.

**7.4 Payment and bills**

| Role | Allowed | What happens |
|---|---|---|
| Cashier | **Cash** | Purchase is paid in cash now. A **purchase cash bill** prints (80 mm; A4 optional): branch, bill number, date, supplier, item table, total, "Paid in cash", issued by, receiver signature line. Supplier ledger gets the purchase and the cash payment |
| Cashier | **Cheque (issue only)** | Fields: cheque number, bank, cheque date (may be post-dated), amount (equals the bill total). A cheque is created as `PENDING` and linked to the purchase; the supplier ledger records the purchase; the existing rule that clearing posts the payment stays. The bill prints with the cheque details; a cheque voucher can be printed. The cashier sees only a confirmation. No cheque list, no status, no supplier balance |
| Super Admin | Cash, cheque, **credit** (pay later), **bank transfer**, **part payment** | Existing behaviour for credit; same bills |

- Stock is increased at the purchase branch (`PURCHASE_IN` movements) when the bill is saved. Each line keeps its own unit cost permanently.
- After saving: **Print labels for received items** (WP3 label editor, cashier only) and **Print bill**.
- A duplicate cheque number is refused with "This cheque number is already used" without showing other cheque details.
- Cashiers cannot cancel a purchase; the Super Admin can (existing rule: refuse if it would make stock negative).
- All purchases created by cashiers are flagged for review (Section 5.10). Every purchase, supplier and cheque action is audited.

**Acceptance tests**
- U1: A cashier adds a new supplier; a duplicate name or phone is blocked.
- U2: A cashier buys a shoe size run (two colours, five sizes) in one grid and a bag product in another; stock rises at the cashier's branch by the entered quantities.
- U3: Filtering the picker by type Bags, brand and colour narrows the products correctly.
- U4: A cash purchase prints a cash bill and the supplier ledger shows purchase and payment; the cashier cannot open the ledger.
- U5: A cashier issues a cheque for a purchase; the cheque exists as pending and linked; the cashier has no way to see its status or any cheque list; the Super Admin sees it and can clear it (existing rules).
- U6: A cashier cannot choose credit, bank transfer or part payment, and the data function refuses them.
- U7: A cashier's My purchases lists only their own bills and allows reprint (marked duplicate).
- U8: The Super Admin's All purchases shows every purchase with issuer, costs and payment method, and can mark one reviewed.
- U9: A product missing from the catalogue can be added during purchasing and appears on the bill.
- U10: The purchase screen works at 390 px width (grid scrolls inside its own container, sticky totals and Save).

---

### 5.8 WP8. Repair desk: bags, warranty and billing estimate

**Goal:** the repair desk accepts shoes, slippers and bags (luggage, school bags, travel bags, travel pouches). A warranty option makes the service free. A billing estimate is optional. No shift.

**8.1 Intake form changes**
- Rename the module **Repair Desk** (shoes and bags).
- **Item type** Footwear or Bag; **sub-type**: Footwear (Shoe, Slipper or sandal, Boot, Other), Bag (Luggage bag, School bag, Travel bag, Travel pouch, Other).
- Fields: brand, model or name, colour, size (footwear) or size and dimension (bag), issue description with quick-pick chips (footwear: sole, heel, stitching, zip, glue; bag: zip, handle or strap, wheel, lock, stitching) plus free text, customer name and phone, address optional, bought from this shop (existing), promised date.
- Keep the existing `shoeBrand`, `shoeModel`, `shoeSize`, `shoeColor` fields working: read both old and new fields, write both for now.

**8.2 Warranty option**
- Switch **Under warranty**. Two bases:
  - **Bought from this shop:** enter the invoice number. The system looks it up in the user's own branch (exact number; audited) and shows the purchase date and items, computes the warranty expiry from Settings (`warrantyMonthsFootwear`, `warrantyMonthsBag`), and shows **Verified**, **Expired**, or **Not found**. Expired leaves the switch off by default.
  - **Manual (no invoice):** enter a warranty card number or a note. The claim is saved as **Unverified** and listed in the Review Inbox.
- When warranty applies: the estimate and final cost are **0**, no advance is taken, no payment step appears at delivery, and the slip prints "WARRANTY CLAIM — NO CHARGE" with the basis, status and the coverage note from Settings. Only the Super Admin can later change a warranty repair to a paid one.
- Keep the existing 14-day repair workmanship note on the delivery invoice, labelled clearly as "Repair workmanship warranty" so it is not confused with the product warranty.

**8.3 Billing estimate option**
- Switch **Give a billing estimate** (on by default for paid repairs). On: estimated cost and optional advance as today. Off: the slip prints "Estimate to be advised" and the final cost is entered at completion.
- Warranty repairs hide the estimate fields.

**8.4 Printing**
- Claim slip and tag: item type, sub-type, warranty line, estimate line; the barcode uses the short scan code and stays **inside the tag** (Change Request 01 WP2). Delivery invoice: paid or "Warranty service — no charge".

**8.5 Reports**
Repair report adds item type (footwear or bag), warranty versus paid, and unverified warranties.

**Acceptance tests**
- W1: A school bag repair can be received, tagged, progressed and delivered.
- W2: With a valid store invoice inside the warranty period the claim shows Verified, the cost is 0, and no payment is requested at delivery.
- W3: An invoice outside the period shows Expired and the switch stays off.
- W4: A manual warranty is saved as Unverified and appears in the Review Inbox.
- W5: Turning the estimate off prints "Estimate to be advised" and allows a final cost at delivery.
- W6: Old repair records (before this change) still open and print.
- W7: The slip and tag print inside their labels for long repair numbers.
- W8: A cashier cannot convert a warranty repair to paid; the Super Admin can.

---

### 5.9 WP9. Employees, wages, payroll and leave (Super Admin only)

**Goal:** the Super Admin manages employees, gives daily wages that are deducted from a fixed monthly salary, prints payslips, and manages leave and off days.

**9.1 Employees**
- New module **Employees & Payroll**. List with name, designation, branch, monthly salary, status, and this month's wages paid.
- **Create employee:** name, phone, designation, branch, join date, **monthly fixed salary**, optional **default daily wage** (used to prefill daily wage entries), optional link to a cashier account, notes. A staff customer account is created and linked automatically (WP5) if the Super Admin chooses.
- **Edit salary:** a new `salaryHistory` row with an effective date; earlier months keep their old salary. Employees can be marked as left (with date); records are never deleted.
- Personal identity numbers are not collected unless the client asks (Section 9).

**9.2 Daily wages**
- **Give daily wage:** employee, date, amount (prefilled from the default), method (cash or bank), note. It writes a `DAILY_WAGE` payment.
- The employee page and the payroll sheet always show: **Monthly salary**, **Daily wages paid this month**, **Salary remaining**. A warning appears when a new wage would take total wages above the monthly salary.
- Mistakes are corrected with a reversal entry, never by deleting.

**9.3 Monthly payroll**
- **Payroll month sheet:** pick a month; one row per active employee with monthly salary, daily wages paid, staff credit outstanding, leave days (paid and unpaid), deductions, net payable, status (`OPEN`, `FINALISED`, `PAID`).
- **Calculation (one pure function with unit tests):**
  `Net payable = Monthly salary − Daily wages already paid − Staff credit recovery − Leave deduction − Other deductions`
  - Monthly salary is the amount effective for that month; if the employee joined or left during the month it is pro-rated by calendar days [decision, Section 9].
  - Staff credit recovery is chosen by the Super Admin (default: the smaller of the outstanding staff credit and the remaining pay). On finalising it writes `SALARY_RECOVERY` entries in the staff customer ledger.
  - Leave deduction follows Settings (default none; see D7). Other deductions are manual lines with a note.
  - If deductions exceed the salary, the net is shown as 0 with an "Overpaid by X" warning; the Super Admin adjusts the recovery or deductions; nothing carries forward automatically.
- **Finalise** freezes the figures. **Record salary payment** (date, method) writes `SALARY_PAYMENT` and sets the month `PAID`. Reopening a finalised month needs the Super Admin and a reason and writes reversals; every step is audited.
- **Print:** payslip per employee per month (A4): employee, branch, month, salary, a table of each daily wage (date and amount), deductions, net payable, payment date and method, leave summary, signature lines. Also a payroll summary for all employees.

**9.4 Leave and off days**
- Types: Annual, Sick, Casual, Unpaid, **Off day** (assigned rest day), Half day. Statuses: Requested, Approved, Rejected, Cancelled.
- The Super Admin can **assign** leave or an off day directly (saved as Approved) and **approve or reject** requests. A cashier who is linked to an employee can request leave from a small "My leave" page and see its status; no other payroll data is visible to cashiers.
- Views: month calendar per employee, a branch roster showing who is off each day (with a warning when nobody from a branch would be present), per-employee history with totals per type, and a printable leave summary.
- Overlapping leave for one employee is refused. Leave days are counted in 0.5 steps.
- Entitlements (for example 14 annual days) and balances are not part of this change unless the client asks.

**9.5 Staff credit link**
The employee page shows the staff credit balance and ledger (WP5): products taken on credit at the POS and cash advances recorded by the Super Admin.

**9.6 Security**
All payroll and leave collections are readable and writable only by the Super Admin, except a cashier's own leave requests. No hard deletes.

**Acceptance tests**
- E1: Create an employee with salary 60,000; give three daily wages of 1,500; the page shows wages paid 4,500 and remaining 55,500.
- E2: The payslip for that month shows each wage entry and net payable 55,500 when there are no other deductions.
- E3: With staff credit of 8,000 outstanding and recovery of 8,000, net payable is 47,500 and the customer ledger gains a `SALARY_RECOVERY` entry.
- E4: Wages above the salary produce the warning and "Overpaid" figure.
- E5: A salary change effective from the 1st of next month does not change this month's payslip.
- E6: Assigning an off day saves as Approved; a leave request from a linked cashier appears for approval and updates the calendar after approval.
- E7: Overlapping leave is refused; half days count as 0.5.
- E8: A finalised month cannot be edited without reopening; reopening needs a reason and is audited.
- E9: A cashier cannot open Employees & Payroll or read its data (UI and data layer).
- E10: Payroll maths unit tests pass for pro-rating, recovery capping and overpayment.

---

### 5.10 WP10. Super Admin review inbox and report updates

**Goal:** with managers removed and cashiers trusted with more, the Super Admin needs one place to review what cashiers did.

**10.1 Review Inbox (Super Admin only, badge count in the sidebar)**
Tabs with counts: New products, New suppliers, Purchases by cashiers, Cheques issued by cashiers, Price overrides, Quick transfers, Unverified warranties, Credit sales (and returns if approvals are off, decision D8).
Each row shows what, who, branch, when and a link to the detail or edit screen, with **Mark reviewed** (optional note, audited). Reviewing clears the flag. Price overrides can be filtered by size of the reduction.

**10.2 Report changes**

| Report | Change |
|---|---|
| Daily Sales and Daily report (Change Request 01) | No shifts; takings lines Cash, Card, Bank transfer, Credit (not collected); payments received on account; price overrides section; purchases paid in cash |
| Day-end Status | Invoice payment status counts (Paid, Part paid, Credit); credit totals; no shifts section |
| Daily Cash (new) | WP2 |
| Outstanding credit and customer statement (new) | WP5 |
| Stock by branch | WP6 |
| Transfers | Quick and formal, with filters |
| Purchases | By supplier, branch, issuer, payment method |
| Repairs | Type, warranty, unverified |
| Payroll summary and Leave summary | WP9 |

**Acceptance tests**
- V1: A cashier's new product, supplier, purchase and cheque each appear in the right tab and clear after Mark reviewed.
- V2: A price override appears in the Price overrides tab with product, list price, price charged and cashier.
- V3: A cashier cannot see the Review Inbox.
- V4: Report totals equal the sums of the underlying records for a seeded day.

---

### 5.11 WP11. Verification and regression

Run the verification script below at 1280, 1024, 768 and 390 px, run lint, build and all unit tests, and report. Regression areas that **must still work unchanged:** completing a sale (stock decrease, invoice number), returns and size exchanges, stock movement reconciliation, formal transfers, supplier ledger maths, cheque rules for the Super Admin, existing reports, barcode scanning and label printing (Change Request 01), invoice visibility (own versus all), daily sales and day-end pages.

| # | Check | Pass when |
|---|---|---|
| 1 | Sign in as the Super Admin | No POS, no shifts, no label print; Review Inbox, Employees, Reports, Admin visible |
| 2 | Sign in as a cashier | No shift step; sells straight away; no Suppliers & Cheques, Employees, Review Inbox, Admin |
| 3 | Scan a product, Enter | One pair at the catalogue price; scan, type a price, Enter: overridden price saved |
| 4 | Quantity 3 with three different prices | Three lines, correct total, correct receipt |
| 5 | Credit sale with part payment | Balance and status correct; receive payment settles oldest first |
| 6 | Quick transfer by scan | Stock moves and total unchanged |
| 7 | Cashier purchase (cash) | Cash bill printed, stock up, no ledger access |
| 8 | Cashier purchase (cheque) | Cheque issued; cashier cannot see status; Super Admin can |
| 9 | Add a new product from an unknown barcode in the POS | Product created flagged for review and added to the cart |
| 10 | Edit a product's colour and size | Old invoices unchanged; stock intact |
| 11 | Print a label with the editor | Bars and number inside the label; text edit applies to this print only |
| 12 | Repair a bag under warranty | Free, slip shows warranty, tag barcode inside the label |
| 13 | Payroll month | Wages deducted, payslip prints, leave visible |
| 14 | Review Inbox | Items appear and clear |
| 15 | All new screens at 390 px | No horizontal page scroll; actions reachable; 16 px inputs |
| 16 | Old data (invoice with `shiftId`, old repair, old product) | Opens, prints, edits |

Final report format: a table of every acceptance test ID (R1 to R7, S1 to S5, P1 to P9, X1 to X10, C1 to C8, T1 to T7, U1 to U10, W1 to W8, E1 to E10, V1 to V4) with PASS, FAIL or NOT TESTED and the evidence; the list of files changed; anything not completed; and every behaviour that changed beyond this file.

---

## 6. New settings (Admin & Settings, Super Admin only)

| Setting | Default |
|---|---|
| `scanPriceDialog` (popup on scan) | On |
| `allowCashierToggleScanDialog` | On |
| `requireOverrideReason` | Off |
| `priceFloorMode` and `priceFloorValue` | None |
| `defaultCreditLimit` (blank means none) | None |
| `creditDueDays` (blank means none) | None |
| `warrantyMonthsFootwear`, `warrantyMonthsBag`, `warrantyCoverageNote`, `requireInvoiceForWarranty` | Client to supply; invoice not required |
| `purchaseCostChangeWarningPercent` | 25 |
| `cashierPurchaseBackdateDays` | 0 |
| `unpaidLeaveDeductionMode` | None (manual) |
| `salaryProrationMode` | Calendar days |
| `returnApprovalMode` | Off |
| `reviewFlagsEnabled` (products, suppliers, purchases, cheques, overrides, transfers, warranty) | On |
| Label size presets, receipt width | Existing `print-config.ts` |

---

## 7. Printed documents (new or changed)

All black on white, millimetre-exact, isolated print document, reprints marked DUPLICATE and audited.

| Document | Change |
|---|---|
| Sales receipt and invoice | Credit sale (customer, balance due, signature line); price charged on each line |
| Purchase cash bill | New (80 mm and A4) |
| Cheque voucher | New (issued by cashier or Super Admin) |
| Customer payment receipt | New (shows invoices settled) |
| Cash advance voucher | New (Super Admin) |
| Transfer note | Quick transfers print as "Completed transfer" |
| Repair claim slip and tag | Item type, warranty, estimate; barcode inside the label |
| Repair delivery invoice | Warranty or paid; workmanship note labelled |
| Product labels | From the label editor; barcode and number inside the label |
| Payslip and payroll summary | New (A4) |
| Leave summary | New |
| Daily Cash Summary | New |
| Daily report and day-end status | Change Request 01, updated for credit and no shifts |

---

## 8. Migration and existing data

Write one idempotent migration script (`npm run migrate:cr02`) with a **dry-run** mode that reports what it would change. Take a backup or export before running it on any real data. Run it on a copy first.

| Data | Migration |
|---|---|
| Products, categories, sizes | `productType = FOOTWEAR` |
| Sales | `paymentStatus = PAID`, `amountPaid = total`, `balanceDue = 0`; cancelled sales keep their status |
| Sale items | `listPrice = unitSellingPrice`, `priceOverridden = false` |
| Purchases | `paymentMethod = CREDIT` (they were posted as credit), `paymentStatus` from existing balance, `reviewStatus = OK` |
| Transfers | `mode = FORMAL` |
| Repairs | `itemType = FOOTWEAR`, `estimateProvided = true`, no warranty; shift ids kept as legacy |
| Users | Remove manager users using the reference check in WP1 |
| Shifts | Leave untouched |
| Customers | Not auto-created; the first credit sale or the Super Admin creates them |

After migration, re-run the stock reconciliation (quantity on hand equals the sum of movements for every variant and branch) and report any mismatch.

---

## 9. Decisions to confirm with the client

Defaults in Section 6 let the work start. These must be answered before go-live.

| # | Question | Why it matters |
|---|---|---|
| 1 | Warranty period for shoes and for bags, and what it covers | Printed on slips; controls the Verified or Expired result |
| 2 | Should unpaid leave reduce pay, and how (salary divided by 30, or by working days)? | Payroll maths |
| 3 | Pro-rate salary for staff who join or leave during a month? | Payroll maths |
| 4 | Are statutory contributions or tax (for example EPF and ETF), allowances, bonus or overtime needed on payslips? | Not included in this change |
| 5 | Credit sales: credit limit per customer, due days, and may credit be given to anyone or registered customers only? | Credit controls |
| 6 | Who may give cash advances (credit as cash)? Currently the Super Admin only | Cash risk |
| 7 | May cashiers also buy on credit, bank transfer or part payment? Currently Super Admin only | Supplier liability control |
| 8 | Should there be a minimum price at the POS (floor)? | Prevents very low overrides |
| 9 | Quick transfer is immediate. Should the receiving branch confirm receipt? | Loss visibility |
| 10 | Should returns need approval by the Super Admin? Currently reviewed after the fact | Speed versus control |
| 11 | Should cashiers be able to back-date purchase bills? Currently no | Record accuracy |
| 12 | Should the Super Admin keep any stock adjustment tool only for themselves? Currently yes | Stock integrity |
| 13 | Label sizes and printer model; receipt printer width | Printing |
| 14 | Collect employee ID numbers or addresses? Currently not | Privacy |
| 15 | Should repair estimates be on by default? Currently yes for paid repairs | Counter speed |

---

## 10. Prompt 0 (paste first, in Planning mode)

```
You are working in the Next.js + TypeScript + Firebase POS project at D:\Projects\pos
(branches: RightWay Shoes and Mega Shoes). Read AGENTS.md if it exists, then read
CHANGE-REQUEST-02.md completely (and CHANGE-REQUEST-01.md if it exists; Section 0.2 of
file 02 says which parts of 01 are replaced). File 02 is the specification.

Do NOT edit any files yet. Produce an implementation plan as an artifact that:
1. Lists the files you expect to create or change for each work package WP1 to WP11, in
   the order WP1, WP2, WP3, WP4, WP5, WP6, WP7, WP8, WP9, WP10, WP11.
2. Shows where in the current code each of these lives today: roles and permission
   checks, the sidebar and view router, user management in AdminView, shifts and the
   shift gate (ShiftManager, Header pill, AppContext, completeSale, returns, repairs),
   the POS cart and scan input, product and variant types and ProductsMasterView, label
   printing, stock and transfer functions, purchasing and supplier functions, repair
   order functions and RepairDesk, sale and payment types, reports and the receipt
   generator.
3. Lists every question or ambiguity instead of guessing (for example label sizes).
4. Confirms you will follow the ground rules in Section 3: no unrequested logic changes,
   keep design tokens, one permission module enforced in the data layer, audit every new
   action, no hard deletes, Asia/Colombo time, responsive at 1280/1024/768/390 px,
   millimetre-exact black-and-white printing, keep existing data working, unit tests for
   pure logic.
5. Flags any place where the existing code security cannot be fully enforced client-side,
   so I know the remaining gap.

Wait for my approval of the plan. Then implement ONE work package at a time, run
`npm run lint`, `npm run build` and the unit tests after each, prove the acceptance tests
for that package in the running app with the browser tool, and stop for my confirmation
before starting the next package. Never mark a test PASS without evidence.
```

---

## 11. Prompts for each work package

Use after Prompt 0 is approved. Each assumes `CHANGE-REQUEST-02.md` is in the project root.

**WP1**
```
Implement WP1: create src/lib/permissions.ts from the Section 2.3 matrix with a Can
component, usePermission hook and a unit test for every matrix row. Hide POS Billing
Counter and label printing from the Super Admin and refuse completeSale for the Super
Admin in the data layer. Hide Suppliers & Cheques, Employees & Payroll, Review Inbox,
Reports and Admin from cashiers. Remove manager users from seed and database using the
reference check (delete if unreferenced, otherwise active:false and hidden:true) but keep
the SHOP_MANAGER role in code. Build Admin > Users to create, edit, disable and reset
Cashiers and Shop Managers with server-side account creation and the safety guards.
```

**WP2**
```
Implement WP2: remove shifts and the cash drawer everywhere as listed in Section 5.2
(sidebar item, ShiftManager, header pill, AppContext shift state, shift checks and totals
in completeSale, returns, repairs, Z-report template and tab, expected drawer cash). Keep
legacy types, documents and shiftId so old data still loads. Update Daily Sales and
Day-end Status to drop shift sections. Add the Daily Cash Summary (Super Admin by cashier
and day; cashiers see My day summary) with print.
```

**WP3**
```
Implement WP3: add FOOTWEAR and BAG product types, type-aware categories and sizes, seed
bag categories and Slippers & Sandals, the catalogue search and filters, product and
variant editing with the permission rules in Section 2.3, add-variants grid, cache refresh
that leaves old records unchanged, Quick add with review flags and starting stock
movement, inline add of brand/colour/size/category with duplicate checks, and the label
editor (cashier and manager only) with barcode number printing per Change Request 01 WP2.
```

**WP4**
```
Implement WP4 in the POS: cart lines keyed by variant and unit price with listPrice,
unitSellingPrice and priceOverridden; a line Edit price modal with same-price and
different-price-per-pair modes; the scan popup (price prefilled and selected, quantity,
Enter to add, Esc to cancel, queue for scans while open); unknown barcode popup with Add
as new product and Link to existing product; audit PRICE_OVERRIDE; optional price floor
enforced in completeSale; settings scanPriceDialog and a per-device toggle. Add unit tests
for line splitting and merging.
```

**WP5**
```
Implement WP5: add the Credit payment method, customers and customerLedger, the POS
credit flow with customer, paid-now part and credit limit, sale paymentStatus, amountPaid
and balanceDue, the Customers & Credit module with Receive payment applied to oldest
invoices first, Super Admin cash advance, credit-aware returns, invoice badges and
filters, credit receipts and the Outstanding credit report. Balance must always be derived
from ledger entries. Add unit tests for balance and allocation.
```

**WP6**
```
Implement WP6: Stock check for cashiers (both branches, quantities only), central stock
for the Super Admin, and Branch Transfers > Quick transfer with scan, atomic deduct and
add, TRANSFER_OUT and TRANSFER_IN movements, mode QUICK, idempotency and a printed
completed-transfer note. Keep the formal dispatch and receive flow. Add a unit test that
the combined stock of both branches is unchanged by a transfer.
```

**WP7**
```
Implement WP7: cashier purchasing with supplier search and quick add (duplicate check),
product picker with type, category, brand, colour, size and gender filters, size-run grid
for shoes and bags, scan-to-add, cash bill with printed receipt, cheque issue-only with
no cheque or supplier status visible to cashiers, Super Admin-only credit, bank transfer
and part payment, My purchases for cashiers, All purchases for the Super Admin, review
flags and cost-change warning. Enforce all restrictions in the data layer.
```

**WP8**
```
Implement WP8: Repair Desk accepts Footwear and Bag items with sub-types, quick-pick
issue chips, the Under warranty option (store invoice verification with Settings periods,
or manual Unverified), free service for warranty, the optional billing estimate, updated
slip, tag (barcode inside the label), delivery invoice and reports. Keep old repair
records and old fields working and remove shift requirements.
```

**WP9**
```
Implement WP9: Employees & Payroll for the Super Admin only: employees with fixed monthly
salary and salary history, daily wage payments deducted from salary, payroll month sheet
with the net payable formula in Section 5.9, staff credit recovery linked to the customer
ledger, finalise and pay, payslip and payroll summary prints, leave and off days with
assign, request, approve, calendar and roster, and restricted data access. Put the payroll
maths in a pure function with unit tests.
```

**WP10**
```
Implement WP10: the Super Admin Review Inbox with tabs and counts, Mark reviewed with note
and audit, sidebar badge, and the report updates in Section 5.10. Then WP11: run the full
verification table and give the final report in the required format.
```
