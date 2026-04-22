<script lang="ts">
    import type { ReminderToken } from "$lib/database/common/types";

    interface Props {
        data: ReminderToken;
        size?: string;
    }

    let {
        data,
        size = '150px',
    }: Props = $props();

    $inspect("ReminderToken data:", data);

    let hasImage = $state(true);
</script>

<style>
    .reminder-token-view-main {
        color-scheme: only light;
        width: var(--size);
        height: var(--size);

        position: relative;


        background-color: hsl(30, 20%, 37%);
        color: white;
        border: calc(var(--size) * 0.05) solid hsl(40, 72%, 45%);
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
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        text-transform: uppercase;
    }

    .reminder-token-text > * {
        width: 100%;
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
        height: 100%;
        width: 100%;
        object-fit: contain;
        overflow: visible;
        transform: translateY(-15%);
    }
</style>

<div class="reminder-token-view-main" style="--size: {size};">
    {#if hasImage}
        <div class="img-container">
            
            <img src="/api/characters/{data.character_id}/img" alt={data.text} onerror={() => hasImage = false}/>

        </div>
    {/if}
    <div class="reminder-token-text" style="--font-size: calc({size} * {data.textSize/250});">
        {#each data.text.split('\n') as line}
            <div>{line}</div>
        {/each}
    </div>
</div>