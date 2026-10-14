# Apex POS — UI redesign instructions

**Purpose:** replace the current dark, crowded interface with a calm, readable, light interface for a footwear counter POS.
**Audience:** the developer or AI coding tool applying the redesign.
**Stack assumed:** Next.js, TypeScript, Tailwind CSS (existing project).

---

## 0. The one rule that overrides everything

**This is a presentation-only change.** Do not alter business logic, state, hooks, props, API or Firestore calls, validation, permissions, routing, or data shapes. Change class names, layout, markup structure, copy and styling only. Every function in the inventory in Section 13 must work exactly as it does today.

Where this document suggests regrouping information (for example grouping sizes under one product tile), the underlying data and the "add this exact variant to the sale" action stay the same. A flat alternative is given for each such case if zero change in click path is required.

---

## 1. What is wrong with the current screen

| Problem seen in the screenshot | Why it hurts at a counter | Fix |
|---|---|---|
| Near-black background with neon blue, purple, orange and green all at once | Eye fatigue under shop lighting; no single thing draws the eye | Light theme, one blue, greys, colour only for exceptions (Section 3) |
| Locked state is announced four times: sidebar "LOCKED", sidebar "CLOSED", header "DRAWER LOCKED", large orange banner | Noise; the cashier needs one message and one button | One status chip in the header, one inline notice with one button (Section 6) |
| Text as small as 10–11 px (SKU, labels, badges, placeholders) | Unreadable at arm's length, especially on a tablet | Nothing below 13 px; body 15 px (Section 3.3) |
| Nine near-identical cards for one shoe (every size is its own card) | Repetition hides the real choice | Group sizes under one product tile (Section 5.3) |
| Purple brand pills, green and amber stock pills on every card | Colour used for decoration, not meaning | Brand as plain grey text; stock coloured only when low or out |
| Internal labels visible: "Rule V6", "Phase 1 [R]", "Firestore Cloud Mode" | Meaningless to staff, looks unfinished | Remove from the production UI (Section 9) |
| Tiny cart header, customer fields always open, empty cart dominates | Primary workflow (the cart and the total) has the least presence | Larger cart with a prominent total and one primary button (Section 5.5) |

---

## 2. Design direction

**Concept: a quiet counter.** The product catalogue and the cart are the whole job. Everything else steps back.

1. **One accent.** Blue means "you can act here" (buttons, selection, focus). Everything else is white or grey.
2. **Colour is information.** A coloured element always means something: low stock, out of stock, error, success. If an element is coloured and carries no meaning, remove the colour.
3. **The memorable element is the total.** The sale total and the Complete sale button are the largest, boldest things on the screen. The rest stays quiet and disciplined.
4. **Space before borders.** Separate content with whitespace first, a 1 px hairline second. No drop shadows on tiles or panels; shadows only on floating layers (menus, modals).
5. **Show less per tile.** At most five pieces of information on a product tile. Detail is available on selection, not all at once.
6. **Counter-first sizing.** Every tappable control is at least 44 px high; main actions are 48–56 px.

Colour budget: at any moment, at most **three hues** are visible on a screen: neutral grey/white, the blue accent, and one status colour if something needs attention.

---

## 3. Design tokens

### 3.1 Colour

All text pairs below were checked for contrast (WCAG AA, 4.5:1 for text).

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `canvas` | `#F3F5F8` | App background behind panels | — |
| `surface` | `#FFFFFF` | Panels, tiles, tables, modals | — |
| `surface-sunken` | `#EEF1F5` | Table headers, inputs when disabled, segmented control track | — |
| `line` | `#DDE2E9` | Default 1 px borders and dividers | — |
| `line-strong` | `#C3CBD6` | Input borders, focused-adjacent borders | — |
| `ink` | `#101828` | Primary text, prices, totals | 17.8:1 on white |
| `ink-2` | `#475467` | Secondary text, labels | 7.7:1 on white |
| `ink-3` | `#667085` | Captions, placeholders, SKU | 5.0:1 on white, 4.55:1 on canvas |
| `primary` | `#2056C8` | Primary buttons, selected state, links, focus ring | 6.5:1 (white text on it) |
| `primary-hover` | `#1A47A3` | Primary hover and pressed | 8.5:1 |
| `primary-soft` | `#E8F0FD` | Selected row/chip/nav background | — |
| `primary-soft-line` | `#BCD2F7` | Border of selected items | — |
| `primary-ink` | `#173C84` | Text on `primary-soft` | 9.1:1 |
| `success` / `success-soft` | `#1B7A43` / `#E7F5EC` | Completed, cleared, received | 4.8:1 |
| `warning` / `warning-soft` | `#8A5200` / `#FDF1DC` | Low stock, pending, attention | 5.7:1 |
| `danger` / `danger-soft` | `#B42318` / `#FDEAE8` | Out of stock, errors, bounced, destructive | 5.7:1 |
| `disabled-ink` | `#98A2B3` | Disabled text (exempt from contrast rules) | — |

Do not use gradients, glows, translucent glass effects or coloured shadows anywhere.

### 3.2 Layout, spacing, shape

| Token | Value |
|---|---|
| Spacing scale (4 px base) | 4, 8, 12, 16, 24, 32, 48 |
| Screen padding | 24 px (16 px on tablet) |
| Gap between panels | 16 px |
| Tile padding | 16 px |
| Radius, controls (buttons, inputs, chips) | 8 px |
| Radius, tiles and panels | 12 px |
| Radius, modals | 16 px |
| Border | 1 px `line` |
| Shadow | none, except floating layers: `0 8px 24px rgba(16,24,40,0.12)` |
| Motion | 120–160 ms ease-out for hover, press, expand; nothing animates on page load; respect `prefers-reduced-motion` |

### 3.3 Typography

**Typeface:** IBM Plex Sans (load with `next/font/google`), fallback `system-ui, sans-serif`. It has clear numerals and distinguishes 1, l and I, which matters for prices and SKUs. One family only.

Enable **tabular numerals** (`font-variant-numeric: tabular-nums`) on all prices, quantities, totals, SKUs and invoice numbers so columns line up.

| Role | Size / line height | Weight | Colour |
|---|---|---|---|
| Sale total | 32 / 40 | 700 | `ink` |
| Page title | 22 / 28 | 600 | `ink` |
| Section heading | 17 / 24 | 600 | `ink` |
| Body | 15 / 22 | 400 | `ink` |
| Body strong (names, prices) | 15 / 22 | 600 | `ink` |
| Price on tile | 18 / 24 | 600 | `ink` |
| Secondary | 14 / 20 | 400 | `ink-2` |
| Caption (minimum size anywhere) | 13 / 18 | 400 | `ink-3` |
| Button | 15 / 20 | 600 | per variant |

**Rules:** sentence case everywhere ("Open shift", not "OPEN SHIFT"); no all-caps labels, no letter-spaced eyebrow text; no text below 13 px; line length under 80 characters.

### 3.4 Tailwind mapping (reference)

```
colors: {
  canvas:'#F3F5F8', surface:'#FFFFFF', sunken:'#EEF1F5',
  line:{DEFAULT:'#DDE2E9', strong:'#C3CBD6'},
  ink:{DEFAULT:'#101828', 2:'#475467', 3:'#667085'},
  primary:{DEFAULT:'#2056C8', hover:'#1A47A3', soft:'#E8F0FD', line:'#BCD2F7', ink:'#173C84'},
  success:{DEFAULT:'#1B7A43', soft:'#E7F5EC'},
  warning:{DEFAULT:'#8A5200', soft:'#FDF1DC'},
  danger:{DEFAULT:'#B42318', soft:'#FDEAE8'}
}
```

Replace the existing dark-theme classes with these tokens. Do not leave any hard-coded hex values in components.

---

## 4. App shell

### 4.1 Layout at 1280 × 720 (reference)

```
┌──────────┬─────────────────────────────────────────────────────────────┐
│ Sidebar  │ Top bar (56 px): branch · shift status · staff · refresh    │
│ 232 px   ├──────────────────────────────────────┬──────────────────────┤
│          │ Catalogue (flexible)                 │ Current sale (400 px)│
│ logo     │ ┌ notice (only when shift closed) ┐  │ header + item count  │
│ 11 items │ └─────────────────────────────────┘  │ customer (collapsed) │
│          │ [ Scan barcode ][ Search shoes     ] │ ───────────────────  │
│          │ category tabs (one row)              │ line items (scroll)  │
│          │ ┌────────┐ ┌────────┐ ┌────────┐     │ ───────────────────  │
│          │ │ tile   │ │ tile   │ │ tile   │     │ subtotal / discount  │
│          │ └────────┘ └────────┘ └────────┘     │ TOTAL                │
│          │                                      │ payment method       │
│          │                                      │ [ Complete sale ]    │
└──────────┴──────────────────────────────────────┴──────────────────────┘
```

Page background is `canvas`. The catalogue area and the cart are white panels (`surface`, 12 px radius, 1 px `line`) with 16 px between them. The cart is a full-height panel with a sticky footer.

### 4.2 Sidebar

- White (`surface`), 1 px right border, width 232 px. Collapses to a 72 px icon rail below 1180 px width or when the user collapses it; labels appear as tooltips in rail mode.
- Top: logo mark and the name "Apex POS" (17 px, 600). Remove the "Footwear Management v1.1" line, or show it only in Admin & Settings.
- Remove the group label "OPERATIONAL MODULES" (all caps, adds nothing).
- Keep the **same 11 items, same names, same order**: POS Billing Counter, Cash Drawer & Shifts, Returns & Exchanges, Shoe Repair Desk, Branch Transfers, Stock & Movements, Product Catalog, Purchasing & Inward, Suppliers & Cheques, Reports & Z-Reports, Admin & Settings. Items the user's role cannot access stay hidden, as today.
- Item: 44 px high, 12 px horizontal padding, 20 px icon (single-weight line icons, `ink-2`), label 15 px.
- Active item: `primary-soft` background, `primary-ink` text and icon, plus a 3 px `primary` bar on the left edge. Hover: `sunken`.
- **Remove all status badges from the sidebar** ("LOCKED", "CLOSED"). Shift status lives only in the top bar.
- Bottom of the sidebar: remove "Firestore Cloud Mode" and "Phase 1 [R]". If a connection indicator is wanted, show a small grey dot with "Online" / red dot with "Offline" only.

### 4.3 Top bar

56 px high, white, 1 px bottom border. Left to right:

1. **Branch:** branch name in 15 px 600 ("Apex Footwear — Galleria Mall Outlet"), branch code in 13 px `ink-3` beneath or beside it. For Super Admin it is a selector (chevron, opens a menu: All shops, then each shop). For Shop Manager and Cashier it is **plain text with no chevron** (see Section 14, issue 1).
2. **Shift status chip** (the only place shift state is shown): closed = grey chip "Shift closed" with a "Open shift" text button next to it; open = green-dot chip "Shift open since 09:12". 36 px high.
3. Spacer.
4. **Staff:** name (15 px 600) and role (13 px `ink-3`, "Cashier") with a menu chevron. Remove the shop from the name string ("Nadeeka Silva", role "Cashier"; the branch is already shown on the left).
5. **Refresh** icon button, 44 × 44.

No orange or gold chips anywhere in the bar.

---

## 5. POS billing screen

### 5.1 Scan and search row

- Two inputs side by side, 48 px high, 8 px radius, 1 px `line-strong`, white fill. Scan field takes 40% width, search 60%.
- Scan field: barcode icon, placeholder "Scan barcode or enter SKU", trailing "Scan" button kept as today. **Always keeps focus** after any action so a scanner can fire at any moment (existing behaviour; do not break it).
- Search field: magnifier icon, placeholder "Search by name, brand, colour or size".
- Focus state: 2 px `primary` ring, no glow.

### 5.2 Category tabs

- One row, 40 px high, horizontally scrollable with no visible scrollbar; fade the right edge when more are hidden.
- Same labels as today (All footwear, Men's formal, Sports & running, Casual & sneakers, Women's heels, Women's flats), generated from the same data.
- Unselected: text `ink-2` on transparent, 1 px `line` border. Selected: `primary-soft` fill, `primary-soft-line` border, `primary-ink` text. Radius 8 px, not pills.

### 5.3 Product tiles

Three columns at 1280 px, two at 1024 px, four at 1600 px and above. Gap 16 px. Tiles are white, 1 px `line`, 12 px radius, no shadow. Hover changes the border to `line-strong`; nothing lifts or scales.

**Option A (recommended): one tile per product, sizes inside it.**

```
Clarks                                  ← brand, 13 px, ink-3
Tilden Cap Oxford                       ← name, 16 px, 600, max 2 lines
● ○                                     ← colour swatches (24 px), selected has blue ring
Midnight black                          ← selected colour name, 14 px, ink-2

[ 41 ] [ 42 ] [ 43 ] [ 44 ]             ← size chips, EU numbers, 44 px wide each

6 in stock · EU 42 (UK 8.5)             ← only after a size is chosen
Rs. 18,900.00                [ Add ]    ← price left, Add button right
```

- Size chip states: available (white, `line-strong` border), selected (`primary` fill, white text), low stock (small `warning` dot in the corner), out of stock (`disabled-ink` text, diagonal strike, not selectable).
- **Add** is disabled until a size is chosen. If a product has a single variant, it is pre-selected.
- Stock text: normal stock in `ink-2` ("6 in stock"); low stock `warning` ("Only 2 left"); zero `danger` ("Out of stock").
- SKU is **not** shown on the tile. It is shown in the search results list (below) and available on hover/long-press of the selected size chip.
- Brand is plain text, never a coloured pill.
- Pressing Add puts that exact variant (colour + size) in the cart exactly as today; the tile keeps its selection so another pair of the same size can be added quickly.

**Option B (zero change in click path): one tile per variant, simplified.**

```
Clarks
Tilden Cap Oxford
Midnight black, EU 42 (UK 8.5)
6 in stock
Rs. 18,900.00                [ Add ]
```

Five lines at most; SKU hidden (shown in search results); no stock pill unless low or out.

**Search results mode.** When the search field has text, replace the tile grid with a list. Each row is 56 px: product name and "colour, EU size (UK size)" on the left, SKU (`ink-3`, tabular), stock, price, and a 44 px Add button. This keeps SKU and barcode lookup exact and easy to scan.

### 5.4 Header of the cart

"Current sale" (17 px, 600) and an item count in plain text ("0 items"), not a bordered pill. Customer name and mobile phone are the same two fields, now collapsed under a text button "Add customer details (optional)" that expands them as two 44 px inputs. If the business decides they are mandatory, keep them expanded.

### 5.5 Cart lines, totals, payment

**Empty state:** a 48 px grey cart icon, "No items yet" (15 px, 600), and "Scan a barcode or choose shoes from the list." (14 px, `ink-2`). Centered in the line area.

**Line item** (72 px high, hairline divider between lines):

```
Clarks Tilden Cap Oxford                          Rs. 18,900.00
Midnight black, EU 42 (UK 8.5)             [ − ] 1 [ + ]      🗑
```

- Name 15 px 600, one line, truncate; detail 14 px `ink-2`.
- Quantity stepper: buttons 44 × 44, number 15 px 600 tabular. The stepper cannot exceed available stock (existing rule) and shows an inline message "Only 4 in stock" in `danger`, not a silent clamp.
- Remove: 44 × 44 icon button, `ink-3`, `danger` on hover.
- A newly added line highlights with `primary-soft` that fades over 300 ms, so the cashier sees what changed.

**Totals block** (sticky above the payment area):

| Row | Style |
|---|---|
| Subtotal | 15 px, `ink-2` label, `ink` value, right-aligned |
| Discount (shown only if the user has permission; text button "Add discount" otherwise hidden) | Same, value in `ink` with minus sign |
| **Total** | 32 px 700, label "Total" 15 px 600 |

**Payment area:**

- Payment method: a segmented control, one row, 48 px high, `sunken` track, selected segment white with a 1 px `line-strong` border and `ink` text. Options exactly as today (Cash, Card, Bank transfer, Other).
- Cash: "Amount received" input (48 px, right-aligned numerals) and a "Change due" line (17 px 600; `success` text when ≥ 0, `danger` "Short by Rs. …" when below the total).
- Other methods: a "Reference" input only if the app has one today.
- **Complete sale**: full-width primary button, 56 px high, 17 px 600, label "Complete sale" and the amount on the right side of the button. Disabled (`sunken` fill, `disabled-ink` text) when the cart is empty, cash received is short, or no shift is open. While submitting: spinner and label "Completing…", button disabled (matches the duplicate-submission protection).

### 5.6 Completion view

After a successful sale the cart panel shows: a green check icon, "Sale complete", the invoice number (tabular), change due if cash (24 px 700), then two buttons: **Print receipt** (primary, 48 px) and **New sale** (secondary, 48 px). The scan field regains focus on New sale.

### 5.7 Required states

| State | Treatment |
|---|---|
| Loading catalogue | Skeleton tiles (`sunken` blocks), no spinners over content |
| No results | "No shoes match 'xyz'." with a text button "Clear search" |
| Out of stock variant | Chip struck out and disabled; if scanned: toast "Out of stock at this branch" (danger) |
| Low stock | `warning` dot on chip and text "Only N left" |
| Scan not found | Toast "No shoe found for this barcode" and the scan field is cleared and refocused |
| Connection lost | Full-width `warning-soft` bar under the top bar: "Connection lost. Sales are paused until you are back online." Complete sale disabled |
| Error on save | Inline `danger-soft` message above the button with what went wrong and what to do |

---

## 6. Shift closed (replaces the "Cash drawer locked" treatment)

Show state **once** in the top bar chip and **once** in the catalogue. Do not repeat it in the sidebar, banner and chip.

- **Notice:** a single bar at the top of the catalogue panel: `primary-soft` background, `primary-soft-line` border, 12 px radius, 16 px padding. Left: info icon and the text "Open a shift to start selling." with a second line in `ink-2`: "Enter your starting cash to begin." Right: primary button **Open shift** (44 px). No orange, no gold, no rule numbers.
- The catalogue stays browsable so staff can check stock and prices. Add buttons are disabled with tooltip "Open a shift first". The scan field is disabled.
- The cart shows its normal empty state.
- **Open shift dialog** (modal, 440 px): title "Open shift", one input "Starting cash (float)" with the currency prefix, helper "Count the cash in the drawer before you start.", buttons Cancel and **Open shift**. On success the chip turns to "Shift open since HH:MM" and the notice disappears.

---

## 7. Other modules: shared page patterns

Apply the same tokens and components to every module. Page structure:

1. **Page header:** title (22 px, 600), one line of description in `ink-2` only if it helps, primary action on the right.
2. **Filter bar:** inputs and dropdowns in one row, 44 px high, with a text button "Clear filters".
3. **Content:** a table or a two-pane layout on a white panel.

| Module | Layout |
|---|---|
| Cash Drawer & Shifts | Current shift summary (opening float, sales by method, expected cash) in a white panel above a shift-history table. Close shift is a primary button; the count and variance form opens in a modal |
| Returns & Exchanges | Two panes: left 40% find the sale (search by invoice number) and see its lines; right 60% the return or exchange form (line selection, reason, disposition, refund method, summary). Sticky footer with the primary action. Printing uses the receipt layout |
| Shoe Repair Desk | Tabs: Receive repair, Queue, Completed, Collected. Receive repair is a single-column form with a live summary on the right; Save and print is the primary action. Lists are tables with status badges and ageing |
| Branch Transfers | Table of transfers with status badges; detail view with line table and the one next action for the user's role as the primary button (Approve, Dispatch, Receive) |
| Stock & Movements | Stock table with a branch filter and low-stock toggle; Movements as a second tab |
| Product Catalog | Table with search; product detail as a slide-over panel containing the variants table |
| Purchasing & Inward | Form with supplier and branch at the top, line table, totals and payment at the bottom right |
| Suppliers & Cheques | Supplier list with balance column (right-aligned); tabs for Ledger, Payments and Cheques |
| Reports & Z-Reports | Report picker on the left (list), report on the right with date filter and Export |
| Admin & Settings | Left list of sections, form on the right |

### 7.1 Status badges (text plus a small dot, sentence case)

| Status | Style |
|---|---|
| Pending, Requested, Received (repair), Low stock | `warning-soft` background, `warning` text — except Requested and Received, which use `sunken` / `ink-2` |
| Approved, Dispatched, In repair | `primary-soft` / `primary-ink` |
| Cleared, Completed, Received (transfer), Collected | `success-soft` / `success` |
| Bounced, Cancelled with money impact, Out of stock, Unrepairable | `danger-soft` / `danger` |
| Cancelled (no impact), Closed | `sunken` / `ink-2` |

Badge: 28 px high, 13 px 600 text, 8 px radius. Never rely on colour alone: the label text always carries the meaning.

---

## 8. Component specifications

| Component | Specification |
|---|---|
| **Primary button** | `primary` fill, white text, 8 px radius, 48 px high (56 px for Complete sale), hover `primary-hover`, pressed same with 1 px inset, disabled `sunken` fill and `disabled-ink` text. One primary button per region |
| **Secondary button** | White fill, 1 px `line-strong` border, `ink` text, hover `sunken` |
| **Text button** | `primary` text, no border, 44 px hit area, underline on hover |
| **Destructive button** | `danger` fill, white text; always paired with a confirmation dialog that states the effect |
| **Icon button** | 44 × 44, `ink-2`, hover `sunken`, always has an accessible label and tooltip |
| **Input** | 44 px (48 px on POS), white, 1 px `line-strong`, 8 px radius, 15 px text, `ink-3` placeholder; focus 2 px `primary` ring; error 1 px `danger` border with message below in 13 px `danger` |
| **Label** | Above the input, 14 px 600, `ink` (not all caps); optional marker "(optional)" in `ink-3` |
| **Dropdown / menu** | White, 1 px `line`, 8 px radius, floating shadow, items 44 px high, selected item `primary-soft` |
| **Segmented control** | `sunken` track, 48 px high, selected segment white with 1 px `line-strong` |
| **Chip (filter, size)** | 40–44 px high, 8 px radius, states per Section 5 |
| **Table** | Header 44 px, `sunken` background, 14 px 600 `ink-2` text (not all caps); rows 52 px, 1 px `line` dividers, no zebra stripes; hover `canvas`; numbers right-aligned and tabular; sticky header; pagination 44 px controls |
| **Modal** | White, 16 px radius, 440 px (confirm) or 640 px (form) wide, 24 px padding, title 20 px 600, buttons right-aligned with primary on the far right, backdrop `rgba(16,24,40,0.45)`, closes with Esc, focus trapped |
| **Toast** | Top right below the top bar, white, 1 px `line`, 4 px left bar in status colour, auto-dismiss 4 s (errors stay until dismissed) |
| **Empty state** | One icon, one sentence stating what is missing, one action that fixes it |
| **Icons** | One line-icon set (Lucide), 20 px, 1.75 px stroke, `ink-2` by default |

---

## 9. Copy and things to remove

**Remove from the production UI:** "Rule V6" and any rule or spec identifiers; "Phase 1 [R]"; "Firestore Cloud Mode"; "Footwear Management v1.1" under the logo; all-caps labels ("OPERATIONAL MODULES", "ACTIVE BRANCH CONTEXT", "LOGGED STAFF", "DRAWER LOCKED"); the "LOCKED" and "CLOSED" sidebar badges; the Next.js development badge (it only appears in development builds, make sure the production build is used for the counter).

**Copy rules:**
- Sentence case, plain verbs, no jargon. "Open shift", "Complete sale", "Print receipt", "New sale".
- A button says what will happen. The same action keeps the same name everywhere (the button "Complete sale" produces the message "Sale complete").
- Errors say what happened and what to do: "Only 4 in stock. Reduce the quantity or choose another size."
- No exclamation marks, no emoji.
- Currency format stays as configured (currently "Rs. 18,900.00"); keep two decimals only where cents matter and be consistent across the app.

---

## 10. Interaction, keyboard and touch

- Scan field keeps focus after Add, Remove, Complete sale, closing a modal, and changing category. A scanned barcode adds the exact variant to the cart immediately (existing behaviour).
- Keyboard shortcuts, as already planned for the POS: F-keys for payment method, quantity field and Complete sale. Show the shortcut as a small `ink-3` hint on the control ("F9"). Do not add new functions.
- Tab order: scan, search, tiles, cart lines, payment, Complete sale.
- Touch: 44 px minimum targets, 8 px minimum between adjacent targets; no hover-only information (hover content must also appear on press or focus); no double-tap or swipe gestures required.
- Press feedback: background change within 100 ms.

---

## 11. Responsive behaviour

| Width | Behaviour |
|---|---|
| 1600 px and above | Sidebar expanded, 4 tile columns, cart 420 px |
| 1280–1599 px | Sidebar expanded, 3 columns, cart 400 px (reference layout) |
| 1024–1279 px (tablet landscape) | Sidebar collapses to the 72 px rail, 2 columns, cart 360 px, top bar hides the branch code |
| Below 1024 px | Sidebar becomes a slide-over menu; cart becomes a bottom sheet opened by a sticky "View sale (N items) Rs. total" bar; payment steps inside the sheet |

The Complete sale button and the total must be visible without scrolling at 1280 × 720 and 1024 × 768. Only the line-item area scrolls.

---

## 12. Accessibility

- All text meets 4.5:1 contrast (tokens in Section 3.1 already do); large text and icons meet 3:1.
- Visible keyboard focus on every control: 2 px `primary` ring with 2 px offset.
- Never use colour as the only signal: stock states have text, status badges have labels, chip states have shape changes (strike, dot).
- Every icon-only button has an accessible name.
- Form errors are announced (`aria-live="polite"`) and linked to the input (`aria-describedby`).
- Modals trap focus and return it to the trigger on close.
- Respect `prefers-reduced-motion` (disable the line highlight fade and any transitions).
- Minimum text size 13 px; the user's browser zoom to 200% must not break the layout.

---

## 13. Function inventory (must behave exactly as today)

Use this as a regression checklist after the redesign.

| Area | Functions to preserve |
|---|---|
| Sidebar | The 11 modules, role-based visibility, navigation, active state |
| Top bar | Branch context display (and selector for Super Admin only), shift status and Open shift action, logged-in staff menu (including sign out), refresh |
| Shift gate | Sales blocked until a shift with a starting cash float is open; open-shift flow |
| Scan | Barcode and SKU entry, Enter to submit, Scan button, auto-focus, exact variant added to cart |
| Search | Search by name, brand, colour, size (and SKU/barcode) |
| Categories | Category filtering including All footwear |
| Product data per variant | Brand, product name, colour, EU and UK size, SKU, stock count for the active branch, selling price |
| Add to sale | Adds the exact variant; stock check; disabled or blocked when out of stock |
| Cart | Item count, quantity change, remove item, empty state, line totals, subtotal, discount (if permitted), total |
| Customer | Customer name and mobile phone fields |
| Payment | Cash, card, bank transfer and other; amount received, change due, completion, invoice generation, receipt print, stock deduction |
| Duplicate protection | Complete sale disables while submitting; idempotency behaviour unchanged |
| Branch isolation | Only the user's permitted branch data is shown |

---

## 14. Functional issues seen in the screenshot (not design, please check)

1. **Branch and staff mismatch.** The top bar shows the active branch as SHOP002 while the logged-in staff is "Shop 1 Cashier". A cashier must never be able to view or sell in a branch they are not assigned to. The branch indicator for non-admin users should come from the user's assigned shop, be non-editable, and be enforced on the server, not only in the UI.
2. **Wrong rule reference.** The banner cites "Rule V6". In the specification, V6 is the purchase-quantity rule; the shift requirement is V39 (v1.1). Rule IDs should not appear in the interface at all.
3. **Development labels in production.** "Phase 1 [R]", "Firestore Cloud Mode" and the Next.js badge should not reach the counter.

---

## 15. Acceptance checklist

| # | Check | Pass when |
|---|---|---|
| 1 | Theme | Light theme; only the tokens in Section 3; no hard-coded colours; no gradients or glows |
| 2 | Colour budget | At most three hues visible at once (neutral, blue, one status colour) |
| 3 | Type | No text under 13 px; body 15 px; sentence case; tabular numerals on money |
| 4 | Density | At 1280 × 720 the catalogue shows 3 columns with at most five items of information per tile; no tile text overlaps or truncates the price |
| 5 | Shift state | Appears in exactly two places (top bar chip, catalogue notice) and nowhere else |
| 6 | Cart | Total (32 px) and Complete sale (56 px) visible without scrolling at 1280 × 720 and 1024 × 768 |
| 7 | Touch | Every control at least 44 px; 8 px between neighbours |
| 8 | Contrast and focus | AA contrast; visible focus ring on every control |
| 9 | Removed items | No "Rule V6", "Phase 1 [R]", "Firestore Cloud Mode", all-caps labels or sidebar status badges |
| 10 | Function | Every row of Section 13 verified on a real device; no change to logic or data files in the diff |
| 11 | Responsive | Layouts per Section 11 verified at 1600, 1280, 1024 and 768 widths |
| 12 | States | Loading, empty, no results, out of stock, low stock, scan not found, offline, error and sale-complete states implemented |

---

## 16. Prompt to give your coding tool

> You are restyling an existing Next.js + TypeScript + Tailwind POS called Apex POS. This is a **presentation-only** change: do not modify business logic, state management, hooks, props, API/Firestore calls, validation, permissions or routing. Replace the dark theme with the light blue-and-grey design system in `POS UI Design Instructions.md` (tokens in Section 3, shell in Section 4, POS screen in Section 5, shift state in Section 6, shared patterns in Sections 7–8). Use IBM Plex Sans with tabular numerals for money. Minimum text size 13 px, minimum touch target 44 px. Show shift status only in the top-bar chip and one inline notice. Remove the development labels listed in Section 9. Use Option A (grouped product tiles) unless told otherwise. After the change, walk through the function inventory in Section 13 and confirm each item still works. Do not add new features.
