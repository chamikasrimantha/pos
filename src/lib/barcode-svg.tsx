// src/lib/barcode-svg.tsx
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
 * Validates whether a 13-digit string has a mathematically correct EAN-13 modulo-10 check digit.
 */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return checksum === parseInt(code[12], 10);
}

/**
 * Generates an SVG string representation of a barcode (crisp vector lines, 0% blur).
 * Automatically ensures scannable symbology and never fails to render.
 */
export function generateBarcodeSVG(
  text: string,
  options: BarcodeRenderOptions = {}
): string {
  if (!text) {
    return `<div style="font-family: monospace; font-weight: bold; text-align: center;">N/A</div>`;
  }

  const cleanText = text.trim();

  // In non-browser environments, return a placeholder
  if (typeof window === "undefined" || typeof document === "undefined") {
    return `<div style="font-family: monospace; font-weight: bold; text-align: center;">${cleanText}</div>`;
  }

  // Determine symbology: EAN13 only if strictly valid; otherwise Code128 handles any character/digit
  let chosenFormat = options.format;
  if (!chosenFormat) {
    chosenFormat = isValidEan13(cleanText) ? "EAN13" : "CODE128";
  } else if (chosenFormat === "EAN13" && !isValidEan13(cleanText)) {
    // If user requested EAN13 but checksum is invalid, fall back to CODE128 to prevent JsBarcode crash
    chosenFormat = "CODE128";
  }

  try {
    const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    JsBarcode(svgNode, cleanText, {
      format: chosenFormat,
      width: options.width || 2,
      height: options.height || 36,
      displayValue: options.displayValue !== false,
      fontSize: options.fontSize || 12,
      font: "monospace",
      margin: options.margin !== undefined ? options.margin : 2,
      background: "#ffffff",
      lineColor: "#000000",
    });

    // Ensure clean crisp rendering and scaling
    svgNode.setAttribute("shape-rendering", "crispEdges");
    svgNode.setAttribute("style", "max-width: 100%; height: auto; display: block; margin: 0 auto;");

    return new XMLSerializer().serializeToString(svgNode);
  } catch (err) {
    // Second safety net: if chosen format still threw, retry with Code128
    try {
      const fallbackSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(fallbackSvg, cleanText, {
        format: "CODE128",
        width: 1.8,
        height: options.height || 36,
        displayValue: options.displayValue !== false,
        fontSize: options.fontSize || 12,
        font: "monospace",
        margin: 2,
        background: "#ffffff",
        lineColor: "#000000",
      });
      fallbackSvg.setAttribute("shape-rendering", "crispEdges");
      fallbackSvg.setAttribute("style", "max-width: 100%; height: auto; display: block; margin: 0 auto;");
      return new XMLSerializer().serializeToString(fallbackSvg);
    } catch (secondErr) {
      console.warn("Fallback Barcode SVG generation error:", secondErr);
      return `<div style="font-family: monospace; font-size: 11px; font-weight: bold; padding: 4px; text-align: center;">${cleanText}</div>`;
    }
  }
}

/**
 * Reusable React Component for rendering SVG vector barcodes in the DOM
 */
export function BarcodeSVGView({
  value,
  format,
  width = 2,
  height = 42,
  displayValue = true,
  fontSize = 12,
  margin = 2,
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
      const cleanValue = value.trim();
      let chosenFormat = format;
      if (!chosenFormat) {
        chosenFormat = isValidEan13(cleanValue) ? "EAN13" : "CODE128";
      } else if (chosenFormat === "EAN13" && !isValidEan13(cleanValue)) {
        chosenFormat = "CODE128";
      }

      JsBarcode(svgRef.current, cleanValue, {
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
      svgRef.current.setAttribute("shape-rendering", "crispEdges");
    } catch (err) {
      console.warn("Failed to render barcode in SVG element, retrying with CODE128:", err);
      try {
        if (svgRef.current) {
          JsBarcode(svgRef.current, value.trim(), {
            format: "CODE128",
            width,
            height,
            displayValue,
            fontSize,
            margin,
            background: "#ffffff",
            lineColor: "#000000",
          });
        }
      } catch (e) {
        console.error("Critical failure in BarcodeSVGView:", e);
      }
    }
  }, [value, format, width, height, displayValue, fontSize, margin]);

  if (!value) return null;

  return (
    <div style={{ display: "inline-block", background: "#ffffff", padding: "2px" }} className={className}>
      <svg ref={svgRef} style={{ maxWidth: "100%", height: "auto" }} />
    </div>
  );
}
