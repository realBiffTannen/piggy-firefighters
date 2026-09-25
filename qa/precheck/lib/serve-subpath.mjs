// A static server that mounts a built game ONE DIRECTORY DEEP, the way Stake does
// (https://<team>.live.stake-engine.com/<version>/), and 404s everything outside the mount.
// No index.html fallback, no rewrite: a missing asset is a 404, never a silent 200
// (ledger: base-path-assumed-to-be-site-root, falsePositiveRisk).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.ogg': 'audio/ogg',
	'.webm': 'video/webm',
	'.mp4': 'video/mp4',
	'.atlas': 'text/plain; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.skel': 'application/octet-stream',
};

/**
 * @param {{dir:string, mount:string, port:number, host?:string, rewriteIndex?:(html:string)=>string, rewrite?:(rel:string, body:string)=>string|null}} opts
 * `rewrite(rel, text)` may return replacement text for any text asset (canaries that re-create a pre-fix bundle byte-wise).
 * @returns {Promise<{server:http.Server, origin:string, base:string, close:()=>void}>}
 */
export const serveSubpath = async ({ dir, mount, port, host = '127.0.0.1', rewriteIndex, rewrite }) => {
	const DIR = path.resolve(dir);
	const MOUNT = mount.replace(/\/+$/, '');
	if (!fs.existsSync(path.join(DIR, 'index.html'))) throw new Error(`no index.html under ${DIR}`);
	const server = http.createServer((req, res) => {
		const url = new URL(req.url, `http://${host}`);
		const pathname = decodeURIComponent(url.pathname);
		if (pathname === MOUNT) {
			res.writeHead(301, { location: MOUNT + '/' + url.search });
			res.end();
			return;
		}
		if (!pathname.startsWith(MOUNT + '/')) {
			res.writeHead(404, { 'content-type': 'text/plain' });
			res.end('outside mount');
			return;
		}
		let rel = pathname.slice(MOUNT.length);
		if (rel.endsWith('/')) rel += 'index.html';
		const file = path.join(DIR, rel);
		if (!file.startsWith(DIR + path.sep) && file !== DIR) {
			res.writeHead(404, { 'content-type': 'text/plain' });
			res.end('escaped root');
			return;
		}
		if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
			res.writeHead(404, { 'content-type': 'text/plain' });
			res.end('not found');
			return;
		}
		let body = fs.readFileSync(file);
		const ext = path.extname(file).toLowerCase();
		if (rewriteIndex && rel.endsWith('index.html')) body = Buffer.from(rewriteIndex(String(body)));
		if (rewrite && /\.(html|js|mjs|css|json)$/.test(rel)) {
			const out = rewrite(rel, String(body));
			if (typeof out === 'string') body = Buffer.from(out);
		}
		res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
		res.end(body);
	});
	await new Promise((r) => server.listen(port, host, r));
	const origin = `http://${host}:${port}`;
	return { server, origin, base: `${origin}${MOUNT}/`, close: () => server.close() };
};
