import { error } from '@sveltejs/kit';

/**
 * The rig viewer is a development-only review tool. Outside `vite dev` the route is a 404 (and the page component
 * renders nothing), so tools/build_dist.sh's move-aside of src/routes/rigs is belt-and-braces only.
 */
export const load = () => {
  if (!import.meta.env.DEV) error(404, 'Not found');
  return {};
};
