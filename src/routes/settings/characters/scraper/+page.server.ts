import { CHARACTER_CATEGORIES } from "$lib/resources/common/gameData";
import { listWikiCharacters } from "$lib/scraper/server/char_data_scraper";

export async function load() {
    const listingsByCategory = Object.fromEntries(
        await Promise.all(
            CHARACTER_CATEGORIES.map(async category => [category, await listWikiCharacters(category)] as const)
        )
    );

    return { listingsByCategory };
}
