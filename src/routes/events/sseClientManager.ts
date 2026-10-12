import type { WSMessage } from "$lib/common/comms";
import type { Unsafe } from "sveltekit-sse";
import { v7 } from "uuid";

export type emit_cb = (eventName: string, data: string)=>Unsafe<void, Error>;

export class SSEClientManager {
    #emitters = new Set<emit_cb>();

    broadcast(message: WSMessage) {
        const messageStr = JSON.stringify(message);
        for(const emitter of [...this.#emitters]){
            const {error} = emitter('message', messageStr);
            if(error){
                console.error("Error emitting to client:", error);
                this.deleteClient(emitter);
            }
        }
    }

    addClient(emit_cb: emit_cb){
        this.#emitters.add(emit_cb);
        return ()=>{this.deleteClient(emit_cb)}
    }

    deleteClient(emit_cb: emit_cb){
        if(this.#emitters.has(emit_cb)){
            this.#emitters.delete(emit_cb);
            console.log("Client disconnected", emit_cb);
        }
    }

    setupClient(emit_cb: emit_cb, setup:(cb: (msg: WSMessage)=>void)=>void){
        setup((msg: WSMessage)=>{
            let data = JSON.stringify(msg);
            emit_cb('message', data);
        });
        return this.addClient(emit_cb);
    }
}
