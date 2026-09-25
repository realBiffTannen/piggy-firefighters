// DEV-ONLY rig preview. Production builds must not expose it:
//  - `dev` is a compile-time constant, so in a production build this load() always throws 404 and the
//    viewer below is never imported (the dynamic import in +page.svelte is dead code and is dropped).
//  - The root layout forces `prerender = true` + adapter-static(strict), so the route cannot be marked
//    non-prerenderable without failing the build; the 404 is therefore raised by the client router.
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export const load = () => {
	if (!dev) error(404, 'Not found');
	return {};
};
