import { getSpotifyHelperInstance } from '$lib/model/server/Spotify/SpotifyHelper.js';
import { error, redirect } from '@sveltejs/kit';

/** Spotify sends the browser back here after consent. */
export async function GET({ url, cookies }) {
    const expectedState = cookies.get('spotify_auth_state');
    cookies.delete('spotify_auth_state', { path: '/api/spotify' });
    if (url.searchParams.get('error')) {
        return error(400, { message: `Spotify authorization failed: ${url.searchParams.get('error')}` });
    }
    const code = url.searchParams.get('code');
    if (!code || !expectedState || url.searchParams.get('state') !== expectedState) {
        return error(400, { message: 'Invalid Spotify authorization response' });
    }
    try {
        await getSpotifyHelperInstance().completeAuth(code, `${url.origin}/api/spotify/callback`);
    } catch (e) {
        return error(500, { message: e instanceof Error ? e.message : String(e) });
    }
    return redirect(302, '/admin/mixer');
}
