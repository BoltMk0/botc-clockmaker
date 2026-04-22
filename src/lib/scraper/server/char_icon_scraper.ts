import type { Character } from "$lib/database/common/types";
import { setCharacterImageResource } from "$lib/resources/server/character-images";
import type { ScrapeResult } from "../common/types";

export async function scrape(origin: string, character: Character): Promise<ScrapeResult> {
    console.log("Scraping character", character.name);
    return await fetch(`${origin}/api/characters/${character.id}/img`).then(async response => {
        if(response.ok) {
            console.log("Skipping scrape for character", character.name, " - image already exists");
            return { status: 'exists' } as ScrapeResult;
        }

        if(response.status !== 404){
            // Unexpected error, log it and skip scraping for this character
            console.error(`Failed to scrape character ${character.name}: ${response.statusText} (${response.status})`);
            return { status: 'error', error: `Unexpected response ${response.statusText} (${response.status})` } as ScrapeResult;
        }

        console.log(`No image found for character ${character.name}. Scraping...`);
        const character_name_enc = character.name.replaceAll(' ', '').replaceAll(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return await fetch(`https://wiki.bloodontheclocktower.com/File:Icon_${character_name_enc}.png`).then(async scrapeResponse => {
            if (!scrapeResponse.ok) {
                console.log(`Failed to scrape character ${character.name}, no image found on wiki`);
                return { status: 'not_found' } as ScrapeResult;
            }

            const html = await scrapeResponse.text();
            // Use a regex to extract the href from the <a> tag with the correct title and class
            const regex = new RegExp(`<a[^>]+href="([^"]+)"[^>]*class="internal"[^>]*title="Icon ${character_name_enc}\\.png"`, 'i');
            const match = html.match(regex);
            if (match && match[1]) {
                var fullIconURL = `https://wiki.bloodontheclocktower.com${match[1]}`;
            } else {
                throw new Error(`Could not find icon URL for ${character.name}`);
            }
            console.log(`Found icon URL for character ${character.name}: ${fullIconURL}. Downloading...`);
            return await fetch(fullIconURL).then(async iconResponse => {
                if (!iconResponse.ok) {
                    throw new Error(`Failed to download icon for ${character.name} from ${fullIconURL}: ${iconResponse.statusText} (${iconResponse.status})`);
                }
                console.log(`Successfully scraped character ${character.name} from wiki. Uploading to server...`);
                const mimeType = iconResponse.headers.get('Content-Type') || 'application/octet-stream';
                const buf = Buffer.from(await iconResponse.arrayBuffer());

                setCharacterImageResource(character.id, buf, mimeType);

                console.log(`Successfully uploaded scraped icon for character ${character.name} to server`);
                return { status: 'scraped' } as ScrapeResult;
            });
        }).catch(er => {
            console.log(`Failed to scrape character ${character.name}: ${er}`);
            return { status: 'error', error: er.message } as ScrapeResult;
        });
    });
}
