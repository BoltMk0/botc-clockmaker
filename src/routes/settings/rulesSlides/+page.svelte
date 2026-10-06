<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import BinIcon from "$lib/assets/binIcon.svelte";
    import { getAcceptedExtensionsForResourceType, type Resource } from "$lib/resources/common/types";
    import { prettifyResourceName } from "$lib/resources/common/util";

    let { data }: { data: { slides: Resource[] } } = $props();

    const acceptedExtensions = getAcceptedExtensionsForResourceType('rules-slide');

    let uploading = $state(false);
    /** Dropping files to upload: counts nested dragenter/dragleave pairs, so moving over a child doesn't end the highlight. */
    let dragDepth = $state(0);

    // ---- Reordering by dragging a slide ----

    /** The slide being dragged to reorder. */
    let draggingId: string | null = $state(null);
    /** The order shown while dragging (and until the server confirms it), as ids; null to show data.slides as is. */
    let previewOrder: string[] | null = $state(null);
    let dropped = false;

    const slides = $derived.by(() => {
        if (!previewOrder) return data.slides;
        const byId = new Map(data.slides.map(s => [s.id, s]));
        return previewOrder.map(id => byId.get(id)).filter((s): s is Resource => s !== undefined);
    });

    /** Whether a drag is files from outside the page, rather than a slide being reordered. */
    function isFileDrag(e: DragEvent) {
        return draggingId === null && (e.dataTransfer?.types.includes('Files') ?? false);
    }

    function onSlideDragStart(e: DragEvent, slide: Resource) {
        draggingId = slide.id;
        dropped = false;
        previewOrder = data.slides.map(s => s.id);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', slide.name); // Firefox won't start a drag without some data
        }
    }

    /** Moves the dragged slide to before or after the hovered one, depending on which half the pointer is over. */
    function onSlideDragOver(e: DragEvent, target: Resource) {
        if (draggingId === null || !previewOrder) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (target.id === draggingId) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const after = e.clientX > rect.left + rect.width / 2;
        const order = previewOrder.filter(id => id !== draggingId);
        const index = order.indexOf(target.id) + (after ? 1 : 0);
        order.splice(index, 0, draggingId);
        if (order.join() !== previewOrder.join()) previewOrder = order;
    }

    async function commitOrder() {
        const order = previewOrder;
        draggingId = null;
        if (!order || order.join() === data.slides.map(s => s.id).join()) {
            previewOrder = null;
            return;
        }
        const r = await fetch('/api/rulesSlides/order', {
            method: 'PUT',
            body: JSON.stringify(order),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!r.ok) alert(`Failed to save the new order (${r.status})`);
        await invalidateAll();
        previewOrder = null;
    }

    function onSlideDragEnd() {
        // A drag dropped outside the slides (or cancelled with Escape) puts everything back
        if (!dropped) {
            draggingId = null;
            previewOrder = null;
        }
    }

    function isAccepted(file: File) {
        const dot = file.name.lastIndexOf('.');
        return dot >= 0 && acceptedExtensions.includes(file.name.slice(dot).toLowerCase());
    }

    /** Uploads the files as new slides, one after another. */
    async function upload(files: File[]) {
        if (files.length === 0) return;
        uploading = true;
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                const r = await fetch('/api/rulesSlides', { method: 'POST', body: formData });
                if (!r.ok) {
                    const message = await r.json().then(j => j.message).catch(() => r.statusText);
                    alert(`Failed to upload "${file.name}" (${r.status}): ${message}`);
                }
            }
        } finally {
            uploading = false;
            await invalidateAll();
        }
    }

    async function deleteSlide(slide: Resource) {
        if (!confirm(`Delete "${prettifyResourceName(slide.name)}"? This cannot be undone.`)) return;
        const r = await fetch(`/api/rulesSlides/${encodeURIComponent(slide.id)}`, { method: 'DELETE' });
        if (!r.ok) {
            alert(`Failed to delete (${r.status})`);
            return;
        }
        await invalidateAll();
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        dragDepth = 0;
        if (draggingId !== null) {
            dropped = true;
            commitOrder();
            return;
        }
        if (!isFileDrag(e)) return;
        const files = Array.from(e.dataTransfer?.files ?? []);
        const accepted = files.filter(isAccepted);
        if (accepted.length < files.length) {
            alert(`Skipped ${files.length - accepted.length} file(s) that aren't images (${acceptedExtensions.join(', ')}).`);
        }
        upload(accepted);
    }
</script>

<div class="center-content main">
<div
    class="panel"
    class:drop-active={dragDepth > 0}
    role="region"
    aria-label="Rules slides (drop images here to upload)"
    ondragenter={(e) => { if (isFileDrag(e)) { e.preventDefault(); dragDepth++; } }}
    ondragover={(e) => { if (isFileDrag(e)) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; } else if (draggingId !== null) e.preventDefault(); }}
    ondragleave={(e) => { if (isFileDrag(e)) dragDepth = Math.max(0, dragDepth - 1); }}
    ondrop={onDrop}
>
<div class="panel-header">
    <h2>Rules Slides</h2>
    <a class="view-link" href="/rules">View slideshow</a>
</div>
<p class="description">The images the Rules slideshow cycles through, in this order. Drag a slide to move it. Drop image files here or use the button below to add them.</p>
<div class="slides" role="list">
    {#each slides as slide, i (slide.id)}
        <div class="slide" class:dragging={draggingId === slide.id} role="listitem" draggable="true"
            ondragstart={(e) => onSlideDragStart(e, slide)}
            ondragover={(e) => onSlideDragOver(e, slide)}
            ondragend={onSlideDragEnd}>
            <a class="slide-image" href="/api/resources/{slide.id}" target="_blank" rel="noopener" title="Open full size" draggable="false">
                <img src="/api/resources/{slide.id}" alt={prettifyResourceName(slide.name)} loading="lazy" draggable="false"/>
            </a>
            <div class="slide-footer">
                <span class="slide-index">{i + 1}</span>
                <span class="slide-name" title={prettifyResourceName(slide.name)}>{prettifyResourceName(slide.name)}</span>
                <button class="icon-button" onclick={() => deleteSlide(slide)} aria-label="Delete {prettifyResourceName(slide.name)}" title="Delete"><BinIcon size={18}/></button>
            </div>
        </div>
    {:else}
        <div class="empty">No rules slides uploaded.</div>
    {/each}
</div>
<label class="add-upload" class:disabled={uploading}>
    {uploading ? 'Uploading...' : '+ Rules Slide'}
    <input type="file" accept={acceptedExtensions.join(',')} multiple disabled={uploading}
        onchange={(e) => { upload(Array.from(e.currentTarget.files ?? [])); e.currentTarget.value = ''; }}/>
</label>
</div>
</div>

<style>
    .main {
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.5rem;
        align-items: flex-start;
    }

    .panel {
        width: 100%;
        max-width: 64rem;
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
    }

    .panel.drop-active {
        outline: 2px dashed var(--theme-highlight);
        outline-offset: -6px;
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
    }

    .panel-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }

    .view-link {
        color: var(--theme-on-bg-secondary);
    }

    .view-link:hover {
        color: var(--theme-highlight);
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .slides {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .slide {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        overflow: hidden;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
    }

    .slide {
        cursor: grab;
    }

    .slide.dragging {
        opacity: 0.4;
        outline: 2px dashed var(--theme-highlight);
        outline-offset: -2px;
    }

    .slide-image {
        display: block;
        aspect-ratio: 16 / 9;
        background-color: black;
    }

    .slide-image img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
    }

    .slide-footer {
        display: flex;
        align-items: center;
        gap: 0.5em;
        padding: 0.4em 0.5em;
    }

    .slide-index {
        font-weight: bold;
        opacity: 0.6;
        font-variant-numeric: tabular-nums;
    }

    .slide-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .empty {
        grid-column: 1 / -1;
        font-style: italic;
        opacity: 0.7;
        padding: 1rem 0;
        text-align: center;
    }

    button.icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.3em;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        cursor: pointer;
    }

    button.icon-button:hover {
        border-color: var(--theme-error);
        color: var(--theme-error);
    }

    /* Looks like the other "+" buttons; it's a label so clicking it opens the (hidden) file picker. */
    label.add-upload {
        display: block;
        box-sizing: border-box;
        width: 100%;
        padding: 0.3em 0.5em;
        border: 2px dashed var(--theme-slider-trim);
        border-radius: 4px;
        text-align: center;
        cursor: pointer;
        color: var(--theme-on-bg-secondary);
    }

    label.add-upload:hover {
        border-color: var(--theme-highlight);
    }

    label.add-upload.disabled {
        opacity: 0.5;
        cursor: progress;
    }

    label.add-upload input {
        display: none;
    }
</style>
