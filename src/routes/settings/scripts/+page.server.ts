import { createScript, deleteScript, listScriptsWithCharacters } from "$lib/resources/server/scripts";
import { fail } from "@sveltejs/kit";

export async function load() {
    const scripts = listScriptsWithCharacters();
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
            const newScript = createScript({name, hue});
            return { success: true, id: newScript.id };
        } catch (err) {
            console.error(err);
            return fail(400, { success: false, error: 'Failed to create script' });
        }
    },
    deleteScript: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id');
        if (typeof id !== 'string' || !id.trim()) {
            return fail(400, { success: false, error: 'Invalid script id' });
        }
        try {
            const deleted = deleteScript(id);
            if (!deleted) {
                return fail(404, { success: false, error: 'Script not found' });
            }
            return { success: true };
        } catch (err) {
            console.error(err);
            return fail(400, { success: false, error: 'Failed to delete script' });
        }
    }
}