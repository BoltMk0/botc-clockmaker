<script lang="ts">
    import { ICON_VIEWBOX } from "./material.js";

    // A Material Symbol (from $lib/icons/material), coloured like text and lined up with it when inline.
    let { icon, size = 24, color = "currentColor", style = "", title }: {
        /** The icon's path, e.g. editIcon. */
        icon: string;
        /** In pixels, or any CSS length. */
        size?: number | string;
        color?: string;
        style?: string;
        /** Read out (and shown on hover) when set; otherwise the icon is hidden from screen readers. */
        title?: string;
    } = $props();

    const length = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

<svg viewBox={ICON_VIEWBOX} width={length} height={length} fill={color} style="flex-shrink: 0; vertical-align: -0.25em; {style}" focusable="false"
    role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} aria-label={title}>
    {#if title}<title>{title}</title>{/if}
    <path d={icon}/>
</svg>
