import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
    createSessionToken, isPasswordSet, safeRedirectTarget, setInitialPassword,
    SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, verifyPassword
} from "$lib/auth/server/auth";

const MIN_PASSWORD_LENGTH = 4;

export const load: PageServerLoad = () => ({ needsSetup: !isPasswordSet() });

export const actions: Actions = {
    default: async ({ request, cookies, url }) => {
        const form = await request.formData();
        const password = String(form.get('password') ?? '');
        const needsSetup = !isPasswordSet();

        if (needsSetup) {
            const confirm = String(form.get('confirm') ?? '');
            if (password.length < MIN_PASSWORD_LENGTH) {
                return fail(400, { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
            }
            if (password !== confirm) {
                return fail(400, { error: 'Passwords do not match.' });
            }
            if (!setInitialPassword(password)) {
                return fail(400, { error: 'A password has already been set.' });
            }
        } else if (!verifyPassword(password)) {
            return fail(401, { error: 'Incorrect password.' });
        }

        cookies.set(SESSION_COOKIE, createSessionToken(), {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: SESSION_MAX_AGE_SECONDS
        });

        redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
    }
};
