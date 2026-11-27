<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import GrimSnapshotView from '$lib/components/GrimSnapshotView.svelte';
    import { playSnapshotUrl, snapshotViewProps } from '$lib/resources/common/presetPlays';
    import type { PageData } from './$types';

    // A logged game's grim snapshot, on its own page. Its timing stats (if saved) are on a page of their own, which
    // comes back here.
    let { data }: { data: PageData } = $props();

    const viewProps = $derived(snapshotViewProps(data.play));
    const statsHref = $derived(data.play.grim?.phase_log?.length
        ? playSnapshotUrl(data.play, page.url.pathname + page.url.search, true)
        : undefined);
</script>

<svelte:head>
    <title>Grim · {viewProps.title}</title>
</svelte:head>

{#if data.play.grim}
    {#key data.play.id}
    <GrimSnapshotView
        snapshot={data.play.grim.snapshot}
        {...viewProps}
        draftKey={data.play.id}
        {statsHref}
        onclose={() => goto(data.backUrl)}
    />
    {/key}
{/if}
