import { json } from '@sveltejs/kit';
import { listCharacters, listCharactersByCategory, addCharacter } from '$lib/database/server/characters';
import { isCharacter, type CharacterCategory } from '$lib/database/common/types';

const VALID_CATEGORIES: CharacterCategory[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveler'];

export async function GET({ url }) {
    const category = url.searchParams.get('category') as CharacterCategory | null;
    if (category !== null) {
        if (!VALID_CATEGORIES.includes(category)) {
            return json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
        }
        return json(await listCharactersByCategory(category));
    }
    return json(await listCharacters());
}

export async function POST({ request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name, category, rules, player_count, wakes_first_night, wakes_other_nights } = body;
    if (!name || !category || !rules) {
        return json({ error: 'name, category and rules are required' }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category)) {
        return json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
    }

    if(!isCharacter(body)){
        return json({ error: 'Invalid character data' }, { status: 400 });
    }

    const character = await addCharacter({ name, category, rules, player_count: player_count ?? 1, wakes_first_night: wakes_first_night ?? false, wakes_other_nights: wakes_other_nights ?? false });
    return json(character, { status: 201 });
}
