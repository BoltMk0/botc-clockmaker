import type { Character, CharacterCategory, ScriptCharacter, ScriptWithCharacters } from "$lib/resources/common/gameData";

// Travellers, loric and fabled aren't part of a script's own character list, but are available in every game.
export const SIDE_CATEGORIES: CharacterCategory[] = ['traveler', 'loric', 'fabled'];

export async function fetchScriptWithSideCharacters(scriptId: string): Promise<ScriptWithCharacters | null> {
    const [script, all] = await Promise.all([
        fetch(`/api/scripts/${scriptId}`).then(r => r.ok ? r.json() as Promise<ScriptWithCharacters> : null),
        fetch('/api/characters').then(r => r.ok ? r.json() as Promise<Character[]> : []).catch(() => [] as Character[])
    ]);
    if (!script) return null;
    const have = new Set(script.characters.map(c => c.id));
    const extra: ScriptCharacter[] = all
        .filter(c => SIDE_CATEGORIES.includes(c.category) && !have.has(c.id))
        .map(c => ({ ...c, firstNightOrder: c.defaultFirstNightOrder, otherNightOrder: c.defaultOtherNightOrder }));
    return { ...script, characters: [...script.characters, ...extra] };
}
