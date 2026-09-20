import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { clearPassword, SESSION_COOKIE } from "$lib/auth/server/auth";

export const actions: Actions = {
    reset: async ({ cookies }) => {
        clearPassword();
        cookies.delete(SESSION_COOKIE, { path: '/' });
        redirect(303, '/login');
    }
};
