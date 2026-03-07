import { getPool } from "./client.js";

async function seed(): Promise<void> {
  const pool = getPool();

  // Seed volcano_status with known active volcanoes
  const volcanoes = [
    { id: "mayon", name: "Mayon", lat: 13.257, lon: 123.685, alertLevel: 0 },
    { id: "taal", name: "Taal", lat: 14.002, lon: 120.993, alertLevel: 1 },
    { id: "pinatubo", name: "Pinatubo", lat: 15.13, lon: 120.35, alertLevel: 0 },
    { id: "kanlaon", name: "Kanlaon", lat: 10.412, lon: 123.132, alertLevel: 0 },
    { id: "bulusan", name: "Bulusan", lat: 12.77, lon: 124.05, alertLevel: 0 },
    { id: "hibok-hibok", name: "Hibok-Hibok", lat: 9.203, lon: 124.673, alertLevel: 0 },
  ];

  for (const v of volcanoes) {
    await pool.query(
      `INSERT INTO volcano_status (id, name, lat, lon, alert_level, alert_description)
       VALUES ($1, $2, $3, $4, $5, 'Normal')
       ON CONFLICT (id) DO UPDATE SET alert_level = $5`,
      [v.id, v.name, v.lat, v.lon, v.alertLevel]
    );
  }

  console.log("[seed] Seeded volcano_status");
  await pool.end();
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
