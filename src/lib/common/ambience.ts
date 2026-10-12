import type { Resource } from "$lib/resources/common/types";

/** An ambience asset, with the name to show for it: its metadata title, or its tidied filename if it has none. */
export type AmbienceResource = Resource & {
    title: string;
};
