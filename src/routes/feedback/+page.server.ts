import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { sendEmail } from "$lib/resources/server/mailer";
import { getServiceSetting } from "$lib/resources/server/serviceSettings";
import { writeFileSync } from "fs";
import { FEEDBACK_DIR, isFeedbackEnabled, isTurnstileEnabled } from "$lib/resources/server/feedback";

const MAX_LEN = 5000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

/** The original deployment's Turnstile widget, used when TURNSTILE_SITE_KEY isn't set. */
const DEFAULT_TURNSTILE_SITE_KEY = "0x4AAAAAAEk55R9-W9ZS1kzr";

// Read at runtime, so self-hosters can use their own Turnstile widget without rebuilding the image.
// Without a secret key there's no Turnstile check, so no widget either (siteKey null).
export const load: PageServerLoad = () => ({
    enabled: isFeedbackEnabled(),
    siteKey: isTurnstileEnabled() ? (getServiceSetting('TURNSTILE_SITE_KEY') || DEFAULT_TURNSTILE_SITE_KEY) : null
});

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

        if (!isFeedbackEnabled()) return fail(403, { success: false, disabled: true });

        // Read at runtime rather than baked into the build, so the secret stays out of the image.
        // Without one, submissions aren't checked with Turnstile: only the honeypot and rate limit apply.
        const secret = getServiceSetting('TURNSTILE_SECRET_KEY');
        if (secret) {
            const token = formData.get('cf-turnstile-response')?.toString();
            if (!token) return fail(400, { success: false });

            const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret, response: token }),
            }).then(r => r.json() as Promise<{ success: boolean; action?: string; hostname?: string }>);

            if (!verification.success || verification.action !== 'feedback') {
                return fail(400, { success: false });
            }
        }

        const text = formData.get('text')?.toString().trim();

        if(!text) return fail(400, { success: false });
        if(text.length > MAX_LEN) return fail(400, { success: false });

        if(rateLimited(getClientAddress())) return fail(429, { success: false });

        sendEmail('Feedback', text).catch(e=>{
            console.warn('Failed to send email:', (e instanceof Error ? e.message : e));
        });

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            writeFileSync(`${FEEDBACK_DIR}/${timestamp}.txt`, text, 'utf8');
            console.log(`Saved feedback to ${timestamp}.txt`);
        } catch(er){
            console.warn(`Failed to save feedback to storage:`, er instanceof Error ? er.message : er);
        }

        return {success: true};
    }
}
