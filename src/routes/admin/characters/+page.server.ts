import { isValidCharacterCategory } from "$lib/database/common/types";
import { addCharacter, listCharacters, updateCharacter } from "$lib/database/server/characters";
import { fail } from "@sveltejs/kit";

export async function load(){
    const characters = await listCharacters();
    return { characters };
}

export const actions = {
    createCharacter: async ({ request }) => {
        const formData = await request.formData();
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
        
        const character = await addCharacter({name, category, rules: '', player_count: 1, wakes_first_night: false, wakes_other_nights: false});

        return { success: true, ...character};
    },

    updateCharacter: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id');
        if (typeof id !== 'string' || !id.trim() || isNaN(Number(id))) {
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

        const wakes_first_night = formData.get('wakes_first_night') === 'on';
        const wakes_other_nights = formData.get('wakes_other_nights') === 'on';
        const counts_as_player = formData.get('counts_as_player') === 'on';
        const player_count = counts_as_player ? 1 : 0;
        const playerCountNumber = Number(player_count);
        if (isNaN(playerCountNumber) || playerCountNumber < 0) {
            return fail(400, {error: 'Player count must be a non-negative number' });
        }

        const character = await updateCharacter(Number(id), {name, category, rules, wakes_first_night, wakes_other_nights, player_count: playerCountNumber});

        if(!character){
            return fail(404, {error: 'Character not found'});
        }

        return { success: true, ...character};
    }
}