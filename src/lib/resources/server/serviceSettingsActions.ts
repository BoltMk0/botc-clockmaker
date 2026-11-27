import { fail, type RequestEvent } from "@sveltejs/kit";
import {
    canStoreSecrets,
    isSecretSetting,
    isServiceSettingName,
    SERVICE_SETTINGS,
    updateServiceSettings,
    type ServiceSettingName
} from "./serviceSettings";

/** The form actions ServiceSettingsForm.svelte posts to, for the server of any page that shows it. */
export const serviceSettingsActions = {
    /** Saves the fields sent. A secret's field left empty keeps it as it is. */
    saveServices: async ({ request }: RequestEvent) => {
        if (!canStoreSecrets()) return fail(503, { error: 'SECRETS_KEY is not set on the server.' });
        const formData = await request.formData();
        const changes: Partial<Record<ServiceSettingName, string>> = {};
        for (const { name } of SERVICE_SETTINGS) {
            const value = formData.get(name);
            if (typeof value !== 'string') continue;
            if (isSecretSetting(name) && !value.trim()) continue;
            changes[name] = value;
        }
        updateServiceSettings(changes);
        return { saved: true };
    },
    clearService: async ({ request }: RequestEvent) => {
        if (!canStoreSecrets()) return fail(503, { error: 'SECRETS_KEY is not set on the server.' });
        const name = (await request.formData()).get('name');
        if (typeof name !== 'string' || !isServiceSettingName(name)) return fail(400, { error: 'Unknown setting.' });
        updateServiceSettings({ [name]: '' });
        return { saved: true };
    }
};
