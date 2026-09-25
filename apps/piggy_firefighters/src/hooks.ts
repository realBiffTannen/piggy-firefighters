import type { Reroute } from '@sveltejs/kit';

// The platform launches the game as `<cdn>/<team>/<game>/<version>/index.html?…`. SvelteKit's client
// router only knows the route `/`, so without this it logs "Not found: …/index.html" on every boot —
// a console error on a build that must boot console-clean. Map the file name back onto the root route.
export const reroute: Reroute = ({ url }) => {
	if (url.pathname.endsWith('/index.html')) return url.pathname.slice(0, -'index.html'.length);
};
