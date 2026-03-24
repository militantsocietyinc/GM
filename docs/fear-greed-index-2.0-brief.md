# Fear & Greed Index 2.0 — Reverse Engineering Brief

## Overview

A composite market sentiment gauge (0–100) combining **10 weighted categories** into a single score. The original CNN Fear & Greed Index uses ~7 inputs and is widely criticized for lagging and oversimplifying. This "2.0" version by @investingluc uses 10+ granular inputs to produce a more nuanced reading.

**Example reading**: 38.7 (Fear) — while CNN was at 16 (Extreme Fear) and SPY was only ~6% off ATH.

---

## Architecture (Reverse-Engineered from Screenshots)

### Composite Score Formula

```
Final Score = Σ (Category_Score × Category_Weight)
```

Each category scores **0–100** (0 = Extreme Fear, 100 = Extreme Greed).
The weighted sum produces the composite index.

### 10 Categories with Weights

| # | Category       | Weight | Score Example | Contribution | What It Measures |
|---|---------------|--------|---------------|-------------|------------------|
| 1 | **Sentiment**  | 10%    | 19            | 1.9         | CNN F&G, AAII Bull/Bear surveys, social sentiment |
| 2 | **Volatility** | 10%    | 47            | 4.7         | VIX level, VIX term structure (contango/backwardation) |
| 3 | **Positioning**| 15%    | 34            | 5.1         | Put/Call ratios, options skew, CFTC positioning |
| 4 | **Trend**      | 10%    | 52            | 5.2         | SPX vs 20d/50d/200d MAs, price momentum |
| 5 | **Breadth**    | 10%    | 40            | 4.0         | % stocks > 200 DMA, advance/decline ratio, new highs/lows |
| 6 | **Momentum**   | 10%    | 13            | 1.3         | Sector leaders vs laggards, RSI, rate of change |
| 7 | **Liquidity**  | 15%    | 26            | 3.9         | Bid-ask spreads, market depth, funding rates |
| 8 | **Credit**     | 10%    | 68            | 6.8         | HY spreads, IG spreads, CDS indices, credit conditions |
| 9 | **Macro**      | 5%     | 44            | 2.2         | Fed rate, yield curve, economic surprise index |
| 10| **Cross-Asset**| 5%     | 72            | 3.6         | Gold/USD correlation, bonds vs equities, commodity signals |

**Verification**: 1.9 + 4.7 + 5.1 + 5.2 + 4.0 + 1.3 + 3.9 + 6.8 + 2.2 + 3.6 = **38.7** ✓

### Key Metrics Displayed in Header

| Metric       | Value      | Context              |
|-------------|------------|----------------------|
| CNN F&G     | 16         | Extreme Fear         |
| AAII Bear   | 52%        | 6-week high          |
| AAII Bull   | 30.4%      | Below average        |
| Put/Call    | 1.01       | vs 0.87 yr avg       |
| VIX         | 26.78      | +11.31%              |
| HY Spread   | 3.27%      | vs 3,298 LT avg      |
| % > 200D    | 43.93%     | Down from 68.5%      |
| 10Y Yield   | 4.25%      | —                    |
| Fed Rate    | 3.50-3.75% | Hawkish/hold         |

### UI Components

1. **Gauge** — Semicircular 0–100 dial with color gradient (red→yellow→green)
2. **Header Grid** — 9 key metrics in 3×3 grid with contextual annotations
3. **Category Radar** — Spider/radar chart of all 10 category scores
4. **Score Distribution** — Horizontal bar chart per category (color-coded)
5. **Category Breakdown** — Expandable cards per category (score, weight, contribution, mini bar)

---

## Data Source Audit: What We Have vs What We Need

### ✅ ALREADY HAVE (in worldmonitor)

| Data Point | Source | Service | Notes |
|-----------|--------|---------|-------|
| VIX level | FRED (VIXCLS) | EconomicService | Daily, used in MacroSignals |
| HY Spread (OAS) | FRED (BAMLH0A0HYM2) | EconomicService | Daily |
| 10Y Yield | FRED (DGS10) | EconomicService | Daily |
| Fed Funds Rate | FRED (FEDFUNDS) | EconomicService | Daily |
| 10Y-2Y Spread | FRED (T10Y2Y) | EconomicService | Yield curve inversion |
| Crypto Fear & Greed | Alternative.me | MacroSignals | Daily, 0-100 |
| Stock prices (SPX, QQQ) | Yahoo Finance / Finnhub | MarketService | Real-time |
| Sector ETF performance | Yahoo Finance | MarketService | Real-time |
| ETF flows (BTC) | Yahoo Finance | MarketService | Daily |
| M2 Money Supply | FRED (M2SL) | EconomicService | Weekly |
| Fed Balance Sheet | FRED (WALCL) | EconomicService | Weekly |
| CPI | FRED (CPIAUCSL) | EconomicService | Monthly |
| Supply Chain Pressure | FRED (GSCPI) | EconomicService | Monthly |
| BIS Policy Rates | BIS API | EconomicService | Quarterly |

### ❌ MISSING — Need to Add

| Data Point | Category | Possible Free Source | Priority |
|-----------|----------|---------------------|----------|
| **AAII Bull/Bear Survey** | Sentiment | AAII website scrape or data feed | HIGH |
| **CNN Fear & Greed Index** | Sentiment | CNN API endpoint (undocumented) | HIGH |
| **Put/Call Ratio (CBOE)** | Positioning | FRED (not available) / CBOE / Yahoo | HIGH |
| **% Stocks > 200 DMA** | Breadth | Barchart / finviz scrape / computed | HIGH |
| **Advance/Decline Ratio** | Breadth | NYSE data / Yahoo Finance | HIGH |
| **New 52-week Highs/Lows** | Breadth | NYSE data / finviz | MEDIUM |
| **VIX Term Structure** | Volatility | CBOE (VIX futures) / Yahoo (VIX9D, VIX3M, VIX6M) | MEDIUM |
| **Options Skew** | Positioning | CBOE Skew Index (SKEW) via FRED or Yahoo | MEDIUM |
| **Sector Momentum (RSI)** | Momentum | Computed from Yahoo price data | MEDIUM |
| **Credit Default Swap indices** | Credit | ICE/Markit (paid) or proxy via ETFs (HYG, LQD) | LOW |
| **IG Spread** | Credit | FRED (BAMLC0A0CM) | MEDIUM |
| **Gold/USD Correlation** | Cross-Asset | Computed from Yahoo (GLD, DXY) | MEDIUM |
| **Bond/Equity Correlation** | Cross-Asset | Computed from Yahoo (TLT, SPY) | MEDIUM |
| **Economic Surprise Index** | Macro | Citi ECSI (paid) or proxy | LOW |
| **Funding Rates / Liquidity** | Liquidity | Treasury repo rates / FRED (SOFR) | MEDIUM |

### 🟡 PARTIALLY HAVE (Need Enhancement)

| Data Point | Category | Current State | Enhancement Needed |
|-----------|----------|--------------|-------------------|
| Trend (SPX vs MAs) | Trend | Have prices, no MA computation | Compute 20/50/200 DMA server-side |
| Sector rotation | Momentum | Have sector ETFs | Compute relative strength, RSI |
| Credit conditions | Credit | Have HY spread | Add IG spread (BAMLC0A0CM from FRED) |
| Macro signals | Macro | 7-signal composite exists | Restructure into F&G category format |

---

## Scoring Logic (Proposed)

Each category maps raw data to a **0–100 score** where:
- **0–20**: Extreme Fear
- **20–40**: Fear
- **40–60**: Neutral
- **60–80**: Greed
- **80–100**: Extreme Greed

### Category Scoring Formulas

#### 1. Sentiment (10%)
```
inputs: CNN_FG, AAII_Bull, AAII_Bear
score = (CNN_FG * 0.4) + (AAII_Bull_Percentile * 0.3) + ((100 - AAII_Bear_Percentile) * 0.3)
```

#### 2. Volatility (10%)
```
inputs: VIX, VIX_Term_Structure
vix_score = clamp(100 - ((VIX - 12) / 28) * 100, 0, 100)  // VIX 12=100, VIX 40=0
term_score = contango ? 70 : backwardation ? 30 : 50
score = vix_score * 0.7 + term_score * 0.3
```

#### 3. Positioning (15%)
```
inputs: Put_Call_Ratio, Options_Skew
pc_score = clamp(100 - ((PC_Ratio - 0.7) / 0.6) * 100, 0, 100)  // 0.7=greed, 1.3=fear
skew_score = clamp(100 - ((SKEW - 100) / 50) * 100, 0, 100)
score = pc_score * 0.6 + skew_score * 0.4
```

#### 4. Trend (10%)
```
inputs: SPX_Price, SMA20, SMA50, SMA200
above_count = count(price > SMA20, price > SMA50, price > SMA200)
distance_200 = (price - SMA200) / SMA200
score = (above_count / 3) * 50 + clamp(distance_200 * 500 + 50, 0, 100) * 0.5
```

#### 5. Breadth (10%)
```
inputs: Pct_Above_200DMA, Advance_Decline, New_Highs_Lows
breadth_score = Pct_Above_200DMA  // already 0-100
ad_score = clamp((AD_Ratio - 0.5) / 1.5 * 100, 0, 100)
hl_score = clamp(NH / (NH + NL) * 100, 0, 100)
score = breadth_score * 0.4 + ad_score * 0.3 + hl_score * 0.3
```

#### 6. Momentum (10%)
```
inputs: Sector_RSI_Spread, SPX_ROC_20d
rsi_score = clamp((avg_sector_rsi - 30) / 40 * 100, 0, 100)
roc_score = clamp(SPX_ROC_20d * 10 + 50, 0, 100)
score = rsi_score * 0.5 + roc_score * 0.5
```

#### 7. Liquidity (15%)
```
inputs: M2_YoY_Change, Fed_Balance_Sheet_Change, SOFR_Rate
m2_score = clamp(M2_YoY * 10 + 50, 0, 100)
fed_score = clamp(Fed_BS_MoM * 20 + 50, 0, 100)
sofr_score = clamp(100 - SOFR * 15, 0, 100)
score = m2_score * 0.4 + fed_score * 0.3 + sofr_score * 0.3
```

#### 8. Credit (10%)
```
inputs: HY_Spread, IG_Spread, HY_Spread_Change_30d
hy_score = clamp(100 - ((HY_Spread - 3.0) / 5.0) * 100, 0, 100)
ig_score = clamp(100 - ((IG_Spread - 0.8) / 2.0) * 100, 0, 100)
trend_score = HY_narrowing ? 70 : HY_widening ? 30 : 50
score = hy_score * 0.4 + ig_score * 0.3 + trend_score * 0.3
```

#### 9. Macro (5%)
```
inputs: Fed_Rate, Yield_Curve_10Y2Y, Unemployment_Trend
rate_score = clamp(100 - Fed_Rate * 15, 0, 100)
curve_score = T10Y2Y > 0 ? 60 + T10Y2Y * 20 : 40 + T10Y2Y * 40
unemp_score = clamp(100 - (UNRATE - 3.5) * 20, 0, 100)
score = rate_score * 0.3 + curve_score * 0.4 + unemp_score * 0.3
```

#### 10. Cross-Asset (5%)
```
inputs: Gold_vs_SPY_30d, TLT_vs_SPY_30d, DXY_30d_Change
gold_signal = Gold_30d > SPY_30d ? fear : greed
bond_signal = TLT_30d > SPY_30d ? fear : greed
dxy_signal = DXY_rising ? slight_fear : slight_greed
score = weighted combination with mean reversion
```

---

## Implementation Plan

### Phase 1: Data Layer (Backend)

1. **New FRED series** to add to `seed-economy.mjs`:
   - `BAMLC0A0CM` (IG OAS Spread)
   - `SOFR` (Secured Overnight Financing Rate)

2. **New data fetchers** in server handlers:
   - CBOE Put/Call ratio (Yahoo Finance: `^PCALL` or compute from options)
   - AAII survey data (web scrape or RSS)
   - CNN Fear & Greed (undocumented endpoint)
   - % stocks above 200 DMA (Finviz or computed)
   - VIX term structure (Yahoo: `^VIX`, `^VIX9D`, `^VIX3M`)
   - NYSE advance/decline data
   - CBOE Skew Index (`^SKEW` from Yahoo)

3. **Computed metrics** (server-side):
   - SPX 20/50/200 DMA from historical prices
   - Sector RSI calculations
   - Cross-asset correlation (rolling 30d)
   - M2 year-over-year change
   - Fed balance sheet month-over-month change

### Phase 2: Proto + RPC

4. **New proto**: `proto/worldmonitor/market/v1/fear_greed.proto`
   - `GetFearGreedIndex` RPC
   - Messages for each category score, inputs, and composite

5. **New handler**: `server/worldmonitor/market/v1/get-fear-greed-index.ts`
   - Fetches all inputs, computes scores, caches result (5-min TTL)

### Phase 3: Frontend Panel

6. **New component**: `src/components/FearGreedPanel.ts`
   - Gauge (SVG semicircle, animated)
   - Metric grid (3×3 key stats)
   - Radar chart (SVG, 10 axes)
   - Score distribution bars
   - Expandable category breakdown cards

7. **Register** in finance variant panel config

### Phase 4: Polish

8. Historical tracking (store daily snapshots for trend)
9. Sparklines per category (7d/30d history)
10. Alerts on threshold crossings

---

## Effort Estimate by Source Availability

| Effort Level | Items |
|-------------|-------|
| **Easy** (already have data) | VIX score, HY/IG credit, Fed rate, yield curve, M2/Fed BS, trend (need MA calc) |
| **Medium** (free API/computed) | Put/call ratio, VIX term structure, SKEW, sector momentum, cross-asset correlations, % > 200 DMA |
| **Hard** (scraping/unreliable) | AAII survey, CNN F&G, advance/decline line, new highs/lows, economic surprise |

---

## Quick-Win MVP

Build an initial version using **only data we already have + easy computations**:

1. **Volatility** — VIX from FRED ✅
2. **Credit** — HY Spread from FRED ✅
3. **Macro** — Fed Rate + Yield Curve + Unemployment from FRED ✅
4. **Trend** — SPX price vs computed MAs from Yahoo ✅
5. **Liquidity** — M2 + Fed Balance Sheet from FRED ✅
6. **Sentiment** — Crypto F&G as proxy (already have) + CNN F&G endpoint
7. **Momentum** — Sector ETF returns (already have)
8. **Cross-Asset** — Compute from existing Yahoo price feeds

This gives us **8 of 10 categories** immediately. Breadth and Positioning need new data sources.
