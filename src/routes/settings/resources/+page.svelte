<script lang="ts">
    import { enhance } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import CustomOverlay from "$lib/components/CustomOverlay.svelte";
    import { ALL_RESOURCE_TYPES, getAcceptedExtensionsForResourceType, type Resource, type ResourceType } from "$lib/resources/common/types";
    import { onMount, tick } from "svelte";
    import { writable } from "svelte/store";
    import ResourceThumb from "./ResourceThumb.svelte";
    import AudioResourceThumb from "./AudioResourceThumb.svelte";
    import { prettifyResourceType } from "$lib/resources/common/util";


    export let data: { resources: Resource[] };

    let selectedResourceType: ResourceType = 'grimoirestate';

    let showUploadOverlay = false;

    let isDropActive = false;
    let dragDepth = 0;
    let droppedFile: File | null = null;
    let fileInput: HTMLInputElement | null = null;

    const supportedExtensions = new Set(
        ALL_RESOURCE_TYPES.flatMap((type) => getAcceptedExtensionsForResourceType(type)).map((ext) => ext.toLowerCase())
    );

    function isSupportedResourceFile(file: File): boolean {
        const match = /(\.[^./\\]+)$/.exec(file.name.toLowerCase());
        if (!match) return false;
        return supportedExtensions.has(match[1]);
    }

    function handleDragEnter(event: DragEvent) {
        event.preventDefault();
        dragDepth += 1;
        isDropActive = true;
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "copy";
        }
    }

    function handleDragLeave(_event: DragEvent) {
        dragDepth -= 1;
        if (dragDepth <= 0) {
            dragDepth = 0;
            isDropActive = false;
        }
    }

    async function handleDrop(event: DragEvent) {
        event.preventDefault();
        dragDepth = 0;
        isDropActive = false;

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const firstSupported = Array.from(files).find(isSupportedResourceFile);
        if (!firstSupported) return;

        droppedFile = firstSupported;
        showUploadOverlay = true;

        await tick();
        if (fileInput) {
            try {
                const dt = new DataTransfer();
                dt.items.add(firstSupported);
                fileInput.files = dt.files;
            } catch {
                // Some browsers may block programmatic assignment; formData fallback handles it.
            }
        } else {
            console.warn("File input not found, cannot set dropped file programmatically");
        }
    }

    $: if (!showUploadOverlay) {
        droppedFile = null;
        if (fileInput) {
            fileInput.value = "";
        }
    }

    $: resourceTypes = ALL_RESOURCE_TYPES;
    $: sortedResources = resourceTypes.map(type => {
        return {
            type,
            resources: data.resources.filter(r => r.type === type)
        }
    });
    
    const visibleResourceType = writable<ResourceType | null>(null);

    onMount(() => {
        if(sortedResources.length > 0){
            visibleResourceType.set(sortedResources.find(r => r.resources.length > 0)?.type ?? null);
        }
    });


    function deleteResource(id: string){
        if(confirm("Are you sure you want to delete this resource? This action cannot be undone.")){
            fetch(`/api/resources/${id}`, {
                method: "DELETE"
            }).then(async response => {
                if(response.ok){
                    await invalidateAll();
                } else {
                    alert("Failed to delete resource");
                }
            });
        }
    }

</script>

<style>
    .resources-main {   
        background-color: var(--theme-bg-secondary);
        padding: 20px;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: auto 1fr;
    }
    .resource-explorer-main {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px;
        /* background-color: var(--theme-bg); */
        color: var(--theme-on-bg);
        width: 100%;
        height: 100%;
        box-sizing: border-box;
    }

    .resource-explorer-list {
        background-color: var(--theme-bg);
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 10px;
        box-sizing: border-box;
        justify-content: flex-start;
        align-items: flex-start;
        align-content: flex-start;
    }

    .resource-explorer-list.drop-active {
        outline: 2px dashed var(--theme-highlight);
        outline-offset: -4px;
    }

    .resource-explorer-type-list {
        background-color: var(--theme-bg);
        display: flex;
        flex-direction: column;
        padding: 10px;
    }

    .resource-type-item {
        background-color: var(--theme-bg);
        color: var(--theme-on-bg-secondary);
        border: none;
        padding: 10px;
        text-align: left;
        cursor: pointer;
        box-sizing: border-box;
    }

    .resource-type-item:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .resource-type-item.active {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
    }
</style>

<div class="resources-main">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 40px;">
        <h1>Resources</h1>
        <CustomOverlay title="Upload new Resource" bind:visible={showUploadOverlay} >
            <form action="?/newResource" method="post" enctype="multipart/form-data" use:enhance={({ formData }) => {
                const existing = formData.get("file");
                const existingIsFile = existing instanceof File;
                const hasExistingFile = existingIsFile && existing.size > 0;

                if (!hasExistingFile && droppedFile) {
                    formData.set("file", droppedFile);
                }

                return async ({ result, update }) => {
                    if (result.type === "success") {
                        showUploadOverlay = false;
                        update();
                        await invalidateAll();
                    } else {
                        alert("Failed to upload resource");
                    }
                };
            }}>
            
                <table>
                    <tbody>
                        <tr>
                            <th>Name</th>
                            <td>
                                <input type="text" name="name" placeholder="Resource Name"/>
                            </td>
                        </tr>
                        <tr>
                            <th>Type</th>
                            <td>
                                <select name="type" required bind:value={selectedResourceType}>
                                    <option value="" disabled selected>Select Resource Type</option>
                                    {#each ALL_RESOURCE_TYPES as type}
                                        <option value={type}>{prettifyResourceType(type)}</option>
                                    {/each}
                                </select>
                            </td>
                        </tr>
                        {#if selectedResourceType}
                            <tr>
                                <th>File</th>
                                <td>
                                      <input bind:this={fileInput} type="file" name="file" required={!droppedFile} multiple={false} accept="{getAcceptedExtensionsForResourceType(selectedResourceType).join(',')}"/>
                                </td>
                            </tr>
                        {/if}
                        <tr>
                            <td colspan="2" style="padding-top: 10px;">
                                <button style="width: 100%;" type="submit" class="button-style">Upload new {selectedResourceType} resource</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </form>
        </CustomOverlay>
    </div>

    <div class="resource-explorer-main">
        <div class="resource-explorer-type-list">
            {#each resourceTypes as type}
                <button class="resource-type-item" class:active={$visibleResourceType === type} on:click={() => visibleResourceType.set(type)}>
                    {prettifyResourceType(type)}
                </button>
            {/each}
        </div>
        <div
            class="resource-explorer-list"
            class:drop-active={isDropActive}
            role="region"
            aria-label="Resource explorer list (drop zone)"
            on:dragenter={handleDragEnter}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
            on:drop={handleDrop}
        >
            {#each sortedResources.find(r => r.type === $visibleResourceType)?.resources ?? [] as resource}
                {#if resource.type === 'sfx' || resource.type === 'music' }
                     <AudioResourceThumb resource={resource} style="flex-grow: 1; max-width: 400px;" onDelete={deleteResource} />
                {:else}
                     <ResourceThumb data={resource} onDelete={deleteResource} />
                {/if}
            {/each}

            {#if sortedResources.find(r => r.type === $visibleResourceType)?.resources.length === 0}
                <div style="color: var(--theme-on-bg-secondary); font-style: italic; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; opacity: 0.5; text-align: center;">No {$visibleResourceType} uploaded yet.<br/>Drag and drop files here to upload.</div>
            {/if}
        </div>
    </div>
</div>
