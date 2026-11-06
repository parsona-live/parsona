/**
 * Actual AI Cost Management & Formatting.
 *
 * NOTE: Costs are ONLY sourced from actual provider API call responses
 * (e.g. OpenRouter's reported `usage.total_cost`).
 * We strictly do NOT estimate or compute synthetic costs from tokens or hardcoded rates.
 * If the provider did not return cost data, the cost is treated as null / not available.
 */

/**
 * Returns the exact cost reported by the API call, or null if no cost was returned.
 */
export function getActualCost(reportedCost?: unknown): number | null {
  if (typeof reportedCost === "number" && Number.isFinite(reportedCost) && reportedCost >= 0) {
    return Number(reportedCost.toFixed(6));
  }
  return null;
}

/**
 * Format actual USD and optional INR equivalent for the UI.
 * If cost is null or undefined (e.g. historical data without reported cost),
 * returns "—" so no fake cost is displayed.
 */
export function formatAiCost(
  costUsd?: number | null,
  includeInr = true,
): string {
  if (costUsd === null || costUsd === undefined) {
    return "—";
  }

  if (costUsd === 0) {
    return "$0.00";
  }

  let usdFormatted: string;
  if (costUsd < 0.0001) {
    usdFormatted = `$${costUsd.toFixed(6)}`;
  } else if (costUsd < 0.01) {
    usdFormatted = `$${costUsd.toFixed(4)}`;
  } else {
    usdFormatted = `$${costUsd.toFixed(2)}`;
  }

  if (includeInr) {
    // 1 USD approx ~86 INR
    const inrValue = costUsd * 86;
    let inrFormatted: string;
    if (inrValue < 0.01) {
      inrFormatted = `₹${inrValue.toFixed(4)}`;
    } else {
      inrFormatted = `₹${inrValue.toFixed(2)}`;
    }
    return `${usdFormatted} (${inrFormatted})`;
  }

  return usdFormatted;
}
