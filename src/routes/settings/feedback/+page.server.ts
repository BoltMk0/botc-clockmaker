import type { Actions, PageServerLoad } from "./$types";
import { isFeedbackEnabled, isTurnstileEnabled, listFeedback, setFeedbackEnabled } from "$lib/resources/server/feedback";
import { serviceSettingsStatus } from "$lib/resources/server/serviceSettings";
import { serviceSettingsActions } from "$lib/resources/server/serviceSettingsActions";

export const load: PageServerLoad = () => {
    return {
        entries: listFeedback(),
        enabled: isFeedbackEnabled(),
        turnstile: isTurnstileEnabled(),
        // Only whether each secret is set reaches the page, never its value
        services: serviceSettingsStatus()
    };
};

export const actions: Actions = {
    setEnabled: async ({ request }) => {
        setFeedbackEnabled((await request.formData()).get('enabled') === 'true');
    },
    ...serviceSettingsActions
};
