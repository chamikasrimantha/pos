// src/components/pos/PosView.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import {
  getVariants,
  getInventoryForShop,
  completeSale,
} from "@/lib/firestore-service";
import { formatCurrency, renderSaleReceiptHTML } from "@/lib/receipt-generator";
import { ProductVariant, PaymentEntry, PaymentMethod } from "@/types";
import { CameraScannerModal } from "@/components/common/CameraScannerModal";
import {
  Barcode,
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  AlertCircle,
  Coins,
  CheckCircle2,
  X,
  User,
  Phone,
  Camera,
  ChevronRight,
} from "lucide-react";

interface CartItem {
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export function PosView() {
  const {
    activeShop,
    currentUser,
    activeShift,
    setActiveView,
    showToast,
    openPrintModal,
    refreshData,
    dataVersion,
    hasPermission,
  } = useApp();

  const [barcodeInput, setBarcodeInput] = useState("");
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [lastAddedVariantId, setLastAddedVariantId] = useState<string | null>(null);

  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load variants and active shop inventory
  const variants = useMemo(() => getVariants(), [dataVersion]);
  const inventoryList = useMemo(() => getInventoryForShop(activeShop.id), [activeShop.id, dataVersion]);

  // Inventory lookup map: variantId -> quantityOnHand
  const stockMap = useMemo(() => {
    const map: Record<string, number> = {};
    inventoryList.forEach((inv) => {
      map[inv.variantId] = inv.quantityOnHand;
    });
    return map;
  }, [inventoryList]);

  // Categories list
  const categories = useMemo(() => {
    return [
      { id: "ALL", name: "All Footwear" },
      { id: "cat_formal_men", name: "Men's Formal" },
      { id: "cat_sports", name: "Sports & Running" },
      { id: "cat_casual", name: "Casual & Sneakers" },
      { id: "cat_heels_women", name: "Women's Heels" },
      { id: "cat_flats_women", name: "Women's Flats" },
    ];
  }, []);

  // Filtered variants
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.productNameCache.toLowerCase().includes(q) ||
        v.brandNameCache.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        v.barcode.includes(q) ||
        v.sizeLabelCache.toLowerCase().includes(q) ||
        v.colorNameCache.toLowerCase().includes(q);

      const matchesCat =
        selectedCategory === "ALL" ||
        (selectedCategory === "cat_formal_men" && (v.productNameCache.includes("Oxford") || v.productNameCache.includes("Loafer"))) ||
        (selectedCategory === "cat_sports" && v.productNameCache.includes("Air Max")) ||
        (selectedCategory === "cat_casual" && (v.productNameCache.includes("Samba") || v.productNameCache.includes("Retro"))) ||
        (selectedCategory === "cat_heels_women" && v.productNameCache.includes("Pump"));

      return matchesSearch && matchesCat && v.active;
    });
  }, [variants, searchQuery, selectedCategory]);

  // Cart calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cart]);

  const netTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - billDiscount);
  }, [cartSubtotal, billDiscount]);

  // Handle barcode quick scan (Enter press)
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const code = barcodeInput.trim();
    const found = variants.find((v) => v.barcode === code || v.sku.toLowerCase() === code.toLowerCase());

    if (!found) {
      showToast(`No shoe variant matched barcode: ${code}`, "error");
      setBarcodeInput("");
      return;
    }

    addToCart(found);
    setBarcodeInput("");
  };

  const addToCart = (variant: ProductVariant) => {
    const onHand = stockMap[variant.id] || 0;
    const existing = cart.find((i) => i.variant.id === variant.id);
    const existingQty = existing ? existing.quantity : 0;

    if (existingQty + 1 > onHand) {
      showToast(`Stock limit reached for ${variant.productNameCache}. (Available: ${onHand})`, "error");
      return;
    }

    if (existing) {
      setCart((prev) =>
        prev.map((i) =>
          i.variant.id === variant.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                lineTotal: (i.quantity + 1) * i.unitPrice - i.discount,
              }
            : i
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          variant,
          quantity: 1,
          unitPrice: variant.sellingPrice,
          discount: 0,
          lineTotal: variant.sellingPrice,
        },
      ]);
    }

    setLastAddedVariantId(variant.id);
    setTimeout(() => setLastAddedVariantId(null), 350);
    showToast(`Added ${variant.productNameCache} (${variant.sizeLabelCache}) to cart`, "success");
  };

  const updateQuantity = (variantId: string, delta: number) => {
    const onHand = stockMap[variantId] || 0;
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.variant.id !== variantId) return i;
          const newQty = i.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > onHand) {
            showToast(`Cannot exceed shop stock (${onHand} available)`, "error");
            return i;
          }
          return {
            ...i,
            quantity: newQty,
            lineTotal: newQty * i.unitPrice - i.discount,
          };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variant.id !== variantId));
  };

  const clearCart = () => {
    setCart([]);
    setBillDiscount(0);
    setCustomerName("");
    setCustomerPhone("");
  };

  // Open Checkout
  const handleOpenCheckout = () => {
    if (!activeShift) {
      showToast("Cannot checkout: Active cashier shift is required.", "error");
      return;
    }
    if (cart.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }
    setAmountReceived(netTotal.toString());
    setIsPaymentModalOpen(true);
  };

  // Finalize Sale
  const handleFinalizeSale = async () => {
    if (!activeShift || !currentUser) return;
    setIsSubmitting(true);

    try {
      const received = parseFloat(amountReceived) || netTotal;
      const change = paymentMethod === "CASH" ? Math.max(0, received - netTotal) : 0;

      const payments: PaymentEntry[] = [
        {
          method: paymentMethod,
          amount: netTotal,
        },
      ];

      const idempotencyKey = `sale_${activeShop.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const { sale, items } = await completeSale({
        shopId: activeShop.id,
        cashierId: currentUser.uid,
        cashierName: currentUser.displayName,
        shiftId: activeShift.id,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        idempotencyKey,
        items: cart.map((c) => ({
          variant: c.variant,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          discount: c.discount,
          lineTotal: c.lineTotal,
        })),
        subtotal: cartSubtotal,
        discount: billDiscount,
        taxAmount: 0,
        total: netTotal,
        payments,
        amountReceived: received,
        changeGiven: change,
      });

      showToast(`Sale completed! Invoice #${sale.invoiceNumber}`, "success");
      setIsPaymentModalOpen(false);
      clearCart();
      refreshData();

      // Automatically open thermal receipt print preview
      const receiptHTML = renderSaleReceiptHTML(sale, items, activeShop);
      openPrintModal(`Invoice Receipt — ${sale.invoiceNumber}`, receiptHTML);
    } catch (err: any) {
      showToast(err.message || "Failed to complete sale", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden", background: "var(--canvas)", gap: "16px", padding: "16px" }}>
      {/* LEFT: Product Catalogue */}
      <div
        style={{
          flex: 1,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {/* Shift closed notice — shown once here only */}
        {!activeShift && (
          <div
            className="animate-fade-in"
            style={{
              margin: "16px 16px 0",
              padding: "12px 16px",
              background: "var(--primary-soft)",
              border: "1px solid var(--primary-soft-line)",
              borderRadius: "var(--radius-tile)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertCircle size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--primary-ink)" }}>
                  Open a shift to start selling.
                </div>
                <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
                  Enter your starting cash to begin.
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setActiveView("shifts")}
              style={{ height: "44px", flexShrink: 0 }}
            >
              Open shift
            </button>
          </div>
        )}

        {/* Scan + Search row */}
        <div style={{ display: "flex", gap: "12px", padding: "16px" }}>
          <form
            onSubmit={handleBarcodeScan}
            style={{
              flex: "0 0 40%",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius-control)",
              padding: "0 12px",
              height: "48px",
            }}
          >
            <Barcode size={18} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode or enter SKU"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              disabled={!activeShift}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--ink)",
                fontSize: "15px",
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              style={{ flexShrink: 0, height: "32px" }}
              disabled={!activeShift}
            >
              Scan
            </button>
            <button
              type="button"
              onClick={() => setIsCameraScannerOpen(true)}
              title="Scan Barcode with Camera"
              className="btn btn-secondary btn-sm"
              style={{ flexShrink: 0, height: "32px", padding: "0 8px", display: "flex", alignItems: "center", gap: "4px" }}
              disabled={!activeShift}
            >
              <Camera size={14} />
              <span style={{ fontSize: "12px" }}>Cam</span>
            </button>
          </form>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius-control)",
              padding: "0 12px",
              height: "48px",
            }}
          >
            <Search size={18} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by name, brand, colour or size"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--ink)",
                fontSize: "15px",
                fontFamily: "inherit",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                style={{ background: "transparent", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: "2px" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "0 16px 12px", scrollbarWidth: "none" }}>
          {categories.map((cat) => {
            const isSel = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  height: "40px",
                  padding: "0 14px",
                  borderRadius: "var(--radius-control)",
                  fontSize: "14px",
                  fontWeight: isSel ? 600 : 400,
                  background: isSel ? "var(--primary-soft)" : "transparent",
                  color: isSel ? "var(--primary-ink)" : "var(--ink-2)",
                  border: isSel ? "1px solid var(--primary-soft-line)" : "1px solid var(--line)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all var(--motion-hover)",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Product tiles */}
        <div className="pos-catalogue-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "16px",
            alignContent: "start",
          }}>
            {filteredVariants.length === 0 ? (
              <div style={{ gridColumn: "1/-1", padding: "48px 0", textAlign: "center", color: "var(--ink-2)" }}>
                No products found.
              </div>
            ) : (
              filteredVariants.map((variant) => {
                const onHand = stockMap[variant.id] || 0;
                const isOut  = onHand <= 0;
                const isLow  = onHand > 0 && onHand <= 3;
                return (
                  <div
                    key={variant.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-tile)",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      opacity: isOut ? 0.55 : 1,
                      cursor: isOut ? "not-allowed" : "default",
                    }}
                  >
                    <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>{variant.brandNameCache}</div>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--ink)", lineHeight: "1.3" }}>
                      {variant.productNameCache}
                    </div>
                    <div style={{ fontSize: "14px", color: "var(--ink-2)" }}>{variant.colorNameCache}</div>
                    <div style={{ fontSize: "14px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{variant.sizeLabelCache}</div>
                    <div style={{ fontSize: "13px", color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--ink-2)" }}>
                      {isOut ? "Out of stock" : isLow ? `Only ${onHand} left` : `${onHand} in stock`}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid var(--line)", marginTop: "4px" }}>
                      <div className="text-price-tile">{formatCurrency(variant.sellingPrice)}</div>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isOut || !activeShift}
                        title={!activeShift ? "Open a shift first" : undefined}
                        onClick={(e) => { e.stopPropagation(); if (!isOut) addToCart(variant); }}
                        style={{ height: "44px" }}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div
        className={`pos-cart-panel ${isMobileCartOpen ? "open" : ""}`}
        style={{
          width: "400px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-tile)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* Cart header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShoppingCart size={18} style={{ color: "var(--ink-2)" }} />
            <span className="text-section-heading">Current sale</span>
            <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>
              {cart.length === 0
                ? "0 items"
                : `${cart.length} ${cart.length === 1 ? "item" : "items"} (${cart.reduce((s, i) => s + i.quantity, 0)} ${cart.reduce((s, i) => s + i.quantity, 0) === 1 ? "pair" : "pairs"})`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {cart.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={clearCart} title="Clear cart">
                <Trash2 size={13} /> Clear
              </button>
            )}
            <button
              className="mobile-cart-close-btn"
              onClick={() => setIsMobileCartOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                color: "var(--ink-2)",
                borderRadius: "6px",
              }}
              aria-label="Close cart drawer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Customer details — collapsed by default */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <User size={14} style={{ color: "var(--ink-3)" }} />
              <input
                type="text"
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{
                  flex: 1, height: "40px", background: "var(--surface)",
                  border: "1px solid var(--line-strong)", borderRadius: "var(--radius-control)",
                  padding: "0 10px", color: "var(--ink)", fontSize: "14px",
                  outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Phone size={14} style={{ color: "var(--ink-3)" }} />
              <input
                type="text"
                placeholder="Mobile phone (optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{
                  flex: 1, height: "40px", background: "var(--surface)",
                  border: "1px solid var(--line-strong)", borderRadius: "var(--radius-control)",
                  padding: "0 10px", color: "var(--ink)", fontSize: "14px",
                  outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        </div>

        {/* Cart line items */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {cart.length === 0 ? (
            <div
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: "12px", padding: "24px", textAlign: "center",
              }}
            >
              <ShoppingCart size={48} strokeWidth={1.5} style={{ color: "var(--line-strong)" }} />
              <div>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--ink-2)", marginBottom: "4px" }}>No items yet</div>
                <div style={{ fontSize: "14px", color: "var(--ink-3)" }}>Scan a barcode or choose shoes from the list.</div>
              </div>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.variant.id}
                className={`pos-cart-line ${lastAddedVariantId === item.variant.id ? "flash-highlight" : ""}`}
              >
                {/* Row 1: Product Name + Line Total */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
                  <div
                    title={item.variant.productNameCache}
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {item.variant.productNameCache}
                  </div>
                  <div style={{ fontVariantNumeric: "tabular-nums", fontSize: "15px", fontWeight: 600, color: "var(--ink)", flexShrink: 0 }}>
                    {formatCurrency(item.lineTotal)}
                  </div>
                </div>

                {/* Row 2: Secondary text (Colour, Size, Unit Price) + Stepper & Remove */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "13px", color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.variant.colorNameCache}, {item.variant.sizeLabelCache}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(item.unitPrice)} each
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variant.id, -1)}
                      aria-label="Decrease quantity"
                      className="cart-qty-btn"
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{ width: "24px", textAlign: "center", fontSize: "14px", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variant.id, 1)}
                      aria-label="Increase quantity"
                      className="cart-qty-btn"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.variant.id)}
                      aria-label="Remove item"
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "var(--radius-control)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--ink-3)",
                        marginLeft: "2px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-3)")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals + Complete sale */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--line)",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "15px", color: "var(--ink-2)" }}>Subtotal</span>
            <span style={{ fontSize: "15px", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(cartSubtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "15px", color: "var(--ink-2)" }}>Discount (Rs.)</span>
            <input
              type="number" min="0"
              disabled={!hasPermission("pos.discount.apply")}
              title={!hasPermission("pos.discount.apply") ? "Discount requires manager permission" : ""}
              value={billDiscount || ""} placeholder="0"
              onChange={(e) => setBillDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{
                width: "96px", height: "36px",
                background: !hasPermission("pos.discount.apply") ? "var(--surface-sunken)" : "var(--surface)",
                border: "1px solid var(--line-strong)", borderRadius: "var(--radius-control)",
                color: "var(--ink)", fontSize: "14px", textAlign: "right",
                padding: "0 8px", outline: "none", fontVariantNumeric: "tabular-nums", fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
            <span style={{ fontSize: "15px", fontWeight: "600", color: "var(--ink)" }}>Total</span>
            <span className="text-total">{formatCurrency(netTotal)}</span>
          </div>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: "4px", justifyContent: "space-between" }}
            disabled={!activeShift || cart.length === 0}
            onClick={() => {
              setIsMobileCartOpen(false);
              setIsPaymentModalOpen(true);
            }}
          >
            <span>Complete sale</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(netTotal)}</span>
          </button>
        </div>
      </div>

      {/* Mobile Floating Cart Summary Pill (shown only below 1024px where cart panel is hidden) */}
      {cart.length > 0 && !isMobileCartOpen && (
        <button
          type="button"
          className="mobile-cart-float-bar"
          onClick={() => setIsMobileCartOpen(true)}
          aria-label="Open cart"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShoppingCart size={18} />
            <span style={{ fontWeight: 700, fontSize: "14px" }}>
              {cart.reduce((s, i) => s + i.quantity, 0)} {cart.reduce((s, i) => s + i.quantity, 0) === 1 ? "item" : "items"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "15px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(netTotal)}
            </span>
            <ChevronRight size={18} />
          </div>
        </button>
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(code) => {
          const found = variants.find(
            (v) => v.barcode === code || v.sku.toLowerCase() === code.toLowerCase()
          );
          if (found) {
            addToCart(found);
            showToast(`Scanned & added ${found.productNameCache} (${found.sizeLabelCache})`, "success");
          } else {
            showToast(`No shoe matched barcode: ${code}`, "error");
          }
        }}
      />

      {/* Payment modal */}
      {isPaymentModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 24, 40, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              background: "var(--surface)",
              borderRadius: "var(--radius-modal)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-floating)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>Settle payment</h3>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  Shift #{activeShift?.shiftNumber} · {activeShop.name}
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Total Display */}
            <div
              style={{
                background: "var(--primary-soft)",
                border: "1px solid var(--primary-soft-line)",
                borderRadius: "var(--radius-panel)",
                padding: "16px",
                textAlign: "center",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--primary-ink)" }}>
                Total due
              </div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "var(--ink)", fontVariantNumeric: "tabular-nums", marginTop: "2px" }}>
                {formatCurrency(netTotal)}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                Payment method
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "6px",
                  background: "var(--sunken)",
                  padding: "4px",
                  borderRadius: "var(--radius-control)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  style={{
                    height: "44px",
                    borderRadius: "calc(var(--radius-control) - 2px)",
                    background: paymentMethod === "CASH" ? "var(--surface)" : "transparent",
                    border: paymentMethod === "CASH" ? "1px solid var(--line-strong)" : "1px solid transparent",
                    color: paymentMethod === "CASH" ? "var(--ink)" : "var(--ink-2)",
                    boxShadow: paymentMethod === "CASH" ? "0 1px 2px rgba(16, 24, 40, 0.05)" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "14px",
                    fontWeight: paymentMethod === "CASH" ? "600" : "500",
                    fontFamily: "inherit",
                    transition: "all var(--motion-hover)",
                  }}
                >
                  <Banknote size={16} /> Cash
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("CARD")}
                  style={{
                    height: "44px",
                    borderRadius: "calc(var(--radius-control) - 2px)",
                    background: paymentMethod === "CARD" ? "var(--surface)" : "transparent",
                    border: paymentMethod === "CARD" ? "1px solid var(--line-strong)" : "1px solid transparent",
                    color: paymentMethod === "CARD" ? "var(--ink)" : "var(--ink-2)",
                    boxShadow: paymentMethod === "CARD" ? "0 1px 2px rgba(16, 24, 40, 0.05)" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "14px",
                    fontWeight: paymentMethod === "CARD" ? "600" : "500",
                    fontFamily: "inherit",
                    transition: "all var(--motion-hover)",
                  }}
                >
                  <CreditCard size={16} /> Card
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  style={{
                    height: "44px",
                    borderRadius: "calc(var(--radius-control) - 2px)",
                    background: paymentMethod === "BANK_TRANSFER" ? "var(--surface)" : "transparent",
                    border: paymentMethod === "BANK_TRANSFER" ? "1px solid var(--line-strong)" : "1px solid transparent",
                    color: paymentMethod === "BANK_TRANSFER" ? "var(--ink)" : "var(--ink-2)",
                    boxShadow: paymentMethod === "BANK_TRANSFER" ? "0 1px 2px rgba(16, 24, 40, 0.05)" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "14px",
                    fontWeight: paymentMethod === "BANK_TRANSFER" ? "600" : "500",
                    fontFamily: "inherit",
                    transition: "all var(--motion-hover)",
                  }}
                >
                  <Coins size={16} /> Transfer
                </button>
              </div>
            </div>

            {/* Cash Received & Change Tendered */}
            {paymentMethod === "CASH" && (
              <div style={{ marginBottom: "24px" }}>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Amount received (Rs.)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  style={{ fontSize: "16px", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}
                />

                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px 16px",
                    background: "var(--canvas)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-control)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "15px",
                    fontWeight: "600",
                  }}
                >
                  <span style={{ color: "var(--ink)" }}>Change due:</span>
                  {(parseFloat(amountReceived) || 0) >= netTotal ? (
                    <span style={{ color: "var(--success)", fontVariantNumeric: "tabular-nums", fontSize: "17px" }}>
                      {formatCurrency(Math.max(0, (parseFloat(amountReceived) || 0) - netTotal))}
                    </span>
                  ) : (
                    <span style={{ color: "var(--danger)", fontSize: "14px" }}>
                      Short by {formatCurrency(Math.max(0, netTotal - (parseFloat(amountReceived) || 0)))}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2, height: "48px" }}
                disabled={isSubmitting || (paymentMethod === "CASH" && (parseFloat(amountReceived) || 0) < netTotal)}
                onClick={handleFinalizeSale}
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? "Completing…" : "Complete sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
