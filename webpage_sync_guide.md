# 🌐 Webpage to Tally Sync Guide (`webpage_sync_guide.md`)

> **Objective**: Trigger live Tally Prime synchronization directly from user interactions on the Plot Perfect web UI (e.g. clicking buttons, approving bookings, or recording fund transfers).

---

## 🛠️ How Webpage Data Sync Works

We have added a dedicated synchronization library ([src/lib/tallySync.ts](file:///e:/projects/plot-perfect-main/plot-perfect-main/src/lib/tallySync.ts)) and UI integrations across the app:

```
┌─────────────────────────┐
│     USER WEBPAGE        │
│                         │
│  [ Sync Tally Button ]  │
│  or Approve Action      │
└────────────┬────────────┘
             │
             │ Calls `syncBookingToTally()`, `syncPaymentToTally()`, `syncTransferToTally()`
             ▼
┌─────────────────────────┐
│   src/lib/tallySync.ts  │
│                         │
│  - Builds Tally XML     │
│  - Targets "HAEGL Tech" │
└────────────┬────────────┘
             │
             │ HTTP POST (http://localhost:9000)
             ▼
┌─────────────────────────┐
│      TALLY PRIME        │
│                         │
│  Creates Voucher Live!  │
└─────────────────────────┘
```

---

## 🚀 Built-in Webpage Sync Trigger Locations

### 1. Bookings Page (`/bookings`)
- **Direct Button**: Each row in the Bookings table now features an interactive **`Sync Tally`** button (green database icon).
- **Behavior**:
  - Automatically creates the Buyer Ledger in Tally under `Sundry Debtors`.
  - Posts the **Sales Voucher** for the total plot price.
  - Posts the **Receipt Voucher** for any advance downpayment collected.
  - Displays instant visual notification: `Synced Plot #101 to Tally Prime!`.

### 2. Treasury Management (`/treasury`)
- **Automatic Sync**: When an administrator records an **Inter-Project Fund Transfer** (reallocating funds between two project accounts):
  - Plot Perfect automatically formats the Journal Voucher payload.
  - Posts the **Journal Voucher** directly to Tally Prime.
  - Displays toast notification: `Synced Journal Voucher to Tally Prime!`.

---

## 👨‍💻 Code Examples for Developers

### Example 1: Syncing a Booking from Any React Component
```typescript
import { syncBookingToTally } from "@/lib/tallySync";
import { toast } from "sonner";

async function onBookPlot() {
  const result = await syncBookingToTally({
    customerName: "Vikram Mehta",
    plotNumber: "204",
    totalPrice: 3500000,
    bookingDate: "20260401",
    bookingRef: "BKG-204",
  });

  if (result.success) {
    toast.success("Plot booking synced to Tally Prime!");
  } else {
    toast.error(`Tally sync error: ${result.responseText}`);
  }
}
```

### Example 2: Syncing an Installment Payment
```typescript
import { syncPaymentToTally } from "@/lib/tallySync";

async function onCollectInstallment() {
  await syncPaymentToTally({
    customerName: "Vikram Mehta",
    plotNumber: "204",
    amount: 750000,
    paymentDate: "20260401",
    paymentRef: "PAY-750",
  });
}
```

---

## 📌 Testing Webpage Sync Live

1. Run the local dev server: `npm run dev`.
2. Open your browser to `http://localhost:3000/bookings` (or `/treasury`).
3. Click the **`Sync Tally`** button on any booking.
4. Switch to **Tally Prime** ➔ Open **Day Book** ➔ See the newly posted voucher appear live!
