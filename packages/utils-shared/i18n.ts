import type { Messages } from '@lingui/core';

import type { Language } from 'state-shared';

export type MessagesMap = Record<Language, Messages>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

// Recursive merge of plain objects into `target` (a later source wins for a leaf, an `undefined` source leaf is
// skipped) — the subset of lodash's `merge` these catalogues use: locale -> message key -> string. Lodash was the
// only reason the whole library (~70 KB min) reached the bundle.
const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
	for (const [key, value] of Object.entries(source)) {
		if (value === undefined) continue;
		const existing = target[key];
		if (isPlainObject(value)) target[key] = deepMerge(isPlainObject(existing) ? existing : {}, value);
		else target[key] = value;
	}
	return target;
};

export const mergeMessagesMaps = (messagesMapList: MessagesMap[]) => {
	const merged = messagesMapList
		.filter(Boolean)
		.reduce((acc, current) => deepMerge(acc, current as unknown as Record<string, unknown>), {} as Record<string, unknown>) as MessagesMap;

	return merged;
};
