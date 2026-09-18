import { listCharacters } from '$lib/resources/server/characters';
import { getScriptWithCharacters } from '$lib/resources/server/scripts';

export async function load({ params }) {
    const script = getScriptWithCharacters(params.id);
    if (!script) {
        throw new Error('Script not found');
    }
    const characters = listCharacters();
    return { script, characters };
}
