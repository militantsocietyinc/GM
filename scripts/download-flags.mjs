/**
 * Download country flag images from flagcdn.com
 * Run: node scripts/download-flags.mjs
 */

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Common country codes used in WorldMonitor
const countryCodes = [
  // Tier 1 CII countries
  'US', 'CN', 'RU', 'IR', 'KP', 'IN', 'PK', 'AF', 'UA', 'BY', 'PL',
  'EG', 'LY', 'SD', 'TR', 'SY', 'IQ', 'IL', 'SA', 'AE', 'QA', 'KW', 'OM', 'YE', 'JO', 'LB',
  'TW', 'JP', 'KR', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI',
  'TW', 'VN', 'TH', 'MY', 'ID', 'PH', 'BD', 'LK', 'NP', 'MM', 'KH', 'LA', 'SG', 'BN',
  'DZ', 'MA', 'TN', 'ML', 'NE', 'TD', 'BF', 'MR', 'SN', 'GM', 'GW', 'SL', 'LR', 'CI', 'GH', 'TG', 'BJ', 'NG', 'CM', 'CF', 'GQ', 'GA', 'CG', 'CD', 'UG', 'RW', 'BI', 'TZ', 'KE', 'SO', 'ET', 'ER', 'DJ', 'SS', 'AO', 'ZM', 'MW', 'MZ', 'ZW', 'BW', 'NA', 'ZA', 'LS', 'SZ', 'MG', 'KM', 'MU', 'SC',
  'MX', 'CA', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'JM', 'HT', 'DO', 'PR',
  'BR', 'AR', 'CL', 'PE', 'BO', 'PY', 'UY', 'VE', 'CO', 'EC', 'GY', 'SR', 'GF',
  'AU', 'NZ', 'PG', 'FJ', 'SB', 'VU', 'NC', 'PF', 'WS', 'TO', 'KI', 'NR', 'TV', 'FM', 'MH', 'PW'
];

const FLAG_DIR = join(process.cwd(), 'public', 'flags');
const BASE_URL = 'https://flagcdn.com/w80';

async function downloadFlag(code) {
  const filename = `${code.toLowerCase()}.png`;
  const filepath = join(FLAG_DIR, filename);
  
  if (existsSync(filepath)) {
    console.log(`✓ ${code} already exists`);
    return;
  }
  
  try {
    const response = await fetch(`${BASE_URL}/${filename}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    writeFileSync(filepath, Buffer.from(buffer));
    console.log(`✓ Downloaded ${code}`);
  } catch (err) {
    console.error(`✗ Failed ${code}: ${err.message}`);
  }
}

async function main() {
  console.log('Downloading country flags...\n');
  
  // Download in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < countryCodes.length; i += batchSize) {
    const batch = countryCodes.slice(i, i + batchSize);
    await Promise.all(batch.map(downloadFlag));
    
    // Small delay between batches
    if (i + batchSize < countryCodes.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log(`\nDone! Flags saved to: ${FLAG_DIR}`);
}

main().catch(console.error);
