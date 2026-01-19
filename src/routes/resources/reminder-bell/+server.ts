import { redirect } from "@sveltejs/kit";

export async function GET(){
    // TODO. For now, just redirect to final-bell resource
    return redirect(307, '/resources/final-bell');
}
