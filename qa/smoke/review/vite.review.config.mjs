// REVIEW ONLY: the app's own vite config with file watching and HMR OFF, so another lane's edit or build cannot reload
// a page mid-round while this reviewer's smoke is running, and with its OWN dep-optimizer cache (never the shared
// apps/piggy_firefighters/node_modules/.vite). Run from apps/piggy_firefighters:
//   node node_modules/vite/bin/vite.js dev --config ../../qa/smoke/review/vite.review.config.mjs --host --port 3004 --strictPort
import base from '../../../apps/piggy_firefighters/vite.config.js';

export default {
	...base,
	cacheDir: process.env.REVIEW_VITE_CACHE ?? '/tmp/pf-review-vite-cache',
	server: { ...(base.server ?? {}), hmr: false, watch: { ignored: ['**/*'] } },
};
