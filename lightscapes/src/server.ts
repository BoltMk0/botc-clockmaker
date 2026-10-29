import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { isTimeOfDay } from "../../src/lib/model/client/types.ts";
import { BELL_EVENTS, ConfigError, normalizeConfig, saveConfig, type BellEvent, type Config } from "./config.ts";
import { clockmakerRequest, type ClockFollower } from "./clock.ts";
import type { Engine } from "./engine.ts";
import type { Zigbee } from "./zigbee.ts";
import { townSquareSpectrum } from "./spectrum.ts";
import { ENV } from "./env.ts";

const MAX_BODY_BYTES = 1024 * 1024;
const LEARN_TIMEOUT_MS = 30_000;
/** The lengths a spectrum can be played through over, in seconds, as the page offers them. */
const PLAY_SECONDS = [10, 20, 30, 60];

const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml'
};

class HttpError extends Error {
    constructor(readonly status: number, message: string) { super(message); }
}

function send(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req){
        size += chunk.length;
        if(size > MAX_BODY_BYTES) throw new HttpError(413, 'Too large');
        chunks.push(chunk);
    }
    if(size === 0) return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        throw new HttpError(400, 'Not JSON');
    }
}

/** HTTP basic auth against LIGHTSCAPES_PASSWORD, any user name, if one's set. */
function authorized(req: IncomingMessage): boolean {
    if(!ENV.password) return true;
    const match = /^Basic\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    if(!match) return false;
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const given = Buffer.from(decoded.slice(decoded.indexOf(':') + 1));
    const expected = Buffer.from(ENV.password);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The configuration for the page: the token's left out, only whether there is one. */
function publicConfig(config: Config) {
    return { ...config, clockmaker: { ...config.clockmaker, token: '', tokenSet: config.clockmaker.token !== '' } };
}

export function startServer(engine: Engine, clock: ClockFollower, zigbee: Zigbee) {
    async function api(req: IncomingMessage, res: ServerResponse, path: string) {
        const method = req.method ?? 'GET';

        if(path === '/api/status' && method === 'GET'){
            const c = clock.clock;
            return send(res, 200, {
                clockmaker: { connection: clock.connection, error: clock.error },
                mqtt: { connected: zigbee.mqttConnected, url: ENV.mqttUrl },
                zigbee2mqtt: { online: zigbee.bridgeOnline },
                dryRun: ENV.dryRun,
                clock: c && {
                    timeOfDay: c.timeOfDay,
                    day: c.day,
                    running: c.time.serverStartTime !== null,
                    progress: engine.progress()
                },
                overridden: engine.overridden,
                previewing: engine.previewing,
                playing: engine.playing,
                activity: engine.activity
            });
        }

        if(path === '/api/config' && method === 'GET') return send(res, 200, publicConfig(engine.config));

        if(path === '/api/config' && method === 'PUT'){
            const body = await readJson(req) as { clockmaker?: { token?: string } };
            // The page never has the token, so a blank one keeps the saved one
            if(body?.clockmaker && !body.clockmaker.token) body.clockmaker.token = engine.config.clockmaker.token;
            const config = normalizeConfig(body);
            saveConfig(config);
            engine.configure(config);
            return send(res, 200, publicConfig(config));
        }

        if(path === '/api/zigbee' && method === 'GET'){
            return send(res, 200, { devices: zigbee.devices, groups: zigbee.groups });
        }

        // The games on a Clockmaker, to pick one from: with the URL and token typed in, or the saved ones
        if(path === '/api/clocks' && method === 'POST'){
            const body = await readJson(req) as { url?: string; token?: string };
            const url = (body.url || engine.config.clockmaker.url).replace(/\/+$/, '');
            const token = body.token || engine.config.clockmaker.token;
            if(!url || !token) throw new HttpError(400, 'Enter the Clockmaker address and API token first');
            try {
                const response = await clockmakerRequest(url, token, '/api/clock');
                const { instances } = await response.json() as { instances: { clock: { clockId: string }; config: { teamName: string | null } }[] };
                return send(res, 200, instances.map(i => ({ id: i.clock.clockId, name: i.config.teamName })));
            } catch(err) {
                const message = err instanceof Error ? (err.name === 'TimeoutError' ? 'Timed out' : err.message) : String(err);
                throw new HttpError(502, `Couldn't reach Clockmaker: ${message}`);
            }
        }

        if(path === '/api/townsquare-spectrum' && method === 'GET') return send(res, 200, townSquareSpectrum());

        if(path === '/api/learn' && method === 'POST'){
            const press = await engine.learn(LEARN_TIMEOUT_MS);
            return send(res, 200, press);
        }

        if(path === '/api/preview' && method === 'POST'){
            if(engine.overridden) throw new HttpError(409, "The lights are overridden from the remote");
            const body = await readJson(req) as { phase?: unknown; progress?: unknown; bell?: unknown; play?: unknown; seconds?: unknown; config?: unknown };
            // The page's unsaved configuration, if it sent it
            const config = body.config === undefined ? engine.config : normalizeConfig(body.config);
            if(isTimeOfDay(body.phase)){
                const progress = typeof body.progress === 'number' ? Math.min(Math.max(body.progress, 0), 1) : 0;
                engine.preview(body.phase, progress, config);
            } else if(BELL_EVENTS.includes(body.bell as BellEvent)){
                engine.previewBell(body.bell as BellEvent, config);
            } else if(typeof body.play === 'string'){
                const spectrum = config.spectrums.find(s => s.id === body.play);
                if(!spectrum) throw new HttpError(400, 'No such spectrum');
                if(!PLAY_SECONDS.includes(body.seconds as number)) throw new HttpError(400, `Play it over ${PLAY_SECONDS.join(', ')} seconds`);
                engine.playSpectrum(spectrum, body.seconds as number, config);
            } else throw new HttpError(400, 'Preview a phase, a bell or a spectrum');
            return send(res, 200, {});
        }

        if(path === '/api/preview' && method === 'DELETE'){
            engine.endPreview();
            return send(res, 200, {});
        }

        throw new HttpError(404, 'Not found');
    }

    async function serveFile(res: ServerResponse, path: string) {
        const relative = normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, '');
        const file = join(ENV.publicDir, relative);
        if(!file.startsWith(ENV.publicDir)) throw new HttpError(404, 'Not found');
        const extension = relative.slice(relative.lastIndexOf('.'));
        try {
            const content = await readFile(file);
            res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
            res.end(content);
        } catch {
            throw new HttpError(404, 'Not found');
        }
    }

    const server = createServer(async (req, res) => {
        if(!authorized(req)){
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Lightscapes"' });
            res.end('Unauthorized');
            return;
        }
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        try {
            if(path.startsWith('/api/')) await api(req, res, path);
            else if(req.method === 'GET' || req.method === 'HEAD') await serveFile(res, path);
            else throw new HttpError(405, 'Method not allowed');
        } catch(err) {
            if(res.headersSent) return;
            if(err instanceof HttpError) send(res, err.status, { error: err.message });
            else if(err instanceof ConfigError) send(res, 400, { error: err.message });
            else {
                console.error(err);
                send(res, 500, { error: 'Something went wrong' });
            }
        }
    });
    server.listen(ENV.port, () => console.log(`Lightscapes: configuration page on port ${ENV.port}`));
    return server;
}
