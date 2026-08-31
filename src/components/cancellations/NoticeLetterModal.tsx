import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Building2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { printElement } from "@/lib/printUtils";

interface NoticeLetterModalProps {
  cancellation: any;
  booking: any;
  noticeStage: 1 | 2 | 3;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function money(val: any) {
  return `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateLong(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export function NoticeLetterModal({ cancellation, booking, noticeStage, open, onOpenChange }: NoticeLetterModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!booking) return null;

  const handlePrint = () => {
    printElement(printRef.current, {
      title: `ARK_Legal_Notice_Stage_${noticeStage}_Plot_${plot.plot_number || "P"}_${(customerName || "Customer").replace(/[^a-zA-Z0-9]/g, "_")}`,
      pageSize: "A4 portrait",
      pageMargin: "8mm 10mm",
    });
  };

  const project = booking.plots?.projects || {};
  const plot = booking.plots || {};
  const customerName = booking.customer_name || "Customer";
  const address = booking.customer_address || "Hubballi";
  const city = booking.city || "Hubballi";
  const pincode = booking.pincode || "580029";
  const mobile = booking.customer_phone || "—";
  const email = booking.customer_email || "—";

  const totalPrice = Number(booking.total_price || 0);
  const advancePaid = Number(booking.advance_paid || booking.booking_amount || 0);
  const totalPaid = advancePaid; // Total collected so far
  const remainingBalance = Math.max(0, totalPrice - totalPaid);
  const emiArrears = cancellation?.cancellation_type === "emi_default" 
    ? Number(booking.installment_amount || (totalPrice - advancePaid) / Math.max(1, Number(booking.installment_count || 12))) * 2
    : 0;

  const cancellationType = cancellation?.cancellation_type || "emi_default";
  const isEmiDefault = cancellationType === "emi_default";

  const noticeDateStr = cancellation?.[`notice_${noticeStage}_sent_at`]
    ? cancellation[`notice_${noticeStage}_sent_at`]
    : new Date().toISOString();

  const refNo = `ARK/CRM/NOTICE-${noticeStage}/${new Date().getFullYear()}/${(plot.plot_number || "P21").toUpperCase()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto p-0 bg-card border border-border/80 shadow-2xl rounded-2xl">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="print:hidden sticky top-0 z-20 flex items-center justify-between p-4 bg-card/95 backdrop-blur-xl border-b border-border/60 text-foreground">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-terracotta/10 border border-terracotta/30 flex items-center justify-center text-terracotta shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-foreground block tracking-tight">Ark Builders & Developers</span>
              <span className="text-xs text-muted-foreground">Standard Formal Notice Letter #{noticeStage} (Speed Post / A4 Print)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handlePrint}
              className="bg-terracotta hover:bg-terracotta/90 text-white font-bold text-xs px-5 py-2.5 rounded-xl gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print Formal Notice Letter (A4)
            </Button>
          </div>
        </div>

        {/* PRINT CONTAINER / PREVIEW AREA */}
        <div className="p-6 bg-slate-200 dark:bg-slate-950 flex justify-center">
          <div
            ref={printRef}
            className="print-document relative bg-white text-slate-900 shadow-2xl w-[210mm] min-h-[297mm] p-[12mm] font-serif leading-relaxed text-xs border border-slate-300 rounded-md space-y-5 overflow-hidden"
          >

            {/* WATERMARK ACCENT */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none rotate-[-35deg]">
              <span className="text-8xl font-black font-serif uppercase tracking-widest text-slate-900 text-center leading-tight">
                ARK BUILDERS<br />LEGAL NOTICE
              </span>
            </div>

            {/* OFFICIAL LETTERHEAD HEADER */}
            <div
              className="border-b-2 border-slate-900 pb-3 flex items-center gap-5 font-sans relative z-10"
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: "20px",
                borderBottom: "2px solid #0f172a",
                paddingBottom: "12px",
              }}
            >
              <img
                src="/ark-logo.png"
                alt="Ark Builders & Developers Logo"
                className="h-20 w-auto object-contain shrink-0"
                style={{
                  height: "75px",
                  width: "auto",
                  maxWidth: "185px",
                  objectFit: "contain",
                  flexShrink: 0,
                  display: "block",
                }}
                onError={(e: any) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <div className="space-y-1 text-slate-700 flex-1" style={{ flex: "1 1 0%", minWidth: 0 }}>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-serif font-black text-2xl text-slate-900 tracking-tight leading-none" style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                    ARK BUILDERS & DEVELOPERS
                  </h1>
                </div>
                <p className="text-[11px] font-semibold text-amber-800 tracking-wide uppercase" style={{ margin: "2px 0 0 0", fontSize: "11px", fontWeight: 700, color: "#9a3412", letterSpacing: "0.5px" }}>
                  PROMOTERS, BUILDERS & DEVELOPERS
                </p>
                <p className="text-[10.5px] text-slate-600 font-medium" style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#475569" }}>
                  #4th Floor, SVB City Center, Above Yes Bank, Club Road, HUBBALLI – 580029
                </p>
                <div className="flex items-center gap-4 text-[10px] text-slate-600 font-medium flex-wrap" style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "9.5px", color: "#475569", marginTop: "3px", flexWrap: "wrap" }}>
                  <span>Tel: <strong className="text-slate-800">0836-4264881</strong></span>
                  <span>•</span>
                  <span>Cell: <strong className="text-slate-800">+91-9739 388 839</strong>, <strong className="text-slate-800">+91-9844 123 456</strong></span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-600 font-medium flex-wrap" style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "9.5px", color: "#475569", marginTop: "2px" }}>
                  <span>E-mail: <strong className="text-slate-800">arkbuild4@gmail.com</strong></span>
                  <span>•</span>
                  <span>Web: <strong className="text-slate-800">www.arkbuildersanddevelopers.in</strong></span>
                </div>
              </div>
            </div>

            {/* FORMAL NOTICE HEADER DETAILS (Ref No, Date & Mode) */}
            <div className="flex justify-between items-start text-xs font-sans border-b border-slate-200 pb-2 relative z-10 font-medium">
              <div>
                <span className="font-bold text-slate-700">Ref No: </span>
                <span className="font-mono font-bold text-slate-900">{refNo}</span>
              </div>
              <div className="text-right">
                <div><span className="font-bold text-slate-700">Date: </span><strong className="text-slate-900">{formatDateLong(noticeDateStr)}</strong></div>
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide block mt-0.5">
                  BY SPEED POST A.D. / REGISTERED POST
                </span>
              </div>
            </div>

            {/* RECIPIENT POSTAL ADDRESS BLOCK */}
            <div className="space-y-1 font-serif text-xs pt-1 relative z-10 text-slate-900">
              <span className="font-bold block font-sans text-slate-700">To,</span>
              <p className="font-bold text-sm text-slate-900">{customerName}</p>
              <p className="max-w-md text-slate-800">{address}</p>
              <p className="text-slate-800">{city}, Karnataka — {pincode}</p>
              <p className="text-slate-700 font-sans pt-0.5">Mobile: <strong>+91-{mobile}</strong> {email !== "—" ? `· Email: ${email}` : ""}</p>
            </div>

            {/* FORMAL SUBJECT & SALUTATION */}
            <div className="space-y-2 pt-2 relative z-10">
              <div className="p-3 bg-amber-50/90 border-l-4 border-amber-600 rounded-r-md font-sans text-xs font-bold text-slate-900 leading-snug">
                Sub: OFFICIAL NOTICE #{noticeStage} — {isEmiDefault ? `Overdue Installment Payment & Impending Plot Booking Cancellation` : `Confirmation of Customer Voluntary Cancellation Request`} regarding Plot #{plot.plot_number} at {project.name || "Royal Villa Properties"}.
              </div>
              <p className="font-bold text-xs pt-1 text-slate-900">Dear Sir / Madam,</p>
            </div>

            {/* FORMAL LETTER BODY */}
            <div className="space-y-3.5 text-xs text-slate-900 leading-relaxed font-serif relative z-10 text-justify">
              <p>
                With reference to your plot booking application and agreement executed with <strong>Ark Builders & Developers</strong> for purchase of <strong>Plot #{plot.plot_number}</strong> situated at <strong>{project.name || "Royal Villa Properties"}</strong>, Hubballi, we hereby serve you this official Notice #{noticeStage} regarding your account status.
              </p>

              {/* STATEMENT OF ACCOUNT TABLE */}
              <div className="space-y-1.5 font-sans my-3">
                <p className="font-bold text-[11px] uppercase tracking-wider text-slate-800">
                  Statement of Account & Financial Breakdown:
                </p>
                <table className="w-full border border-slate-300 text-xs text-left rounded-md overflow-hidden">
                  <thead className="bg-[#0B2545] text-white font-bold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2 border-r border-blue-900">Total Agreed Plot Cost</th>
                      <th className="p-2 border-r border-blue-900">Total Amount Paid</th>
                      <th className="p-2 border-r border-blue-900">Overdue Arrears</th>
                      <th className="p-2">Total Balance Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white font-mono text-[11px]">
                    <tr>
                      <td className="p-2 border-r border-slate-300 font-bold text-slate-900">{money(totalPrice)}</td>
                      <td className="p-2 border-r border-slate-300 font-bold text-emerald-700">{money(totalPaid)}</td>
                      <td className="p-2 border-r border-slate-300 font-bold text-rose-700">{money(emiArrears)}</td>
                      <td className="p-2 font-bold text-amber-900">{money(remainingBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {noticeStage === 1 && (
                <>
                  {isEmiDefault ? (
                    <p>
                      As per our accounting records, your scheduled monthly installment payments totaling <strong>{money(emiArrears)}</strong> are currently overdue. We request you to clear these outstanding dues within a grace period of <strong>15 calendar days</strong> from the date of receipt of this notice.
                    </p>
                  ) : (
                    <p>
                      We acknowledge receipt of your voluntary request for cancellation of your plot booking. Before proceeding with final cancellation, we grant you a grace period of <strong>15 calendar days</strong> from the date of this notice to confirm or revoke your request.
                    </p>
                  )}
                  <p>
                    Please note that during this Notice #1 period, you retain full rights to revoke the cancellation request or clear your overdue dues to retain your plot booking in good standing.
                  </p>
                </>
              )}

              {noticeStage === 2 && (
                <>
                  <p className="font-bold text-amber-950">
                    ⚠️ URGENT FINAL WARNING NOTICE: IMPENDING PLOT TERMINATION
                  </p>
                  <p>
                    Despite our previous Notice #1 dated {cancellation?.notice_1_sent_at ? formatDateLong(cancellation.notice_1_sent_at) : "earlier"}, the outstanding dues / cancellation status of <strong>{money(emiArrears || remainingBalance)}</strong> remain unrectified.
                  </p>
                  <p>
                    This serves as your final warning notice (Notice #2). You are hereby granted a final grace period of <strong>7 calendar days</strong> to make the payment or submit your revocation request. Failure to do so will result in immediate issuance of Notice #3 (Final Cancellation) and release of Plot #{plot.plot_number} back to the market.
                  </p>
                </>
              )}

              {noticeStage === 3 && (
                <>
                  <p className="font-bold text-rose-900">
                    🚫 FINAL NOTICE #3: PLOT BOOKING CANCELLATION & SITE TERMINATION
                  </p>
                  <p>
                    Since no payment or revocation was received within the stipulated grace periods under Notice #1 and Notice #2, we hereby inform you that your booking for <strong>Plot #{plot.plot_number}</strong> at <strong>{project.name || "Royal Villa Properties"}</strong> stands <strong>CANCELLED AND TERMINATED</strong> with immediate effect.
                  </p>
                  <p>
                    Plot #{plot.plot_number} has been reset to AVAILABLE status on our Site Mapper and freed for fresh booking. Accounting reconciliation and refund processing, if applicable, shall be carried out strictly as per company cancellation terms.
                  </p>
                </>
              )}

              <p className="pt-2">
                For any clarifications or assistance, please visit our head office at SVB City Center, Club Road, Hubballi, or contact our CRM desk at <strong>+91-9739 388 839</strong>.
              </p>
            </div>

            {/* FORMAL CLOSING & SIGNATURE BLOCK */}
            <div className="pt-6 flex justify-between items-end font-serif relative z-10 text-xs">
              <div className="space-y-8">
                <p>Thanking You,</p>
                <div>
                  <p className="font-bold text-slate-900 font-sans">Yours Faithfully,</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">For ARK BUILDERS & DEVELOPERS</p>
                  <div className="h-10 border-b border-dashed border-slate-300 w-56 my-2 flex items-center justify-center text-[10px] text-slate-400 italic font-sans">
                    [ Official Seal & Signature ]
                  </div>
                  <p className="font-bold text-slate-900 font-sans">Authorized Signatory / CRM Legal Head</p>
                  <p className="text-[10px] text-slate-600 font-sans">Ark Builders & Developers, Hubballi</p>
                </div>
              </div>

              <div className="text-right text-[10px] text-slate-500 font-sans border-l border-slate-200 pl-4 space-y-1">
                <p className="font-bold text-slate-700">Copy To:</p>
                <p>1. Accounts & Audit Dept.</p>
                <p>2. Legal & Registration File Copy</p>
                <p>3. Managing Director Desk</p>
              </div>
            </div>

            {/* FOOTER */}
            <div className="pt-3 border-t border-amber-300 flex justify-between items-center text-[10px] text-amber-900 font-medium font-sans relative z-10">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="h-4 w-4 text-amber-600 inline" /> Building Trust. Creating Landmarks. Delivering Value.
              </div>
              <div className="text-slate-500 text-[9px]">
                Ark Builders & Developers · Official Registered Notice Letter
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
