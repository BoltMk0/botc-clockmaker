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

    function bump_day(delta: number) {
        if(!model) return ;
        fetch(`/api/clock/${id}/day`, {
            method: 'POST',
            body: JSON.stringify({day: model.day + 1}),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                throw new Error('Failed to set day');
            }
        }).catch(error => {
            console.error("Error setting day:", error);
        });
    }

    function startClock(params: {duration: number, ringBellAfter?: number}) {
        // send request to start clock
        fetch(`/api/clock/${id}/start`, {
            method: 'POST',
            body: JSON.stringify({
                duration: params.duration,
                ringBellAfter: params.ringBellAfter
            }),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                throw new Error('Failed to start clock');
            }
            console.log("Clock started");
        }).catch(error => {
            console.error("Error starting clock:", error);
        });
    }

</script>
<Navbar/>
{#if model}
<div style="width: min-content; display: grid; grid-template-rows: auto auto; gap: 20px;">
    <div style="height: 300px;">
    <FullDisplay {model} displayMode='original' size={240}/>
    </div>
    <div style="">
        <ClockSetter {model}/>
    </div>
</div>
{/if}
