<script lang="ts">
    import ClockSetter from "./ClockSetter.svelte";
    import {onMount } from "svelte";
    import { type Unsubscriber } from "svelte/store";
    import { page } from "$app/state";
    import type { PageData } from './$types';
    import { Clocktower } from "$lib/model/client/Clocktower.svelte";
    import { browser } from "$app/environment";

    let { data }: { data: PageData } = $props();

    const id = page.params.clockid
    let model: Clocktower|null = $state(null);

    onMount(()=>{
        if(!browser) return;
        console.log("Admin page for clock", id, "is mounting, initializing model and subscribing to comms state");
        model = new Clocktower(data.model);
        return ()=>{
            model?.close();
        }
    });

</script>
<a class="back-button" href="/admin/{id}/storytell" aria-label="Back to Storytell">
    <svg width={36} height={36} viewBox="0 0 24 24" style="fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;">
        <path d="M15 5l-7 7 7 7" />
    </svg>
</a>
{#if model}
<!-- grim setup/view/delete live on the storytell page now, so hide them here -->
<ClockSetter {model} timerOptions={data.timerOptions} hasGrim={data.hasGrim} inGrim={true}/>
{/if}

<style>
    .back-button {
        position: absolute;
        top: 10px;
        left: 10px;
        display: flex;
        color: var(--theme-on-bg);
        opacity: 0.85;
        z-index: 1000;
    }

    .back-button:hover {
        opacity: 1;
    }
</style>
