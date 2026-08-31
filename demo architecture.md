# 🚀 Local Demo Architecture & Client PoC Guide (`demo architecture.md`)

> **Objective**: Set up a live working demonstration on your local computer to show the client that Plot Perfect seamlessly syncs **Bookings**, **Installment Receipts**, and **Project Treasury Transfers** directly into **Tally Prime** in real-time.  
> **Status**: **VERIFIED & WORKING (Tested Live with Tally Prime Educational Mode)**

---

## ✅ Verified Setup Status

| Component | Status | Details |
| :--- | :--- | :--- |
| **Tally Prime Server** | ✅ **Active & Running** | `http://localhost:9000` returns `<RESPONSE>TallyPrime Server is Running</RESPONSE>` |
| **Tally Company Name** | ✅ **Configured** | `HAEGL Tech` |
| **Ledgers Created** | ✅ **Verified** | `Plot Sales Revenue`, `HDFC Bank Collection A/c`, `Inter-Project Transfer Account`, `Sundry Debtors` |
| **HTTP XML Sync Test** | ✅ **100% SUCCESS** | All 4 test vouchers posted & verified in Tally Day Book (`<CREATED>1</CREATED>`) |

---

## 🏗️ Local Demo System Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         YOUR LOCAL DEVELOPMENT PC                          │
│                                                                            │
│  ┌─────────────────────────────┐           ┌────────────────────────────┐  │
│  │  Plot Perfect Web App       │           │  Supabase Database         │  │
│  │  (Running on http://... )   │◄─────────►│  (Cloud DB or Local DB)   │  │
│  └──────────────┬──────────────┘           └─────────────┬──────────────┘  │
└─────────────────┼────────────────────────────────────────┼─────────────────┘
                  │                                        │
                  │ Trigger Action / Event                 │ Read Unsynced Queue
                  ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    LOCAL TALLY SYNC CONNECTOR AGENT                        │
│                (`scripts/test-tally.js` / Webhook Handler)                 │
│                                                                            │
│   1. Listens for new Bookings, Installments, or Treasury Transfers.        │
│   2. Formats Tally XML Envelope targeting company "HAEGL Tech".            │
│   3. HTTP POST XML payload to http://localhost:9000.                       │
│   4. Parses `<RESPONSE><CREATED>1</CREATED></RESPONSE>` from Tally.        │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
                                    │ HTTP POST XML (Port 9000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               TALLY PRIME (Educational Mode - HAEGL Tech)                  │
│                                                                            │
│   - Receives XML POST on Port 9000.                                        │
│   - Automatically creates Buyer Ledger under "Sundry Debtors".            │
│   - Instantly posts Sales Voucher, Receipt Voucher, and Journal Voucher.   │
└───────────────────────────────────┴────────────────────────────────────────┘
```

---

## 🎬 How to Run the Live Demo for the Client

To perform the live demo in front of the client:

### 1. Open Tally Prime
- Keep Tally Prime open on screen showing company **HAEGL Tech**.
- Open **Day Book** (`Display More Reports` ➔ `Day Book`).

### 2. Execute Demo Runner Script
Open PowerShell in project folder and run:
```powershell
node scripts/test-tally.js
```

### 3. Show Live Vouchers Created in Tally
Press **F5 (Refresh)** or re-open **Day Book** in Tally Prime. The client will see:

1. **Customer Ledger**: `Customer - Rajesh Kumar` created automatically under `Sundry Debtors`.
2. **Sales Voucher #1**: `₹25,00,000` (Plot #101 Booking Sale).
3. **Receipt Voucher #1**: `₹5,00,000` (Advance Payment in HDFC Bank Collection A/c).
4. **Journal Voucher #1**: `₹10,00,000` (Inter-Project Capital Reallocation).

---

## 💻 Working Tally XML Payload Reference

Here are the exact XML structures verified against your Tally Prime instance:

### A. Customer Ledger Auto-Creation XML
```xml
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>HAEGL Tech</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Customer - Rajesh Kumar" ACTION="Create">
            <NAME>Customer - Rajesh Kumar</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <MAILINGNAME>Rajesh Kumar</MAILINGNAME>
            <ADDRESS.LIST>
              <ADDRESS>Plot #101, Grand Meadows</ADDRESS>
            </ADDRESS.LIST>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

### B. Plot Booking Sales Voucher (₹25,00,000)
```xml
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>HAEGL Tech</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>Customer - Rajesh Kumar</PARTYLEDGERNAME>
            <NARRATION>Booking Sale for Plot #101 (1200 sqft) - Ref: BKG-101</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Customer - Rajesh Kumar</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-2500000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Plot Sales Revenue</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>2500000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

### C. Installment Receipt Voucher (₹5,00,000)
```xml
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>HAEGL Tech</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>Customer - Rajesh Kumar</PARTYLEDGERNAME>
            <NARRATION>Advance Payment Collection for Plot #101 via HDFC Bank - Ref: PAY-501</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>HDFC Bank Collection A/c</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-500000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Customer - Rajesh Kumar</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>500000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

### D. Inter-Project Fund Transfer Journal Voucher (₹10,00,000)
```xml
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>HAEGL Tech</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <NARRATION>Inter-Project Capital Reallocation from Grand Meadows to Royal Palms - Ref: TRF-102</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Inter-Project Transfer Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-1000000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>HDFC Bank Collection A/c</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>1000000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

---

## 📌 Summary for Client Demo
- **Tested & Verified Live**: All 4 transactions return `<CREATED>1</CREATED>` from Tally Prime on `http://localhost:9000`.
- **Zero Configuration Needed on Client End**: When client provides their server, we simply update the company name and ledger mappings.
