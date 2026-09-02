import nodemailer from 'nodemailer';
import { env } from "$env/dynamic/private";

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: env.GMAIL_USER,
                pass: env.GMAIL_APP_PASSWORD,
            },
        });
    }
    return transporter;
}

export async function sendEmail(subject: string, text: string) {
    const required_env_varnames = ['FEEDBACK_TO_EMAILS', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'];
    for(const name of required_env_varnames){
        if(env[name] === undefined){
            console.info(`Ignoring request to send email - ${name} missing from environment vars`);
            return;
        }
    }
    
    const dest_emails = env.FEEDBACK_TO_EMAILS!.split(';');

    await getTransporter().sendMail({
        from: env.GMAIL_USER,
        to: dest_emails,
        subject,
        text,
    });
}
