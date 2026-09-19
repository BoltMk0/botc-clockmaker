<script lang="ts">
    import ClockSetter from "./ClockSetter.svelte";
    import {onMount } from "svelte";
    import { type Unsubscriber } from "svelte/store";
    import { page } from "$app/state";
    import TopNavbar from "$lib/components/TopNavbar.svelte";
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
<TopNavbar/>
{#if model}
<!-- grim setup/view/delete live on the storytell page now, so hide them here -->
<ClockSetter {model} timerOptions={data.timerOptions} hasGrim={data.hasGrim} inGrim={true}/>
{/if}
