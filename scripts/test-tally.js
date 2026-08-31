// Complete Tally XML Sync Demo Suite
const TALLY_URL = "http://localhost:9000";
const COMPANY_NAME = "HAEGL Tech";

// 1. XML to Create Customer Ledger
const createCustomerXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${COMPANY_NAME}</SVCURRENTCOMPANY>
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
`;

// 2. XML to Create Sales Voucher (Plot Booking for ₹25,00,000)
const createSalesVoucherXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${COMPANY_NAME}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>Customer - Rajesh Kumar</PARTYLEDGERNAME>
            <NARRATION>Booking Sale for Plot #101 (1200 sqft) - Ref: BKG-101 | Customer: Rajesh Kumar</NARRATION>
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
`;

// 3. XML to Create Receipt Voucher (Installment Payment for ₹5,00,000)
const createReceiptVoucherXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${COMPANY_NAME}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>Customer - Rajesh Kumar</PARTYLEDGERNAME>
            <NARRATION>Advance Payment Collection for Plot #101 via HDFC Bank - Ref: PAY-501 | Customer: Rajesh Kumar</NARRATION>
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
`;

// 4. XML to Create Journal Voucher (Inter-Project Transfer for ₹10,00,000)
const createJournalVoucherXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${COMPANY_NAME}</SVCURRENTCOMPANY>
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
`;

async function postToTally(xmlData, label) {
  console.log(`\n--------------------------------------------------`);
  console.log(`🚀 Sending: ${label}...`);
  try {
    const response = await fetch(TALLY_URL, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xmlData.trim(),
    });
    const text = await response.text();
    console.log(`📥 Response for ${label}:`);
    console.log(text);
    if (text.includes("<CREATED>1</CREATED>") || text.includes("<ALTERED>1</ALTERED>")) {
      console.log(`✅ SUCCESS: ${label} recorded in Tally!`);
    } else {
      console.log(`⚠️ WARNING: Tally response for ${label}`);
    }
  } catch (error) {
    console.error(`❌ ERROR sending ${label}:`, error.message);
  }
}

async function runDemoSuite() {
  console.log(`==================================================`);
  console.log(`🎯 STARTING CLEAN TALLY PRIME XML INTEGRATION TEST`);
  console.log(`Target URL    : ${TALLY_URL}`);
  console.log(`Target Company: ${COMPANY_NAME}`);
  console.log(`==================================================`);

  await postToTally(createCustomerXml, "1. Customer Ledger Creation");
  await postToTally(createSalesVoucherXml, "2. Plot Sale Voucher (₹25,00,000)");
  await postToTally(createReceiptVoucherXml, "3. Receipt Voucher (₹5,00,000)");
  await postToTally(createJournalVoucherXml, "4. Inter-Project Transfer Journal Voucher (₹10,00,000)");

  console.log(`\n==================================================`);
  console.log(`🎉 TEST COMPLETED! Open Tally Prime Day Book to verify.`);
  console.log(`==================================================\n`);
}

runDemoSuite();
