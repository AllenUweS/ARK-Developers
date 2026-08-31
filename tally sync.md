# 📑 Plot Perfect: Tally Prime Integration & Self-Hosting Architecture (`tally sync.md`)

> **Document Status**: Production Blueprint & Feasibility Guide  
> **Target Audience**: Management, Technical Team, and Client IT Operations  
> **Feasibility Verdict**: **100% FEASIBLE & DOABLE**

---

## 🎯 Executive Summary

This document specifies the complete technical blueprint for:
1. **Tally Data Synchronization**: Automatically syncing **Plot Bookings (Sales Vouchers)**, **Installment Receipts (Receipt Vouchers)**, and **Inter-Project Fund Transfers (Journal/Contra Vouchers)** from the Plot Perfect platform directly into **Tally Prime / Tally.ERP 9**.
2. **On-Premises Self-Hosting**: Deploying the Plot Perfect web application, PostgreSQL database, and authentication stack on the client’s own server infrastructure so all project data stays 100% internal.

---

## 📋 Client Requirements Needed (Prerequisites)

Before starting implementation, the client must provide the following parameters and environment accesses:

### 1. Tally Prime System Details
- **Tally License**: Tally Prime (Gold Multi-user or Silver Single-user).
- **Tally Web Server Enabled**: Tally HTTP interface enabled on Tally host PC (`Tally.ini` setting `User Tally Web Server = Yes`, default Port `9000`).
- **Tally Company Names**: Exact company names as configured in Tally per project:
  - *Example Project 1*: `"Plot Perfect - Grand Meadows Ltd."`
  - *Example Project 2*: `"Plot Perfect - Royal Palms Ltd."`
- **Chart of Accounts Ledger Mapping**:
  - **Customer Group**: e.g. `"Sundry Debtors"` or `"Plot Buyers"`
  - **Revenue / Plot Income Ledger**: e.g. `"Plot Sales Income"`
  - **Bank / Cash Ledgers**: e.g. `"HDFC Bank Operating A/c"`, `"ICICI Collection A/c"`
  - **Inter-Project Transfer Ledger**: e.g. `"Inter-Project Capital Transfer Account"`

### 2. Client On-Premises Server Specs
- **Operating System**: Ubuntu 22.04 LTS (Recommended) or Windows Server 2019/2022 (with Docker Desktop / WSL2).
- **Hardware Resources**:
  - **CPU**: 4 Cores minimum (8 Cores recommended).
  - **RAM**: 16 GB minimum.
  - **Storage**: 100 GB+ NVMe SSD storage with secondary backup partition.
- **Network Configuration**:
  - Static Local IP (e.g. `192.168.1.100`) or Local Domain (e.g. `https://plots.clientdomain.local`).
  - SSL Certificate (Enterprise CA or internal domain SSL certificate).
  - SSH / Remote Desktop administrative credentials.

---

## 🏗️ System Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT ON-PREMISES SERVER                       │
│                                                                        │
│   ┌───────────────────────────┐         ┌───────────────────────────┐  │
│   │ Plot Perfect Web Platform │         │ Self-Hosted Supabase      │  │
│   │ (Node.js / TanStack Start)│◄───────►│ (PostgreSQL, GoTrue Auth, │  │
│   │                           │         │  Storage, PostgREST API)  │  │
│   └─────────────┬─────────────┘         └─────────────┬─────────────┘  │
└─────────────────┼─────────────────────────────────────┼────────────────┘
                  │                                     │
                  │ Webhook Triggers / Event Queue      │ DB Sync Queue Logs
                  ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TALLY SYNC CONNECTOR MIDDLEWARE                      │
│      (Lightweight Background Service on Windows/Host Tally PC)         │
│                                                                        │
│   1. Reads pending entries from `tally_sync_logs` DB queue.            │
│   2. Formats Tally XML envelopes (Sales, Receipts, Journals).          │
│   3. Posts XML payload to local Tally HTTP endpoint (Port 9000).        │
│   4. Parses XML response & updates DB status (Synced / Error log).     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ Tally XML HTTP POST (Port 9000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      TALLY PRIME / TALLY.ERP 9                         │
│                                                                        │
│   - Auto-creates Customer Ledgers (Sundry Debtors)                     │
│   - Creates Sales Vouchers for Bookings                                │
│   - Creates Receipt Vouchers for Installments                          │
│   - Creates Journal/Contra Vouchers for Project-to-Project Transfers   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Technical Implementation Details

### 1. Database Schema (`tally_sync_logs`)

```sql
-- Migration: Add Tally Sync Audit & Queue Log Table
CREATE TYPE tally_sync_type AS ENUM (
  'customer_master', 
  'booking_sale', 
  'installment_receipt', 
  'project_transfer'
);

CREATE TYPE tally_sync_status AS ENUM (
  'pending', 
  'synced', 
  'failed', 
  'retrying'
);

CREATE TABLE public.tally_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type tally_sync_type NOT NULL,
    entity_id UUID NOT NULL,
    project_id UUID REFERENCES public.projects(id),
    tally_company_name TEXT NOT NULL,
    xml_request TEXT NOT NULL,
    xml_response TEXT,
    tally_voucher_number TEXT,
    status tally_sync_status DEFAULT 'pending',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);
```

---

### 2. Tally XML Payload Engine

#### A. Customer Ledger Auto-Creation XML
*Creates the customer under "Sundry Debtors" in Tally before posting vouchers.*

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
          <SVCURRENTCOMPANY>Plot Perfect - Grand Meadows Ltd.</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Customer - Rajesh Kumar" ACTION="Create">
            <NAME>Customer - Rajesh Kumar</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <MAILINGNAME>Rajesh Kumar</MAILINGNAME>
            <ADDRESS.LIST>
              <ADDRESS>Plot 42, Sector 5, City</ADDRESS>
            </ADDRESS.LIST>
            <PANNUMBER>ABCDE1234F</PANNUMBER>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

#### B. Booking Sales Voucher XML
*Posts plot sale amount to Sales Revenue & debits Customer Ledger.*

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
          <SVCURRENTCOMPANY>Plot Perfect - Grand Meadows Ltd.</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20260811</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>Customer - Rajesh Kumar</PARTYLEDGERNAME>
            <NARRATION>Plot #42 (1200 sqft) Booking Sale - Ref BKG-9921</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Customer - Rajesh Kumar</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-2500000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Plot Sales Income Account</LEDGERNAME>
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

#### C. Installment Receipt Voucher XML
*Credits Customer Ledger and debits Bank/Cash Account when installment payment is collected.*

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
          <SVCURRENTCOMPANY>Plot Perfect - Grand Meadows Ltd.</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>20260811</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>Customer - Rajesh Kumar</PARTYLEDGERNAME>
            <NARRATION>Installment #1 collection for Plot #42 via HDFC Bank</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>HDFC Bank Collection Account</LEDGERNAME>
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

#### D. Inter-Project Fund Transfer Journal XML
*Records capital reallocation from Project A to Project B.*

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
          <SVCURRENTCOMPANY>Plot Perfect - Royal Palms Ltd.</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>20260811</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <NARRATION>Capital reallocation from Grand Meadows to Royal Palms Project - Transfer ID: TRF-102</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>HDFC Bank Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-1500000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Inter-Project Capital Transfer Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>1500000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

---

## 🛡️ Reliability, Security & Error Handling

1. **Idempotency Safeguards**: Each voucher generation embeds a unique reference ID (e.g. `BKG-9921`, `PAY-501`) into Tally’s narration and voucher reference fields to prevent duplicate entries if a network retry occurs.
2. **Offline Handling**: If Tally Prime is closed or the host PC is turned off, the Tally Connector background service retries failed entries automatically once Tally is restarted.
3. **Data Security**: All data remains entirely on the client’s internal server and local network—no third-party cloud accounting intermediaries are required.

---

## 📌 Implementation Checklist & Rollout Plan

- [ ] **Step 1**: Collect Tally Prime Company names and Ledger group mappings from client accountant.
- [ ] **Step 2**: Provision client server (Ubuntu 22.04 LTS / Windows Server) & install Docker.
- [ ] **Step 3**: Deploy self-hosted PostgreSQL & Plot Perfect application via Docker Compose.
- [ ] **Step 4**: Deploy Tally Connector Service on the local PC running Tally Prime.
- [ ] **Step 5**: Execute end-to-end integration testing for Bookings, Installments, and Treasury Transfers.
- [ ] **Step 6**: Hand over operational documentation & train client finance team.
