import type { paths } from './schema';
import { fetcher } from 'utils-fetcher';

/** Every failure this module can hit is reported in the RGS's own envelope,
 *  `{ error: { statusCode, code, message } }`. That shape is duck-tested in
 *  three places — utils-xstate/src/createPrimaryMachines.ts:22,52 and
 *  Authenticate.svelte:38,209 — and the `message` is rendered straight to the
 *  player by ModalError, so it has to be a sentence, not a diagnostic.
 *
 *  Before this, a transport failure escaped as a raw `TypeError: Failed to
 *  fetch` and a non-JSON body escaped as a `SyntaxError`; both reached
 *  ModalError as an Error instance, and `JSON.stringify(anError)` is exactly
 *  "{}" (name/message/stack are non-enumerable). An unreachable rgs_url
 *  therefore rendered "Sorry, something went wrong." above a box containing
 *  the two characters "{}". */
type RgsErrorEnvelope = { error: { statusCode: number; code: string; message: string } };

const MESSAGE_NETWORK =
	'Could not connect to the game server. Check your internet connection and reload the game. If it keeps happening, contact support.';
const MESSAGE_BAD_RESPONSE =
	'The game server sent a reply this game could not read. Please reload the game, and contact support if it keeps happening.';
const MESSAGE_AUTH =
	'Could not sign in to the game server. Your session may have expired — please reload the game from the operator, and contact support if it keeps happening.';
const MESSAGE_HTTP =
	'The game server could not complete that request. Please reload the game, and contact support if it keeps happening.';

const envelope = (statusCode: number, code: string, message: string): RgsErrorEnvelope => ({
	error: { statusCode, code, message },
});

/** The authority of an rgs_url: host without the port, ipv6 brackets kept. */
const hostOf = (authority: string) => {
	const bracketed = /^\[([^\]]+)\]/.exec(authority);
	return bracketed ? `[${bracketed[1]}]` : authority.split(':')[0];
};

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Stake's RGS is always https, so that stays the default — but a mock RGS
 *  on localhost has no TLS, and forcing the scheme made local replay and
 *  storybook-vs-RGS work impossible (ERR_SSL_PROTOCOL_ERROR). A bare host of
 *  localhost/127.0.0.1/[::1] goes plain http; every real deployment is
 *  unchanged. Mirrors the rules pinned by piggy-farm's
 *  tests/unit/rgs-protocol.test.mjs.
 *
 *  An rgs_url that ALREADY carries a scheme is now honoured as given (trailing
 *  slash trimmed). Prepending unconditionally turned `https://rgs.example.com`
 *  into `https://https://rgs.example.com/...`, whose authority is the
 *  unresolvable host "https" — a launch URL that named its scheme could never
 *  connect. For the same reason an EMPTY rgs_url no longer becomes
 *  `https:///wallet/authenticate` (authority "wallet", an unrelated host this
 *  game would have posted a sessionID to): with nothing to address, the
 *  request stays same-origin and fails as an honest 404. */
const endpointFor = (rgsUrl: string, url: string) => {
	const trimmed = (rgsUrl ?? '').trim().replace(/\/+$/, '');
	if (!trimmed) return url;
	if (/^https?:\/\//i.test(trimmed)) return `${trimmed}${url}`;
	const scheme = LOOPBACK_HOSTS.has(hostOf(trimmed.split('/')[0])) ? 'http' : 'https';
	return `${scheme}://${trimmed}${url}`;
};

/** The one path both verbs take. It ALWAYS resolves to a value: nothing that
 *  happens on the wire is allowed to escape as a thrown Error, because every
 *  caller duck-tests `data?.error` rather than catching. */
const request = async (options: {
	method: 'POST' | 'GET';
	rgsUrl: string;
	url: string;
	variables?: object;
}): Promise<unknown> => {
	const endpoint = endpointFor(options.rgsUrl, options.url);

	let response: Response;
	try {
		response = await fetcher({
			method: options.method,
			endpoint,
			...(options.method === 'GET' ? {} : { variables: options.variables }),
		});
	} catch (err) {
		// The player sentence names the connection; the underlying reason is
		// logged for support (ERR_CONNECTION_REFUSED, DNS failure, CORS, ...).
		console.error('rgs-fetcher: request to', endpoint, 'failed:', (err as Error)?.message ?? err);
		return envelope(0, 'ERR_NETWORK', MESSAGE_NETWORK);
	}

	const statusCode = response.status;

	// Read the body ONCE as text, then parse it here: `response.json()` on an
	// HTML error page (a proxy's 502, an operator's login redirect) throws a
	// SyntaxError out of the fetcher and past every caller.
	let body: string;
	try {
		body = await response.text();
	} catch (err) {
		console.error('rgs-fetcher: could not read the body of', endpoint, (err as Error)?.message ?? err);
		return envelope(statusCode, 'ERR_BAD_RESPONSE', MESSAGE_BAD_RESPONSE);
	}

	let data: unknown;
	try {
		data = body.trim() ? JSON.parse(body) : {};
	} catch {
		console.error('rgs-fetcher: non-JSON response from', endpoint, statusCode, body.slice(0, 200));
		return envelope(statusCode, 'ERR_BAD_RESPONSE', MESSAGE_BAD_RESPONSE);
	}

	if (statusCode !== 200) {
		console.error('error', statusCode, data);
		// The RGS's own envelope passes through byte-compatible; only a status
		// that carries no envelope gets one synthesised.
		if (data && typeof data === 'object' && 'error' in (data as object)) return data;
		const authFailure = statusCode === 401 || statusCode === 403;
		return envelope(
			statusCode,
			`ERR_HTTP_${statusCode}`,
			authFailure ? MESSAGE_AUTH : MESSAGE_HTTP,
		);
	}

	return data;
};

export const rgsFetcher = {
	post: async function post<
		T extends keyof paths,
		TResponse = paths[T]['post']['responses'][200]['content']['application/json'],
	>(options: {
		url: T;
		rgsUrl: string;
		variables?: paths[T]['post']['requestBody']['content']['application/json'];
	}): Promise<TResponse> {
		const data = await request({
			method: 'POST',
			rgsUrl: options.rgsUrl,
			url: options.url as string,
			variables: options.variables as object | undefined,
		});
		return data as TResponse;
	},
	get: async function get<
		T extends string,
		TResponse = NonNullable<paths['/wallet/play']['post']['responses'][200]['content']['application/json']['round']> & { costMultiplier?: number; error?: RgsErrorEnvelope['error'] },
	>(options: { url: T; rgsUrl: string }): Promise<TResponse> {
		const data = await request({
			method: 'GET',
			rgsUrl: options.rgsUrl,
			url: options.url as string,
		});
		return data as TResponse;
	},
};

/** Exported for the unit nets only (endpoint derivation is not otherwise
 *  observable without a live server). */
export { endpointFor };
