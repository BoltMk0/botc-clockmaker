<script lang="ts">
    import { onMount } from "svelte";
    import type { ReminderToken } from "$lib/resources/common/gameData";
    import { fitReminderText, REMINDER_FONT_FAMILY, REMINDER_LINE_HEIGHT } from "./reminderTextFit";

    interface Props {
        data: ReminderToken;
        characterId?: string | null;
        size?: string;
    }

    let {
        data,
        characterId = null,
        size = '150px',
    }: Props = $props();

    let hasImage = $state(true);

    let isBlank = $derived(data.text.trim() === '');
    // Text is measured in the browser only, after hydration, so the first render matches the server's.
    let mounted = $state(false);
    onMount(() => { mounted = true; });
    let fit = $derived(fitReminderText(data.text, mounted));
</script>

<style>
    .reminder-token-view-main {
        color-scheme: only light;
        width: var(--size);
        height: var(--size);

        position: relative;


        background-color: hsl(281, 23%, 19%);
        color: #EEE;
        border: calc(var(--size) * 0.06) solid hsl(287, 22%, 20%);
        border-radius: 50%;
    }

    .reminder-token-text {
        font-size: var(--font-size);
        text-align: center;
        box-sizing: border-box;
        white-space: normal;
        position: absolute;
        top: 70%;
        transform: translateY(-40%);
        text-shadow: 0 0 calc(var(--font-size) * 0.5) black;
        text-align: center;
        display: flex;
        flex-direction: column;
        justify-content: center;
        left:-15%;
        width: 130%;
        font-family: var(--font-family);
        line-height: var(--line-height);
        text-transform: uppercase;
    }

    .reminder-token-text > * {
        width: 100%;
        white-space: nowrap;
        padding: 0;
        margin: 0;
    }

    .img-container {
        height: 80%;
        width: 100%;
        position: relative;
        overflow: visible;
        top: 5%;
    }

    img {
        position: absolute;
        top: 0;
        /* Explicit, so an inherited text-align: center can't shift the image's static position. */
        left: 0;
        height: 100%;
        width: 100%;
        object-fit: contain;
        overflow: visible;
        transform: translateY(-15%);
        /* A token is never an image to save: holding it on a phone mustn't open the browser's image menu. */
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
    }

    .blank-img-container {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        overflow: hidden;
    }

    .blank-img-container img {
        position: absolute;
        inset: 0;
        top: 0;
        left: 0;
        transform: none;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
</style>

<div class="reminder-token-view-main" style="--size: {size};">
    {#if isBlank}
        {#if hasImage && characterId}
            <div class="blank-img-container">
                <img src="/api/characters/{characterId}/img" alt="" draggable="false" onerror={() => hasImage = false}/>
            </div>
        {/if}
    {:else}
        {#if hasImage && characterId}
            <div class="img-container">

                <img src="/api/characters/{characterId}/img" alt={data.text} draggable="false" onerror={() => hasImage = false}/>

            </div>
        {/if}
        <div class="reminder-token-text" style="--font-size: calc({size} * {fit.font}); --font-family: {REMINDER_FONT_FAMILY}; --line-height: {REMINDER_LINE_HEIGHT};">
            {#each fit.lines as line}
                <div>{line}</div>
            {/each}
        </div>
    {/if}
</div>