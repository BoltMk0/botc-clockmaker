import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { sendEmail } from "$lib/resources/server/mailer";

const MAX_LEN = 5000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    hits.set(ip, recent);
    // crude memory bound so a flood of distinct IPs can't grow the map forever
    if (hits.size > 5000) hits.clear();
    return recent.length > MAX_PER_WINDOW;
}

export const actions: Actions = {
    default: async ({request, getClientAddress})=>{
        const formData = await request.formData();

        // Honeypot: a hidden field real users never fill. Pretend success for bots.
        if(formData.get('website')) return {success: true};

        const text = formData.get('text')?.toString().trim();

        if(!text) return fail(400, { success: false });
        if(text.length > MAX_LEN) return fail(400, { success: false });

        if(rateLimited(getClientAddress())) return fail(429, { success: false });

        sendEmail('Feedback', text).catch(e=>{
            console.warn('Failed to send email:', (e instanceof Error ? e.message : e));
        });
        return {success: true};
    }
}
