import { listRulesSlidesResoirces } from "$lib/resources/server/rules-slides";

export async function load() {
    const slides = listRulesSlidesResoirces();
    return {slides};
}
