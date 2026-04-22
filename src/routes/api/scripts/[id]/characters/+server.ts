import { json } from '@sveltejs/kit';
import { getCharactersForScript, setScriptCharacters, type ScriptCharacterInput } from '$lib/database/server/scripts';
import { getScriptById } from '$lib/database/server/scripts';

export async function GET({ params }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const script = await getScriptById(id);
    if (!script) return json({ error: 'Script not found' }, { status: 404 });

    return json(await getCharactersForScript(id));
}

// PUT replaces the full character list for the script.
// Body: { characterIds: number[] }  OR  { characters: ScriptCharacterInput[] }
export async function PUT({ params, request }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid body' }, { status: 400 });

    let entries: ScriptCharacterInput[];
    if (Array.isArray(body.characters)) {
        if (!body.characters.every((c: any) => Number.isInteger(c?.characterId))) {
            return json({ error: 'Each character must have an integer characterId' }, { status: 400 });
        }
        entries = body.characters.map((c: any) => ({
            characterId: c.characterId,
            firstNightOrder: c.firstNightOrder ?? null,
            otherNightOrder: c.otherNightOrder ?? null,
        }));
    } else if (Array.isArray(body.characterIds)) {
        if (!body.characterIds.every(Number.isInteger)) {
            return json({ error: 'All characterIds must be integers' }, { status: 400 });
        }
        entries = body.characterIds.map((cid: number) => ({
            characterId: cid,
            firstNightOrder: null,
            otherNightOrder: null,
        }));
    } else {
        return json({ error: 'characters or characterIds array is required' }, { status: 400 });
    }

    const script = await getScriptById(id);
    if (!script) return json({ error: 'Script not found' }, { status: 404 });

    await setScriptCharacters(id, entries);
    return json(await getCharactersForScript(id));
}
