import { json } from '@sveltejs/kit';
import { getCharactersForScript, setScriptCharacters } from '$lib/server/database/scripts';
import { getScriptById } from '$lib/server/database/scripts';

export async function GET({ params }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const script = await getScriptById(id);
    if (!script) return json({ error: 'Script not found' }, { status: 404 });

    return json(await getCharactersForScript(id));
}

// PUT replaces the full character list for the script.
// Body: { characterIds: number[] }
export async function PUT({ params, request }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.characterIds)) {
        return json({ error: 'characterIds array is required' }, { status: 400 });
    }
    if (!body.characterIds.every(Number.isInteger)) {
        return json({ error: 'All characterIds must be integers' }, { status: 400 });
    }

    const script = await getScriptById(id);
    if (!script) return json({ error: 'Script not found' }, { status: 404 });

    await setScriptCharacters(id, body.characterIds);
    return json(await getCharactersForScript(id));
}
