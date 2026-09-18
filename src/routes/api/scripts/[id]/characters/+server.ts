import { json } from '@sveltejs/kit';
import { getCharactersForScript, setScriptCharacters, type ScriptCharacterInput } from '$lib/resources/server/scripts';
import { getScriptById } from '$lib/resources/server/scripts';

export async function GET({ params }) {
    const script = getScriptById(params.id);
    if (!script) return json({ error: 'Script not found' }, { status: 404 });

    return json(getCharactersForScript(params.id));
}

// PUT replaces the full character list for the script.
// Body: { characterIds: string[] }  OR  { characters: ScriptCharacterInput[] }
export async function PUT({ params, request }) {
    const id = params.id;

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid body' }, { status: 400 });

    let entries: ScriptCharacterInput[];
    if (Array.isArray(body.characters)) {
        if (!body.characters.every((c: any) => typeof c?.characterId === 'string')) {
            return json({ error: 'Each character must have a string characterId' }, { status: 400 });
        }
        entries = body.characters.map((c: any) => ({
            characterId: c.characterId,
            firstNightOrder: c.firstNightOrder ?? null,
            otherNightOrder: c.otherNightOrder ?? null,
        }));
    } else if (Array.isArray(body.characterIds)) {
        if (!body.characterIds.every((cid: any) => typeof cid === 'string')) {
            return json({ error: 'All characterIds must be strings' }, { status: 400 });
        }
        entries = body.characterIds.map((cid: string) => ({
            characterId: cid,
            firstNightOrder: null,
            otherNightOrder: null,
        }));
    } else {
        return json({ error: 'characters or characterIds array is required' }, { status: 400 });
    }

    const script = getScriptById(id);
    if (!script) return json({ error: 'Script not found' }, { status: 404 });

    setScriptCharacters(id, entries);
    return json(getCharactersForScript(id));
}
