<script lang="ts">
    // A yellow warning triangle marking a bluff that's in play. Bluffing an in-play character is allowed, so this
    // only points it out to the storyteller; it's never shown on pages the players see.

    let { size = '24px', style = '', title = 'In play' }: { size?: string; style?: string; title?: string } = $props();
</script>

<svg class="in-play-warning" viewBox="0 0 24 24" width={size} height={size} {style} role="img" aria-label={title}>
    <title>{title}</title>
    <path d="M12 2.2 1.2 21h21.6L12 2.2Z" fill="#f5c518" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M12 8.6v6.2" stroke="#000" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="12" cy="18" r="1.4" fill="#000"/>
</svg>

<style>
    .in-play-warning {
        flex-shrink: 0;
        filter: drop-shadow(0 1px 2px #0008);
        pointer-events: auto;
    }
</style>
