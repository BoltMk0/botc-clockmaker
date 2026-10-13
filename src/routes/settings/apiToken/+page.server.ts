import type { Actions, PageServerLoad } from "./$types";
import { apiTokenCreatedAt, createApiToken, revokeApiToken } from "$lib/auth/server/apiToken";

export const load: PageServerLoad = () => {
    return { createdAt: apiTokenCreatedAt() };
};

export const actions: Actions = {
    create: async () => {
        return { token: createApiToken() };
    },
    revoke: async () => {
        revokeApiToken();
    }
};
