import { createGameSetup, listGameSetups, listGameSetupsWithCharacters } from '$lib/server/database/games.js';
import { json } from '@sveltejs/kit';

export async function GET({ url }) {
    const withCharacters = url.searchParams.get('characters') === 'true';
    if (withCharacters) {
        return json(await listGameSetupsWithCharacters());
    }
    return json(await listGameSetups());
}

export async function POST({ request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { script_id } = body;
    if (!script_id) {
        return json({ error: 'script_id is required' }, { status: 400 });
    }

    const game = await createGameSetup({ script_id });
    return json(game, { status: 201 });
}