/**
 * Cross-platform flag rendering service
 * Uses local flag images for all platforms (works offline, no CORS issues)
 */

// Local flag path (flags are in public/flags/)
const FLAG_PATH = '/flags';

/**
 * Get flag HTML for a country code
 * @param code - Two-letter country code (e.g., 'US', 'GH')
 * @param size - Size in pixels (default: 24)
 * @returns HTML string with flag image
 */
export function getFlagHtml(code: string, size: number = 24): string {
  const normalizedCode = code.toUpperCase();
  
  // Use local flag images (works on all platforms including Windows)
  return `<img src="${FLAG_PATH}/${normalizedCode.toLowerCase()}.png" 
    alt="${normalizedCode}" 
    class="flag-image" 
    style="width:${size}px;height:${size}px;object-fit:cover;border-radius:2px;"
    onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
    <span class="flag-fallback" style="display:none;font-size:${size}px;">${getFlagEmoji(normalizedCode)}</span>`;
}

/**
 * Get flag emoji for a country code (fallback)
 * @param code - Two-letter country code
 * @returns Flag emoji string
 */
export function getFlagEmoji(code: string): string {
  try {
    return code
      .toUpperCase()
      .split('')
      .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
      .join('');
  } catch {
    return '🌍';
  }
}

/**
 * Get flag CSS class
 * @returns CSS class name
 */
export function getFlagClass(): string {
  return 'flag-image';
}

/**
 * Preload flag images
 * @param codes - Array of country codes to preload
 */
export function preloadFlags(codes: string[]): void {
  codes.forEach(code => {
    const img = new Image();
    img.src = `${FLAG_PATH}/${code.toLowerCase()}.png`;
  });
}
