export interface EntityEntry {
  id: string;
  name: string;
  aliases: string[];
  type: "government" | "military" | "company" | "organization" | "person";
  category: string;
}

export const PH_ENTITIES: EntityEntry[] = [
  // Government agencies
  { id: "dfa", name: "Department of Foreign Affairs", aliases: ["DFA"], type: "government", category: "foreign-affairs" },
  { id: "dnd", name: "Department of National Defense", aliases: ["DND"], type: "government", category: "defense" },
  { id: "bsp", name: "Bangko Sentral ng Pilipinas", aliases: ["BSP", "Central Bank"], type: "government", category: "economy" },
  { id: "pagasa", name: "PAGASA", aliases: ["Philippine Atmospheric, Geophysical and Astronomical Services Administration"], type: "government", category: "disaster" },
  { id: "phivolcs", name: "PHIVOLCS", aliases: ["Philippine Institute of Volcanology and Seismology"], type: "government", category: "disaster" },
  { id: "ndrrmc", name: "NDRRMC", aliases: ["National Disaster Risk Reduction and Management Council"], type: "government", category: "disaster" },
  { id: "pcg", name: "Philippine Coast Guard", aliases: ["PCG"], type: "military", category: "maritime" },
  { id: "pse", name: "Philippine Stock Exchange", aliases: ["PSE"], type: "organization", category: "economy" },

  // Military
  { id: "afp", name: "Armed Forces of the Philippines", aliases: ["AFP"], type: "military", category: "defense" },
  { id: "pn", name: "Philippine Navy", aliases: ["PN"], type: "military", category: "defense" },
  { id: "paf", name: "Philippine Air Force", aliases: ["PAF"], type: "military", category: "defense" },
  { id: "pa", name: "Philippine Army", aliases: ["PA"], type: "military", category: "defense" },
  { id: "wescom", name: "Western Command", aliases: ["WESCOM", "WestCom"], type: "military", category: "wps" },
];
