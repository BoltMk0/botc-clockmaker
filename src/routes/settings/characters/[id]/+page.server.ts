import { isValidCharacterCategory } from "$lib/resources/common/gameData";
import { isMessagePresetList } from "$lib/common/message";
import { getCharacterById, updateCharacter } from "$lib/resources/server/characters";
import { error, fail } from "@sveltejs/kit";

// A night's message presets, sent as JSON; null if they're not valid.
function parseMessagePresetsField(value: FormDataEntryValue | null) {
    try {
        const presets: unknown = JSON.parse(String(value ?? '[]'));
        return isMessagePresetList(presets) ? presets : null;
    } catch {
        return null;
    }
}

function parseNightOrderField(value: FormDataEntryValue | null): number | null {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const n = Number(value);
    return isFinite(n) ? n : null;
}

export async function load({ params }) {
    const character = getCharacterById(params.id);
    if (!character) error(404, 'Character not found');
    return { character };
}

export const actions = {
    updateCharacter: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id');
        if (typeof id !== 'string' || !id.trim()) {
            return fail(400, {error: 'Valid ID is required' });
        }

        const name = formData.get('name');
        if (typeof name !== 'string' || !name.trim()) {
            return fail(400, {error: 'Name is required' });
        }

        const category = formData.get('category');
        if (typeof category !== 'string' || !category.trim()) {
            return fail(400, {error: 'Category is required' });
        }
        if(!isValidCharacterCategory(category)){
            return fail(400, {error: 'Invalid category' });
        }

        const rules = formData.get('rules');
        if (typeof rules !== 'string') {
            return fail(400, {error: 'Rules must be a string' });
        }

        const setup = formData.get('setup');
        if (typeof setup !== 'string') {
            return fail(400, {error: 'Setup must be a string' });
        }

        const firstNightReminder = formData.get('firstNightReminder');
        const otherNightReminder = formData.get('otherNightReminder');
        if (typeof firstNightReminder !== 'string' || typeof otherNightReminder !== 'string') {
            return fail(400, {error: 'Night reminders must be strings' });
        }


        const firstNightMessagePresets = parseMessagePresetsField(formData.get('firstNightMessagePresets'));
        const otherNightMessagePresets = parseMessagePresetsField(formData.get('otherNightMessagePresets'));
        if (!firstNightMessagePresets || !otherNightMessagePresets) {
            return fail(400, {error: 'Invalid communications' });
        }

        // Left empty, the character doesn't wake that night
        const firstNightOrder = parseNightOrderField(formData.get('firstNightOrder'));
        const otherNightOrder = parseNightOrderField(formData.get('otherNightOrder'));

        const character = updateCharacter(id, {name, category, rules, setup: setup.trim(), firstNightOrder, otherNightOrder, firstNightReminder: firstNightReminder.trim(), otherNightReminder: otherNightReminder.trim(), firstNightMessagePresets, otherNightMessagePresets});

        if(!character){
            return fail(404, {error: 'Character not found'});
        }

        return { success: true, ...character};
    }
}
