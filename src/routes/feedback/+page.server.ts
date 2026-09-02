import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { sendEmail } from "$lib/resources/server/mailer";
import { TURNSTILE_SECRET_KEY } from "$env/static/private";
import { existsSync, mkdirSync, writeFileSync } from "fs";

const FEEDBACK_DIR = process.env.FEEDBACK_DATA_DIR || "data/feedback";
if (!existsSync(FEEDBACK_DIR)) mkdirSync(FEEDBACK_DIR, { recursive: true });

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

        const token = formData.get('cf-turnstile-response')?.toString();
        if (!token) return fail(400, { success: false });

        const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: token }),
        }).then(r => r.json() as Promise<{ success: boolean; action?: string; hostname?: string }>);

        if (!verification.success || verification.action !== 'feedback') {
            return fail(400, { success: false });
        }

        const text = formData.get('text')?.toString().trim();

        if(!text) return fail(400, { success: false });
        if(text.length > MAX_LEN) return fail(400, { success: false });

        if(rateLimited(getClientAddress())) return fail(429, { success: false });

        sendEmail('Feedback', text).catch(e=>{
            console.warn('Failed to send email:', (e instanceof Error ? e.message : e));
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        writeFileSync(`${FEEDBACK_DIR}/${timestamp}.txt`, text, 'utf8');

        return {success: true};
    }
}
