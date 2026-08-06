<script lang="ts">
    import { onMount } from 'svelte';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import type { PageData } from './$types';
    import MuteButton from '$lib/components/MuteButton.svelte';
    import { browser } from '$app/environment';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte';

    let { data }: { data: PageData } = $props();

    let model: Clocktower|null = $state(null);
    onMount(() => {
        if(!browser) return;
        model = new Clocktower(data.model);
        return ()=>{
            model?.close();
        }
    });


</script>

{#if model}
<FullDisplay model={model} />
{/if}

<Navbar/>


