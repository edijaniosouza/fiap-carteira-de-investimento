/** Money values are kept with 2 decimal places (centavos). */
const MONEY_SCALE = 100;

/** Quantities and unit prices are kept with 8 decimal places (fractional shares, Tesouro Direto). */
const QUANTITY_SCALE = 1e8;

/** Tolerance below which a quantity is considered zero (floating point residue). */
export const QUANTITY_EPSILON = 1 / QUANTITY_SCALE;

export function round_money(value: number): number {
  return Math.round(value * MONEY_SCALE) / MONEY_SCALE;
}

export function round_quantity(value: number): number {
  return Math.round(value * QUANTITY_SCALE) / QUANTITY_SCALE;
}
