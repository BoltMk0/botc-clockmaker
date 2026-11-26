<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { playArrowFillIcon } from "$lib/icons/material.js";

    // Shown while paused: the play arrow.
    let {size = 12}: {size?: number} = $props();
</script>
<MaterialIcon icon={playArrowFillIcon} {size}/>
