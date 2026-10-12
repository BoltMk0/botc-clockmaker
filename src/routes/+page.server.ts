import { listRulesSlidesResoirces } from "$lib/resources/server/rules-slides";

export async function load() {
    // Only the count is needed - the home menu hides the Rules button when there are no slides
    return { hasRulesSlides: listRulesSlidesResoirces().length > 0 };
}
