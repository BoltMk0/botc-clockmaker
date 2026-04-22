import { json } from '@sveltejs/kit';
import { getCharacterById, updateCharacter, deleteCharacter } from '$lib/database/server/characters';
import type { CharacterCategory } from '$lib/database/common/types';

const VALID_CATEGORIES: CharacterCategory[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveler'];

export async function GET({ params }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const character = await getCharacterById(id);
    if (!character) return json({ error: 'Character not found' }, { status: 404 });
    return json(character);
}

export async function PATCH({ params, request }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name, category, rules } = body;
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
        return json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
    }

    const character = await updateCharacter(id, { name, category, rules });
    if (!character) return json({ error: 'Character not found' }, { status: 404 });
    return json(character);
}

export async function DELETE({ params }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const deleted = await deleteCharacter(id);
    if (!deleted) return json({ error: 'Character not found' }, { status: 404 });
    return new Response(null, { status: 204 });
}
