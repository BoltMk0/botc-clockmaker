<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { inkEraserFillIcon } from "$lib/icons/material.js";

    // An eraser, in the given colour. Sized by style (e.g. to fill its button).
    let { color, style = "" }: { color: string; style?: string } = $props();
</script>

<MaterialIcon icon={inkEraserFillIcon} size="100%" {color} {style}/>
