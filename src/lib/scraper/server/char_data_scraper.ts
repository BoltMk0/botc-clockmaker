import { splitSetupFromRules, type CharacterCategory, type NewCharacter } from "$lib/resources/common/gameData";
import { addCharacter, addReminderToken, getCharacterByName, updateCharacter } from "$lib/resources/server/characters";
import { getCharacterImageResource } from "$lib/resources/server/character-images";
import { scrapeIcon } from "./char_icon_scraper";
import { decodeHtmlEntities, fetchWikiPage } from "./wiki";
import type { CharacterScrapeResult, WikiCharacterListing } from "../common/types";

// Reminder token texts aren't reliably structured on the wiki pages themselves, so they're
// pulled from the community-maintained role dataset behind the clocktower.online virtual
// grimoire, which mirrors the official reminder tokens for each character.
const ROLES_JSON_URL = 'https://raw.githubusercontent.com/bra1n/townsquare/main/src/roles.json';

type BrainRole = { name: string; reminders?: string[]; firstNight?: number; otherNight?: number; firstNightReminder?: string; otherNightReminder?: string };

let brainRolesPromise: Promise<BrainRole[]> | null = null;

function fetchBrainRoles(): Promise<BrainRole[]> {
    if (!brainRolesPromise) {
        brainRolesPromise = fetch(ROLES_JSON_URL).then(r => {
            if (!r.ok) throw new Error(`Failed to fetch roles.json: ${r.statusText}`);
            return r.json();
        }).catch(er => {
            brainRolesPromise = null;
            throw er;
        });
    }
    return brainRolesPromise;
}

async function scrapeReminderTokenTexts(name: string): Promise<string[]> {
    try {
        const roles = await fetchBrainRoles();
        return roles.find(r => r.name === name)?.reminders ?? [];
    } catch (er) {
        console.error(`Failed to fetch reminder tokens for ${name}:`, er);
        return [];
    }
}

type NightInfo = Pick<NewCharacter, 'firstNightOrder' | 'otherNightOrder' | 'firstNightReminder' | 'otherNightReminder'>;

// roles.json ranks every character on a single global first/other-night scale; 0 means the
// character doesn't wake that night at all, so that maps to no order here. It also
// carries the storyteller's reminder for each night, as the night order sheet reads it.
async function scrapeNightInfo(name: string): Promise<NightInfo> {
    try {
        const roles = await fetchBrainRoles();
        const role = roles.find(r => r.name === name);
        return {
            firstNightOrder: role?.firstNight ? role.firstNight : null,
            otherNightOrder: role?.otherNight ? role.otherNight : null,
            firstNightReminder: role?.firstNightReminder?.trim() ?? '',
            otherNightReminder: role?.otherNightReminder?.trim() ?? ''
        };
    } catch (er) {
        console.error(`Failed to fetch night order for ${name}:`, er);
        return { firstNightOrder: null, otherNightOrder: null, firstNightReminder: '', otherNightReminder: '' };
    }
}

const CATEGORY_WIKI_PAGE: Record<CharacterCategory, string> = {
    townsfolk: 'Category:Townsfolk',
    outsider: 'Category:Outsiders',
    minion: 'Category:Minions',
    demon: 'Category:Demons',
    traveler: 'Category:Travellers',
    loric: 'Category:Loric',
    fabled: 'Category:Fabled'
};

// The wiki's MediaWiki category pages list every character in that category as
// `<a href="/Some_Name" title="...">Display Name</a>` links inside a `mw-pages` div.
export async function listWikiCharacters(category: CharacterCategory): Promise<WikiCharacterListing[]> {
    const html = await fetchWikiPage(CATEGORY_WIKI_PAGE[category]);

    const pagesSectionMatch = html.match(/id="mw-pages">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
    const section = pagesSectionMatch ? pagesSectionMatch[1] : html;

    const listing: WikiCharacterListing[] = [];
    const linkRegex = /<a href="\/([^":]+)" title="[^"]*">([^<]+)<\/a>/g;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(section)) !== null) {
        const name = decodeHtmlEntities(match[2]).trim();
        const existingCharacter = getCharacterByName(name);
        listing.push({
            name,
            wikiPath: match[1],
            exists: !!existingCharacter,
            iconExists: !!existingCharacter && !!getCharacterImageResource(existingCharacter.id)
        });
    }
    return listing;
}

// The ability text lives in the first paragraph of the "Summary" section, e.g:
// <h2>...id="Summary">Summary</h2><p>"Each night*, choose a player: they die."</p>
function extractRulesText(html: string): string | null {
    const sectionMatch = html.match(/id="Summary">Summary<\/span><\/h2>([\s\S]*?)<h2/);
    if (!sectionMatch) return null;

    const firstParagraphMatch = sectionMatch[1].match(/<p>([\s\S]*?)<\/p>/);
    if (!firstParagraphMatch) return null;

    const text = decodeHtmlEntities(firstParagraphMatch[1].replace(/<[^>]+>/g, '')).trim().replace(/^"|"$/g, '').trim();
    return text || null;
}

export async function scrapeCharacter(category: CharacterCategory, name: string, wikiPath: string): Promise<CharacterScrapeResult> {
    console.log("Scraping character data", name);
    try {
        const html = await fetchWikiPage(wikiPath);
        const abilityText = extractRulesText(html);
        if (!abilityText) {
            return { status: 'error', error: 'Could not find ability text on wiki page' };
        }
        const { rules, setup } = splitSetupFromRules(abilityText);
        const nightInfo = await scrapeNightInfo(name);
        const existing = getCharacterByName(name);

        const newCharacter: NewCharacter = {
            name,
            category,
            rules,
            setup,
            player_count: 1,
            ...nightInfo,
            // Characters newer than roles.json have no published place in the night order: keep any set by hand
            firstNightOrder: nightInfo.firstNightOrder ?? existing?.firstNightOrder ?? null,
            otherNightOrder: nightInfo.otherNightOrder ?? existing?.otherNightOrder ?? null
        };

        const character = existing ? updateCharacter(existing.id, newCharacter)! : addCharacter(newCharacter);

        if (character.reminderTokens.length === 0) {
            const reminderTexts = await scrapeReminderTokenTexts(name);
            for (const text of reminderTexts) {
                addReminderToken(character.id, { text, textSize: 46 });
            }
        }

        const iconResult = await scrapeIcon(character);

        return {
            status: existing ? 'updated' : 'created',
            iconStatus: iconResult.status,
            iconError: iconResult.error
        };
    } catch (er: any) {
        console.error(`Failed to scrape character ${name}:`, er);
        return { status: 'error', error: er.message };
    }
}
