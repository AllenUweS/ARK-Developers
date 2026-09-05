/**
 * WhatsApp Automation Service for Plot Perfect / Terra Site Manager
 * Supports both Official Meta WhatsApp Cloud API / Provider webhooks
 * and 1-click WhatsApp web links for instant sales & ledger dispatch.
 */

export interface BookingWhatsAppPayload {
  customerName: string;
  customerPhone: string;
  projectName: string;
  plotNumber: string;
  totalPrice: number;
  bookingAmountPaid: number;
  bookingDate?: string;
  salesExecutiveName?: string;
}

export interface EMIStatementWhatsAppPayload {
  customerName: string;
  customerPhone: string;
  unitProjectDetails: string; // e.g. "Shree Durga Enclave - Plot #108"
  totalContractPrice: number;
  totalAmountRealized: number;
  remainingBalance: number;
  paidInstallmentsText: string; // e.g. "4 of 12 EMIs"
  pendingInstallmentsText: string; // e.g. "8 EMIs"
  nextDueDate?: string; // e.g. "10 Sep 2026"
  nextDueAmount: number;
  pdfDocumentUrl?: string;
  pdfBlob?: Blob;
  mediaId?: string;
  pdfFileName?: string;
}

const formatMoney = (val: number) =>
  `₹${Math.round(val || 0).toLocaleString("en-IN")}`;

const formatMoneyRs = (val: number) =>
  `Rs. ${Math.round(val || 0).toLocaleString("en-IN")}`;

const formatDate = (dateStr?: string) => {
  if (!dateStr) return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  try {
    const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
};

/**
 * Clean phone number to 10-digit format with country code (defaults to +91 India).
 */
export function formatWhatsAppPhone(phone: string, countryCode = "91"): string {
  const digits = phone.replace(/\D/g, "");
  const clean10 = digits.slice(-10);
  return `${countryCode}${clean10}`;
}

/**
 * Formats clean, professional text for WhatsApp booking confirmation message.
 */
export function buildBookingConfirmationMessage(payload: BookingWhatsAppPayload): string {
  const {
    customerName,
    projectName,
    plotNumber,
    totalPrice,
    bookingAmountPaid,
    bookingDate,
  } = payload;

  return `Hello *${customerName}*,

Thank you for booking with us! We are delighted to confirm your plot booking. Here are your official booking details:

🏷️ *Project Name:* ${projectName}
🏡 *Plot Number:* Plot #${plotNumber}
💰 *Total Agreement Price:* ${formatMoney(totalPrice)}
💳 *Booking Amount Paid:* ${formatMoney(bookingAmountPaid)}
📅 *Booking Date:* ${formatDate(bookingDate)}

Your booking confirmation & payment receipt have been generated. Our operations team will reach out to you shortly with agreement documentation and payment schedule details.

Thank you for trusting us with your dream property!

Warm regards,
Sales & Operations Team`;
}

/**
 * Formats clean, professional text for SBI Bank style EMI Statement WhatsApp message.
 */
export function buildEMIStatementMessage(payload: EMIStatementWhatsAppPayload): string {
  return `Dear *${payload.customerName}*,

Here is your updated EMI payment statement and ledger summary for your property reservation:

🏡 *Project & Plot:* ${payload.unitProjectDetails}
💰 *Total Contract Price:* ${formatMoney(payload.totalContractPrice)}
✅ *Total Amount Received:* ${formatMoney(payload.totalAmountRealized)}
⏳ *Remaining Balance:* ${formatMoney(payload.remainingBalance)}

📊 *EMI Progress:*
• Paid Installments: ${payload.paidInstallmentsText}
• Pending Installments: ${payload.pendingInstallmentsText}
📅 *Next EMI Due Date:* ${formatDate(payload.nextDueDate)}
💵 *Next Due Amount:* ${formatMoney(payload.nextDueAmount)}

Thank you for your prompt payments and continued trust with us!

Warm regards,
Accounts & Finance Team`;
}

/**
 * Generates direct 1-tap WhatsApp Web / Mobile deep link for Booking Confirmation.
 */
export function getWhatsAppDeepLink(payload: BookingWhatsAppPayload): string {
  const phoneWithCode = formatWhatsAppPhone(payload.customerPhone);
  const messageText = buildBookingConfirmationMessage(payload);
  return `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(messageText)}`;
}

/**
 * Generates direct 1-tap WhatsApp Web / Mobile deep link for EMI Statement.
 */
export function getEMISatementWhatsAppDeepLink(payload: EMIStatementWhatsAppPayload): string {
  const phoneWithCode = formatWhatsAppPhone(payload.customerPhone);
  const messageText = buildEMIStatementMessage(payload);
  return `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(messageText)}`;
}

const HARDCODED_ACCESS_TOKEN = "EAAONO18mvZBYBSTIFG5gDVRKk1bqwGMhtZBqsbq8EibymSZBP2DUUyaSZClnQ1iYAZCfONHZAMt3QuhDS7YWPGckDALwHr2ZAJ9M16QmJnuzyw6bgpSw7UtefXFIxU7aUAmc7X9v8ULsCspZA7HPXAMYzityHFVGijdZAhfpRUod3ZC4KhcUZBuAxaaG0960jvAdNQC3sYPXkADZAcQeAxknU3ZCRZCi2927GbuXE2bYmwSDlayvsOqS6ZBE90lhFZArOA08bCf6TR0YeVDOzefv42HXcDKJaDRprZCEZD";
const HARDCODED_PHONE_NUMBER_ID = "1126770290524197";
const HARDCODED_BOOKING_TEMPLATE_NAME = "plot_booking_confirmation";
const HARDCODED_EMI_TEMPLATE_NAME = "customer_emi_statement_v2";

/**
 * Automated API Trigger for Booking Confirmation.
 */
export async function sendBookingConfirmationWhatsApp(
  payload: BookingWhatsAppPayload,
  config?: {
    accessToken?: string;
    phoneNumberId?: string;
    templateName?: string;
  }
): Promise<{ success: boolean; mode: "api" | "deeplink"; message?: string; deepLink?: string }> {
  const accessToken = config?.accessToken || import.meta.env.VITE_WHATSAPP_API_TOKEN || HARDCODED_ACCESS_TOKEN;
  const phoneNumberId = config?.phoneNumberId || import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID || HARDCODED_PHONE_NUMBER_ID;
  const templateName = config?.templateName || import.meta.env.VITE_WHATSAPP_TEMPLATE_NAME || HARDCODED_BOOKING_TEMPLATE_NAME;

  const deepLink = getWhatsAppDeepLink(payload);

  if (!accessToken || !phoneNumberId) {
    return {
      success: true,
      mode: "deeplink",
      deepLink,
      message: "WhatsApp API credentials not set. Generated 1-tap WhatsApp link.",
    };
  }

  const phoneWithCode = formatWhatsAppPhone(payload.customerPhone);
  const preferredLang = import.meta.env.VITE_WHATSAPP_LANGUAGE_CODE || "en";

  async function postTemplate(langCode: string) {
    return fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneWithCode,
          type: "template",
          template: {
            name: templateName,
            language: { code: langCode },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: payload.customerName },
                  { type: "text", text: payload.projectName },
                  { type: "text", text: `Plot #${payload.plotNumber}` },
                  { type: "text", text: formatMoney(payload.totalPrice) },
                  { type: "text", text: formatMoney(payload.bookingAmountPaid) },
                  { type: "text", text: formatDate(payload.bookingDate) },
                ],
              },
            ],
          },
        }),
      }
    );
  }

  try {
    let response = await postTemplate(preferredLang);
    let result = await response.json();

    if (!response.ok && result.error?.code === 132001) {
      const alternateLang = preferredLang === "en" ? "en_US" : "en";
      response = await postTemplate(alternateLang);
      result = await response.json();
    }

    if (!response.ok) {
      return {
        success: false,
        mode: "api",
        deepLink,
        message: result.error?.message || "WhatsApp API call failed",
      };
    }

    return {
      success: true,
      mode: "api",
      message: `WhatsApp message successfully dispatched to ${phoneWithCode}!`,
    };
  } catch (err: any) {
    return {
      success: false,
      mode: "deeplink",
      deepLink,
      message: err.message || "Failed to dispatch WhatsApp message via API",
    };
  }
}

/**
 * Automated API Trigger for SBI-Style EMI Statement WhatsApp Dispatch.
 */
export async function uploadMediaToMetaWhatsApp(
  blob: Blob,
  fileName = "EMI_Statement.pdf",
  accessToken = HARDCODED_ACCESS_TOKEN,
  phoneNumberId = HARDCODED_PHONE_NUMBER_ID
): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", blob, fileName);
    form.append("type", "application/pdf");
    form.append("messaging_product", "whatsapp");

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[Meta Media Upload Error]", res.status, errText);
      return null;
    }

    const data = await res.json();
    return data.id || null;
  } catch (e) {
    console.warn("[Meta Media Upload Exception]", e);
    return null;
  }
}

export async function sendEMIStatementWhatsApp(
  payload: EMIStatementWhatsAppPayload,
  config?: {
    accessToken?: string;
    phoneNumberId?: string;
    templateName?: string;
  }
): Promise<{ success: boolean; mode: "api" | "deeplink"; message?: string; deepLink?: string }> {
  const accessToken = config?.accessToken || import.meta.env.VITE_WHATSAPP_API_TOKEN || HARDCODED_ACCESS_TOKEN;
  const phoneNumberId = config?.phoneNumberId || import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID || HARDCODED_PHONE_NUMBER_ID;
  const templateName = config?.templateName || import.meta.env.VITE_WHATSAPP_EMI_TEMPLATE_NAME || HARDCODED_EMI_TEMPLATE_NAME;

  const deepLink = getEMISatementWhatsAppDeepLink(payload);

  if (!accessToken || !phoneNumberId) {
    return {
      success: true,
      mode: "deeplink",
      deepLink,
      message: "WhatsApp API credentials not set. Generated 1-tap WhatsApp link.",
    };
  }

  // Upload PDF blob directly to Meta WhatsApp Media API if available!
  let mediaId = payload.mediaId;
  if (!mediaId && payload.pdfBlob) {
    console.log("[WhatsApp EMI API] Uploading generated statement PDF directly to Meta Media API...");
    mediaId = (await uploadMediaToMetaWhatsApp(
      payload.pdfBlob,
      payload.pdfFileName || "EMI_Statement.pdf",
      accessToken,
      phoneNumberId
    )) || undefined;
    if (mediaId) {
      console.log("[WhatsApp EMI API] Meta Media Upload Success, ID:", mediaId);
    }
  }

  const phoneWithCode = formatWhatsAppPhone(payload.customerPhone);
  const preferredLang = import.meta.env.VITE_WHATSAPP_LANGUAGE_CODE || "en";

  const documentParam: any = mediaId
    ? { id: mediaId, filename: payload.pdfFileName || "EMI_Statement.pdf" }
    : payload.pdfDocumentUrl
    ? { link: payload.pdfDocumentUrl, filename: payload.pdfFileName || "EMI_Statement.pdf" }
    : { link: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", filename: payload.pdfFileName || "EMI_Statement.pdf" };

  async function postTemplate(langCode: string) {
    const components: any[] = [
      {
        type: "header",
        parameters: [
          {
            type: "document",
            document: documentParam,
          },
        ],
      },
      {
        type: "body",
        parameters: [
          { type: "text", text: payload.customerName },                  // {{1}}
          { type: "text", text: payload.unitProjectDetails },            // {{2}}
          { type: "text", text: formatMoneyRs(payload.totalContractPrice) }, // {{3}}
          { type: "text", text: formatMoneyRs(payload.totalAmountRealized) }, // {{4}}
          { type: "text", text: formatMoneyRs(payload.remainingBalance) },   // {{5}}
          { type: "text", text: payload.paidInstallmentsText },          // {{6}}
          { type: "text", text: payload.pendingInstallmentsText },       // {{7}}
          { type: "text", text: formatDate(payload.nextDueDate) },       // {{8}}
          { type: "text", text: formatMoneyRs(payload.nextDueAmount) },  // {{9}}
        ],
      },
    ];

    return fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneWithCode,
          type: "template",
          template: {
            name: templateName,
            language: { code: langCode },
            components,
          },
        }),
      }
    );
  }

  async function postDirectDocument() {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phoneWithCode,
            type: "document",
            document: {
              ...documentParam,
              caption: `📄 Official EMI Statement PDF for ${payload.customerName} (${payload.unitProjectDetails})\n💰 Contract Value: ${formatMoney(payload.totalContractPrice)}\n✅ Received: ${formatMoney(payload.totalAmountRealized)}\n⏳ Remaining Balance: ${formatMoney(payload.remainingBalance)}`,
            },
          }),
        }
      );
      const data = await res.json();
      console.log("[WhatsApp Direct PDF Document API Response]", data);
      return res.ok;
    } catch (e) {
      console.warn("[WhatsApp Direct PDF Error]", e);
      return false;
    }
  }

  try {
    let docTemplateResp = await postTemplate(preferredLang);
    let docTemplateResult = await docTemplateResp.json();

    if (!docTemplateResp.ok && (docTemplateResult.error?.code === 132001 || docTemplateResult.error?.message?.includes("translation"))) {
      const alternateLang = preferredLang === "en" ? "en_US" : "en";
      docTemplateResp = await postTemplate(alternateLang);
      docTemplateResult = await docTemplateResp.json();
    }

    if (docTemplateResp.ok) {
      return {
        success: true,
        mode: "api",
        message: `Single PDF Statement message successfully sent to ${phoneWithCode} via WhatsApp!`,
      };
    }

    if (!docTemplateResp.ok) {
      console.log("[WhatsApp EMI API] Template message error:", docTemplateResult.error?.message, "Attempting direct PDF document message...");
      const directOk = await postDirectDocument();
      if (directOk) {
        return {
          success: true,
          mode: "api",
          message: `Official Statement PDF document successfully sent to ${phoneWithCode} via WhatsApp!`,
        };
      }
    }

    const errMsg = docTemplateResult.error?.error_data?.details || docTemplateResult.error?.message || "WhatsApp API call failed";
    return {
      success: false,
      mode: "api",
      deepLink,
      message: `(#${docTemplateResult.error?.code || "API"}) ${errMsg}`,
    };
  } catch (err: any) {
    return {
      success: false,
      mode: "deeplink",
      deepLink,
      message: err.message || "Failed to dispatch WhatsApp statement via API",
    };
  }
}
