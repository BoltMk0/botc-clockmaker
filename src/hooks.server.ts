import { redirect, type Handle, type ServerInit } from "@sveltejs/kit";
import { isValidSessionToken, SESSION_COOKIE } from "$lib/auth/server/auth";
import { migrateCharacterIds } from "$lib/resources/server/migrateCharacterIds";

export const init: ServerInit = () => {
    migrateCharacterIds();
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

export const handle: Handle = async ({ event, resolve }) => {
    const { pathname, search } = event.url;

    if (isPublic(pathname) || isPublicRead(event.request.method, pathname) || isValidSessionToken(event.cookies.get(SESSION_COOKIE))) {
        return resolve(event);
    }

    if (pathname.startsWith('/api/') || pathname.startsWith('/events/')) {
        return new Response('Unauthorized', { status: 401 });
    }

    redirect(303, `/login?redirectTo=${encodeURIComponent(pathname + search)}`);
};
