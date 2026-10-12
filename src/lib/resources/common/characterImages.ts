// Character images are stored full size plus at each of these widths (px, square), so places that show them
// small (character lists, the grim's token tray) can load a much lighter copy.
export const CHARACTER_IMAGE_SIZES = [128, 256] as const;

// URL of a character's image. With `size`, the server sends the smallest stored copy at least that wide (or the
// full-size image if none is); without it, the full-size image.
export function characterImageUrl(characterId: string, size?: number): string {
    const base = `/api/characters/${characterId}/img`;
    return size ? `${base}?size=${size}` : base;
}
