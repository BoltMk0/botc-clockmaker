<script lang="ts">
    import { enhance } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import CustomOverlay from "$lib/common/CustomOverlay.svelte";
    import { ACCEPTED_RESOURCE_EXTENSIONS, ALL_RESOURCE_TYPES, type Resource } from "$lib/common/resources";
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import ResourceThumb from "./ResourceThumb.svelte";
    import Navbar from "$lib/common/Navbar.svelte";


    export let data: { resources: Resource[] };

    let size: number;


    let showUploadOverlay = false;
    $: console.log(showUploadOverlay);

    $: resourceTypes = ALL_RESOURCE_TYPES;
    $: sortedResources = resourceTypes.map(type => {
        return {
            type,
            resources: data.resources.filter(r => r.type === type)
        }
    });
    
    const visibleResourceType = writable<string | null>(null);

    onMount(() => {
        if(sortedResources.length > 0){
            visibleResourceType.set(sortedResources.find(r => r.resources.length > 0)?.type ?? null);
        }
    });


    function deleteResource(id: string){
        if(confirm("Are you sure you want to delete this resource? This action cannot be undone.")){
            fetch(`/admin/api/resources/${id}`, {
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

<Navbar clients={[]} bind:size={size}/>
<div class="resources-main">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 40px;">
        <h1>Resources</h1>
        <CustomOverlay title="Upload new Resource" bind:visible={showUploadOverlay} >
            <form action="?/newResource" method="post" enctype="multipart/form-data" use:enhance={() => {
                return async({result, update})=>{
                    if(result.type === "success"){
                        showUploadOverlay = false;
                        update();
                        await invalidateAll();
                    } else {
                        alert("Failed to upload resource");
                    }
                }
            }}>
                <input type="text" name="name" placeholder="Resource Name"/>
                <input type="file" name="file" required multiple={false} accept="{ACCEPTED_RESOURCE_EXTENSIONS.join(',')}"/>
                <button type="submit" class="button-style">Upload</button>
            </form>
        </CustomOverlay>
    </div>

    <div class="resource-explorer-main">
        <div class="resource-explorer-type-list">
            {#each resourceTypes as type}
                <button class="resource-type-item" class:active={$visibleResourceType === type} disabled={sortedResources.find(r => r.type === type)?.resources.length === 0} on:click={() => visibleResourceType.set(type)}>
                    {type}
                </button>
            {/each}
        </div>
        <div class="resource-explorer-list">
            {#each sortedResources.find(r => r.type === $visibleResourceType)?.resources ?? [] as resource}
                <ResourceThumb data={resource} onDelete={deleteResource} />
            {/each}
        </div>
    </div>
</div>
