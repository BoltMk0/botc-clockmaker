import nodemailer from 'nodemailer';
import { getServiceSetting, onServiceSettingsChanged, type ServiceSettingName } from "./serviceSettings";

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

// The Gmail account may be changed in the settings
onServiceSettingsChanged(() => transporter = undefined);

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: getServiceSetting('GMAIL_USER'),
                pass: getServiceSetting('GMAIL_APP_PASSWORD'),
            },
        });
    }
    return transporter;
}

export async function sendEmail(subject: string, text: string) {
    const required: ServiceSettingName[] = ['FEEDBACK_TO_EMAILS', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'];
    for (const name of required) {
        if (!getServiceSetting(name)) {
            console.info(`Ignoring request to send email - ${name} isn't set`);
            return;
        }
    }

    const dest_emails = getServiceSetting('FEEDBACK_TO_EMAILS')!.split(';').map(e => e.trim()).filter(e => e);

    await getTransporter().sendMail({
        from: getServiceSetting('GMAIL_USER'),
        to: dest_emails,
        subject,
        text,
    });
}
