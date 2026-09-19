import { getScriptWithCharacters } from '$lib/resources/server/scripts';
import { listPresetsForScript } from '$lib/resources/server/presets';

export async function load({ params }) {
    const script = getScriptWithCharacters(params.id);
    if (!script) {
        throw new Error('Script not found');
    }
    const presets = listPresetsForScript(params.id);
    return { script, presets };
}
