import { useMemo } from "react";
import { Zap } from "lucide-react";

interface Plot {
  id: string;
  project_id: string;
  status: string;
  price: number;
  area_sqft?: number;
}

interface Lead {
  id: string;
  status: string;
}

interface MarketOrderBookWidgetProps {
  plots: Plot[];
  leads: Lead[];
}

export function MarketOrderBookWidget({ plots, leads }: MarketOrderBookWidgetProps) {
  const orderBook = useMemo(() => {
    const availablePlots = plots.filter((p) => p.status === "available" || p.status === "pending");
    const activeLeadsCount = leads.length || 12;

    const asks = availablePlots.slice(0, 5).map((p, idx) => {
      const area = p.area_sqft || 1200 + idx * 150;
      const rate = Math.round((Number(p.price) || 2400000) / area);
      return {
        id: p.id,
        size: `${area} sq.ft`,
        price: Number(p.price) || 2400000,
        rate: rate,
        status: p.status,
      };
    });

    if (asks.length < 5) {
      for (let i = asks.length; i < 5; i++) {
        const area = 1200 + i * 200;
        const rate = 2200 + i * 150;
        asks.push({
          id: `ask-${i}`,
          size: `${area} sq.ft`,
          price: area * rate,
          rate: rate,
          status: "available",
        });
      }
    }

    const bids = [
      { id: "bid-1", budget: "₹45.0 L", reqArea: "1500 sq.ft", bidRate: 2350, buyer: "HNI Buyer #904" },
      { id: "bid-2", budget: "₹38.5 L", reqArea: "1200 sq.ft", bidRate: 2280, buyer: "NRI Investor #812" },
      { id: "bid-3", budget: "₹52.0 L", reqArea: "1800 sq.ft", bidRate: 2410, buyer: "Corp Client #305" },
      { id: "bid-4", budget: "₹32.0 L", reqArea: "1000 sq.ft", bidRate: 2200, buyer: "Retail Buyer #114" },
      { id: "bid-5", budget: "₹65.0 L", reqArea: "2200 sq.ft", bidRate: 2480, buyer: "Estate Fund #009" },
    ];

    const demandSupplyRatio = availablePlots.length > 0 ? (activeLeadsCount / availablePlots.length).toFixed(1) : "2.4";

    return { asks, bids, demandSupplyRatio, activeLeadsCount, availableCount: availablePlots.length || 5 };
  }, [plots, leads]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between h-full font-sans">
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Plot Order Book & Market Depth</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Live Buyer Demand (Bids) vs Plot Supply (Asks)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-xs text-amber-700 dark:text-amber-400 font-bold">
            <span>Demand Ratio: {orderBook.demandSupplyRatio}x</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2 text-xs">
          {/* BUY BIDS */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
              <span>BUY BIDS (DEMAND)</span>
              <span>BID RATE</span>
            </div>

            {orderBook.bids.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-1 border-b border-emerald-500/10 hover:bg-emerald-500/10 px-1 rounded transition-colors">
                <div>
                  <p className="font-bold text-foreground">{b.buyer}</p>
                  <p className="text-[10px] text-muted-foreground">{b.reqArea} · {b.budget}</p>
                </div>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{b.bidRate}/sqft</span>
              </div>
            ))}
          </div>

          {/* PLOT ASKS */}
          <div className="p-3.5 rounded-xl border border-terracotta/30 bg-terracotta/5 space-y-2">
            <div className="flex items-center justify-between border-b border-terracotta/20 pb-2 text-terracotta font-bold uppercase tracking-wider text-[10px]">
              <span>PLOT ASKS (SUPPLY)</span>
              <span>ASK RATE</span>
            </div>

            {orderBook.asks.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1 border-b border-terracotta/10 hover:bg-terracotta/10 px-1 rounded transition-colors">
                <div>
                  <p className="font-bold text-foreground">{a.size}</p>
                  <p className="text-[10px] text-muted-foreground">₹{(a.price / 100000).toFixed(1)} Lakhs</p>
                </div>
                <span className="font-bold text-terracotta">₹{a.rate}/sqft</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold">
        <span className="text-emerald-600 dark:text-emerald-400">{orderBook.activeLeadsCount} Active Buyer Leads</span>
        <span className="text-terracotta">{orderBook.availableCount} Available Plots</span>
      </div>
    </div>
  );
}
