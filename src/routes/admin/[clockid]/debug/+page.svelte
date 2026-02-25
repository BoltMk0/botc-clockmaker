<script lang="ts">
    import { ClientModel } from "$lib/client/model";
    import FullDisplay from "$lib/common/FullDisplay/FullDisplay.svelte";
    import OffsetDisplay from "./OffsetDisplay.svelte";
    import { onMount } from "svelte";

    let audio: HTMLAudioElement;
    let audio2: HTMLAudioElement;
    let model = new ClientModel();

    let timeOnDevice = Date.now();
    $: timeOnServer = timeOnDevice - (model.deltaTimeManager.minDeltaToServerTime ?? 0);

    onMount(()=>{
        model.init({finalBellAudioPlayer: audio, reminderBellAudioPlayer: audio2});
        setInterval(() => {
            timeOnDevice = Date.now();
        }, 1000);
    })
</script>

<audio bind:this={audio} preload="auto"></audio>
<audio bind:this={audio2} preload="auto"></audio>
<div>
    <FullDisplay {model} size={400} />
    <div>
        <table>
            <tbody>
                <tr>
                    <th>Time on Device</th>
                    <td>{timeOnDevice}</td>
                    <td>{new Date(timeOnDevice).toLocaleString()}</td>
                </tr>
                <tr>
                    <th>Time on Server</th>
                    <td>{timeOnServer}</td>
                    <td>{new Date(timeOnServer).toLocaleString()}</td>
                </tr>
            </tbody>
        </table>
    </div>
    <OffsetDisplay {model} />
</div>

<style>
    table {
        border-collapse: collapse;
    }
    th, td {
        border: 1px solid #FFF3;
        padding: 4px 8px;
    }

    th {
        background-color: #FFF2;
    }
</style>