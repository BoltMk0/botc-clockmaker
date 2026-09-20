import { redirect, type Handle } from "@sveltejs/kit";
import { isValidSessionToken, SESSION_COOKIE } from "$lib/auth/server/auth";

const PUBLIC_PREFIXES = ['/feedback', '/login', '/_app/'];
const PUBLIC_PATHS = ['/favicon.ico', '/favicon.png', '/robots.txt'];

function isPublic(pathname: string): boolean {
    return PUBLIC_PATHS.includes(pathname) ||
        PUBLIC_PREFIXES.some(p => pathname === p.replace(/\/$/, '') || pathname.startsWith(p.endsWith('/') ? p : p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
    const { pathname, search } = event.url;

    if (isPublic(pathname) || isValidSessionToken(event.cookies.get(SESSION_COOKIE))) {
        return resolve(event);
    }

    if (pathname.startsWith('/api/') || pathname.startsWith('/events/')) {
        return new Response('Unauthorized', { status: 401 });
    }

    redirect(303, `/login?redirectTo=${encodeURIComponent(pathname + search)}`);
};
