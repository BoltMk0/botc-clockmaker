<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { inkPenFillIcon } from "$lib/icons/material.js";

    // A pen in its ink's colour. Sized by style (e.g. to fill its button).
    let { color = 'currentColor', style = '' }: { color?: string; style?: string } = $props();
</script>

<MaterialIcon icon={inkPenFillIcon} size="100%" {color} {style}/>
