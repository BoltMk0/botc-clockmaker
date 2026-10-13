import { redirect, type Handle, type ServerInit } from "@sveltejs/kit";
import { isValidSessionToken, SESSION_COOKIE } from "$lib/auth/server/auth";
import { bearerToken, isValidApiToken } from "$lib/auth/server/apiToken";
import { migrateCharacterIds } from "$lib/resources/server/migrateCharacterIds";
import { startMusicLoudnessWorker } from "$lib/resources/server/musicLoudness";

export const init: ServerInit = () => {
    migrateCharacterIds();
    startMusicLoudnessWorker();
};

const PUBLIC_PREFIXES = ['/feedback', '/login', '/script', '/_app/'];
const PUBLIC_PATHS = ['/favicon.ico', '/favicon.png', '/robots.txt'];

function isPublic(pathname: string): boolean {
    return PUBLIC_PATHS.includes(pathname) ||
        PUBLIC_PREFIXES.some(p => pathname === p.replace(/\/$/, '') || pathname.startsWith(p.endsWith('/') ? p : p + '/'));
}

// Character images can be viewed without logging in, for the public script viewer (/script/[id]).
const PUBLIC_CHARACTER_IMAGE = /^\/api\/characters\/[^/]+\/img$/;

function isPublicRead(method: string, pathname: string): boolean {
    return (method === 'GET' || method === 'HEAD') && PUBLIC_CHARACTER_IMAGE.test(pathname);
}

function isApiPath(pathname: string): boolean {
    return pathname.startsWith('/api/') || pathname.startsWith('/events/');
}

export const handle: Handle = async ({ event, resolve }) => {
    const { pathname, search } = event.url;

    if (isPublic(pathname) || isPublicRead(event.request.method, pathname) || isValidSessionToken(event.cookies.get(SESSION_COOKIE))) {
        return resolve(event);
    }

    // Programs (e.g. Lightscapes) use the API token instead of a session, for the API and events only
    if (isApiPath(pathname) && isValidApiToken(bearerToken(event.request))) {
        return resolve(event);
    }

    if (isApiPath(pathname)) {
        return new Response('Unauthorized', { status: 401 });
    }

    redirect(303, `/login?redirectTo=${encodeURIComponent(pathname + search)}`);
};
