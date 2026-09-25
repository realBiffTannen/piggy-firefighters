import { stateI18n } from 'state-shared';

import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet } from 'state-shared';

/** Stake's published currency-display table. Symbols, fraction counts,
 *  placement, and spacing are platform rules; only the numeric separators
 *  follow the player's active locale. */
const PLATFORM_DISPLAY: Record<
	string,
	{ symbol: string; fractionDigits: number; symbolAfter?: boolean; spaced?: boolean }
> = {
	USD: { symbol: '$', fractionDigits: 2, spaced: false },
	CAD: { symbol: 'CA$', fractionDigits: 2, spaced: false },
	JPY: { symbol: '¥', fractionDigits: 0, spaced: false },
	EUR: { symbol: '€', fractionDigits: 2, spaced: false },
	RUB: { symbol: '₽', fractionDigits: 2, spaced: false },
	CNY: { symbol: 'CN¥', fractionDigits: 2, spaced: false },
	PHP: { symbol: '₱', fractionDigits: 2, spaced: false },
	INR: { symbol: '₹', fractionDigits: 2, spaced: false },
	IDR: { symbol: 'Rp', fractionDigits: 0, spaced: false },
	KRW: { symbol: '₩', fractionDigits: 0, spaced: false },
	BRL: { symbol: 'R$', fractionDigits: 2, spaced: false },
	MXN: { symbol: 'MX$', fractionDigits: 2, spaced: false },
	DKK: { symbol: 'KR', fractionDigits: 2, symbolAfter: true, spaced: true },
	PLN: { symbol: 'zł', fractionDigits: 2, symbolAfter: true, spaced: true },
	VND: { symbol: '₫', fractionDigits: 0, symbolAfter: true, spaced: true },
	TRY: { symbol: '₺', fractionDigits: 2, spaced: false },
	CLP: { symbol: 'CLP', fractionDigits: 0, symbolAfter: true, spaced: true },
	ARS: { symbol: 'ARS', fractionDigits: 2, symbolAfter: true, spaced: true },
	PEN: { symbol: 'S/', fractionDigits: 2, spaced: false },
	NGN: { symbol: '₦', fractionDigits: 2, spaced: false },
	SAR: { symbol: 'SAR', fractionDigits: 2, symbolAfter: true, spaced: true },
	ILS: { symbol: 'ILS', fractionDigits: 2, symbolAfter: true, spaced: true },
	AED: { symbol: 'AED', fractionDigits: 2, symbolAfter: true, spaced: true },
	TWD: { symbol: 'NT$', fractionDigits: 2, spaced: false },
	NOK: { symbol: 'kr', fractionDigits: 2, spaced: false },
	KWD: { symbol: 'KD', fractionDigits: 2, spaced: false },
	JOD: { symbol: 'JD', fractionDigits: 2, spaced: false },
	CRC: { symbol: '₡', fractionDigits: 2, spaced: false },
	TND: { symbol: 'TND', fractionDigits: 2, symbolAfter: true, spaced: true },
	SGD: { symbol: 'SG$', fractionDigits: 2, spaced: false },
	MYR: { symbol: 'RM', fractionDigits: 2, spaced: false },
	OMR: { symbol: 'OMR', fractionDigits: 2, symbolAfter: true, spaced: true },
	QAR: { symbol: 'QAR', fractionDigits: 2, symbolAfter: true, spaced: true },
	BHD: { symbol: 'BD', fractionDigits: 2, spaced: false },
	XGC: { symbol: 'GC', fractionDigits: 2, symbolAfter: true, spaced: true },
	XSC: { symbol: 'SC', fractionDigits: 2, symbolAfter: true, spaced: true },
	XEC: { symbol: 'SC', fractionDigits: 2, symbolAfter: true, spaced: true },
	ISK: { symbol: 'kr', fractionDigits: 2, spaced: false },
	PKR: { symbol: '₨', fractionDigits: 2, spaced: false },
	EGP: { symbol: 'ج.م', fractionDigits: 2, spaced: false },
	NZD: { symbol: 'NZ$', fractionDigits: 2, spaced: false },
	BOB: { symbol: 'Bs', fractionDigits: 2, spaced: false },
	GHS: { symbol: 'GH₵', fractionDigits: 2, spaced: false },
	KES: { symbol: 'KSh', fractionDigits: 2, spaced: false },
	MAD: { symbol: 'MAD', fractionDigits: 2, spaced: false },
	BAM: { symbol: 'KM', fractionDigits: 2, spaced: false },
	TZS: { symbol: 'TSh', fractionDigits: 2, spaced: false },
	UGX: { symbol: 'USh', fractionDigits: 2, spaced: false },
	XOF: { symbol: 'CFA', fractionDigits: 2, spaced: false },
};

// bookEventAmount: is the amount or win numbers in the events of books, e.g. the amount in setTotalWin bookEvent
// {
// 	"index": 3,
// 	"type": "setTotalWin",
// 	"amount": 100
// },
// if betting on $1,   100 bookEventAmount equals to $1.    betAmountMultiplier is (100 / BOOK_AMOUNT_MULTIPLIER =) 1
// if betting on $1,    50 bookEventAmount equals to $0.5.  betAmountMultiplier is ( 50 / BOOK_AMOUNT_MULTIPLIER =) 0.5
// if betting on $0.5, 100 bookEventAmount equals to $0.5.  betAmountMultiplier is (100 / BOOK_AMOUNT_MULTIPLIER =) 1
// if betting on $0.5,  50 bookEventAmount equals to $0.25. betAmountMultiplier is ( 50 / BOOK_AMOUNT_MULTIPLIER =) 0.5

export const bookEventAmountToBetAmountMultiplier = (bookEventAmount: number) =>
	bookEventAmount / BOOK_AMOUNT_MULTIPLIER;

export const bookEventAmountToNormalisedAmount = (bookEventAmount: number) => {
	const betAmountMultiplier = bookEventAmountToBetAmountMultiplier(bookEventAmount);
	return stateBet.wageredBetAmount * betAmountMultiplier;
};

export const numberToFloat = (value: number) => Number.parseFloat(`${value}`);

/** Retains the shipping currency-style behavior for codes outside the
 *  platform table. */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'IDR', 'VND', 'CLP']);

const fractionDigitsFor = (currency: string): number =>
	ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;

/** A payout is never allowed to be shown as more precise than the RGS pays,
 *  and never less. API amounts are integers of 1e-6 of a unit, so six
 *  fraction digits is the finest a payout can actually be; eight is the
 *  ceiling with headroom to spare. */
const PAYOUT_MAX_FRACTION_DIGITS = 8;

/** Fraction digits that keep a payout LEGIBLE.
 *
 *  The reported defect: "the game does not correctly display payouts below one
 *  cent". A flat two digits renders every sub-cent payout as the currency's
 *  zero — the player is credited a real amount and reads $0.00, which is a
 *  displayed-equals-paid failure, not a rounding preference. A flat four
 *  digits only moves the cliff to $0.0001.
 *
 *  So the digit count follows the VALUE: enough to carry its first significant
 *  figure, never fewer than four, never more than the RGS can pay. A true zero
 *  keeps the currency's own digits, because "$0.00" is the correct rendering
 *  of nothing.
 */
const payoutFractionDigits = (value: number, baseDigits: number): number => {
	const magnitude = Math.abs(value);
	if (!Number.isFinite(magnitude) || magnitude === 0) return baseDigits;
	const floor = Math.max(4, baseDigits);
	const neededForFirstSignificantDigit = Math.ceil(-Math.log10(magnitude));
	return Math.min(PAYOUT_MAX_FRACTION_DIGITS, Math.max(floor, neededForFirstSignificantDigit));
};

const formatCurrencyString = (value: number, exactPayout: boolean) => {
	const display = PLATFORM_DISPLAY[stateBet.currency];
	if (display) {
		const amount = stateI18n.i18n.number(value, {
			minimumFractionDigits: display.fractionDigits,
			maximumFractionDigits: exactPayout
				? payoutFractionDigits(value, display.fractionDigits)
				: display.fractionDigits,
			style: 'decimal',
		});
		const separator = display.spaced === false ? '' : ' ';
		return display.symbolAfter
			? `${amount}${separator}${display.symbol}`
			: `${display.symbol}${separator}${amount}`;
	}

	const naturalFractionDigits = fractionDigitsFor(stateBet.currency);
	const digits = {
		minimumFractionDigits: naturalFractionDigits,
		maximumFractionDigits: exactPayout
			? payoutFractionDigits(value, naturalFractionDigits)
			: naturalFractionDigits,
	};

	/** `Intl.NumberFormat({style:'currency'})` throws a RangeError for anything
	 *  that is not a well-formed 3-alpha code, and a replay URL's `?currency=`
	 *  reaches this function unvalidated. A throw here takes the whole meter
	 *  render with it, so an unusable code degrades to a plain amount with the
	 *  code as a suffix — money still shows, and the bad code is visible rather
	 *  than swallowed. */
	try {
		return stateI18n.i18n.number(value, {
			...digits,
			style: 'currency',
			currency: stateBet.currency,
			// numberingSystem: 'latn',
		});
	} catch {
		const amount = stateI18n.i18n.number(value, { ...digits, style: 'decimal' });
		const code = String(stateBet.currency ?? '').trim();
		return code ? `${amount} ${code}` : amount;
	}
};

export const numberToCurrencyString = (value: number) => formatCurrencyString(value, false);

export const numberToPayoutCurrencyString = (value: number) => formatCurrencyString(value, true);

export const bookEventAmountToCurrencyString = (bookEventAmount: number) => {
	const normalisedAmount = bookEventAmountToNormalisedAmount(bookEventAmount);
	return numberToCurrencyString(normalisedAmount);
};

export const bookEventAmountToPayoutCurrencyString = (bookEventAmount: number) => {
	const normalisedAmount = bookEventAmountToNormalisedAmount(bookEventAmount);
	return numberToPayoutCurrencyString(normalisedAmount);
};
