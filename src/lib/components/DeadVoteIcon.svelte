<script lang="ts">
    import deadVoteUrl from "$lib/assets/clocktower-scene/dead_vote.png";

    // Shown on a dead player's token while they still have their one dead vote.
    let { size = '1em', style = '' }: { size?: string; style?: string } = $props();
</script>

<img class="dead-vote-icon" src={deadVoteUrl} alt="Has dead vote" title="Has dead vote" width={undefined} style="width: {size}; height: {size}; {style}" draggable="false" />

<style>
    .dead-vote-icon {
        object-fit: contain;
        pointer-events: none;
        user-select: none;
    }
</style>
