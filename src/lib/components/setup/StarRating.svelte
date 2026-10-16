<script lang="ts">
    import { PRESET_MAX_RATING } from "$lib/resources/common/gameData.js";

    interface Props {
        rating: number | null | undefined;
        /** When given, the stars are buttons that set the rating; clicking the current rating clears it. */
        onchange?: (rating: number | null) => void;
    }

    let { rating, onchange }: Props = $props();

    const stars = Array.from({ length: PRESET_MAX_RATING }, (_, i) => i + 1);
</script>

<span class="star-rating" class:unrated={!rating} title={rating ? `${rating} out of ${PRESET_MAX_RATING} stars` : 'Not rated'}>
    {#each stars as star}
        {#if onchange}
            <button type="button" class:filled={!!rating && star <= rating} aria-label={`${star} star${star === 1 ? '' : 's'}`} onclick={() => onchange(star === rating ? null : star)}>
                {!!rating && star <= rating ? '★' : '☆'}
            </button>
        {:else}
            <span class:filled={!!rating && star <= rating}>{!!rating && star <= rating ? '★' : '☆'}</span>
        {/if}
    {/each}
</span>

<style>
    .star-rating {
        display: inline-flex;
        white-space: nowrap;
        line-height: 1;
    }

    .star-rating.unrated {
        opacity: 0.4;
    }

    .filled {
        color: gold;
    }

    button {
        background: none;
        border: none;
        color: inherit;
        font: inherit;
        font-size: 1.5em;
        padding: 0 0.05em;
        cursor: pointer;
    }

    button.filled {
        color: gold;
    }
</style>
