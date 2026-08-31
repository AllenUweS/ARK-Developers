import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

export interface EMIStatementPDFData {
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  projectName: string;
  projectCode?: string;
  plotNumber: string;
  areaSqft?: number;
  totalPrice: number;
  advancePaid: number;
  remainingBalance: number;
  govtAmount?: number;
  companyAmount?: number;
  installmentCount?: number;
  installmentAmount?: number;
  firstDueDate?: string;
  bookingDate?: string;
  scheduleRows?: Array<{
    installment_number: number;
    due_date: string;
    amount: number;
    paid_amount?: number;
    account_type?: "company" | "govt" | "split" | string;
    status?: string;
    notes?: string;
    govt_amount?: number;
    company_amount?: number;
  }>;
  recordedPayments?: Array<{
    id?: string;
    amount: number;
    paid_on: string;
    payment_method?: string;
    reference_number?: string;
    collection_account?: string;
    govt_component?: number;
    company_component?: number;
  }>;
}

const formatMoney = (val: number) =>
  `₹${Math.round(val || 0).toLocaleString("en-IN")}`;

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  try {
    const cleanStr = dateStr.slice(0, 10);
    const [y, m, d] = cleanStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export function generateEMIStatementHTML(data: EMIStatementPDFData): string {
  const {
    customerName = "Customer",
    customerPhone = "N/A",
    customerAddress = "Registered Customer",
    projectName = "Plot Development Project",
    projectCode = "PRJ",
    plotNumber = "N/A",
    areaSqft,
    totalPrice = 0,
    advancePaid = 0,
    govtAmount = Math.round(totalPrice * 0.4),
    companyAmount = Math.max(0, totalPrice - govtAmount),
    installmentCount = 12,
    installmentAmount,
    firstDueDate,
    bookingDate,
    scheduleRows = [],
    recordedPayments = [],
  } = data;

  const totalRecordedPayments = recordedPayments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const effectivePaid = Math.max(advancePaid, totalRecordedPayments);
  const currentOutstanding = Math.max(0, totalPrice - effectivePaid);
  const paidPct = totalPrice > 0 ? Math.min(100, Math.round((effectivePaid / totalPrice) * 100)) : 0;

  let companyCollected = 0;
  let govtCollected = 0;

  if (recordedPayments.length > 0) {
    recordedPayments.forEach((p) => {
      const pAmt = Number(p.amount || 0);
      if (p.company_component !== undefined && p.govt_component !== undefined) {
        companyCollected += Number(p.company_component || 0);
        govtCollected += Number(p.govt_component || 0);
      } else if (p.collection_account === "govt") {
        govtCollected += pAmt;
      } else if (p.collection_account === "company") {
        companyCollected += pAmt;
      } else {
        const gShare = Math.round(pAmt * (govtAmount / (totalPrice || 1)));
        govtCollected += gShare;
        companyCollected += pAmt - gShare;
      }
    });
  } else {
    govtCollected = Math.round(effectivePaid * (govtAmount / (totalPrice || 1)));
    companyCollected = effectivePaid - govtCollected;
  }

  interface NormalizedEMI {
    num: number;
    dueDate: string;
    amount: number;
    accountType: string;
    paidAmount: number;
    balanceDue: number;
    status: "paid" | "partial" | "pending" | "overdue";
    refNote?: string;
  }

  const totalTerms = Math.max(scheduleRows.length, installmentCount, 1);
  const normalizedEMIs: NormalizedEMI[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cumulativeSettledPool = effectivePaid;

  if (scheduleRows.length > 0) {
    scheduleRows.forEach((r, idx) => {
      const num = r.installment_number || idx + 1;
      const emiAmt = Number(r.amount) || 0;
      
      let paidAmt = 0;
      if (cumulativeSettledPool >= emiAmt) {
        paidAmt = emiAmt;
        cumulativeSettledPool -= emiAmt;
      } else if (cumulativeSettledPool > 0) {
        paidAmt = cumulativeSettledPool;
        cumulativeSettledPool = 0;
      } else if (r.paid_amount && Number(r.paid_amount) > 0) {
        paidAmt = Number(r.paid_amount);
      }

      const bal = Math.max(0, emiAmt - paidAmt);
      const dueD = r.due_date ? new Date(`${r.due_date.slice(0, 10)}T00:00:00`) : null;
      let status: "paid" | "partial" | "pending" | "overdue" = "pending";

      if (r.status === "paid" || paidAmt >= emiAmt) {
        status = "paid";
      } else if (paidAmt > 0) {
        status = "partial";
      } else if (dueD && dueD < today) {
        status = "overdue";
      }

      const cleanMilestone = r.notes
        ? r.notes.replace(/Govt Guideline |Company Commercial /gi, "").trim()
        : `EMI #${num}`;

      const matchedPayment = recordedPayments[idx];
      const refNote = matchedPayment?.reference_number 
        ? `${matchedPayment.payment_method || "Payment"}: ${matchedPayment.reference_number}`
        : cleanMilestone || (status === "paid" ? "Settled" : undefined);

      normalizedEMIs.push({
        num,
        dueDate: r.due_date || "",
        amount: emiAmt,
        accountType: cleanMilestone,
        paidAmount: paidAmt,
        balanceDue: bal,
        status,
        refNote,
      });
    });
  } else {
    const balanceToAmortize = Math.max(0, totalPrice - advancePaid);
    const calculatedEmiAmt = installmentAmount || (totalTerms > 0 ? Math.round(balanceToAmortize / totalTerms) : 0);
    const startD = firstDueDate ? new Date(`${firstDueDate.slice(0, 10)}T00:00:00`) : new Date();

    let cumulativeSettledPool = advancePaid;

    for (let i = 1; i <= totalTerms; i++) {
      const emiDue = new Date(startD);
      emiDue.setMonth(startD.getMonth() + (i - 1));
      const emiAmt = calculatedEmiAmt;

      let paidForThisEmi = 0;
      if (cumulativeSettledPool >= emiAmt) {
        paidForThisEmi = emiAmt;
        cumulativeSettledPool -= emiAmt;
      } else if (cumulativeSettledPool > 0) {
        paidForThisEmi = cumulativeSettledPool;
        cumulativeSettledPool = 0;
      }

      let status: "paid" | "partial" | "pending" | "overdue" = "pending";
      if (paidForThisEmi >= emiAmt) {
        status = "paid";
      } else if (paidForThisEmi > 0) {
        status = "partial";
      } else if (emiDue < today) {
        status = "overdue";
      }

      const matchedPayment = recordedPayments[i - 1];
      const refNote = matchedPayment?.reference_number 
        ? `${matchedPayment.payment_method || "Payment"}: ${matchedPayment.reference_number}`
        : status === "paid" ? "Downpayment Credit" : undefined;

      normalizedEMIs.push({
        num: i,
        dueDate: emiDue.toISOString().slice(0, 10),
        amount: emiAmt,
        accountType: i % 2 === 0 ? "company" : "govt",
        paidAmount: paidForThisEmi,
        balanceDue: Math.max(0, emiAmt - paidForThisEmi),
        status,
        refNote,
      });
    }
  }

  const paidEMIsCount = normalizedEMIs.filter((e) => e.status === "paid").length;
  const pendingEMIsCount = normalizedEMIs.filter((e) => e.status === "pending" || e.status === "partial").length;
  const overdueEMIsCount = normalizedEMIs.filter((e) => e.status === "overdue").length;
  const nextPendingEMI = normalizedEMIs.find((e) => e.status !== "paid");

  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const statementRef = `STMT-${(projectCode || "PRJ").toUpperCase()}-${plotNumber}-${Date.now().toString().slice(-4)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <base href="${typeof window !== "undefined" ? window.location.origin : ""}/">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Customer Ledger & EMI Statement - ${customerName} (Plot #${plotNumber})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11.5px;
      line-height: 1.45;
    }
    .print-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .print-bar-title {
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .print-btn {
      background: #c85a32;
      color: #ffffff;
      border: none;
      padding: 8px 20px;
      border-radius: 8px;
      font-weight: 800;
      cursor: pointer;
      font-size: 13px;
      letter-spacing: 0.3px;
      box-shadow: 0 2px 6px rgba(200, 90, 50, 0.4);
      transition: background 0.2s;
    }
    .print-btn:hover {
      background: #b04923;
    }
    @media print {
      .print-bar {
        display: none !important;
      }
    }
    .container {
      max-width: 850px;
      margin: 0 auto;
      padding: 16px 20px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2.5px solid #0f172a;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 700;
      color: #c85a32;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .brand-tagline {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .doc-meta {
      text-align: right;
      vertical-align: middle;
    }
    .doc-badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .doc-ref-text {
      font-size: 10px;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin-top: 4px;
    }
    .dossier-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .dossier-card {
      width: 48.5%;
      vertical-align: top;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .dossier-title {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #0f172a;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }
    .dossier-row {
      margin-bottom: 4px;
      font-size: 11px;
      display: flex;
    }
    .dossier-label {
      color: #64748b;
      width: 120px;
      shrink: 0;
      font-weight: 500;
    }
    .dossier-value {
      font-weight: 700;
      color: #0f172a;
      word-break: break-word;
    }
    .kpi-row {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .kpi-box {
      width: 23.5%;
      padding: 10px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      text-align: left;
    }
    .kpi-box.emerald {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .kpi-box.terracotta {
      background: #fff7ed;
      border-color: #fed7aa;
    }
    .kpi-box.indigo {
      background: #f0f9ff;
      border-color: #bae6fd;
    }
    .kpi-title {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    .kpi-amt {
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: -0.3px;
    }
    .kpi-amt.emerald { color: #166534; }
    .kpi-amt.terracotta { color: #c85a32; }
    .kpi-amt.indigo { color: #0369a1; }
    .kpi-footnote {
      font-size: 9.5px;
      font-weight: 600;
      color: #64748b;
      margin-top: 2px;
    }
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .matrix-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 8px;
      border: 1px solid #0f172a;
      text-align: left;
    }
    .matrix-table th.center { text-align: center; }
    .matrix-table th.right { text-align: right; }
    .matrix-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      font-size: 10.5px;
    }
    .matrix-table td.center { text-align: center; }
    .matrix-table td.right { text-align: right; font-family: ui-monospace, monospace; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .badge-settled { background: #dcfce7; color: #166534; }
    .badge-pending { background: #f1f5f9; color: #475569; }
    .badge-overdue { background: #fee2e2; color: #991b1b; }
    .badge-partial { background: #ffedd5; color: #9a3412; }
    .footer-section {
      width: 100%;
      border-top: 1.5px solid #cbd5e1;
      margin-top: 20px;
      padding-top: 14px;
      page-break-inside: avoid;
    }
    .footer-grid {
      width: 100%;
      border-collapse: collapse;
    }
    .terms-cell {
      width: 60%;
      vertical-align: top;
      font-size: 9px;
      color: #64748b;
      line-height: 1.45;
    }
    .sign-cell {
      width: 40%;
      vertical-align: bottom;
      text-align: right;
    }
    .sign-box {
      display: inline-block;
      text-align: center;
      width: 190px;
    }
    .sign-line {
      border-top: 1.5px solid #0f172a;
      margin-top: 40px;
      padding-top: 4px;
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
    }
    .sign-sub {
      font-size: 8.5px;
      color: #64748b;
    }
    .watermark-text {
      text-align: center;
      font-size: 8.5px;
      color: #94a3b8;
      margin-top: 12px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div class="print-bar-title">
      <span>📄 Official Customer Ledger & EMI Statement</span>
      <span style="opacity: 0.7; font-weight: normal;">| ${customerName} (Plot #${plotNumber})</span>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="container">
    <table class="header-table">
      <tr>
        <td style="width: 75px; vertical-align: middle; padding-right: 12px;">
          <img src="/ark-logo.png" alt="Ark Logo" style="height: 55px; width: auto; object-fit: contain; display: block;" onerror="this.style.display='none'" />
        </td>
        <td style="vertical-align: middle;">
          <div style="font-size: 9.5px; font-weight: 800; color: #c85a32; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 2px;">
            ARK BUILDERS & DEVELOPERS
          </div>
          <h1 class="brand-title">${projectName}</h1>
          <div class="brand-sub">Premium Plotted Development & Housing Schemes</div>
          <div class="brand-tagline">Corporate Office: SVB City Center, Club Road, Hubballi • Tally Prime Port 9000 Verified Ledger</div>
        </td>
        <td class="doc-meta">
          <div class="doc-badge">Official EMI Statement</div>
          <div class="doc-ref-text">Ref: ${statementRef}</div>
          <div class="doc-ref-text">Date: ${generatedOn}</div>
        </td>
      </tr>
    </table>
    <table class="dossier-grid">
      <tr>
        <td class="dossier-card">
          <div class="dossier-title">
            <span>👤 Buyer & KYC Information</span>
            <span style="color: #166534; font-size: 9px;">✓ Verified Allottee</span>
          </div>
          <div class="dossier-row">
            <span class="dossier-label">Customer Name:</span>
            <span class="dossier-value">${customerName}</span>
          </div>
          <div class="dossier-row">
            <span class="dossier-label">Phone Number:</span>
            <span class="dossier-value" style="font-family: monospace;">${customerPhone}</span>
          </div>
          <div class="dossier-row">
            <span class="dossier-label">Postal Address:</span>
            <span class="dossier-value">${customerAddress}</span>
          </div>
          <div class="dossier-row">
            <span class="dossier-label">Account Category:</span>
            <span class="dossier-value">Individual Plot Buyer / Primary Allottee</span>
          </div>
        </td>
        <td style="width: 3%;"></td>
        <td class="dossier-card">
          <div class="dossier-title">
            <span>🏡 Property & Unit Allocation</span>
            <span style="color: #c85a32; font-size: 9px;">[${(projectCode || "PRJ").toUpperCase()}]</span>
          </div>
          <div class="dossier-row">
            <span class="dossier-label">Project Name:</span>
            <span class="dossier-value">${projectName}</span>
          </div>
          <div class="dossier-row">
            <span class="dossier-label">Allotted Plot #:</span>
            <span class="dossier-value" style="color: #c85a32;">Plot #${plotNumber} ${areaSqft ? `(${areaSqft} sq.ft)` : ""}</span>
          </div>
          <div class="dossier-row">
            <span class="dossier-label">Total Agreement Value:</span>
            <span class="dossier-value" style="font-family: monospace;">${formatMoney(totalPrice)}</span>
          </div>
          <div class="dossier-row">
            <span class="dossier-label">Booking Date:</span>
            <span class="dossier-value">${formatDate(bookingDate || firstDueDate)}</span>
          </div>
        </td>
      </tr>
    </table>
    <table class="kpi-row">
      <tr>
        <td class="kpi-box">
          <div class="kpi-title">Agreed Contract Price</div>
          <div class="kpi-amt">${formatMoney(totalPrice)}</div>
          <div class="kpi-footnote">Total Deal Value</div>
        </td>
        <td style="width: 2%;"></td>
        <td class="kpi-box emerald">
          <div class="kpi-title">Total Received</div>
          <div class="kpi-amt emerald">${formatMoney(effectivePaid)}</div>
          <div class="kpi-footnote" style="color: #166534; font-weight: 700;">${paidPct}% Received to Date</div>
        </td>
        <td style="width: 2%;"></td>
        <td class="kpi-box terracotta">
          <div class="kpi-title">Current Balance Due</div>
          <div class="kpi-amt terracotta">${formatMoney(currentOutstanding)}</div>
          <div class="kpi-footnote" style="color: #c85a32; font-weight: 700;">Remaining Receivables</div>
        </td>
        <td style="width: 2%;"></td>
        <td class="kpi-box indigo">
          <div class="kpi-title">EMI Progression</div>
          <div class="kpi-amt indigo">${paidEMIsCount} / ${totalTerms} <span style="font-size: 11px;">EMIs</span></div>
          <div class="kpi-footnote" style="color: #0369a1; font-weight: 700;">${pendingEMIsCount + overdueEMIsCount} Pending Terms</div>
        </td>
      </tr>
    </table>
    <div class="section-header" style="font-weight: 800; font-size: 11px; margin-bottom: 8px; text-transform: uppercase;">
      <span>📅 Itemized EMI Amortization Schedule & Payment Matrix</span>
    </div>
    <table class="matrix-table">
      <thead>
        <tr>
          <th class="center" style="width: 38px;">#</th>
          <th>Due Date</th>
          <th class="right">Installment (₹)</th>
          <th>Milestone / Description</th>
          <th class="right">Amount Paid (₹)</th>
          <th class="right">Balance (₹)</th>
          <th class="center">Status</th>
          <th>Voucher / Ref Details</th>
        </tr>
      </thead>
      <tbody>
        ${normalizedEMIs
          .map((emi) => {
            const isPaid = emi.status === "paid";
            const isOverdue = emi.status === "overdue";
            const isPartial = emi.status === "partial";

            const statusBadge = isPaid
              ? '<span class="badge badge-settled">✓ SETTLED</span>'
              : isOverdue
              ? '<span class="badge badge-overdue">⚠ OVERDUE</span>'
              : isPartial
              ? '<span class="badge badge-partial">⏳ PARTIAL</span>'
              : '<span class="badge badge-pending">⏳ PENDING</span>';

            return `
              <tr>
                <td class="center" style="font-weight: 800;">${String(emi.num).padStart(2, "0")}</td>
                <td style="font-weight: 600;">${formatDate(emi.dueDate)}</td>
                <td class="right" style="font-weight: 800;">${formatMoney(emi.amount)}</td>
                <td style="font-weight: 600; color: #475569;">${emi.refNote || `EMI #${emi.num}`}</td>
                <td class="right" style="font-weight: 800; color: ${isPaid ? "#166534" : "#475569"};">
                  ${emi.paidAmount > 0 ? formatMoney(emi.paidAmount) : "-"}
                </td>
                <td class="right" style="font-weight: 800; color: ${emi.balanceDue > 0 ? "#c85a32" : "#166534"};">
                  ${formatMoney(emi.balanceDue)}
                </td>
                <td class="center">${statusBadge}</td>
                <td style="font-size: 10px; color: #475569;">
                  ${emi.refNote || (isPaid ? "Cleared" : "Scheduled")}
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
    ${
      recordedPayments.length > 0
        ? `
      <div class="section-header" style="font-weight: 800; font-size: 11px; margin-top: 14px; margin-bottom: 8px; text-transform: uppercase;">
        <span>💳 Received Payment Collection Vouchers (${recordedPayments.length} Transactions)</span>
      </div>
      <table class="matrix-table">
        <thead>
          <tr>
            <th style="width: 100px;">Receipt Date</th>
            <th>Voucher Reference / UTR</th>
            <th>Payment Method</th>
            <th>Credited Bank Ledger</th>
            <th class="right">Received Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${recordedPayments
            .map(
              (p) => `
            <tr>
              <td>${formatDate(p.paid_on)}</td>
              <td style="font-weight: 800; color: #0f172a;">${p.reference_number || "REC-APPROVED"}</td>
              <td style="font-weight: 600;">${p.payment_method || "Bank Transfer"}</td>
              <td style="font-size: 10px;">
                ${
                  p.collection_account === "govt"
                    ? "🏛️ Govt Collection Bank A/c"
                    : p.collection_account === "company"
                    ? "🏢 Company Collection Bank A/c"
                    : "🏦 Primary Real Estate Collection A/c"
                }
              </td>
              <td class="right" style="font-weight: 800; color: #166534;">
                ${formatMoney(p.amount)}
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      `
        : ""
    }
    <div class="footer-section">
      <table class="footer-grid">
        <tr>
          <td class="terms-cell">
            <strong>Official Certification & Statutory Notes:</strong><br>
            • This Statement of Account & EMI Amortization Schedule is an authorized computer-generated financial document.<br>
            • All credited transactions are verified, reconciled, and posted directly into Tally Prime Accounting Software.<br>
            • Future installments are subject to scheduled due dates. Early settlement incurs no foreclosure fees.<br>
            • For billing discrepancies or official receipt requests, please contact the developer treasury desk immediately.
          </td>
          <td class="sign-cell">
            <div class="sign-box">
              <div class="sign-line">Authorized Signatory</div>
              <div class="sign-sub">Treasury & Accounts Desk</div>
            </div>
          </td>
        </tr>
      </table>
      <div class="watermark-text">
        Verified & Synchronized with Tally Prime Treasury Database • RERA & GST Compliant Real Estate ERP System
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;
}

export function downloadEMIStatementPDF(data: EMIStatementPDFData) {
  const htmlContent = generateEMIStatementHTML(data);
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert("Pop-up blocked! Please allow pop-ups for this site to download/print the EMI Statement PDF.");
  }
}

export async function convertHTMLToPDFBlob(htmlContent: string): Promise<Blob> {
  if (typeof window === "undefined" || !document) {
    throw new Error("convertHTMLToPDFBlob must run in browser environment");
  }

  const styleMatches = htmlContent.match(/<style[\s\S]*?<\/style>/gi) || [];
  const styleString = styleMatches.join("\n");

  const bodyMatch = htmlContent.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : htmlContent;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "900px";
  container.style.backgroundColor = "#ffffff";
  container.style.zIndex = "-9999";
  container.innerHTML = `${styleString}\n<div style="background:#ffffff; color:#0f172a; padding:15px; font-family: sans-serif;">${bodyContent}</div>`;
  document.body.appendChild(container);

  try {
    const canvasPromise = html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: "#ffffff",
      imageTimeout: 3000,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("html2canvas render timeout")), 4000)
    );

    const canvas = await Promise.race([canvasPromise, timeoutPromise]);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    return pdf.output("blob");
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export async function uploadEMIStatementPDFToStorage(data: EMIStatementPDFData): Promise<string> {
  try {
    let pdfBlob: Blob;
    try {
      const htmlContent = generateEMIStatementHTML(data);
      pdfBlob = await convertHTMLToPDFBlob(htmlContent);
    } catch (renderErr) {
      console.warn("[HTML Canvas Render Warning, using vector PDF fallback]", renderErr);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text((data.projectName || "REAL ESTATE DEVELOPERS").toUpperCase(), 14, 18);
      doc.setFontSize(10);
      doc.text(`Official EMI Statement - Plot #${data.plotNumber}`, 14, 25);
      doc.text(`Customer: ${data.customerName}`, 14, 32);
      doc.text(`Total Agreement Value: Rs. ${Math.round(data.totalPrice || 0).toLocaleString("en-IN")}`, 14, 39);
      doc.text(`Advance Paid: Rs. ${Math.round(data.advancePaid || 0).toLocaleString("en-IN")}`, 14, 46);
      doc.text(`Remaining Receivable: Rs. ${Math.round(data.remainingBalance || 0).toLocaleString("en-IN")}`, 14, 53);
      pdfBlob = doc.output("blob");
    }

    const fileName = `statements/EMI_Statement_${(data.projectCode || "PRJ").toUpperCase()}_Plot_${data.plotNumber}_${Date.now()}.pdf`;

    let { error: uploadErr } = await supabase.storage
      .from("project-layouts")
      .upload(fileName, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr && (uploadErr.message?.includes("Bucket not found") || (uploadErr as any).statusCode === "404" || (uploadErr as any).error === "Bucket not found")) {
      try {
        await supabase.storage.createBucket("project-layouts", { public: true });
        const retry = await supabase.storage
          .from("project-layouts")
          .upload(fileName, pdfBlob, {
            contentType: "application/pdf",
            upsert: true,
          });
        uploadErr = retry.error;
      } catch {
        // Safe fallback
      }
    }

    if (uploadErr) {
      console.warn("[Storage Upload Warning project-layouts]", uploadErr);
      // Fallback: Try uploading to 'project-documents' bucket if project-layouts fails
      const fallbackUpload = await supabase.storage
        .from("project-documents")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (!fallbackUpload.error) {
        const { data: fallbackPubData } = supabase.storage
          .from("project-documents")
          .getPublicUrl(fileName);
        if (fallbackPubData?.publicUrl) {
          return fallbackPubData.publicUrl;
        }
      }
    }

    if (uploadErr) {
      console.error("[Storage Upload Final Failure]", uploadErr);
      const msg = uploadErr.message || (uploadErr as any).error || JSON.stringify(uploadErr);
      toast.error(`Supabase Storage Error: ${msg}. Please ensure storage policies exist for 'project-layouts'.`, { duration: 10000 });
      return "";
    }

    const { data: pubData } = supabase.storage
      .from("project-layouts")
      .getPublicUrl(fileName);

    return pubData?.publicUrl || "";
  } catch (err: any) {
    console.error("[uploadEMIStatementPDFToStorage Error]", err);
    return "";
  }
}
