import { createServerFn } from "@tanstack/react-start";

export const TALLY_CONFIG = {
  url: "http://localhost:9000",
  companyName: "HAEGL Tech",
};

export interface TallyBookingPayload {
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  plotNumber: string;
  projectName?: string;
  projectCode?: string;
  totalPrice: number;
  areaSqft?: number;
  ratePerSqft?: number;
  bookingDate?: string;
  bookingRef: string;
}

export interface TallyPaymentPayload {
  customerName: string;
  customerPhone?: string;
  plotNumber: string;
  projectName?: string;
  projectCode?: string;
  amount: number;
  bankLedger?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountType?: "company" | "govt" | "dual";
  paymentMode?: string;
  paymentDate?: string;
  paymentRef: string;
  bookingRef?: string;
}

export interface TallyTransferPayload {
  sourceProject: string;
  targetProject: string;
  amount: number;
  transferDate?: string;
  transferRef: string;
  sourceBankName?: string;
  sourceAccountNo?: string;
  sourceIfsc?: string;
  targetBankName?: string;
  targetAccountNo?: string;
  targetIfsc?: string;
}

export interface TallyRepaymentPayload {
  sourceProject: string;
  targetProject?: string;
  amount: number;
  repaymentDate?: string;
  repaymentRef: string;
  sourceBankName?: string;
  sourceAccountNo?: string;
  sourceIfsc?: string;
  targetBankName?: string;
  targetAccountNo?: string;
  targetIfsc?: string;
}

/** 
 * Formats dates for Tally Prime.
 * Note: Tally Educational Mode ONLY permits days 01, 02, and 31.
 * Non-matching days are mapped to valid Educational Mode days so Tally never rejects XML payloads.
 */
function formatTallyDate(dateStr?: string): string {
  if (!dateStr) return "20260701";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "20260701";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const rawDay = d.getDate();

    // Map day to 01, 02, or 31 for 100% Tally Educational Mode compatibility
    let dayStr = String(rawDay).padStart(2, "0");
    if (rawDay !== 1 && rawDay !== 2 && rawDay !== 31) {
      dayStr = rawDay > 15 ? "31" : "01";
    }
    return `${year}${month}${dayStr}`;
  } catch {
    return "20260701";
  }
}

/** Server Function: Executes Node.js fetch to Tally Prime on port 9000 */
export const postToTallyServerFn = createServerFn({ method: "POST" })
  .validator((xmlPayload: string) => xmlPayload)
  .handler(async ({ data: xmlPayload }) => {
    try {
      const response = await fetch(TALLY_CONFIG.url, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: xmlPayload,
      });
      const responseText = await response.text();
      const isSuccess =
        responseText.includes("<CREATED>1</CREATED>") ||
        responseText.includes("<ALTERED>1</ALTERED>") ||
        (responseText.includes("<RESPONSE>") && !responseText.includes("<ERRORS>1</ERRORS>"));
      return { success: isSuccess, responseText };
    } catch (error) {
      console.error("Tally Server Function Error:", error);
      return {
        success: false,
        responseText: error instanceof Error ? error.message : "Failed to reach Tally Prime on port 9000",
      };
    }
  });

/** Helper wrapper that works seamlessly across browser and server */
export async function postToTallyServer(xmlPayload: string): Promise<{ success: boolean; responseText: string }> {
  try {
    return await postToTallyServerFn({ data: xmlPayload });
  } catch (err: any) {
    console.error("postToTallyServer Error:", err);
    return {
      success: false,
      responseText: err?.message || "Failed to execute Tally sync server function",
    };
  }
}

/** 1. Sync Plot Booking (Sales Voucher + Customer Ledger) */
export async function syncBookingToTally(data: TallyBookingPayload) {
  const dateFormatted = formatTallyDate(data.bookingDate);
  const company = TALLY_CONFIG.companyName;
  const projectCode = (data.projectCode || "PRJ").toUpperCase();
  const projectName = data.projectName || "Default Project";
  const voucherNum = data.bookingRef;
  const ledgerName = `Customer - ${data.customerName} (Plot #${data.plotNumber})`;

  // 1. Create/Update Customer Ledger under Sundry Debtors
  const customerXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${ledgerName}" ACTION="Create">
            <NAME>${ledgerName}</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <MAILINGNAME>${data.customerName}</MAILINGNAME>
            <ADDRESS.LIST>
              <ADDRESS>${data.customerAddress || `Plot #${data.plotNumber}, ${projectName}`}</ADDRESS>
            </ADDRESS.LIST>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`.trim();

  await postToTallyServer(customerXml);

  // Build narration
  const areaInfo = data.areaSqft ? ` (${data.areaSqft} SqFt)` : "";
  const narration = `Plot #${data.plotNumber}${areaInfo} Sale | Project: ${projectName} [${projectCode}] | Customer: ${data.customerName} | Ref: ${voucherNum}`;

  // 2. Post Sales Voucher
  const salesXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${dateFormatted}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${voucherNum}</VOUCHERNUMBER>
            <REFERENCE>${voucherNum}</REFERENCE>
            <REMOTEID>${voucherNum}</REMOTEID>
            <GUID>${voucherNum}</GUID>
            <PARTYLEDGERNAME>${ledgerName}</PARTYLEDGERNAME>
            <NARRATION>${narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${ledgerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-${data.totalPrice.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Plot Sales Revenue</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>${data.totalPrice.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`.trim();

  return await postToTallyServer(salesXml);
}

/** 2. Sync Payment / Downpayment (Receipt Voucher with Project Bank Ledger) */
export async function syncPaymentToTally(data: TallyPaymentPayload) {
  const dateFormatted = formatTallyDate(data.paymentDate);
  const company = TALLY_CONFIG.companyName;
  const projectCode = (data.projectCode || "PRJ").toUpperCase();
  const projectName = data.projectName || "Project";
  const isCash = (data.paymentMode || "").toLowerCase() === "cash";
  
  // Resolve project bank ledger name & parent group
  let bankLedger = data.bankLedger;
  let ledgerParent = "Bank Accounts";

  if (isCash) {
    bankLedger = "Cash in Hand";
    ledgerParent = "Cash-in-Hand";
  } else if (!bankLedger) {
    if (data.bankName && data.accountNumber) {
      bankLedger = `${data.bankName} - ${data.accountNumber.slice(-4)}`;
    } else if (data.bankName) {
      bankLedger = `${projectName} - ${data.bankName}`;
    } else {
      bankLedger = `${projectName} Collection Bank A/c`;
    }
  }

  const ledgerName = `Customer - ${data.customerName} (Plot #${data.plotNumber})`;
  const voucherNum = data.paymentRef;

  // 1. Ensure Project-Specific Bank / Cash Ledger exists in Tally
  const bankMasterXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${bankLedger}" ACTION="Create">
            <NAME>${bankLedger}</NAME>
            <PARENT>${ledgerParent}</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`.trim();

  await postToTallyServer(bankMasterXml);

  const narration = `Payment Collection for Plot #${data.plotNumber} | Customer: ${data.customerName} | Project: ${projectName} [${projectCode}] | Mode: ${data.paymentMode || "Bank"} | Bank: ${bankLedger} | Ref: ${voucherNum}`;

  // 2. Create Receipt Voucher
  const receiptXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${dateFormatted}</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${voucherNum}</VOUCHERNUMBER>
            <REFERENCE>${voucherNum}</REFERENCE>
            <REMOTEID>${voucherNum}</REMOTEID>
            <GUID>${voucherNum}</GUID>
            <PARTYLEDGERNAME>${ledgerName}</PARTYLEDGERNAME>
            <NARRATION>${narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${bankLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-${data.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${ledgerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>${data.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`.trim();

  return await postToTallyServer(receiptXml);
}

/** 3. Sync Inter-Project Fund Transfer (Journal Voucher - Direct Bank-to-Bank) */
export async function syncTransferToTally(data: TallyTransferPayload) {
  const dateFormatted = formatTallyDate(data.transferDate);
  const company = TALLY_CONFIG.companyName;
  const sourceBankLedger = `${data.sourceProject} Collection Bank A/c`;
  const targetProjectName = data.targetProject || "Target Project";
  const targetBankLedger = `${targetProjectName} Collection Bank A/c`;

  // 1. Ensure both Source and Target Project Bank Ledgers exist in Tally under "Bank Accounts"
  const masterXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${sourceBankLedger}" ACTION="Create">
            <NAME>${sourceBankLedger}</NAME>
            <PARENT>Bank Accounts</PARENT>
          </LEDGER>
          <LEDGER NAME="${targetBankLedger}" ACTION="Create">
            <NAME>${targetBankLedger}</NAME>
            <PARENT>Bank Accounts</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`.trim();

  await postToTallyServer(masterXml);

  const narration = `Inter-Project Fund Transfer from ${data.sourceProject} to ${data.targetProject} - Ref: ${data.transferRef}`;

  // 2. Post Direct Bank-to-Bank Journal Voucher
  const journalXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>${dateFormatted}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <NARRATION>${narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${targetBankLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-${data.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${sourceBankLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>${data.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`.trim();

  return await postToTallyServer(journalXml);
}

/** 4. Sync Inter-Project Fund Repayment back to Source Project Bank Account (Direct Bank-to-Bank) */
export async function syncTransferRepaymentToTally(data: TallyRepaymentPayload) {
  const dateFormatted = formatTallyDate(data.repaymentDate);
  const company = TALLY_CONFIG.companyName;
  const sourceBankLedger = `${data.sourceProject} Collection Bank A/c`;
  const targetProjectName = data.targetProject || "Target Project";
  const targetBankLedger = `${targetProjectName} Collection Bank A/c`;

  // 1. Ensure both Source and Target Project Bank Ledgers exist in Tally under "Bank Accounts"
  const masterXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${sourceBankLedger}" ACTION="Create">
            <NAME>${sourceBankLedger}</NAME>
            <PARENT>Bank Accounts</PARENT>
          </LEDGER>
          <LEDGER NAME="${targetBankLedger}" ACTION="Create">
            <NAME>${targetBankLedger}</NAME>
            <PARENT>Bank Accounts</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`.trim();

  await postToTallyServer(masterXml);

  const narration = `Inter-Project Capital Repayment from ${targetProjectName} returned back to ${data.sourceProject} - Ref: ${data.repaymentRef}`;

  // 2. Post Direct Bank-to-Bank Journal Voucher for Repayment
  const journalXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>${dateFormatted}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <NARRATION>${narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${sourceBankLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-${data.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${targetBankLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>${data.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`.trim();

  return await postToTallyServer(journalXml);
}

/** Tally Sync State Tracking Helpers */
const LOCAL_STORAGE_KEY_PREFIX = "tally_sync_v1_";

export function isBookingSyncedToTally(bookingId: string): boolean {
  if (typeof window === "undefined" || !bookingId) return false;
  return !!localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}bkg_${bookingId}`);
}

export function markBookingSyncedToTally(bookingId: string): void {
  if (typeof window === "undefined" || !bookingId) return;
  localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}bkg_${bookingId}`, new Date().toISOString());
}

export function isPaymentSyncedToTally(paymentId: string): boolean {
  if (typeof window === "undefined" || !paymentId) return false;
  return !!localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}pay_${paymentId}`);
}

export function markPaymentSyncedToTally(paymentId: string): void {
  if (typeof window === "undefined" || !paymentId) return;
  localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}pay_${paymentId}`, new Date().toISOString());
}

export function resetTallySyncForBooking(bookingId: string, paymentIds: string[] = []): void {
  if (typeof window === "undefined" || !bookingId) return;
  localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}bkg_${bookingId}`);
  localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}pay_advance_${bookingId}`);
  paymentIds.forEach((pid) => localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}pay_${pid}`));
}

/**
 * Single Unified Customer Ledger Tally Sync Handler (Idempotent & Incremental).
 * Prevents re-creation of previously synced Sales & Receipt Vouchers.
 * Syncs ONLY unsynced transactions (Sales voucher or new payments).
 */
export async function syncCustomerLedgerUnified({
  booking,
  payments = [],
  forceResync = false,
}: {
  booking: any;
  payments?: any[];
  forceResync?: boolean;
}): Promise<{
  success: boolean;
  syncedSales: boolean;
  syncedPaymentsCount: number;
  alreadyUpToDate: boolean;
  error?: string;
}> {
  if (!booking) throw new Error("No booking provided for Tally sync");

  const prjCode = (booking.plots?.projects?.code || "PRJ").toUpperCase();
  const prjName = booking.plots?.projects?.name || "Project";
  const plotNo = String(booking.plots?.plot_number || "101");
  const bkgRef = `BKG-${prjCode}-${plotNo}`;
  const totalPrice = Number(booking.total_price || 0);
  const advancePaid = Number(booking.advance_paid || 0);

  let syncedSales = false;
  let syncedPaymentsCount = 0;

  if (forceResync) {
    resetTallySyncForBooking(
      booking.id,
      payments.map((p: any) => p.id)
    );
  }

  // 1. Sync Booking Sales Voucher if not synced yet
  const bookingAlreadySynced = isBookingSyncedToTally(booking.id);
  if (!bookingAlreadySynced || forceResync) {
    const salesRes = await syncBookingToTally({
      customerName: booking.customer_name || "Customer",
      customerPhone: booking.customer_phone || undefined,
      customerAddress: booking.customer_address || undefined,
      plotNumber: plotNo,
      projectName: prjName,
      projectCode: prjCode,
      totalPrice: totalPrice,
      bookingDate: booking.booking_date || booking.created_at,
      bookingRef: bkgRef,
    });

    if (!salesRes.success) {
      return {
        success: false,
        syncedSales: false,
        syncedPaymentsCount: 0,
        alreadyUpToDate: false,
        error: salesRes.responseText || "Failed to post Sales Voucher to Tally Prime",
      };
    }

    markBookingSyncedToTally(booking.id);
    syncedSales = true;
  }

  // 2. Sync Payments (Receipt Vouchers)
  if (payments.length > 0) {
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      const pId = p.id;
      const paymentAlreadySynced = isPaymentSyncedToTally(pId);

      if (!paymentAlreadySynced || forceResync) {
        const recRef = p.reference_number || `REC-${prjCode}-${plotNo}-${String(i + 1).padStart(2, "0")}`;
        const bankName = `${prjName} Collection Bank A/c`;

        const payRes = await syncPaymentToTally({
          customerName: booking.customer_name || "Customer",
          customerPhone: booking.customer_phone || undefined,
          plotNumber: plotNo,
          projectName: prjName,
          projectCode: prjCode,
          amount: Number(p.amount),
          bankLedger: bankName,
          paymentDate: p.paid_on || p.created_at,
          paymentMode: p.payment_method || "Bank Transfer",
          paymentRef: recRef,
          bookingRef: bkgRef,
        });

        if (!payRes.success) {
          return {
            success: false,
            syncedSales,
            syncedPaymentsCount,
            alreadyUpToDate: false,
            error: payRes.responseText || `Failed to post Receipt Voucher (${recRef}) to Tally Prime`,
          };
        }

        markPaymentSyncedToTally(pId);
        syncedPaymentsCount++;
      }
    }
  } else if (advancePaid > 0) {
    const advKey = `advance_${booking.id}`;
    const advanceAlreadySynced = isPaymentSyncedToTally(advKey);

    if (!advanceAlreadySynced || forceResync) {
      const recRef = `REC-${prjCode}-${plotNo}-01`;
      const payRes = await syncPaymentToTally({
        customerName: booking.customer_name || "Customer",
        customerPhone: booking.customer_phone || undefined,
        plotNumber: plotNo,
        projectName: prjName,
        projectCode: prjCode,
        amount: advancePaid,
        bankLedger: `${prjName} Collection Bank A/c`,
        paymentDate: booking.booking_date || booking.created_at,
        paymentMode: "Downpayment",
        paymentRef: recRef,
        bookingRef: bkgRef,
      });

      if (!payRes.success) {
        return {
          success: false,
          syncedSales,
          syncedPaymentsCount,
          alreadyUpToDate: false,
          error: payRes.responseText || "Failed to post Advance Receipt Voucher to Tally Prime",
        };
      }

      markPaymentSyncedToTally(advKey);
      syncedPaymentsCount++;
    }
  }

  const alreadyUpToDate = !syncedSales && syncedPaymentsCount === 0;

  return {
    success: true,
    syncedSales,
    syncedPaymentsCount,
    alreadyUpToDate,
  };
}

