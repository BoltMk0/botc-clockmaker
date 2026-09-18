import { BASE_SCRIPTS, previewScriptRoster } from "$lib/scraper/server/script_scraper";
import { getScriptById } from "$lib/resources/server/scripts";
import { slugify } from "$lib/resources/common/util";

export async function load() {
    const scripts = await Promise.all(BASE_SCRIPTS.map(async entry => ({
        entry,
        alreadySaved: !!getScriptById(slugify(entry.name)),
        roster: await previewScriptRoster(entry)
    })));

    return { scripts };
}
