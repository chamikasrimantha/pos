// src/components/purchases/PurchasesView.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import {
  getPurchases,
  getSuppliersForUser,
  getVariants,
  getProducts,
  getCategories,
  getBrands,
  getColors,
  getSizes,
  getShops,
  addSupplier,
  createPurchase,
  markPurchaseReviewed,
  cancelPurchase,
} from "@/lib/firestore-service";
import {
  formatCurrency,
  formatDate,
  renderPurchaseBillHTML,
  renderChequeVoucherHTML,
} from "@/lib/receipt-generator";
import {
  Product,
  ProductVariant,
  ProductType,
  Purchase,
  Cheque,
  Supplier,
} from "@/types";
import { CameraScannerModal } from "@/components/common/CameraScannerModal";
import { QuickAddProductModal } from "@/components/products/QuickAddProductModal";
import { LabelEditorModal } from "@/components/products/LabelEditorModal";
import {
  Truck,
  Plus,
  PlusCircle,
  Search,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Printer,
  Barcode,
  Layers,
  ArrowRight,
  Filter,
  Eye,
  X,
  CreditCard,
  Banknote,
  FileCheck,
  Building2,
  Calendar,
} from "lucide-react";

interface PurchaseLine {
  variant: ProductVariant;
  quantity: number;
  unitCost: number;
}

export function PurchasesView() {
  const { activeShop, currentUser, showToast, refreshData, dataVersion, openPrintModal } = useApp();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isCashier = currentUser?.role === "CASHIER";

  // Tab State: Cashiers see "New purchase" & "My purchases"; Super Admin sees "New purchase" & "All purchases"
  const [activeTab, setActiveTab] = useState<"NEW" | "HISTORY">("NEW");

  // Master Data
  const shops = useMemo(() => getShops(), []);
  const suppliers = useMemo(() => getSuppliersForUser(currentUser), [currentUser, dataVersion]);
  const allVariants = useMemo(() => getVariants(), [dataVersion]);
  const allProducts = useMemo(() => getProducts(), [dataVersion]);
  const allCategories = useMemo(() => getCategories(), [dataVersion]);
  const allBrands = useMemo(() => getBrands(), [dataVersion]);
  const allColors = useMemo(() => getColors(), [dataVersion]);
  const allSizes = useMemo(() => getSizes(), [dataVersion]);

  // Purchases list
  const purchases = useMemo(() => {
    return getPurchases(undefined, currentUser);
  }, [currentUser, dataVersion]);

  // ----------------------------------------
  // NEW PURCHASE FORM STATE
  // ----------------------------------------
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [supplierBillNumber, setSupplierBillNumber] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [targetShopId, setTargetShopId] = useState<string>(activeShop.id);
  const [purchaseNotes, setPurchaseNotes] = useState<string>("");

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "CHEQUE" | "CREDIT" | "BANK_TRANSFER" | "PARTIAL"
  >("CASH");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [chequeNumber, setChequeNumber] = useState<string>("");
  const [chequeBank, setChequeBank] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Lines
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [costWarning, setCostWarning] = useState<string | null>(null);

  // ----------------------------------------
  // PRODUCT PICKER & SIZE-RUN GRID STATE
  // ----------------------------------------
  const [filterType, setFilterType] = useState<"ALL" | ProductType>("ALL");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("ALL");
  const [filterBrandId, setFilterBrandId] = useState<string>("ALL");
  const [filterColorId, setFilterColorId] = useState<string>("ALL");
  const [filterSizeId, setFilterSizeId] = useState<string>("ALL");
  const [filterGender, setFilterGender] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [barcodeInput, setBarcodeInput] = useState<string>("");

  // Grid product selection
  const [selectedGridProduct, setSelectedGridProduct] = useState<Product | null>(null);
  const [defaultGridCost, setDefaultGridCost] = useState<string>("");
  const [costPerColor, setCostPerColor] = useState<boolean>(false);
  const [colorCostMap, setColorCostMap] = useState<Record<string, string>>({});
  // Grid cell quantities: [colorId_sizeId] -> quantity
  const [gridQuantities, setGridQuantities] = useState<Record<string, number>>({});

  // ----------------------------------------
  // MODALS
  // ----------------------------------------
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>("");
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>("");
  const [newSupplierContact, setNewSupplierContact] = useState<string>("");
  const [newSupplierAddress, setNewSupplierAddress] = useState<string>("");
  const [supplierModalError, setSupplierModalError] = useState<string | null>(null);

  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const [isLabelEditorOpen, setIsLabelEditorOpen] = useState<boolean>(false);

  // Post-purchase modal
  const [completedPurchase, setCompletedPurchase] = useState<Purchase | null>(null);
  const [completedCheque, setCompletedCheque] = useState<Cheque | null>(null);

  // Super Admin view detail & review modal
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [reviewNote, setReviewNote] = useState<string>("");
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  // History Filter State (for Super Admin)
  const [historyShopFilter, setHistoryShopFilter] = useState<string>("ALL");
  const [historySupplierFilter, setHistorySupplierFilter] = useState<string>("ALL");
  const [historyMethodFilter, setHistoryMethodFilter] = useState<string>("ALL");
  const [historyReviewFilter, setHistoryReviewFilter] = useState<string>("ALL");
  const [historySearch, setHistorySearch] = useState<string>("");

  // Select initial supplier if available
  useEffect(() => {
    if (suppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(suppliers[0].id || "");
    }
  }, [suppliers, selectedSupplierId]);

  // Keep target shop synced for cashiers
  useEffect(() => {
    if (isCashier) {
      setTargetShopId(activeShop.id);
    }
  }, [activeShop.id, isCashier]);

  // ----------------------------------------
  // TOTALS & COST VARIANCE CALCULATION
  // ----------------------------------------
  const totalBillUnits = useMemo(() => {
    return purchaseLines.reduce((sum, line) => sum + line.quantity, 0);
  }, [purchaseLines]);

  const totalBillAmount = useMemo(() => {
    return purchaseLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  }, [purchaseLines]);

  // Check cost variance whenever lines change
  useEffect(() => {
    let hasVariance = false;
    for (const line of purchaseLines) {
      let prevCost: number | null = null;
      for (const past of purchases) {
        if (past.status !== "CANCELLED") {
          const it = past.items.find((item) => item.variantId === line.variant.id);
          if (it && it.unitCost > 0) {
            prevCost = it.unitCost;
            break;
          }
        }
      }
      if (prevCost === null && line.variant.referenceCostPrice > 0) {
        prevCost = line.variant.referenceCostPrice;
      }
      if (prevCost !== null && prevCost > 0) {
        const diff = Math.abs(line.unitCost - prevCost) / prevCost;
        if (diff > 0.25) {
          hasVariance = true;
          break;
        }
      }
    }
    if (hasVariance) {
      setCostWarning(
        "Warning: Unit cost on one or more items differs significantly from previous purchase history. This purchase will be flagged for review."
      );
    } else {
      setCostWarning(null);
    }
  }, [purchaseLines, purchases]);

  // ----------------------------------------
  // PRODUCT FILTERING FOR SELECTION
  // ----------------------------------------
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      if (filterType !== "ALL" && (p.productType || "FOOTWEAR") !== filterType) return false;
      if (filterCategoryId !== "ALL" && p.categoryId !== filterCategoryId) return false;
      if (filterBrandId !== "ALL" && p.brandId !== filterBrandId) return false;
      if (filterGender !== "ALL" && p.gender !== filterGender) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const bName = allBrands.find((b) => b.id === p.brandId)?.name || "";
        const matchesBrand = bName.toLowerCase().includes(q);
        if (!matchesName && !matchesBrand) {
          // Check variants
          const productVariants = allVariants.filter((v) => v.productId === p.id);
          const variantMatch = productVariants.some(
            (v) =>
              v.sku.toLowerCase().includes(q) ||
              v.barcode.includes(q) ||
              (v.colorNameCache || "").toLowerCase().includes(q)
          );
          if (!variantMatch) return false;
        }
      }

      return p.active !== false;
    });
  }, [
    allProducts,
    allVariants,
    filterType,
    filterCategoryId,
    filterBrandId,
    filterGender,
    searchQuery,
  ]);

  // When a product is selected for size-run grid:
  const gridVariants = useMemo(() => {
    if (!selectedGridProduct) return [];
    return allVariants.filter((v) => v.productId === selectedGridProduct.id && v.active !== false);
  }, [selectedGridProduct, allVariants]);

  // Distinct colors and sizes for the selected grid product
  const gridColors = useMemo(() => {
    const map = new Map<string, string>();
    gridVariants.forEach((v) => {
      map.set(v.colorId, v.colorNameCache || "Standard");
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [gridVariants]);

  const gridSizes = useMemo(() => {
    const map = new Map<string, { id: string; label: string; order: number }>();
    gridVariants.forEach((v) => {
      const sizeObj = allSizes.find((s) => s.id === v.sizeId);
      map.set(v.sizeId, {
        id: v.sizeId,
        label: v.sizeLabelCache || sizeObj?.label || "One Size",
        order: allSizes.findIndex((s) => s.id === v.sizeId),
      });
    });
    return Array.from(map.values()).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [gridVariants, allSizes]);

  // Initialize default grid cost when product changes
  useEffect(() => {
    if (selectedGridProduct && gridVariants.length > 0) {
      const defaultCost = gridVariants[0].referenceCostPrice || 0;
      setDefaultGridCost(defaultCost > 0 ? String(defaultCost) : "");
      setGridQuantities({});
      setColorCostMap({});
      setCostPerColor(false);
    }
  }, [selectedGridProduct, gridVariants]);

  // Add grid items to lines
  const handleAddGridToLines = () => {
    if (!selectedGridProduct) return;
    const baseCost = parseFloat(defaultGridCost) || 0;
    const newLines: PurchaseLine[] = [...purchaseLines];

    let itemsAdded = 0;
    for (const [key, qty] of Object.entries(gridQuantities)) {
      if (qty > 0) {
        const [colorId, sizeId] = key.split("_");
        const variant = gridVariants.find((v) => v.colorId === colorId && v.sizeId === sizeId);
        if (variant) {
          const unitCost = costPerColor ? parseFloat(colorCostMap[colorId]) || baseCost : baseCost;
          const existingIdx = newLines.findIndex((l) => l.variant.id === variant.id);
          if (existingIdx !== -1) {
            newLines[existingIdx].quantity += qty;
            newLines[existingIdx].unitCost = unitCost;
          } else {
            newLines.push({
              variant,
              quantity: qty,
              unitCost,
            });
          }
          itemsAdded += qty;
        }
      }
    }

    if (itemsAdded === 0) {
      showToast("Please enter quantities in at least one cell.", "info");
      return;
    }

    setPurchaseLines(newLines);
    showToast(`Added ${itemsAdded} units of ${selectedGridProduct.name} to bill.`, "success");
    setSelectedGridProduct(null);
    setGridQuantities({});
  };

  // Add single variant by barcode or scanner
  const handleScanBarcode = (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    const variant = allVariants.find(
      (v) => v.barcode.toLowerCase() === trimmed.toLowerCase() || v.sku.toLowerCase() === trimmed.toLowerCase()
    );

    if (!variant) {
      showToast(`No product found for barcode: ${trimmed}`, "error");
      return;
    }

    const existingIdx = purchaseLines.findIndex((l) => l.variant.id === variant.id);
    if (existingIdx !== -1) {
      setPurchaseLines((prev) =>
        prev.map((l, i) => (i === existingIdx ? { ...l, quantity: l.quantity + 1 } : l))
      );
      showToast(`Incremented ${variant.productNameCache} (${variant.sizeLabelCache}) to ${purchaseLines[existingIdx].quantity + 1}`, "success");
    } else {
      setPurchaseLines((prev) => [
        ...prev,
        {
          variant,
          quantity: 1,
          unitCost: variant.referenceCostPrice || 0,
        },
      ]);
      showToast(`Added ${variant.productNameCache} (${variant.sizeLabelCache}) to bill.`, "success");
    }
    setBarcodeInput("");
  };

  // Line item modifications
  const handleUpdateLineQty = (index: number, qty: number) => {
    setPurchaseLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, quantity: Math.max(1, qty) } : line))
    );
  };

  const handleUpdateLineCost = (index: number, cost: number) => {
    setPurchaseLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, unitCost: Math.max(0, cost) } : line))
    );
  };

  const handleRemoveLine = (index: number) => {
    setPurchaseLines((prev) => prev.filter((_, i) => i !== index));
  };

  // ----------------------------------------
  // ADD SUPPLIER MODAL HANDLER
  // ----------------------------------------
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierModalError(null);
    if (!newSupplierName.trim()) {
      setSupplierModalError("Supplier name is required.");
      return;
    }
    if (!newSupplierPhone.trim()) {
      setSupplierModalError("Supplier phone number is required.");
      return;
    }

    try {
      const created = await addSupplier({
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim(),
        contactPerson: newSupplierContact.trim() || undefined,
        address: newSupplierAddress.trim() || undefined,
        callingUser: currentUser!,
      });

      showToast(`Supplier "${created.name}" created successfully!`, "success");
      setSelectedSupplierId(created.id);
      setIsAddSupplierModalOpen(false);
      setNewSupplierName("");
      setNewSupplierPhone("");
      setNewSupplierContact("");
      setNewSupplierAddress("");
      refreshData();
    } catch (err: any) {
      setSupplierModalError(err.message || "Failed to create supplier");
    }
  };

  // ----------------------------------------
  // SUBMIT PURCHASE BILL
  // ----------------------------------------
  const handleSavePurchase = async () => {
    if (!selectedSupplierId) {
      showToast("Please select a supplier.", "error");
      return;
    }
    if (purchaseLines.length === 0) {
      showToast("Please add at least one line item.", "error");
      return;
    }

    if (paymentMethod === "CHEQUE") {
      if (!chequeNumber.trim()) {
        showToast("Cheque number is required.", "error");
        return;
      }
      if (!chequeBank.trim()) {
        showToast("Bank name is required.", "error");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const parsedChequeDate = chequeDate ? new Date(chequeDate).getTime() : Date.now();
      const parsedInvoiceDate = purchaseDate ? new Date(purchaseDate).getTime() : Date.now();

      const result = await createPurchase({
        shopId: targetShopId,
        supplierId: selectedSupplierId,
        supplierBillNumber: supplierBillNumber.trim() || undefined,
        invoiceDate: parsedInvoiceDate,
        items: purchaseLines.map((l) => ({
          variant: l.variant,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
        notes: purchaseNotes.trim() || undefined,
        paymentMethod,
        paidAmount: paymentMethod === "PARTIAL" ? parseFloat(paidAmount) || 0 : undefined,
        chequeDetails:
          paymentMethod === "CHEQUE"
            ? {
                chequeNumber: chequeNumber.trim(),
                bankName: chequeBank.trim(),
                chequeDate: parsedChequeDate,
              }
            : undefined,
        callingUser: currentUser!,
      });

      setCompletedPurchase(result.purchase);
      setCompletedCheque(result.cheque || null);
      showToast(`Purchase bill #${result.purchase.purchaseNumber} recorded successfully!`, "success");

      // Reset form
      setPurchaseLines([]);
      setPurchaseNotes("");
      setSupplierBillNumber("");
      setChequeNumber("");
      setChequeBank("");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to record purchase bill", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print purchase bill
  const handlePrintPurchaseBill = (purchase: Purchase, isDuplicate: boolean = false) => {
    const shop = shops.find((s) => s.id === purchase.shopId) || activeShop;
    const html = renderPurchaseBillHTML(purchase, shop, { isDuplicate });
    openPrintModal(`Purchase Bill #${purchase.purchaseNumber}`, html);
  };

  // Print cheque voucher
  const handlePrintChequeVoucher = (cheque: Cheque, purchase: Purchase) => {
    const shop = shops.find((s) => s.id === purchase.shopId) || activeShop;
    const html = renderChequeVoucherHTML(cheque, purchase, shop);
    openPrintModal(`Cheque Voucher #${cheque.chequeNumber}`, html);
  };

  // Review purchase handler (Super Admin)
  const handleMarkReviewed = async (purchaseId: string) => {
    if (!isSuperAdmin) return;
    setIsReviewing(true);
    try {
      await markPurchaseReviewed(purchaseId, currentUser!, reviewNote.trim() || undefined);
      showToast("Purchase marked as reviewed.", "success");
      setDetailPurchase(null);
      setReviewNote("");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to mark as reviewed", "error");
    } finally {
      setIsReviewing(false);
    }
  };

  // Cancel purchase handler (Super Admin)
  const handleCancelPurchase = async (purchaseId: string) => {
    if (!isSuperAdmin) return;
    const confirm = window.confirm(
      "Are you sure you want to cancel this purchase? This will deduct the received stock and reverse ledger entries."
    );
    if (!confirm) return;

    try {
      await cancelPurchase(purchaseId, currentUser!, "Cancelled by Super Admin");
      showToast("Purchase cancelled and stock reversed.", "success");
      setDetailPurchase(null);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to cancel purchase", "error");
    }
  };

  // Filtered purchases for history view
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (historyShopFilter !== "ALL" && p.shopId !== historyShopFilter) return false;
      if (historySupplierFilter !== "ALL" && p.supplierId !== historySupplierFilter) return false;
      if (historyMethodFilter !== "ALL" && p.paymentMethod !== historyMethodFilter) return false;
      if (historyReviewFilter !== "ALL") {
        if (historyReviewFilter === "NEEDS_REVIEW" && !p.needsReview) return false;
        if (historyReviewFilter === "REVIEWED" && p.needsReview) return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const matchesNum = p.purchaseNumber.toLowerCase().includes(q);
        const matchesSup = p.supplierNameCache.toLowerCase().includes(q);
        const matchesBill = (p.supplierBillNumber || "").toLowerCase().includes(q);
        const matchesIssuer = (p.createdByNameCache || "").toLowerCase().includes(q);
        if (!matchesNum && !matchesSup && !matchesBill && !matchesIssuer) return false;
      }
      return true;
    });
  }, [
    purchases,
    historyShopFilter,
    historySupplierFilter,
    historyMethodFilter,
    historyReviewFilter,
    historySearch,
  ]);

  return (
    <div
      className="page-responsive-container"
      style={{
        padding: "20px",
        paddingBottom: "100px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* Top Header & Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--primary-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
              }}
            >
              <Truck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                Purchasing & Inward
              </h2>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "2px" }}>
                {isSuperAdmin
                  ? "Record inward shipments, manage supplier bills, cheque issuance, and review cashier purchases."
                  : `Inward shipments for ${activeShop.name} with cash or cheque issuance.`}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "var(--canvas)", padding: "4px", borderRadius: "10px", border: "1px solid var(--line)" }}>
          <button
            className="btn btn-sm"
            onClick={() => setActiveTab("NEW")}
            style={{
              height: "38px",
              padding: "0 16px",
              borderRadius: "8px",
              background: activeTab === "NEW" ? "var(--surface)" : "transparent",
              color: activeTab === "NEW" ? "var(--primary)" : "var(--ink-2)",
              fontWeight: activeTab === "NEW" ? "700" : "500",
              boxShadow: activeTab === "NEW" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              border: "none",
            }}
          >
            <Plus size={16} /> New purchase
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setActiveTab("HISTORY")}
            style={{
              height: "38px",
              padding: "0 16px",
              borderRadius: "8px",
              background: activeTab === "HISTORY" ? "var(--surface)" : "transparent",
              color: activeTab === "HISTORY" ? "var(--primary)" : "var(--ink-2)",
              fontWeight: activeTab === "HISTORY" ? "700" : "500",
              boxShadow: activeTab === "HISTORY" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              border: "none",
            }}
          >
            <FileCheck size={16} /> {isSuperAdmin ? "All purchases" : "My purchases"}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: NEW PURCHASE                                  */}
      {/* ---------------------------------------------------- */}
      {activeTab === "NEW" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Header Card: Supplier & Inward Meta */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              padding: "18px 20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Building2 size={16} color="var(--primary)" /> 1. Supplier & Shipment Details
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              {/* Supplier Picker */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)" }}>
                    Supplier <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddSupplierModalOpen(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <PlusCircle size={13} /> Add new
                  </button>
                </div>
                <select
                  className="input-field"
                  style={{ width: "100%", height: "42px", borderRadius: "8px" }}
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                >
                  <option value="">-- Select supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier Bill / Inv # */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Supplier Bill # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-98124"
                  className="input-field"
                  style={{ width: "100%", height: "42px", borderRadius: "8px" }}
                  value={supplierBillNumber}
                  onChange={(e) => setSupplierBillNumber(e.target.value)}
                />
              </div>

              {/* Date */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Invoice Date
                </label>
                <input
                  type="date"
                  disabled={!isSuperAdmin}
                  className="input-field"
                  style={{
                    width: "100%",
                    height: "42px",
                    borderRadius: "8px",
                    background: !isSuperAdmin ? "var(--canvas)" : "var(--surface)",
                    color: !isSuperAdmin ? "var(--ink-2)" : "var(--ink)",
                  }}
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>

              {/* Branch */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Receiving Branch
                </label>
                {isSuperAdmin ? (
                  <select
                    className="input-field"
                    style={{ width: "100%", height: "42px", borderRadius: "8px" }}
                    value={targetShopId}
                    onChange={(e) => setTargetShopId(e.target.value)}
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    className="input-field"
                    style={{ width: "100%", height: "42px", borderRadius: "8px", background: "var(--canvas)", color: "var(--ink-2)" }}
                    value={activeShop.name}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Product Picker & Adding Goods */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              padding: "18px 20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Layers size={16} color="var(--primary)" /> 2. Add Goods (Size-Run Grid or Single-Line Scan)
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsQuickAddOpen(true)}
                style={{ height: "36px", fontSize: "12px", fontWeight: "700", color: "var(--primary)" }}
              >
                <PlusCircle size={14} /> Add new product to catalogue
              </button>
            </div>

            {/* Quick Barcode Scan Line */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 280px" }}>
                <Barcode
                  size={18}
                  style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }}
                />
                <input
                  type="text"
                  placeholder="Scan or type barcode / SKU and press Enter..."
                  className="input-field"
                  style={{ width: "100%", height: "44px", paddingLeft: "38px", borderRadius: "8px", fontSize: "14px" }}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleScanBarcode(barcodeInput);
                    }
                  }}
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsCameraScannerOpen(true)}
                style={{ height: "44px", padding: "0 14px", borderRadius: "8px" }}
                title="Open Camera Scanner"
              >
                <Camera size={18} /> Camera
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleScanBarcode(barcodeInput)}
                style={{ height: "44px", padding: "0 18px", borderRadius: "8px" }}
              >
                <Plus size={16} /> Add 1 pair
              </button>
            </div>

            {/* Filters Bar for Product Browser */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "14px" }}>
              {/* Type Filter */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Item Type
                </label>
                <select
                  className="input-field"
                  style={{ width: "100%", height: "36px", fontSize: "12px", borderRadius: "6px" }}
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value as any);
                    setFilterCategoryId("ALL");
                  }}
                >
                  <option value="ALL">All Types</option>
                  <option value="FOOTWEAR">Footwear (Shoes/Slippers)</option>
                  <option value="BAG">Bags (Luggage/School/Travel)</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Category
                </label>
                <select
                  className="input-field"
                  style={{ width: "100%", height: "36px", fontSize: "12px", borderRadius: "6px" }}
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  {allCategories
                    .filter((c) => filterType === "ALL" || !c.productType || c.productType === filterType)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Brand */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Brand
                </label>
                <select
                  className="input-field"
                  style={{ width: "100%", height: "36px", fontSize: "12px", borderRadius: "6px" }}
                  value={filterBrandId}
                  onChange={(e) => setFilterBrandId(e.target.value)}
                >
                  <option value="ALL">All Brands</option>
                  {allBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Gender
                </label>
                <select
                  className="input-field"
                  style={{ width: "100%", height: "36px", fontSize: "12px", borderRadius: "6px" }}
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                >
                  <option value="ALL">All Genders</option>
                  <option value="MEN">Men</option>
                  <option value="WOMEN">Women</option>
                  <option value="UNISEX">Unisex</option>
                  <option value="KIDS">Kids</option>
                </select>
              </div>

              {/* Search */}
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Search Product Name or Model
                </label>
                <div style={{ position: "relative" }}>
                  <Search
                    size={15}
                    style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }}
                  />
                  <input
                    type="text"
                    placeholder="Search by model, brand, style..."
                    className="input-field"
                    style={{ width: "100%", height: "36px", paddingLeft: "32px", fontSize: "12px", borderRadius: "6px" }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Product Cards for Grid Selection */}
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "8px", marginBottom: "14px" }}>
              {filteredProducts.slice(0, 15).map((prod) => {
                const isSelected = selectedGridProduct?.id === prod.id;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => setSelectedGridProduct(isSelected ? null : prod)}
                    style={{
                      flex: "0 0 180px",
                      background: isSelected ? "var(--primary-soft)" : "var(--canvas)",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--line)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: "700" }}>
                      {allBrands.find((b) => b.id === prod.brandId)?.name || "Brand"}
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {prod.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--primary)", marginTop: "4px", fontWeight: "600" }}>
                      {isSelected ? "✓ Size grid open" : "+ Open size grid"}
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div style={{ fontSize: "13px", color: "var(--ink-3)", padding: "12px 0" }}>
                  No matching products found. Use "Add new product" above to add to catalog.
                </div>
              )}
            </div>

            {/* SIZE-RUN GRID COMPONENT */}
            {selectedGridProduct && (
              <div
                style={{
                  background: "var(--canvas)",
                  border: "1.5px solid var(--primary)",
                  borderRadius: "10px",
                  padding: "16px",
                  marginTop: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--ink)" }}>
                      Size-Run Grid: {allBrands.find((b) => b.id === selectedGridProduct.brandId)?.name || "Brand"} {selectedGridProduct.name}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--ink-2)", marginLeft: "8px" }}>
                      ({selectedGridProduct.productType || "FOOTWEAR"})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGridProduct(null)}
                    style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: "4px" }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Grid Cost Controls */}
                <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)" }}>
                      Unit Cost (Rs.):
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      style={{ width: "120px", height: "38px", textAlign: "right", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}
                      value={defaultGridCost}
                      onChange={(e) => setDefaultGridCost(e.target.value)}
                    />
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", color: "var(--ink)" }}>
                    <input
                      type="checkbox"
                      checked={costPerColor}
                      onChange={(e) => setCostPerColor(e.target.checked)}
                    />
                    <span>Set separate cost per colour</span>
                  </label>
                </div>

                {/* Table Container with Horizontal Scroll (U10: Responsive at 390px) */}
                <div className="pos-table-container" style={{ background: "var(--surface)" }}>
                  <div style={{ overflowX: "auto", maxHeight: "380px", position: "relative" }}>
                    <table className="pos-table pos-table-form" style={{ width: "100%", minWidth: "480px" }}>
                      <thead>
                        <tr>
                          <th style={{ width: "130px" }}>Colour</th>
                          {costPerColor && (
                            <th className="num" style={{ width: "120px" }}>Cost (Rs.)</th>
                          )}
                          {gridSizes.map((s) => (
                            <th key={s.id} style={{ textAlign: "center", width: "64px" }}>
                              {s.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gridColors.map((c) => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: "700", color: "var(--ink)" }}>
                              {c.name}
                            </td>
                            {costPerColor && (
                              <td className="num">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder={defaultGridCost || "0"}
                                  className="input-field"
                                  style={{ width: "95px", height: "34px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                  value={colorCostMap[c.id] || ""}
                                  onChange={(e) =>
                                    setColorCostMap((prev) => ({ ...prev, [c.id]: e.target.value }))
                                  }
                                />
                              </td>
                            )}
                            {gridSizes.map((s) => {
                              const cellKey = `${c.id}_${s.id}`;
                              const currentVal = gridQuantities[cellKey] || "";
                              return (
                                <td key={s.id} style={{ textAlign: "center" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    className="input-field"
                                    style={{
                                      width: "52px",
                                      height: "34px",
                                      textAlign: "center",
                                      fontWeight: currentVal ? "700" : "500",
                                      background: currentVal ? "var(--primary-soft)" : "var(--surface)",
                                      borderColor: currentVal ? "var(--primary)" : "var(--line-strong)",
                                      margin: "0 auto",
                                      display: "block",
                                    }}
                                    value={currentVal}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      setGridQuantities((prev) => ({
                                        ...prev,
                                        [cellKey]: Math.max(0, val),
                                      }));
                                    }}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Add Grid to Bill Action */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedGridProduct(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddGridToLines}
                    style={{ height: "42px", padding: "0 20px", fontWeight: "700" }}
                  >
                    <Plus size={16} /> Add Grid Items to Bill
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Lines Table Card */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)" }}>
                3. Purchase Bill Items ({purchaseLines.length} lines, {totalBillUnits} units)
              </div>
              {purchaseLines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPurchaseLines([])}
                  style={{ background: "none", border: "none", color: "var(--danger)", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
                >
                  Clear all items
                </button>
              )}
            </div>

            {/* Cost Variance Warning Banner */}
            {costWarning && (
              <div
                style={{
                  padding: "12px 18px",
                  background: "var(--warning-soft, #fef9c3)",
                  borderBottom: "1px solid var(--warning-line, #fef08a)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "13px",
                  color: "var(--warning-ink, #854d0e)",
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{costWarning}</span>
              </div>
            )}

            {purchaseLines.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--ink-2)", fontSize: "14px" }}>
                No items added yet. Use the Size-Run Grid or scan barcodes above to add goods.
              </div>
            ) : (
              <div className="pos-table-container" style={{ border: "none", borderRadius: 0 }}>
                <div style={{ overflowX: "auto", maxHeight: "420px", position: "relative" }}>
                  <table className="pos-table pos-table-form" style={{ width: "100%", minWidth: "600px" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Item Description</th>
                        <th style={{ textAlign: "center", width: "120px" }}>Quantity</th>
                        <th className="num" style={{ width: "150px" }}>Unit Cost (Rs.)</th>
                        <th className="num" style={{ width: "150px" }}>Total (Rs.)</th>
                        <th style={{ textAlign: "center", width: "60px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseLines.map((line, idx) => (
                        <tr key={`${line.variant.id}_${idx}`}>
                          <td>
                            <div style={{ fontWeight: "700", color: "var(--ink)" }}>
                              {line.variant.productNameCache}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--ink-2)" }}>
                              {line.variant.brandNameCache} • {line.variant.colorNameCache} • {line.variant.sizeLabelCache} ({line.variant.productType || "FOOTWEAR"})
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="number"
                              min="1"
                              className="input-field"
                              style={{ width: "80px", height: "36px", textAlign: "center", fontSize: "14px", fontWeight: "700", fontVariantNumeric: "tabular-nums", margin: "0 auto" }}
                              value={line.quantity}
                              onChange={(e) => handleUpdateLineQty(idx, parseInt(e.target.value) || 1)}
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input
                              type="number"
                              min="0"
                              className="input-field"
                              style={{ width: "110px", height: "36px", textAlign: "right", fontSize: "14px", fontWeight: "700", fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}
                              value={line.unitCost}
                              onChange={(e) => handleUpdateLineCost(idx, parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="num" style={{ fontWeight: "800", color: "var(--ink)" }}>
                            {formatCurrency(line.quantity * line.unitCost)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              aria-label="Remove item"
                              onClick={() => handleRemoveLine(idx)}
                              style={{ background: "transparent", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: "6px" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Payment & Bill Details */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              padding: "18px 20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CreditCard size={16} color="var(--primary)" /> 4. Payment Method & Settlement
            </div>

            {/* Payment Method Selector */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setPaymentMethod("CASH")}
                style={{
                  height: "44px",
                  padding: "0 18px",
                  borderRadius: "8px",
                  background: paymentMethod === "CASH" ? "var(--primary)" : "var(--canvas)",
                  color: paymentMethod === "CASH" ? "#ffffff" : "var(--ink)",
                  border: paymentMethod === "CASH" ? "none" : "1px solid var(--line)",
                  fontWeight: "700",
                }}
              >
                <Banknote size={16} /> Cash (Paid Now)
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => setPaymentMethod("CHEQUE")}
                style={{
                  height: "44px",
                  padding: "0 18px",
                  borderRadius: "8px",
                  background: paymentMethod === "CHEQUE" ? "var(--primary)" : "var(--canvas)",
                  color: paymentMethod === "CHEQUE" ? "#ffffff" : "var(--ink)",
                  border: paymentMethod === "CHEQUE" ? "none" : "1px solid var(--line)",
                  fontWeight: "700",
                }}
              >
                <CreditCard size={16} /> Cheque (Issue Only)
              </button>

              {/* Super Admin Additional Options */}
              {isSuperAdmin && (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPaymentMethod("CREDIT")}
                    style={{
                      height: "44px",
                      padding: "0 18px",
                      borderRadius: "8px",
                      background: paymentMethod === "CREDIT" ? "var(--primary)" : "var(--canvas)",
                      color: paymentMethod === "CREDIT" ? "#ffffff" : "var(--ink)",
                      border: paymentMethod === "CREDIT" ? "none" : "1px solid var(--line)",
                      fontWeight: "700",
                    }}
                  >
                    Credit (Pay Later)
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPaymentMethod("BANK_TRANSFER")}
                    style={{
                      height: "44px",
                      padding: "0 18px",
                      borderRadius: "8px",
                      background: paymentMethod === "BANK_TRANSFER" ? "var(--primary)" : "var(--canvas)",
                      color: paymentMethod === "BANK_TRANSFER" ? "#ffffff" : "var(--ink)",
                      border: paymentMethod === "BANK_TRANSFER" ? "none" : "1px solid var(--line)",
                      fontWeight: "700",
                    }}
                  >
                    Bank Transfer
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPaymentMethod("PARTIAL")}
                    style={{
                      height: "44px",
                      padding: "0 18px",
                      borderRadius: "8px",
                      background: paymentMethod === "PARTIAL" ? "var(--primary)" : "var(--canvas)",
                      color: paymentMethod === "PARTIAL" ? "#ffffff" : "var(--ink)",
                      border: paymentMethod === "PARTIAL" ? "none" : "1px solid var(--line)",
                      fontWeight: "700",
                    }}
                  >
                    Part Payment
                  </button>
                </>
              )}
            </div>

            {/* Cheque Details Fields */}
            {paymentMethod === "CHEQUE" && (
              <div
                style={{
                  background: "var(--canvas)",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                    Cheque Number <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 000492"
                    className="input-field"
                    style={{ width: "100%", height: "40px", borderRadius: "6px" }}
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                    Bank Name <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Commercial Bank / BOC"
                    className="input-field"
                    style={{ width: "100%", height: "40px", borderRadius: "6px" }}
                    value={chequeBank}
                    onChange={(e) => setChequeBank(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                    Cheque Date (May be post-dated)
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    style={{ width: "100%", height: "40px", borderRadius: "6px" }}
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Part Payment (Super Admin only) */}
            {paymentMethod === "PARTIAL" && (
              <div style={{ marginBottom: "16px", maxWidth: "300px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Amount Paid Now (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalBillAmount}
                  className="input-field"
                  style={{ width: "100%", height: "40px", textAlign: "right", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Purchase Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="Add shipment remarks or transport notes..."
                className="input-field"
                style={{ width: "100%", height: "40px", borderRadius: "6px" }}
                value={purchaseNotes}
                onChange={(e) => setPurchaseNotes(e.target.value)}
              />
            </div>
          </div>

          {/* STICKY BOTTOM ACTION & TOTALS BAR (U10 Responsive) */}
          <div
            style={{
              position: "sticky",
              bottom: "16px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "16px 20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              zIndex: 30,
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "var(--ink-2)", textTransform: "uppercase", fontWeight: "700" }}>
                Total Inward Cost
              </div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--ink)", fontVariantNumeric: "tabular-nums", marginTop: "2px" }}>
                {formatCurrency(totalBillAmount)}
                <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--ink-2)", marginLeft: "8px" }}>
                  ({totalBillUnits} units)
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSubmitting || purchaseLines.length === 0 || !selectedSupplierId}
                onClick={handleSavePurchase}
                style={{ height: "48px", padding: "0 28px", fontSize: "15px", fontWeight: "700", minWidth: "180px" }}
              >
                <CheckCircle2 size={18} />
                {isSubmitting ? "Recording..." : "Save Purchase Bill"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: PURCHASES HISTORY                             */}
      {/* ---------------------------------------------------- */}
      {activeTab === "HISTORY" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Super Admin Filters */}
          {isSuperAdmin && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-tile)",
                padding: "16px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
              }}
            >
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Branch
                </label>
                <select
                  className="input-field"
                  style={{ width: "100%", height: "36px", fontSize: "12px", borderRadius: "6px" }}
                  value={historyShopFilter}
                  onChange={(e) => setHistoryShopFilter(e.target.value)}
                >
                  <option value="ALL">All Branches</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Supplier
                </label>
                <select
                  className="input-field"
                  style={{ width: "100%", height: "36px", fontSize: "12px", borderRadius: "6px" }}
                  value={historySupplierFilter}
                  onChange={(e) => setHistorySupplierFilter(e.target.value)}
                >
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Payment Method
                </label>
                <select
                  className="input-field"
                  style={{ width: "100%", height: "36px", fontSize: "12px", borderRadius: "6px" }}
                  value={historyMethodFilter}
                  onChange={(e) => setHistoryMethodFilter(e.target.value)}
                >
                  <option value="ALL">All Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CREDIT">Credit</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="PARTIAL">Partial</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Review Status
                </label>
                <select
                  className="input-field"
                  style={{ width: "100%", height: "36px", fontSize: "12px", borderRadius: "6px" }}
                  value={historyReviewFilter}
                  onChange={(e) => setHistoryReviewFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEEDS_REVIEW">Needs Review</option>
                  <option value="REVIEWED">Reviewed</option>
                </select>
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--ink-3)", display: "block", marginBottom: "3px" }}>
                  Search Bill # or Supplier
                </label>
                <input
                  type="text"
                  placeholder="Search bill number, supplier or issuer..."
                  className="input-field"
                  style={{ width: "100%", height: "36px", fontSize: "12px", borderRadius: "6px" }}
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Purchases Table */}
          <div className="pos-table-container">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
                {isSuperAdmin
                  ? `All purchase bills (${filteredPurchases.length})`
                  : `My recorded purchases (${filteredPurchases.length})`}
              </h3>
            </div>

            {filteredPurchases.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--ink-2)", fontSize: "14px" }}>
                No purchase bills found matching the current criteria.
              </div>
            ) : (
              <div className="pos-table-scroll">
                <table className="pos-table" style={{ width: "100%", minWidth: "750px" }}>
                  <thead>
                    <tr>
                      <th>Bill #</th>
                      <th>Date</th>
                      {isSuperAdmin && <th>Branch</th>}
                      <th>Supplier</th>
                      {isSuperAdmin && <th>Issuer</th>}
                      <th className="num">Units</th>
                      <th className="num">Total Amount</th>
                      <th>Method</th>
                      {isSuperAdmin && <th>Review</th>}
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((p) => {
                      const units = p.items.reduce((s, it) => s + it.quantity, 0);
                      const shop = shops.find((s) => s.id === p.shopId);
                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                            {p.purchaseNumber}
                          </td>
                          <td style={{ fontSize: "13px" }}>{formatDate(p.invoiceDate || p.receivedAt)}</td>
                          {isSuperAdmin && (
                            <td style={{ fontSize: "13px" }}>{shop?.name || p.shopId}</td>
                          )}
                          <td style={{ fontWeight: "600" }}>{p.supplierNameCache}</td>
                          {isSuperAdmin && (
                            <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                              {p.createdByNameCache || p.receivedBy}
                            </td>
                          )}
                          <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {units}
                          </td>
                          <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(p.totalAmount)}
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "700",
                                background:
                                  p.paymentMethod === "CASH"
                                    ? "var(--success-soft, #dcfce7)"
                                    : p.paymentMethod === "CHEQUE"
                                    ? "var(--primary-soft)"
                                    : "var(--canvas)",
                                color:
                                  p.paymentMethod === "CASH"
                                    ? "var(--success, #166534)"
                                    : p.paymentMethod === "CHEQUE"
                                    ? "var(--primary)"
                                    : "var(--ink-2)",
                              }}
                            >
                              {p.paymentMethod || "CASH"}
                            </span>
                          </td>
                          {isSuperAdmin && (
                            <td>
                              {p.needsReview ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 8px",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    background: "var(--warning-soft, #fef9c3)",
                                    color: "var(--warning-ink, #854d0e)",
                                  }}
                                >
                                  Needs review
                                </span>
                              ) : (
                                <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>Reviewed</span>
                              )}
                            </td>
                          )}
                          <td>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: p.status === "CANCELLED" ? "var(--danger)" : "var(--success, #166534)",
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setDetailPurchase(p)}
                                  style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                                >
                                  <Eye size={13} /> Details
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handlePrintPurchaseBill(p, true)}
                                style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                                title="Reprint Duplicate Bill"
                              >
                                <Printer size={13} /> Reprint
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* POST-PURCHASE SUCCESS BANNER / MODAL                 */}
      {/* ---------------------------------------------------- */}
      {completedPurchase && (
        <div className="modal-backdrop">
          <div
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "500px", textAlign: "center" }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "var(--success-soft, #dcfce7)",
                color: "var(--success, #16a34a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: "0 0 6px" }}>
              Purchase Bill Recorded!
            </h3>
            <div style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "16px" }}>
              Bill <strong>#{completedPurchase.purchaseNumber}</strong> has been saved and inventory stock has been incremented at {shops.find((s) => s.id === completedPurchase.shopId)?.name || activeShop.name}.
            </div>

            {completedCheque && (
              <div
                style={{
                  background: "var(--primary-soft)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "var(--primary-ink)",
                  marginBottom: "16px",
                  fontWeight: "600",
                }}
              >
                Cheque #{completedCheque.chequeNumber} issued for {formatCurrency(completedCheque.amount)} ({completedCheque.bankName}).
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handlePrintPurchaseBill(completedPurchase, false)}
                style={{ height: "46px", fontSize: "14px", fontWeight: "700" }}
              >
                <Printer size={16} /> Print Purchase Cash Bill
              </button>

              {completedCheque && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handlePrintChequeVoucher(completedCheque, completedPurchase)}
                  style={{ height: "44px", fontSize: "14px", fontWeight: "600" }}
                >
                  <Printer size={16} /> Print Cheque Voucher
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsLabelEditorOpen(true)}
                style={{ height: "44px", fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}
              >
                <Barcode size={16} /> Print Labels for Received Items
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCompletedPurchase(null)}
                style={{ height: "44px", fontSize: "14px" }}
              >
                Done / Next Purchase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SUPER ADMIN DETAIL & REVIEW MODAL                    */}
      {/* ---------------------------------------------------- */}
      {detailPurchase && (
        <div className="modal-backdrop">
          <div
            className="modal-panel modal-panel-lg animate-fade-in"
            style={{ maxWidth: "700px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                  Purchase Bill Details: #{detailPurchase.purchaseNumber}
                </h3>
                <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "2px" }}>
                  {formatDate(detailPurchase.invoiceDate || detailPurchase.receivedAt)} • {shops.find((s) => s.id === detailPurchase.shopId)?.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailPurchase(null)}
                style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "var(--canvas)", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
              <div><strong>Supplier:</strong> {detailPurchase.supplierNameCache}</div>
              <div><strong>Supplier Bill #:</strong> {detailPurchase.supplierBillNumber || "-"}</div>
              <div><strong>Issued By:</strong> {detailPurchase.createdByNameCache || detailPurchase.receivedBy} ({detailPurchase.createdByRoleCache || "CASHIER"})</div>
              <div><strong>Payment Method:</strong> {detailPurchase.paymentMethod}</div>
              <div><strong>Total Amount:</strong> {formatCurrency(detailPurchase.totalAmount)}</div>
              <div><strong>Status:</strong> {detailPurchase.status}</div>
              {detailPurchase.chequeDetails && (
                <div style={{ gridColumn: "span 2" }}>
                  <strong>Cheque:</strong> #{detailPurchase.chequeDetails.chequeNumber} ({detailPurchase.chequeDetails.bankName}, Due: {formatDate(detailPurchase.chequeDetails.chequeDate)})
                </div>
              )}
            </div>

            {/* Items table */}
            <div style={{ border: "1px solid var(--line)", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
              <table className="pos-table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit Cost</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detailPurchase.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.variantDescriptionCache}</td>
                      <td className="num">{it.quantity}</td>
                      <td className="num">{formatCurrency(it.unitCost)}</td>
                      <td className="num">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Review Box for Super Admin */}
            {isSuperAdmin && detailPurchase.needsReview && (
              <div style={{ background: "var(--warning-soft, #fef9c3)", padding: "14px", borderRadius: "8px", marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--warning-ink, #854d0e)", marginBottom: "8px" }}>
                  Super Admin Review
                </div>
                <input
                  type="text"
                  placeholder="Optional review note..."
                  className="input-field"
                  style={{ width: "100%", height: "38px", fontSize: "13px", marginBottom: "10px" }}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={isReviewing}
                  onClick={() => handleMarkReviewed(detailPurchase.id)}
                  style={{ height: "36px", padding: "0 16px" }}
                >
                  <CheckCircle2 size={15} /> Mark Reviewed
                </button>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {isSuperAdmin && detailPurchase.status !== "CANCELLED" && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleCancelPurchase(detailPurchase.id)}
                  style={{ height: "38px" }}
                >
                  Cancel Purchase
                </button>
              )}
              <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handlePrintPurchaseBill(detailPurchase, true)}
                  style={{ height: "38px" }}
                >
                  <Printer size={15} /> Print Bill
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDetailPurchase(null)}
                  style={{ height: "38px" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* ADD NEW SUPPLIER MODAL                               */}
      {/* ---------------------------------------------------- */}
      {isAddSupplierModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "450px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
                Add New Supplier
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            {supplierModalError && (
              <div
                style={{
                  background: "var(--danger-soft, #fee2e2)",
                  color: "var(--danger, #b91c1c)",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  marginBottom: "14px",
                }}
              >
                {supplierModalError}
              </div>
            )}

            <form onSubmit={handleCreateSupplier}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Supplier Name <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lanka Leather Mills"
                  className="input-field"
                  style={{ width: "100%", height: "40px", borderRadius: "6px" }}
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Phone Number <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0771234567"
                  className="input-field"
                  style={{ width: "100%", height: "40px", borderRadius: "6px" }}
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Contact Person (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Bandara"
                  className="input-field"
                  style={{ width: "100%", height: "40px", borderRadius: "6px" }}
                  value={newSupplierContact}
                  onChange={(e) => setNewSupplierContact(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 45 Main Street, Colombo 11"
                  className="input-field"
                  style={{ width: "100%", height: "40px", borderRadius: "6px" }}
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddSupplierModalOpen(false)}
                  style={{ height: "42px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: "42px", padding: "0 20px", fontWeight: "700" }}
                >
                  Create Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal (WP3 integration) */}
      <QuickAddProductModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        showCostField={true}
        onProductCreated={({ product, variant }) => {
          showToast(`Created ${variant.productNameCache} (${variant.sizeLabelCache})! Added to bill.`, "success");
          setPurchaseLines((prev) => [
            ...prev,
            {
              variant,
              quantity: 1,
              unitCost: variant.referenceCostPrice || 0,
            },
          ]);
          setIsQuickAddOpen(false);
          refreshData();
        }}
      />

      {/* Camera Barcode Scanner */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(code: string) => {
          handleScanBarcode(code);
          setIsCameraScannerOpen(false);
        }}
      />

      {/* Label Editor Modal (WP3 integration for printing received items) */}
      {completedPurchase && (
        <LabelEditorModal
          isOpen={isLabelEditorOpen}
          onClose={() => setIsLabelEditorOpen(false)}
          batchVariants={completedPurchase.items.map((it) => {
            const v = allVariants.find((varItem) => varItem.id === it.variantId);
            return (
              v || {
                id: it.variantId,
                productId: it.productId,
                productNameCache: it.variantDescriptionCache,
                sku: it.variantId,
                barcode: it.variantId,
                brandNameCache: it.brandNameCache || "Brand",
                colorNameCache: it.colorNameCache || "Std",
                sizeLabelCache: it.sizeLabelCache || "Std",
                sellingPrice: it.listPrice || 0,
                referenceCostPrice: it.unitCost,
                active: true,
                colorId: "col_1",
                sizeId: "size_1",
                barcodeSource: "INTERNAL",
                createdAt: Date.now(),
              }
            );
          })}
          stockMap={completedPurchase.items.reduce((map, it) => {
            map[it.variantId] = it.quantity;
            return map;
          }, {} as Record<string, number>)}
        />
      )}
    </div>
  );
}
