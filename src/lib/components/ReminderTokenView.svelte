<script lang="ts">
    import type { ReminderToken } from "$lib/common/database/types";

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
        overflow: hidden;
        overflow: hidden;


        background-color: #7b563b;
        color: white;
        border: 3px solid #BA9;
        border-radius: 35%;
    }

    .reminder-token-placeholder {
        width: 100%;
        color: #000;
        text-align: center;
        overflow-wrap: normal;
        word-wrap: normal;
        box-sizing: border-box;
    }

    .reminder-token-text {
        width: 100%;
        font-size: var(--font-size);
        text-align: center;
        overflow-wrap: normal;
        word-wrap: normal;
        box-sizing: border-box;
        position: absolute;
        bottom: 0;
        min-height: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        text-shadow: 0 0 calc(var(--font-size) * 0.5) black;
        width: 100%;
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
    <div class="reminder-token-text dumbledore-font" style="--font-size: calc({size} * {data.textSize/250});">
        {data.text}
    </div>
</div>