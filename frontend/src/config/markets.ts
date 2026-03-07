export interface MarketSymbol {
  symbol: string;
  name: string;
  type: "index" | "stock" | "forex" | "indicator";
}

export const PSE_SYMBOLS: MarketSymbol[] = [
  { symbol: "PSEi", name: "PSE Composite Index", type: "index" },
  { symbol: "SM", name: "SM Investments", type: "stock" },
  { symbol: "BDO", name: "BDO Unibank", type: "stock" },
  { symbol: "ALI", name: "Ayala Land", type: "stock" },
  { symbol: "JFC", name: "Jollibee Foods", type: "stock" },
  { symbol: "TEL", name: "PLDT", type: "stock" },
  { symbol: "AC", name: "Ayala Corporation", type: "stock" },
  { symbol: "MER", name: "Meralco", type: "stock" },
  { symbol: "GLO", name: "Globe Telecom", type: "stock" },
];

export const BSP_INDICATORS: MarketSymbol[] = [
  { symbol: "USD/PHP", name: "US Dollar / Philippine Peso", type: "forex" },
  { symbol: "BSP-rate", name: "BSP Overnight Rate", type: "indicator" },
  { symbol: "CPI", name: "Consumer Price Index", type: "indicator" },
  { symbol: "GIR", name: "Gross International Reserves", type: "indicator" },
  { symbol: "OFW-remit", name: "OFW Remittances", type: "indicator" },
];
