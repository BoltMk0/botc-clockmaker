<script lang="ts">
    import ClockSetter from "./ClockSetter.svelte";
    import FullDisplay from "$lib/components/FullDisplay/FullDisplay.svelte";
    import {onMount } from "svelte";
    import { type Unsubscriber } from "svelte/store";
    import { page } from "$app/state";
    import Navbar from "$lib/components/Navbar.svelte";
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
<Navbar/>
{#if model}
<div style="width: min-content; display: grid; grid-template-rows: auto auto; gap: 20px;">
    <div style="height: 300px;">
    <FullDisplay {model} displayMode='original' size={240}/>
    </div>
    <div style="">
        <ClockSetter {model} timerOptions={data.timerOptions}/>
    </div>
</div>
{/if}
