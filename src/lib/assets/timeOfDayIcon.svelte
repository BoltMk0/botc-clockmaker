<script lang="ts">
    import type { TimeOfDay } from "$lib/model/client/types";
    import DayIcon from "./dayIcon.svelte";
    import DuskIcon from "./duskIcon.svelte";
    import NightIcon from "./nightIcon.svelte";

    let { timeOfDay, size = 16, color = "currentColor" }: { timeOfDay: TimeOfDay; size?: number; color?: string } = $props();
</script>

{#if timeOfDay === 'day'}
<DayIcon {size} {color}/>
{:else if timeOfDay === 'dusk'}
<DuskIcon {size} {color}/>
{:else}
<NightIcon {size} {color}/>
{/if}
