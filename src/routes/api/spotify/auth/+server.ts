import { getSpotifyHelperInstance } from '$lib/model/server/Spotify/SpotifyHelper.js';
import { error, redirect } from '@sveltejs/kit';
import { v7 } from 'uuid';

/** Starts linking a Spotify account: sends the browser to Spotify's consent page. */
export function GET({ url, cookies }) {
    const state = v7();
    cookies.set('spotify_auth_state', state, { path: '/api/spotify', httpOnly: true, sameSite: 'lax', maxAge: 600, secure: false });
    let target: string;
    try {
        target = getSpotifyHelperInstance().authorizeUrl(`${url.origin}/api/spotify/callback`, state);
    } catch (e) {
        return error(400, { message: e instanceof Error ? e.message : String(e) });
    }
    return redirect(302, target);
}
