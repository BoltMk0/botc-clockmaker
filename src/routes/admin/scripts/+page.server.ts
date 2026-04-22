import { listCharacters } from "$lib/database/server/characters";
import { createScript, deleteScript, listScripts, listScriptsWithCharacters } from "$lib/database/server/scripts";
import { fail } from "@sveltejs/kit";

export async function load() {
    const scripts = await listScripts();
    return {scripts};
}


export const actions = {
    createScript: async ({ request }) => {
        const formData = await request.formData();
        const name = formData.get('name') as string;
        const hue = formData.get('hue') as string || '#c45d5d';
        if (typeof name !== 'string' || name.trim() === '') {
            return fail(400, { success: false, error: 'Name is required' });
        }
        try {
            const newScript = await createScript({name, hue}); // This should be replaced with an actual createScript function that inserts into the database and returns the new script's ID
            return { success: true, id: newScript.id };
        } catch (err) {
            console.error(err);
            return fail(400, { success: false, error: 'Database error' });
        }
    },
    deleteScript: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));
        if (!Number.isInteger(id)) {
            return fail(400, { success: false, error: 'Invalid script id' });
        }
        try {
            const deleted = await deleteScript(id);
            if (!deleted) {
                return fail(404, { success: false, error: 'Script not found' });
            }
            return { success: true };
        } catch (err) {
            console.error(err);
            return fail(400, { success: false, error: 'Database error' });
        }
    }
}