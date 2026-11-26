<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { pauseFillIcon } from "$lib/icons/material.js";

    // Shown while playing: the pause bars.
    let {size = 12}: {size?: number} = $props()
</script>
<MaterialIcon icon={pauseFillIcon} {size}/>
