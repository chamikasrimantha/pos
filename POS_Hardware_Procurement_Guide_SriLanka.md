# POS Hardware Procurement Guide & Bill of Materials (BOM)
## Complete Counter Setup Specification for 2 Outlets (Sri Lanka)

**Target Outlets:** RightWay Shoes (Colombo) & Mega Shoes (Kandy)  
**System Architecture:** Cloud-Synced Footwear POS & Inventory Engine (Next.js / Firebase)  
**Market & Pricing Location:** Colombo & Kandy, Sri Lanka  
**Currency:** Sri Lankan Rupees (LKR)  
**PDF Document:** [POS_Hardware_Procurement_Guide_SriLanka.pdf](file:///D:/Projects/pos/POS_Hardware_Procurement_Guide_SriLanka.pdf)

---

## 1. Executive Summary

This document specifies the required physical hardware components, verified Sri Lankan market models, pricing estimates, and physical connection topology for deploying the Point of Sale system at **RightWay Shoes** (Colombo) and **Mega Shoes** (Kandy).

All recommended hardware models are **standard, proven retail workhorses readily available in Sri Lanka** with local vendor support, accessible spare parts, and low consumable costs.

* **Recommended Value Package (Both Outlets):** **~ Rs. 301,000 LKR**
* **Premium Commercial Package (Both Outlets):** **~ Rs. 545,000 LKR**

---

## 2. Equipment Breakdown Per Outlet (1 Counter Workstation)

Each outlet requires **1 Dedicated POS Billing Workstation**:

| Component | Purpose in POS System | Recommended Models in Sri Lanka | Estimated Price (LKR / Unit) |
| :--- | :--- | :--- | :--- |
| **A. POS Terminal / PC** | Runs web POS counter, live inventory lookups, Z-reports, and offline synchronization in Google Chrome/Edge. | • **Option 1 (Best Value & Easy to Service)**: Refurbished Mini PC (HP ProDesk Mini / Dell OptiPlex Micro / Lenovo Tiny) — Core i5 (6th–8th Gen), 8GB RAM, 256GB SSD + 19.5″ LED Monitor.<br>• **Option 2 (Sleek All-In-One Touch)**: 15.6″ Touch POS Machine (Posiflex, Sunmi D2s, or Xprinter Touch POS). | **Option 1**: Rs. 55,000 – 68,000<br>**Option 2**: Rs. 110,000 – 140,000 |
| **B. 80mm Receipt Printer** | Prints thermal customer bills (ESC/POS 80mm format), Z-Reports, repair intake slips, and triggers cash drawer. | • **Xprinter XP-Q800 / XP-N160II / XP-80T** (80mm USB + Auto-cutter, high availability)<br>• **Epson TM-T82X / TM-T20III** (High reliability, Metropolitan warranty) | **Xprinter**: Rs. 16,500 – 22,000<br>**Epson**: Rs. 48,000 – 58,000 |
| **C. Barcode Label Printer** | Prints footwear box stickers & shoe tags (**50mm × 30mm** thermal roll) with vector SVG barcodes. | • **Xprinter XP-365B / XP-370B / XP-420B** (Direct Thermal label printer, 203 DPI, gap sensor)<br>• **Gprinter GP-3120TU** or **Rongta RP421** | Rs. 24,000 – 32,000 |
| **D. Barcode Scanner** | Rapid shoe box scanning (EAN-13 & Code-128 SKUs), transfers receiving, intake lookup. | • **Option 1 (Premium 2D Imager)**: Zebra DS2208 (USB with auto-sensing presentation stand)<br>• **Option 2**: Honeywell Voyager 1250g / 1400g<br>• **Option 3 (Budget 1D/2D)**: Sunlux XL-6500A / Netum NT-2012 (with hands-free stand) | **Sunlux/Netum**: Rs. 8,500 – 11,000<br>**Zebra/Honeywell**: Rs. 18,000 – 35,000 |
| **E. Cash Drawer** | Secure till cash storage with automatic pop-open upon cash bill completion via printer pulse. | • **Standard Heavy Duty Metal Cash Drawer (RJ11 interface)**: 5 bill slots (fits Rs. 5000, 1000, 500, 100, 50), 8 coin compartments (e.g., Maken MK-410, Posiflex CR-4000, or generic 405A). | Rs. 12,500 – 16,500 |
| **F. UPS (Power Backup)** | Protects PC and printers against grid dropouts and power surges. Prevents shift data corruption. | • **Prolink PRO701SFC / PRO700 (650VA–850VA)**<br>• **DCP 650VA / 1200VA** Line Interactive UPS with AVR (Automatic Voltage Regulation). | Rs. 10,000 – 14,000 |

---

## 3. Consumables & Paper Rolls (First Month Supply)

| Consumable | Specification | Where It Fits | Approx. Price (LKR) |
| :--- | :--- | :--- | :--- |
| **Thermal Receipt Paper** | **80mm × 80mm** (or 80mm × 70mm) High-grade Thermal Paper rolls, BPA free | 80mm receipt printer | Rs. 250 – 320 per roll<br>*(Box of 50 = ~Rs. 13,000)* |
| **Thermal Sticker Labels** | **50mm × 30mm** Direct Thermal Self-Adhesive Rolls (~1,000 labels/roll, 2mm gap) | Shoe boxes, heels, and soles | Rs. 650 – 850 per roll<br>*(10 rolls = ~Rs. 7,500)* |
| **A4 Sticker Paper** *(Optional)* | 24 labels/sheet standard A4 self-adhesive sticker sheets | Office laser/inkjet backup batch printing | Rs. 45 – 60 per sheet |

---

## 4. Total Bill of Materials (BOM) — 2 Outlets (Colombo & Kandy)

### Recommended Setup (High Performance + Value for Money)

| Item Description | Qty (2 Stores) | Estimated Unit Cost | Total Cost (LKR) |
| :--- | :---: | :---: | :---: |
| **HP / Dell Mini PC** (Intel Core i5, 8GB RAM, 256GB SSD) + 19.5″ LED Monitor | 2 Sets | Rs. 62,000 | Rs. 124,000 |
| **Xprinter XP-Q800 / XP-N160II** (80mm Thermal Receipt Printer + Auto-Cutter) | 2 Units | Rs. 19,500 | Rs. 39,000 |
| **Xprinter XP-365B / XP-370B** (50×30mm Thermal Barcode Label Printer) | 2 Units | Rs. 26,500 | Rs. 53,000 |
| **Sunlux / Netum 1D/2D Barcode Scanner** with Auto-Sensing Hands-Free Stand | 2 Units | Rs. 9,500 | Rs. 19,000 |
| **Maken MK-410 Heavy Duty RJ11 Electronic Cash Drawer** (5 Note / 8 Coin) | 2 Units | Rs. 13,500 | Rs. 27,000 |
| **Prolink PRO701SFC / DCP 850VA** Line-Interactive UPS with AVR | 2 Units | Rs. 12,500 | Rs. 25,000 |
| **Startup Consumables Pack** (20× 80mm receipt rolls + 10× 50×30mm label rolls) | 2 Outlets | — | Rs. 14,000 |
| **Total Estimated Investment (Both Outlets Inclusive)** | | | **~ Rs. 301,000 LKR** |

*(If using brand-new Touch All-in-One Terminals instead of Mini PCs, add approximately Rs. 100,000 – 140,000 to the total budget).*

---

## 5. Physical Hardware Cabling & Architecture

```
[ POWER WALL OUTLET ] ──► [ UPS (Prolink / DCP 650VA-850VA) ]
                               │
               ┌───────────────┴───────────────┐ Clean Uninterrupted Power
               ▼                               ▼
       [ BILLING MINI PC ]            [ THERMAL PRINTERS ]
         (Core i5, 8GB)                Receipt & Label Printers
               │
   ┌───────────┼───────────┐
   │ (USB)     │ (USB)     │ (USB)
   ▼           ▼           ▼
[SCANNER]   [80mm BILL]  [50x30mm LABEL]
Zebra/      Xprinter     Xprinter
Sunlux      XP-Q800      XP-365B
               │
               │ (RJ11 Cable - 24V Solenoid Trigger)
               ▼
     [ CASH DRAWER (Maken) ]
     (Auto-pops upon sale completion)
```

---

## 6. Where to Buy in Sri Lanka

The client can purchase these items directly from verified vendors in Colombo or order for delivery to Kandy:

1. **Unity Plaza (Galle Road, Bambalapitiya, Colombo 04)**:
   * *Barclays Computers, Redline Technologies, Nanotek, TechZone, Sense Micro, Winsoft*: Best for Mini PCs, monitors, UPS units, RAM/SSD upgrades, and cables.
2. **Dedicated POS & Barcode Hardware Specialists**:
   * **BarcodeSL / PrintPOS** (*barcode.lk*): Specialized in Xprinter receipt and label printers, 50×30mm thermal rolls, and scanners.
   * **POSMarket.lk / Dynamic POS Technologies** (*Colombo 03 / Nugegoda*): Great for Maken cash drawers, Sunlux scanners, and 80mm paper supplies.
   * **MSK Computers / DB Automation** (*Colombo / Pettah*): Readily stocked with Xprinter and budget POS hardware.
3. **Authorized Brand Distributors**:
   * **Metropolitan Technologies (Pvt) Ltd** (*Vauxhall St, Colombo 02 & Kandy branch*): Official Epson thermal printers and Zebra barcode scanners with genuine warranties.
   * **E-Guardian / Debug Computers**: Commercial touch terminals and POS warranty repairs.
4. **Kandy Local Suppliers (For Mega Shoes)**:
   * IT shops in **Kandy City Centre (KCC)** and Peradeniya Road for emergency receipt paper roll restocking, UPS battery replacements, and local servicing.

---

## 7. Technical Compatibility Notes for the Client

1. **Cash Drawer Connection:**
   * The cash drawer does **not** plug into the computer's USB port. It plugs directly into the **RJ11 port (marked "DK")** on the back of the 80mm receipt printer.
   * When a cash sale is completed, the printer sends a 24V electrical kick-pulse to pop open the drawer automatically.
2. **Label Printer Technology & Calibration:**
   * Recommend **Direct Thermal** (like the *Xprinter XP-365B*). It requires **no ink or ribbon**—the heat from the print head marks the heat-sensitive 50×30mm stickers directly, keeping running costs minimal.
   * Hold the feed button until it beeps twice to auto-calibrate label gaps. In Windows printer preferences, configure page dimensions to `50mm Width × 30mm Height, 0mm Margins`.
3. **Zero Hardware Cost for Mobile Stocktake:**
   * The client does **not** need to buy expensive wireless handheld stocktaking guns. Staff and managers can use their personal **Android smartphones or iPhones** (Chrome / Safari); the system's built-in camera barcode scanner directly scans box labels during physical stock counts and inter-branch transfers.
4. **Internet Redundancy:**
   * Equip each counter with a 4G Wi-Fi backup router (Dialog / SLT-Mobitel) alongside the main fiber line so billing never halts during broadband interruptions.
