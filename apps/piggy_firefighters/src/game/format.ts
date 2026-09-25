/** Figures for WORDS (rules sheet, buy cards, the max-win card): a multiple of the base bet, e.g. "15,000×". */
export const fmtX = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}×`;
/** Every value of a list, e.g. "5× · 10× · 20×" (the rules list every obtainable value, never a range). */
export const fmtValues = (values: readonly number[]) => values.map(fmtX).join(' · ');
