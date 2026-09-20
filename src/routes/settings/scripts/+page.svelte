<script lang="ts">
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import type { Character } from "$lib/resources/common/gameData";
    import CustomOverlay from "$lib/components/CustomOverlay.svelte";

    let { data }: { data: {scripts: any[], characters: Character[]} } = $props();


    function selectScript(scriptId: string) {
        location.href = `/settings/scripts/${scriptId}`;
    }

    function deleteScript(scriptId: string) {
        fetch(`?/deleteScript`, { method: 'POST' }).then(response => {
            if (!response.ok) {
                alert('Failed to delete script');
            } else {
                location.reload();
            }
        }).catch(er => {
            alert(`Failed to delete script: ${er}`);
        });
    }

    let deleteActionContent: string | undefined = $state();

</script>


<style>
    .scripts-main {
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
    }

    .scripts-main-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1.5rem;
    }

    .scripts-main-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .scripts-contents {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.7em;
        min-width: 32em;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
    }

    .script-card {
        border-radius: 10px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border-left: 4px solid var(--script-hue);
        overflow: hidden;
    }
    .script-card.clickable {
        cursor: pointer;
    }
    .script-card.clickable:hover {
        background-color: var(--theme-bg-tertiary);
    }

    .script-card-header {
        display: flex;
        align-items: center;
        gap: 1em;
        padding: 0.8em 1em;
    }
    .script-swatch {
        width: 1.2em;
        height: 1.2em;
        border-radius: 50%;
        background: var(--script-hue);
        flex-shrink: 0;
    }
    .script-title {
        flex: 1;
        min-width: 0;
    }
    .script-name {
        font-weight: 600;
        font-size: 1.05em;
    }
    .script-subtitle {
        font-size: 0.8em;
        opacity: 0.7;
    }
</style>

<div style="display: flex; justify-content: center; align-items: flex-start; height: 100%; width: 100%; box-sizing: border-box; padding: 1.5rem; overflow-y: auto;">

    
<div class="scripts-main">
    <div class="scripts-main-header">
        <h2>Scripts</h2>
        <div style="display: flex; gap: 0.5em;">
        <a class="button-style" href="scripts/scraper">Wiki Scraper</a>
        <CustomOverlay title="Create New Script" buttonTitle="+">
            <form action="?/createScript" method="POST" use:enhance={()=>{
                return async ({result}) => {
                    switch(result.type){
                        case 'success':
                            const id = result.data!.id;
                            if(!id) {
                                alert('Failed to create script: No ID returned');
                                return;
                            }
                            goto(`/settings/scripts/${id}`);
                            break;
                        case 'redirect':
                            // Do nothing, the browser will handle the redirect
                            break;
                        case 'failure':
                            alert(`Failed to create script: ${result.data?.error || 'Unknown error'}`);
                            break;
                        case 'error':
                            alert(`Failed to create script: ${result.error}`);
                            break;
                    }
                }
            }}>
                <div style="display: flex; justify-content: center;">
                    
                <table>
                    <tbody>
                        <tr>
                            <th>Name</th>
                            <td><input name="name" required placeholder="Script Name"/></td>
                        </tr>
                        <tr>
                            <th>Colour</th>
                            <td><input type="color" name="hue" value="#c45d5d" style="width: 100%; height: 2em; padding: 0;"/></td>
                        </tr>
                        <tr>
                            <td colspan="2">
                                <button style="width: 100%;" type="submit">Create</button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                </div>

            </form>
        </CustomOverlay>
        </div>
    </div>
    <p class="description">Manage the scripts available across all games.</p>
    <div class="scripts-contents">
        {#each data.scripts as script(script.id)}
            <div class="script-card clickable" style="--script-hue: {script.hue};" onclick={()=>selectScript(script.id)} role="button" tabindex="0" onkeydown={(e)=>{ if(e.key === 'Enter' || e.key === ' ') selectScript(script.id); }}>
                <div class="script-card-header">
                    <div class="script-swatch"></div>
                    <div class="script-title">
                        <div class="script-name">{script.name}</div>
                        <div class="script-subtitle">{script.characters.length} character{script.characters.length === 1 ? '' : 's'}</div>
                    </div>
                    <button class="button-style" onclick={()=>selectScript(script.id)}>
                        Edit
                    </button>
                    <div onclick={(e)=>e.stopPropagation()} role="presentation">
                    <CustomOverlay title="Confirm Delete" buttonTitle="Delete">
                        <form action="?/deleteScript" method="POST" use:enhance={()=>{
                            return async ({result}) => {
                                switch(result.type){
                                    case 'success':
                                        location.reload();
                                        break;
                                    case 'redirect':
                                        // Do nothing, the browser will handle the redirect
                                        break;
                                    case 'failure':
                                        alert(`Failed to delete script: ${result.data?.error || 'Unknown error'}`);
                                        break;
                                    case 'error':
                                        alert(`Failed to delete script: ${result.error}`);
                                        break;
                                }
                            }
                        }}>
                            <input hidden name="id" value={script.id}/>
                            <div>Are you sure you want to delete this script? This action cannot be undone.</div>
                            <div style="width: 100%;">
                            <input bind:value={deleteActionContent} placeholder={`Type '${script.name}' to confirm`} style="width: 100%; text-align: center;"/>
                            </div>
                            <button class="button-style" class:error={deleteActionContent === script.name} type="submit" style="width: 100%; margin-top: 0.5em;">
                                {deleteActionContent === script.name ? 'Confirm Delete' : `Enter '${script.name}' to enable`}
                            </button>
                        </form>
                    </CustomOverlay>
                    </div>
                </div>
            </div>
        {/each}
    </div>

</div>

</div>