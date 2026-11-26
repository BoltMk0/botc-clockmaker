import { getScriptWithCharacters } from '$lib/resources/server/scripts';
import { listPresetsForScript, withLastPlayed } from '$lib/resources/server/presets';

export async function load({ params }) {
    const script = getScriptWithCharacters(params.id);
    if (!script) {
        throw new Error('Script not found');
    }
    return { script, presets: withLastPlayed(listPresetsForScript(params.id)) };
}
