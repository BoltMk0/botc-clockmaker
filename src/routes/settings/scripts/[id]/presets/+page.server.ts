import { redirect } from '@sveltejs/kit';

// The script's presets are listed on its page, under its characters.
export async function load({ params }) {
    redirect(308, `/settings/scripts/${params.id}#presets`);
}
