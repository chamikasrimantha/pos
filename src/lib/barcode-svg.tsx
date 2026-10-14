// src/lib/barcode-svg.ts
// Crisp, vector SVG barcode rendering for thermal labels and counter receipts
"use client";

import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export interface BarcodeRenderOptions {
  format?: "CODE128" | "EAN13";
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
}

/**
 * Generates an SVG string representation of a barcode (vector quality, 0% blur).
 */
export function generateBarcodeSVG(
  text: string,
  options: BarcodeRenderOptions = {}
): string {
  if (typeof window === "undefined" || !text) {
    return `<div style="font-family: monospace; font-weight: bold; text-align: center;">${text}</div>`;
  }

  try {
    const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const format =
      options.format ||
      (text.length === 13 && /^\d+$/.test(text) ? "EAN13" : "CODE128");

    JsBarcode(svgNode, text, {
      format,
      width: options.width || 2,
      height: options.height || 42,
      displayValue: options.displayValue !== false,
      fontSize: options.fontSize || 13,
      font: "monospace",
      margin: options.margin !== undefined ? options.margin : 6,
      background: "#ffffff",
      lineColor: "#000000",
    });

    return new XMLSerializer().serializeToString(svgNode);
  } catch (err) {
    console.warn("Barcode SVG string generation error:", err);
    // Fallback Code128 clean visual representation
    return `<div style="font-family: monospace; font-weight: bold; padding: 4px; text-align: center; border: 1px dashed #000;">${text}</div>`;
  }
}

/**
 * Reusable React Component for rendering SVG vector barcodes
 */
export function BarcodeSVGView({
  value,
  format,
  width = 2,
  height = 42,
  displayValue = true,
  fontSize = 12,
  margin = 4,
  className,
}: {
  value: string;
  format?: "CODE128" | "EAN13";
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      const chosenFormat =
        format ||
        (value.length === 13 && /^\d+$/.test(value) ? "EAN13" : "CODE128");

      JsBarcode(svgRef.current, value, {
        format: chosenFormat,
        width,
        height,
        displayValue,
        fontSize,
        font: "monospace",
        margin,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (err) {
      console.warn("Failed to render barcode in SVG element:", err);
    }
  }, [value, format, width, height, displayValue, fontSize, margin]);

  if (!value) return null;

  return (
    <div style={{ display: "inline-block", background: "#ffffff" }} className={className}>
      <svg ref={svgRef} style={{ maxWidth: "100%", height: "auto" }} />
    </div>
  );
}
