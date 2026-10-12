import { characterIdFromName } from "../common/util";
import { CHARACTERS_MANAGER } from "./characters";
import { SCRIPTS_MANAGER } from "./scripts";
import { PRESETS_MANAGER } from "./presets";
import { DRAW_SESSION_MANAGER } from "./draw-sessions";
import { GRIM_STATE_MANAGER } from "./jsonResourceManager";
import { getCustomMessages, saveCustomMessages } from "./customMessages";
import { listResources, renameResource } from "./resources";
import type { GrimoireStateHistory } from "../common/grimoireState";
import type { DrawSession } from "../common/drawSession";
import type { Preset, Script } from "../common/gameData";

// Character ids used to be hyphenated slugs of the name ("fang-gu"); they're now the official script format's
// ids ("fanggu"), so imported scripts line up with the characters already here. This renames any character still
// on an old id, along with every saved reference to it. Once everything is renamed it does nothing.
export function migrateCharacterIds(): void {
    const renames = new Map<string, string>();
    const taken = new Set(CHARACTERS_MANAGER.values.map(c => c.id));
    for (const character of CHARACTERS_MANAGER.values) {
        const newId = characterIdFromName(character.name);
        if (newId === character.id) continue;
        if (!newId || taken.has(newId)) {
            console.warn(`Not renaming character "${character.id}" to "${newId}": that id is empty or already in use.`);
            continue;
        }
        taken.add(newId);
        renames.set(character.id, newId);
    }
    if (renames.size === 0) return;

    console.log(`Renaming ${renames.size} character id(s) to the official script format.`);
    const id = (old: string) => renames.get(old) ?? old;
    const ids = (list: string[]) => list.map(id);
    const optionalIds = (list: string[] | undefined) => list && ids(list);
    const idSets = (sets: string[][] | undefined) => sets?.map(ids);

    for (const [oldId, newId] of renames) {
        const character = CHARACTERS_MANAGER.get(oldId)!;
        CHARACTERS_MANAGER.add({ ...character, id: newId });
        CHARACTERS_MANAGER.delete(oldId);
        renameCharacterImages(oldId, newId);
    }

    for (const script of [...SCRIPTS_MANAGER.values]) {
        updateIfChanged<Script>(SCRIPTS_MANAGER, script, {
            ...script,
            characters: script.characters.map(c => ({ ...c, characterId: id(c.characterId) }))
        });
    }

    for (const preset of [...PRESETS_MANAGER.values]) {
        updateIfChanged<Preset>(PRESETS_MANAGER, preset, {
            ...preset,
            character_ids: ids(preset.character_ids),
            grim_character_ids: optionalIds(preset.grim_character_ids),
            bluff_sets: idSets(preset.bluff_sets)!,
            bluff_ids: optionalIds(preset.bluff_ids)
        });
    }

    for (const session of [...DRAW_SESSION_MANAGER.values]) {
        updateIfChanged<DrawSession>(DRAW_SESSION_MANAGER, session, {
            ...session,
            bluffSets: idSets(session.bluffSets),
            bluffIds: optionalIds(session.bluffIds),
            offSeatIds: optionalIds(session.offSeatIds),
            slots: session.slots.map(s => ({ ...s, characterId: id(s.characterId) }))
        });
    }

    for (const history of [...GRIM_STATE_MANAGER.values] as GrimoireStateHistory[]) {
        const snapshot = <T extends GrimoireStateHistory['present'] | null>(snap: T): T => snap && {
            ...snap,
            placedTokens: snap.placedTokens.map(t => ({ ...t, characterId: t.characterId && id(t.characterId) }))
        };
        const preset = history.loadedPreset;
        updateIfChanged<GrimoireStateHistory>(GRIM_STATE_MANAGER, history, {
            ...history,
            loadedPreset: preset && {
                ...preset,
                character_ids: ids(preset.character_ids),
                bluff_sets: idSets(preset.bluff_sets),
                bluff_ids: optionalIds(preset.bluff_ids)
            },
            present: snapshot(history.present),
            saveslots: history.saveslots.map(snapshot)
        });
    }

    const messages = getCustomMessages();
    const renamedMessages = messages.map(m => ({
        fields: m.fields.map(f => f.type === 'character' ? { ...f, value: f.value.map(v => v && id(v)) } : f)
    }));
    if (JSON.stringify(renamedMessages) !== JSON.stringify(messages)) saveCustomMessages(renamedMessages);
}

function updateIfChanged<T>(manager: { add(obj: unknown): T }, before: T, after: T): void {
    if (JSON.stringify(after) !== JSON.stringify(before)) manager.add(after);
}

// Images are stored as `character-<id>-img`, plus scaled copies named `character-<id>-img-<size>px`.
function renameCharacterImages(oldId: string, newId: string): void {
    const oldPrefix = `character-${oldId}-img`;
    for (const resource of listResources('charactertokenimage')) {
        const suffix = resource.name.slice(oldPrefix.length);
        if (!resource.name.startsWith(oldPrefix) || !/^(-\d+px)?$/.test(suffix)) continue;
        try {
            renameResource(resource, `character-${newId}-img${suffix}`);
        } catch (err) {
            console.warn(`Failed to rename image ${resource.id} for character "${oldId}":`, err);
        }
    }
}
