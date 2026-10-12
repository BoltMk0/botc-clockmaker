<script lang="ts">
    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<!-- A phone-style dial pad: a 3x4 grid of keys -->
<svg viewBox="0 0 24 24" width={size} height={size} fill={color} stroke="none" focusable="false">
    <circle cx="6" cy="4" r="1.7"/><circle cx="12" cy="4" r="1.7"/><circle cx="18" cy="4" r="1.7"/>
    <circle cx="6" cy="9.5" r="1.7"/><circle cx="12" cy="9.5" r="1.7"/><circle cx="18" cy="9.5" r="1.7"/>
    <circle cx="6" cy="15" r="1.7"/><circle cx="12" cy="15" r="1.7"/><circle cx="18" cy="15" r="1.7"/>
    <circle cx="12" cy="20.5" r="1.7"/>
</svg>
