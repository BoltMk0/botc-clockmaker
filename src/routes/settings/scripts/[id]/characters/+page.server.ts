import { listCharacters } from '$lib/resources/server/characters';
import { getScriptWithCharacters, listScripts } from '$lib/resources/server/scripts';

export async function load({ params }) {
    const script = getScriptWithCharacters(params.id);
    if (!script) {
        throw new Error('Script not found');
    }
    const characters = listCharacters();
    // Other scripts, used to filter the character picker down to one script's characters
    const filterScripts = listScripts()
        .filter(s => s.id !== script.id)
        .map(s => ({ id: s.id, name: s.name, characterIds: s.characters.map(c => c.characterId) }));
    return { script, characters, filterScripts };
}
