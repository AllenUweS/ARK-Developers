/**
 * Universal Pixel-Perfect Print Utility for ARK ERP
 * 
 * Solves the critical issue where printing from inside Radix UI modals / Dialogs
 * causes clipping, misplaced headers, blank pages, and stripped styles due to
 * CSS transforms (translate -50%), fixed overlays, and max-height overflow constraints.
 * 
 * Works by rendering the content into a dedicated, unconstrained hidden iframe
 * with all application styles, fonts, and exact print-color adjustments preserved.
 */

export interface PrintOptions {
  title?: string;
  pageMargin?: string;
  pageSize?: "A4 portrait" | "A4 landscape" | "letter portrait";
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

export function printElement(
  element: HTMLElement | null,
  options: PrintOptions | string = "ARK Document"
) {
  if (typeof window === "undefined") return;

  const opts: PrintOptions =
    typeof options === "string" ? { title: options } : options;
  const title = opts.title || "ARK Document";
  const pageMargin = opts.pageMargin || "6mm 8mm";
  const pageSize = opts.pageSize || "A4 portrait";

  if (!element) {
    window.print();
    return;
  }

  // Remove any stale print frame
  const existingFrame = document.getElementById("ark-print-engine-frame");
  if (existingFrame) {
    existingFrame.remove();
  }

  // Create isolated invisible iframe
  const iframe = document.createElement("iframe");
  iframe.id = "ark-print-engine-frame";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!frameDoc) {
    window.print();
    return;
  }

  // Collect all active stylesheets & style blocks from current document
  const headElements: string[] = [];
  document.querySelectorAll("link[rel='stylesheet'], style").forEach((node) => {
    headElements.push(node.outerHTML);
  });

  const contentHtml = element.innerHTML;

  frameDoc.open();
  frameDoc.write(`
    <!DOCTYPE html>
    <html class="light" style="background: #ffffff !important; color: #0f172a !important;">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
        ${headElements.join("\n")}
        <style>
          @page {
            size: ${pageSize};
            margin: ${pageMargin};
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 11px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            -webkit-font-smoothing: antialiased;
          }
          .print-document {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            position: relative !important;
          }
          .print\\:hidden, .no-print, [data-radix-portal], [data-radix-dialog-overlay] {
            display: none !important;
          }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Fix table printing borders and backgrounds */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        </style>
      </head>
      <body class="light bg-white text-slate-900">
        <div class="print-document">
          ${contentHtml}
        </div>
      </body>
    </html>
  `);
  frameDoc.close();

  opts.onBeforePrint?.();

  // Allow images, SVGs, and web fonts in the iframe to finish painting before triggering dialog
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Print execution failed inside iframe, falling back to window.print:", err);
      window.print();
    } finally {
      opts.onAfterPrint?.();
    }
  }, 280);
}
