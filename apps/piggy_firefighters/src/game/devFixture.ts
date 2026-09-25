/**
 * DEV-ONLY deterministic fixture override.
 *
 * `?fixture=<name>` on the game URL (e.g.
 * `...&fixture=base_trigger_rescue`) tells the mock RGS to return that
 * deterministic fixture book on the following play(s) and to charge that
 * fixture's mode cost. The mock reads them from `server/fixtures/` (the frontend
 * lane's hand-authored dev books, all six modes, 15,000x cap; see its
 * index.json) unless FIXTURES_DIR says otherwise. This is a
 * development affordance served only by `server/mock-rgs.mjs`; it is inert
 * against a real RGS (the POST simply fails and is swallowed) and is never part
 * of any uploaded bundle.
 *
 * We POST the sticky fixture to the mock once on boot; every subsequent play in
 * the session then replays that book, which is exactly what iterating on a
 * feature scene wants. Append `&fixture=off` (or remove the param and reload) to
 * clear it.
 */
export const initDevFixture = () => {
	if (typeof window === 'undefined') return;
	try {
		const params = new URLSearchParams(window.location.search);
		const fixture = params.get('fixture');
		if (!fixture) return;

		const rgsUrl = params.get('rgs_url');
		if (!rgsUrl) return;
		// Only ever talk to a loopback mock RGS — never a real endpoint.
		const host = rgsUrl.replace(/^https?:\/\//, '');
		if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return;

		const name = fixture === 'off' ? null : fixture;
		void fetch(`http://${host}/control/fixture`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name }),
		})
			.then(() => console.info(`[devFixture] mock RGS pinned to fixture: ${name ?? '(cleared)'}`))
			.catch(() => {
				/* real RGS or mock down — dev affordance only, ignore */
			});
	} catch {
		/* URL parsing failed — ignore */
	}
};
