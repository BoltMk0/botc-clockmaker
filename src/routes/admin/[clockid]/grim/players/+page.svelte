<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import PlayerSeatsView from "$lib/components/PlayerSeatsView.svelte";
    import { isGrimoireStateHistory, type GrimoireStateHistory } from "$lib/resources/common/grimoireState";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    // svelte-ignore state_referenced_locally
    let grimoireState = $state<GrimoireStateHistory | null>(data.grimoireState);

    // Poll the grim state endpoint so this page reflects edits made on the grim board
    // without needing a manual refresh - there's no shared reactive store for grimoire state.
    onMount(() => {
        if (!browser) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/admin/${data.clockid}/grim/state`);
                if (!res.ok) return;
                const body = await res.json();
                if (isGrimoireStateHistory(body)) {
                    grimoireState = body;
                }
            } catch {
                // Ignore transient fetch failures; we'll just try again next tick.
            }
        }, 2000);
        return () => clearInterval(interval);
    });
</script>

<div class="players-view-page">
    <PlayerSeatsView {grimoireState} script={data.script}/>
</div>

<style>
    .players-view-page {
        position: absolute;
        inset: 0;
        background: #111;
        overflow: hidden;
    }
</style>
