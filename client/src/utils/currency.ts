/**
 * Format a number as PKR currency
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the ₨ symbol (default: true)
 * @returns Formatted currency string
 */
export const formatPKR = (amount: number, showSymbol: boolean = true): string => {
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  return showSymbol ? `₨ ${formatted}` : formatted;
};

/**
 * Format a number with commas for better readability
 * @param num - The number to format
 * @returns Formatted number string
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-PK').format(num);
};

/**
 * Parse PKR formatted string back to number
 * @param pkrString - The PKR formatted string
 * @returns Parsed number
 */
export const parsePKR = (pkrString: string): number => {
  // Remove ₨ symbol, spaces, and commas
  const cleaned = pkrString.replace(/[₨,\s]/g, '');
  return parseFloat(cleaned) || 0;
};
