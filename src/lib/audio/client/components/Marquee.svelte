<script lang="ts">
    /**
     * One line of text that, when it's too long to fit, scrolls along to show the rest - like the track title on a
     * music player. It holds at the start for a moment, scrolls, and loops round seamlessly (it's followed by a copy of
     * itself). Takes the font from wherever it's put.
     */
    let { text }: { text: string } = $props();

    /** Space between the end of the text and the copy following it. */
    const GAP_PX = 40;
    const SPEED_PX_PER_S = 30;
    /** How long it holds at the start of each loop, so the beginning can be read. */
    const HOLD_MS = 2500;

    let containerWidth = $state(0);
    let textWidth = $state(0);
    let track = $state<HTMLElement>();
    const overflowing = $derived(textWidth > containerWidth + 1);

    $effect(() => {
        if (!track || !overflowing) return;
        const distance = textWidth + GAP_PX;
        const duration = HOLD_MS + distance / SPEED_PX_PER_S * 1000;
        const animation = track.animate([
            { transform: 'translateX(0)', offset: 0 },
            { transform: 'translateX(0)', offset: HOLD_MS / duration },
            { transform: `translateX(-${distance}px)`, offset: 1 }
        ], { duration, iterations: Infinity });
        return () => animation.cancel();
    });
</script>

<div class="marquee" class:overflowing bind:clientWidth={containerWidth}>
    <div class="track" bind:this={track}>
        <span bind:clientWidth={textWidth}>{text}</span>
        {#if overflowing}<span aria-hidden="true" style:padding-left="{GAP_PX}px">{text}</span>{/if}
    </div>
</div>

<style>
    .marquee {
        overflow: hidden;
        white-space: nowrap;
    }

    /* Soft edges only while scrolling; the left one is narrow so the start of the text still reads while it holds */
    .marquee.overflowing {
        mask-image: linear-gradient(to right, transparent, black 4px, black calc(100% - 16px), transparent);
    }

    .track {
        display: inline-flex;
    }

    .track span {
        display: inline-block;
    }
</style>
