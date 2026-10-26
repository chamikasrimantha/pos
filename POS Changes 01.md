# Change request 01 — instructions and prompts for Antigravity

**Project:** Apex POS, outlets RightWay Shoes and Mega Shoes (`D:\Projects\pos`)
**Stack:** Next.js (App Router), React, TypeScript, Firebase / Firestore, Lucide icons
**Scope:** 12 requested changes, grouped into 9 work packages (WP1 to WP9)

---

## 1. How to use this file

1. Save this file in the project root as `CHANGE-REQUEST-01.md` so the agent can read it.
2. Open the project in Antigravity. Start with **Planning mode** (not Fast mode) so the agent produces an implementation plan you can review before it edits files.
3. Paste **Prompt 0** (the master prompt, Section 5) first. Let the agent produce its plan and check it covers all nine work packages.
4. Then run the work packages **one at a time** in the order below, using the short prompts in Section 6. Commit to Git after each package so any package can be rolled back alone.
5. After each package, run the matching checks in Section 7 yourself. Do not accept "done" without them.

**Order:** WP1 → WP5 → WP2 → WP3 → WP4 → WP6 → WP7 → WP8 → WP9. (Quick safe removals first, shared printing before the reports that use it, the invoice query layer before reports and day-end.)

If the project already has an `AGENTS.md`, the agent must read and follow it before changing anything. Put the ground rules from Section 3 into it if your version of Antigravity supports persistent project rules.

---

## 2. How each request is read (confirm anything that is wrong)

| # | Your request | How I read it | Needs your confirmation |
|---|---|---|---|
| 1 | Demo accounts should be removed | Remove every demo-account element from the screens: demo credential panels, quick-login buttons, the role switcher, "demo" wording | No |
| 2 | Remove the admin demo account too, but keep it in the database so I can log in | The admin is not shown or advertised anywhere in the UI, but the Super Admin user record stays in the database and signs in through the normal login form | The seeded password must not be printed in the UI or committed as plain text (see WP1) |
| 3 | Remove the reset demo data button | Remove the button and the code path behind it from the application | No |
| 4 | Barcode reader should add to the cart | A real hardware scanner (keyboard-style USB or Bluetooth scanner) adds the exact variant to the cart immediately. Camera scanning is added for phones as an extra | Camera scanning is optional (see WP3) |
| 5 | The "view bar" that appears when a product is added should be narrower | The floating cart summary bar that appears after adding an item becomes a compact pill instead of a wide strip | I could not see this bar in the screenshot you shared earlier. The agent must find it; Section WP4 describes what to look for |
| 6 | Cart list is congested with many products | Rebuild the cart line layout so many items stay readable, in the modern blue-and-white style | No |
| 7 | Barcode print: show barcode and its number; sticker must be perfect | Product labels show the barcode bars and the barcode number beneath, sized to fit the label exactly | Confirm the physical label size and printer (see WP2) |
| 8 | Daily sales and reports viewable and printable separately; previous months generated separately, Super Admin | A Daily Sales page for the Super Admin with month and day navigation. "Print daily report" and "Print invoices" are separate actions. Any past month can be opened | Managers and cashiers get "My sales" only (see decision D2) |
| 9 | Repair label barcode goes outside the label | Barcode on the repair tag and claim slip must fit inside the label | No |
| 10 | Super Admin sees invoice status at end of day on a separate page | New Super Admin-only page "Day-end Status" | No |
| 11 | Cashiers see their own invoices; managers the same; only Super Admin sees everything; everyone can search | Cashier and Manager see only invoices **they** issued. Super Admin sees every invoice, both outlets. All three can search within what they are allowed to see | **Decision D1 and D2** below |
| 12 | Expected drawer cash formula | Expected drawer cash = Opening float + Cash sales + Repair cash collected − Cash refunds − Cash removed from the drawer, used identically everywhere | See WP5 for exact meaning of each term |

### Decisions I have made for you (change them if wrong)

| ID | Decision | Why |
|---|---|---|
| D1 | **Returns:** a cashier or manager can still look up an invoice by its **exact invoice number** inside Returns and Exchanges, even if someone else issued it. The lookup is logged and shows only what is needed to process the return | Without this, a return for an invoice issued by a colleague is impossible. Invoice **lists and search** stay limited to own invoices |
| D2 | **Reports:** the Daily Sales page and all previous-month generation are **Super Admin only**. Cashiers and managers get "My sales" (their own invoices and their own totals, any date) | Matches "only the Super Admin can view every sale" |
| D3 | **Cash removed from the drawer** means money taken out of the till during a shift (paid-out and safe drops). Recorded by Manager or Super Admin with a mandatory reason; cashiers cannot | Keeps cashiers from reducing the expected cash without oversight |

---

## 3. Ground rules for the agent (applies to every work package)

1. **Do not change business logic that is not mentioned here.** Do not rename existing functions, change data shapes, or alter how stock, sales, returns, shifts, repairs, transfers, purchases, suppliers or cheques work, except where a work package says so.
2. **Keep the current UI design** (blue and white tokens in `globals.css`, IBM Plex Sans, 44 px touch targets). Reuse existing tokens and components. No new colours.
3. **No internal terms in the UI:** no rule numbers (for example "Rule V6"), no "demo", "phase", "Firestore mode" labels.
4. **Roles:** `SUPER_ADMIN`, `SHOP_MANAGER`, `CASHIER`. Every restriction in this document must be enforced in the **data-access functions** (`firestore-service.ts`) as well as hidden in the UI. A hidden button is not security.
5. **Time zone:** all "today", "day" and "month" boundaries use **Asia/Colombo**, never the server or browser default.
6. **Responsive:** every new or changed screen must work at 1280, 1024, 768 and 390 px widths with no horizontal page scroll. Inputs use 16 px text on phones.
7. **Printing:** all printed output uses black on white only, exact page sizes in millimetres, zero page margins, and an isolated print document (not the app shell). Nothing may spill outside its label or page.
8. **Pure logic gets tests.** Add Vitest (dev dependency only) and unit tests for: the drawer cash formula, scan-input parsing, day and month bucketing, barcode fit calculation, and invoice visibility filtering.
9. **Never print or commit credentials.** Do not put passwords in source files, UI text, logs or this repository.
10. After each work package run `npm run lint` and `npm run build` and fix every error before continuing. Summarise what changed, which files, and how it was verified.

---

## 4. Work packages

### WP1. Remove demo accounts, impersonation and demo reset

**Find and remove from the UI:**
- Any panel, card or buttons on the login or start screen that list demo accounts, show demo emails or passwords, or log in with one click.
- The role switcher / user impersonation control in `Header.tsx` and in `AdminView.tsx` (`setCurrentUser` for testing).
- The **Reset demo data / re-seed** button in `AdminView.tsx` and the service function behind it (remove the function and its exports; do not just hide the button).
- The word "demo" and any test-only copy anywhere in the interface.

**Keep:**
- The user records in the database, including the Super Admin, Shop Managers and Cashiers, so they can sign in through the normal login form. Do not delete users from `seed-data.ts` or from Firestore.
- The Admin → Users list (read-only view of real staff) and the audit log viewer.

**Credentials safety:**
- Remove any plain-text passwords from source files and from anything displayed. If the seed script creates the admin sign-in, it must read the password from an environment variable (for example `SEED_ADMIN_PASSWORD`) or generate one and print it **once in the terminal**, never in the app.
- Mark seeded accounts `mustChangePassword = true` so the first sign-in forces a new password (add the field and the screen only if sign-in already exists; if not, record this as a follow-up and do not invent a login system in this change).
- Dev-only seeding stays as a command-line script (`npm run seed`), outside the app bundle.

**Acceptance:** searching the code for `demo`, `Demo`, `impersonat`, `resetDemo`, `reseed` returns nothing in `src/`; the login screen shows no accounts; Admin shows no reset button; the Super Admin can still sign in with the real credentials.

---

### WP5. Expected drawer cash formula (do early; small)

**Formula, exactly and everywhere:**

`Expected drawer cash = Opening float + Cash sales + Repair cash collected − Cash refunds − Cash removed from the drawer`

| Term | Meaning in code |
|---|---|
| Opening float | `shift.openingFloat` |
| Cash sales | Cash actually kept in the till from sales: for every `CASH` payment entry, amount received minus change given. Includes the cash top-up paid on a size exchange. Card and bank transfer are excluded |
| Repair cash collected | Cash taken for repairs: advance deposits and final payments paid in cash (`repairCashIn`) |
| Cash refunds | Cash paid out to customers for returns and exchanges, plus cash returned from repair advances |
| Cash removed from the drawer | Cash taken out during the shift: paid-outs and safe drops (`cashPayouts`) |

**Implementation:**
1. Create one pure function, for example `computeExpectedDrawerCash(shiftTotals)` in `src/lib/shift-math.ts`, and use it in **every** place that shows or stores expected cash: `closeCashierShift`, the live metrics panel and close-shift modal in `ShiftManager.tsx`, `renderZReportHTML`, and the Z-report tab in `ReportsView.tsx`. Remove all duplicate formulas.
2. Show the lines in this order and with these exact labels on the shift screen, the close modal and the Z-report: Opening float, Cash sales, Repair cash collected, Cash refunds, Cash removed from the drawer, **Expected drawer cash**. Then Counted cash and Variance.
3. If there is **no screen to record cash removed from the drawer**, add a "Remove cash" action on the shift screen for Manager and Super Admin: amount greater than 0, mandatory reason, cannot exceed the current expected cash, adds to `cashPayouts`, writes an audit log, and shows in the shift history. Cashiers do not see it.
4. Unit tests with this case: opening 10,000; cash sales 46,000; repair cash 4,000; refunds 3,000; removed 30,500 → expected **26,500**. Counted 26,300 → variance **−200**.

**Acceptance:** the same expected value appears on the shift panel, close modal, Z-report print and Reports tab for the same shift.

---

### WP2. Barcode and label printing foundation

**Problem causes to fix:** barcodes are not real scannable symbols or are drawn by font/CSS; sizing is in pixels; labels are printed inside the app page; long values (such as `SHOP001-REP-000123`) make the barcode far wider than a small label.

**Build a shared printing layer:**
1. Install `jsbarcode`. Create `src/components/print/BarcodeSvg.tsx` and a plain function `renderBarcodeSvg(value, {widthMm, heightMm})` returning an SVG **string** (so `receipt-generator.ts` can embed it). Vector SVG only; never PNG, never a font.
2. **Symbology:** EAN-13 when the value is exactly 13 digits with a valid check digit; otherwise Code 128 (numeric-only values use the compact numeric mode). Draw the bars only; do **not** use the library's built-in text.
3. **Fit to the label:** read the encoded width in modules, add quiet zones (11 left and 7 right for EAN-13, 10 each side for Code 128), then scale the SVG with a `viewBox` so it fills the available width without exceeding it. Use `shape-rendering="crispEdges"`. If the resulting narrowest bar is below **0.25 mm**, show a visible warning in the label preview ("Barcode too long for this label") and, for numeric values, switch to the compact numeric mode first.
4. **Barcode number:** print the value as text directly under the bars, centred, 7 to 8 pt, tabular numerals, never smaller than 6 pt, never wider than the bars' container (use `font-size` that shrinks only down to 6 pt, otherwise two lines).
5. **Print mechanism:** create an isolated print route or hidden iframe that contains only the labels. Print CSS: `@page { size: <W>mm <H>mm; margin: 0 }`, one label per page, `print-color-adjust: exact`, black on white only, 1.5 to 2 mm inner padding, `overflow: hidden` only as a last safety (the layout must already fit). Wait for fonts and SVG to render before calling print.
6. **Label sizes in one config file** (`src/lib/print-config.ts`): `PRODUCT_LABEL`, `REPAIR_TAG`, `RECEIPT_WIDTH`, each in millimetres. Read the sizes the code uses today and put them there; if the real label size is unknown, default `PRODUCT_LABEL` to 50 × 30 mm and tell me in the summary. Do not guess other sizes silently.

**Product label layout (example 50 × 30 mm):** top: product name (max two lines, truncated), middle: colour and size (size large and bold) on the left, price on the right, bottom: barcode bars (at least 10 mm high) with the barcode number beneath. Copies count and the existing "print" modal behaviour stay.

**Repair tag and claim slip:** the long repair number is the reason the bars overflow. Encode a **short numeric scan code** instead and print the full repair number as text:
- Scan code = outlet digit + 6-digit sequence (for example `SHOP001-REP-000123` becomes `1000123`). Write a pure function to build it and its inverse, with tests.
- The Repair Desk search must accept both the full number and the scan code.
- Do the same for any barcode that currently encodes an invoice number on a receipt.

**Acceptance:** a printed product label shows bars and number fully inside the label, scans reliably, and the print preview matches the paper; the repair tag barcode is inside the tag with margin on both sides.

---

### WP3. Real barcode scanning in the POS

Hardware scanners behave like a very fast keyboard that ends with Enter (some end with Tab).

**Requirements:**
1. Create a hook, for example `useBarcodeScanner`, that listens on the window while the POS screen is active and **no modal is open**. It treats a burst of characters typed with under about 40 ms between keys and ended by Enter or Tab, with a minimum length (default 6), as a scan. Slower human typing in other fields is ignored.
2. The existing scan input keeps working: Enter in that field also scans. Keep that field focused after every action (add, remove, completing a sale, closing a modal, changing category) so a scan is never lost.
3. On a scan: trim and clean the text; look up the variant by **barcode, then SKU** for the **active outlet**; add **one pair** to the cart, or increase the quantity if already in the cart.
4. Respect the existing rules: no sale without an open shift (show "Open a shift to start selling" and do not add), and never exceed the outlet's stock (show "Only N in stock").
5. **Feedback:** short success beep and a brief highlight of the new or updated cart line; a toast "Added: product, colour, size". Not found: error beep and toast "No shoe found for this barcode". Out of stock: error toast. Beeps use the Web Audio API and can be muted by a small toggle in the POS header.
6. Add a **Scan with camera** button for phones (hidden on desktop) that opens a full-screen camera view, decodes EAN-13 and Code 128 using a library that also works on iPhone Safari, and feeds the result through the **same** function as a hardware scan. HTTPS only (Vercel provides it); manual entry fallback if permission is denied. Load this code only when the button is tapped.
7. Unit tests for the parser: fast burst accepted, slow typing rejected, Enter and Tab terminators, too-short strings ignored, prefix and suffix characters stripped. Provide a small test utility that simulates a scanner.

**Acceptance:** scanning three different printed labels in a row adds three lines; scanning the same label twice makes quantity 2; an unknown code shows the error; scanning does nothing when a modal is open or the shift is closed.

---

### WP4. POS cart: compact view bar and readable item list

**4a. The "view bar":** find the element that appears when an item is added to the sale (look in `PosView.tsx` for a fixed or sticky bottom bar, a "View" or "items" bar, or a toast-like strip). Change it to:
- A compact **pill**, `width: fit-content`, minimum 220 px, maximum 340 px, 48 px high, centred above the bottom edge with 16 px margin (never full width).
- Content: cart icon, "N items", total amount, chevron. One tap opens the cart.
- Shown **only where the cart panel is not already visible** (below 1024 px width). On desktop the cart is permanently visible, so no bar.
- It must not cover content: add bottom padding to the catalogue scroll area equal to the pill height plus margin. Respect the phone safe area.

**4b. Cart item list.** Rebuild the line layout so ten, twenty or more items remain readable:
- The cart panel is a flex column: header (Current sale, item count), scrolling list (`flex: 1; min-height: 0; overflow-y: auto`), and a **sticky footer** with subtotal, discount, total, payment and Complete sale that never scrolls away.
- Each line is a two-row item on a fixed grid so numbers align down the list:
  - Row 1: product name (15 px, 600, one line, truncated with full name on hover or long press) and line total on the right (tabular numerals, 600).
  - Row 2: "Colour, EU size (UK size)" in secondary text and the unit price ("Rs. 18,900.00 each") in caption text.
  - Controls: quantity stepper (− qty +) on the left of row 2 or on the right, 40 px buttons on desktop and 44 px on phones; remove icon button at the far right.
- Rows: minimum height 72 px, 12 px vertical and 16 px horizontal padding, hairline divider between rows, rounded hover background; a small line number is optional.
- New or changed lines scroll into view and flash the soft blue for about 300 ms (not with reduced-motion on).
- A thin scrollbar and a divider line under the header when the list is scrolled. No gradients or shadows on rows.
- Header shows "N items" and total pairs; keep any existing Clear action only if it exists today.
- All existing behaviours stay: quantity limits by stock, remove line, discount, customer fields.

**Acceptance:** with 15 items in the cart at 1280 × 720 and at 390 × 844, names, sizes, quantities and totals are all readable, the total and Complete sale stay visible, and the view bar is a small pill that appears only on phone and tablet widths.

---

### WP6. Invoices: own vs all, search, view and reprint

Add an **Invoices** item to the sidebar and the phone "More" menu, visible to all three roles.

**Visibility (enforced in the data layer, not only in the UI):**

| Role | Sees |
|---|---|
| Cashier | Only invoices where `cashierId` is their own id |
| Shop Manager | Only invoices **they** issued (same rule as the cashier) |
| Super Admin | Every invoice from every cashier and manager, both outlets |

Create one function, for example `getInvoicesForUser(user, filters, cursor)`, that applies this rule. The UI never filters by role itself; it only passes filters. Add unit tests for the rule.

**Page content:**
- Search box: invoice number (partial match), customer name, phone, amount.
- Filters: date range (default today), status (Completed, Partially returned, Fully returned, Cancelled), payment method. Super Admin also gets: outlet and issued-by (cashier or manager).
- List: invoice number, date and time, issued by (Super Admin only), customer, total, payment method, status badge. Paginated (50 per page). Cards on phones.
- Invoice detail (side panel, full screen on phones): header, lines, discounts, payments, returns made against it, shift number.
- Actions: **Reprint** (marked DUPLICATE and written to the audit log) and **Start return** (opens Returns and Exchanges with the invoice prefilled) according to role. Reprint is available only for invoices the user is allowed to see.

**Returns lookup (decision D1):** keep the exact-invoice-number lookup in Returns and Exchanges working inside the user's own outlet for any invoice, but log each lookup of someone else's invoice in the audit log and show only what the return needs.

**Acceptance:** a cashier cannot see a manager's or another cashier's invoice in the list or in search results; a Super Admin can see all and filter by person and outlet; searching an invoice number finds it for the allowed viewer only.

---

### WP7. Daily sales and reports (Super Admin)

Add a **Daily Sales** area under Reports & Z-Reports for the **Super Admin only** (managers and cashiers get "My sales", which is the Invoices page filtered to their own invoices with a daily summary and print).

**Page layout:**
1. **Outlet selector** (RightWay Shoes, Mega Shoes, Both) and a **month picker** that allows any past month.
2. **Month overview:** a calendar or list of days in that month, each with invoice count and net sales, days with no sales greyed. Clicking a day opens the daily report.
3. **Daily report view** for the chosen day and outlet: gross sales, discounts, returns and refunds, net sales, takings by payment method (cash, card, bank transfer), invoice count, repair income, shifts that day with variance, and the invoice table (number, time, issued by, total, status).
4. **Two separate print actions, each with its own button:**
   - **Print daily report** (summary page; A4 by default, 80 mm option) with outlet header, date, generated by and time.
   - **Print invoices** (all invoices of that day, one per page, in invoice-number order). Also allow printing a single invoice from the table.
5. **Previous months:** a button **Generate month pack** for a chosen month that lists every day with two buttons per day (report, invoices) and an optional "print all daily reports" and "print all invoices" for the month. Generate on demand from stored sales (no new data is stored). Render in chunks with a progress indicator and a warning above a few hundred pages.
6. Optional: CSV export of the daily table.

**Rules:** day boundaries in Asia/Colombo; invoices reprinted from this page are marked DUPLICATE and audited; use the shared print layer from WP2; numbers use the same formatting as the rest of the app; nothing here changes stored sales.

**Acceptance:** as Super Admin, open last month, choose a day, print the report and print that day's invoices as two separate prints; the invoice count on the report equals the number of invoice pages printed.

---

### WP8. Day-end Status page (Super Admin only)

Add a sidebar item **Day-end Status** visible only to the Super Admin (and blocked in the data layer for other roles).

**Content for a chosen date (default today) and outlet (each outlet shown separately, plus a combined total):**
- **Invoice status summary:** counts and amounts for Completed, Partially returned, Fully returned and Cancelled; total invoices issued.
- **Invoice number check:** first and last invoice number of the day and a list of any **missing numbers** in the sequence.
- **Takings:** cash, card and bank transfer totals; returns and refunds; net sales; repair income.
- **Shifts:** each shift of that day with opened and closed times, status, expected cash, counted cash and variance. Highlight any shift still **open** at day end and any variance not zero.
- **Reconciliation check:** sum of sales recorded against shifts equals the day total; flag a mismatch.
- **Invoice table:** filter by status, search by number, open the invoice detail.
- Buttons: **Print day-end status** (its own print layout) and a link to the Daily Sales report for the same day.
- No new "close the day" locking function is added in this change.

**Acceptance:** the status counts add up to the total invoices; a voided or returned invoice appears in the right status; an open shift is highlighted.

---

### WP9. Final verification and regression

Run the full manual script in Section 7, plus `npm run lint`, `npm run build`, and the unit tests. Produce a final summary that lists each requested change, the files touched, how it was tested, and anything not done or assumed.

---

## 5. Prompt 0 — master prompt (paste first, in Planning mode)

```
You are working in the Next.js + TypeScript + Firebase POS project at D:\Projects\pos
(outlets: RightWay Shoes and Mega Shoes). First read AGENTS.md if it exists, then read
CHANGE-REQUEST-01.md in the project root completely. That file is the specification for
this task.

Do NOT edit any files yet. Produce an implementation plan as an artifact that:
1. Lists every file you expect to create or change for each work package WP1 to WP9,
   in the order: WP1, WP5, WP2, WP3, WP4, WP6, WP7, WP8, WP9.
2. Identifies where in the existing code each of these currently lives: demo accounts and
   the role switcher, the reset demo data button and its service function, the barcode
   scan input in PosView.tsx, the floating view bar shown after adding an item, the cart
   line layout, the barcode and label generation in ProductsMasterView.tsx and
   receipt-generator.ts, the repair tag and claim slip, the expected cash calculation in
   firestore-service.ts, ShiftManager.tsx, receipt-generator.ts and ReportsView.tsx, and
   how sales are queried today.
3. States any question or ambiguity (for example the physical label size) instead of
   guessing.
4. Confirms you will follow the ground rules in Section 3 of the file: no changes to
   business logic that is not requested, keep the existing design tokens, no internal terms
   in the UI, enforce role visibility in the data layer, Asia/Colombo time, responsive at
   1280/1024/768/390 px, black-and-white millimetre-exact printing, unit tests for pure
   logic, no credentials in code or UI.

Wait for my approval of the plan before making any change. After approval, implement one
work package at a time, run `npm run lint` and `npm run build` after each, and stop for my
confirmation before starting the next package.
```

---

## 6. Short prompts for each work package

Use these after Prompt 0 is approved. Each one assumes `CHANGE-REQUEST-01.md` is in the project.

**WP1**
```
Implement WP1 from CHANGE-REQUEST-01.md: remove all demo accounts, the role switcher /
impersonation, the "reset demo data" button and its service function, and all "demo"
wording from the UI. Keep the real user records (including the Super Admin) in the
database and seed so they can sign in with the normal form. Do not print or commit any
password; seeding must read the password from an environment variable or print a
generated one once in the terminal. Run lint and build and report the files changed and
the grep results listed in the acceptance criteria.
```

**WP5**
```
Implement WP5: create one pure function computeExpectedDrawerCash in src/lib/shift-math.ts
with the formula Opening float + Cash sales + Repair cash collected − Cash refunds −
Cash removed from the drawer, and use it everywhere expected cash is calculated or shown
(closeCashierShift, ShiftManager, the Z-report template, ReportsView). Use the exact labels
and order from the file. If there is no way to record cash removed from the drawer, add a
Remove cash action for Manager and Super Admin only (amount > 0, mandatory reason, cannot
exceed expected cash, audited). Add Vitest unit tests including 10,000 + 46,000 + 4,000 −
3,000 − 30,500 = 26,500.
```

**WP2**
```
Implement WP2: build the shared barcode and print layer. Install jsbarcode; create
BarcodeSvg and a renderBarcodeSvg(value, {widthMm, heightMm}) string function; EAN-13 for
valid 13-digit values, otherwise Code 128; vector SVG scaled to fit the label with quiet
zones; print the barcode number under the bars; add src/lib/print-config.ts with label
sizes in millimetres; print through an isolated document with @page size equal to the
label and zero margin. Update the product barcode label in ProductsMasterView and the
repair tag and claim slip so the barcode is fully inside the label. For repairs encode a
short numeric scan code (outlet digit + 6-digit sequence) and print the full repair number
as text; make Repair Desk search accept both. Tell me which label sizes you found or
defaulted.
```

**WP3**
```
Implement WP3: real barcode scanning in PosView. Add a useBarcodeScanner hook that detects
fast keyboard bursts ending in Enter or Tab while the POS is active and no modal is open,
looks up the variant by barcode then SKU for the active outlet, and adds one pair (or
increments the quantity) respecting the open-shift requirement and stock limits. Keep the
scan field focused after every action. Add success and error beeps with a mute toggle,
toasts, and a highlight on the cart line. Add a phone-only "Scan with camera" button that
feeds the same function, loading the decoder only when tapped. Add unit tests for the
parser.
```

**WP4**
```
Implement WP4 in PosView.tsx and the cart components: (a) turn the floating view bar that
appears after adding an item into a compact pill (max 340 px wide, 48 px high, centred,
shown only below 1024 px where the cart panel is not visible); (b) rebuild the cart line
layout as described in the file: sticky footer with totals and Complete sale, scrolling list,
two-row lines on a fixed grid, 40/44 px stepper, remove button, auto-scroll and brief
highlight for added lines. Keep all existing cart behaviour. Verify with 15 items at 1280
and 390 px widths.
```

**WP6**
```
Implement WP6: add an Invoices page for all roles. Create getInvoicesForUser(user, filters,
cursor) in firestore-service.ts that returns only invoices issued by the user for
CASHIER and SHOP_MANAGER, and all invoices for SUPER_ADMIN, with unit tests. Add search
(invoice number, customer name, phone, amount), filters (date range default today, status,
payment method; outlet and issued-by for Super Admin), pagination, a detail panel, Reprint
(marked DUPLICATE and audited) and Start return. Keep the exact-invoice-number lookup in
Returns working inside the user's own outlet and audit lookups of other people's invoices.
```

**WP7**
```
Implement WP7: add a Super Admin-only Daily Sales page under Reports with outlet and month
pickers (any past month), a per-day overview, a daily report view, and two separate print
buttons: Print daily report and Print invoices (one invoice per page). Add Generate month
pack for a previous month with per-day buttons. Use the print layer from WP2 and
Asia/Colombo day boundaries. Managers and cashiers get "My sales" only (their own invoices).
Do not store anything new; generate from existing sales.
```

**WP8**
```
Implement WP8: add a Super Admin-only Day-end Status page for a chosen date and outlet:
invoice counts and amounts by status (Completed, Partially returned, Fully returned,
Cancelled), first and last invoice numbers with any missing numbers, takings by payment
method, returns, repair income, each shift with variance (highlight open shifts), a
reconciliation check, an invoice table with status filter and search, and a separate Print
day-end status button. Block other roles in the data layer and the sidebar.
```

**WP9**
```
Run the verification script in Section 7 of CHANGE-REQUEST-01.md as far as you can with the
browser tool at 1280, 1024, 768 and 390 px widths, run lint, build and all unit tests, and
give me a final report: each requested change, files touched, how it was tested, and
anything not completed or assumed. List any behaviour that changed beyond what was requested.
```

---

## 7. Verification script (you run this)

| # | Check | Pass when |
|---|---|---|
| 1 | Open the login screen | No demo accounts, no quick-login, no role switcher anywhere |
| 2 | Sign in as the real Super Admin | Works; Admin has no reset button |
| 3 | Scan three product labels with the real scanner on the POS | Three lines added; same label twice makes quantity 2 |
| 4 | Scan an unknown code, then scan with the shift closed | Error toast, nothing added; "Open a shift" message |
| 5 | Type slowly in the search box | Not treated as a scan |
| 6 | On a phone, tap Scan with camera and scan a label | Same result as the hardware scanner |
| 7 | Add items on a phone-width screen | Small centred pill, not a full-width bar; hidden on desktop |
| 8 | Add 15 items | List readable, total and Complete sale stay visible, new line highlighted |
| 9 | Print a product label | Bars and number fully inside the label; scans first time |
| 10 | Print the repair tag and claim slip | Barcode fully inside with margin; scanning finds the repair |
| 11 | Open a shift, sell cash and card, take a repair advance in cash, refund cash, remove cash | Expected drawer cash equals Opening float + Cash sales + Repair cash collected − Cash refunds − Cash removed; same on panel, close modal, Z-report and Reports tab |
| 12 | Sign in as a cashier, then a manager, then the Super Admin; open Invoices | Cashier and manager see only their own; Super Admin sees all and can filter by person and outlet |
| 13 | As cashier search an invoice number issued by someone else | Not found in Invoices; exact lookup in Returns still works and is audited |
| 14 | As Super Admin open last month, pick a day | Print daily report and Print invoices work as two separate prints; counts match |
| 15 | Open Day-end Status | Status counts add up; open shift highlighted; missing invoice numbers listed; other roles cannot reach it |
| 16 | Repeat key screens at 1280, 1024, 768 and 390 px | No horizontal scroll; actions reachable |
| 17 | `npm run lint`, `npm run build`, unit tests | All pass |

---

## 8. Things to confirm with the client or owner

1. Physical label size and printer model (for WP2); the repair tag size if different.
2. Whether managers should also see outlet-wide reports (currently Super Admin only, decision D2).
3. Whether cashiers may record "Cash removed from the drawer" (currently Manager and Super Admin only, decision D3).
4. That the exact-invoice-number lookup in Returns for another person's invoice is acceptable (decision D1).
5. Whether the sign-in system is already in place; if not, the access-control and login work in the earlier Further Development Plan must come first, because the invoice visibility rules in WP6 depend on knowing who is signed in.
