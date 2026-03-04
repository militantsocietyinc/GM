/**
 * Server-side killswitch for Sentinel modules.
 * Usage in edge functions:
 *   const disabled = checkKillswitch('CLAUDE');
 *   if (disabled) return disabled;
 */
export function checkKillswitch(
  moduleName: string,
  corsHeaders?: Record<string, string>,
): Response | null {
  const envKey = `MODULE_${moduleName.toUpperCase()}_ENABLED`;
  const value = process.env[envKey];
  if (value === undefined || value === '' || value === 'true' || value === '1') {
    return null; // Module is enabled
  }
  return new Response(
    JSON.stringify({ error: `Module ${moduleName} is disabled`, status: 'disabled' }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '300', ...(corsHeaders ?? {}) },
    },
  );
}
