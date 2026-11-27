# Credentials and `SECRETS_KEY`

[← Documentation home](README.md)

Clockmaker can use three outside services, each needing credentials. They can be set in the app, or as environment
variables:

| Service | Set in the app at | Environment variables |
| --- | --- | --- |
| Spotify | [Settings → Music Library](settings/music.md#spotify), Spotify tab | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |
| Turnstile bot check for the feedback form | [Settings → Feedback](settings/feedback.md#setup), Setup tab | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| Feedback emails | [Settings → Feedback](settings/feedback.md#setup), Setup tab | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FEEDBACK_TO_EMAILS` |

Changes made in the app apply straight away, with no restart.

## Secrets are write-only

Once a secret (a client secret, secret key or app password) is saved in the app, it is never shown again, not even
to you. The app only says whether it's **Set**. To change it, type the new one and save. Leaving the field empty
keeps the saved one, and **Clear** removes it. The settings that aren't secret (the client ID, site key and email
addresses) are shown and edited normally.

## Turning it on: `SECRETS_KEY`

Credentials set in the app are saved in one encrypted file in the data directory (`secrets/services.enc.json`).
The encryption key comes from the `SECRETS_KEY` environment variable, so a copy of the data directory (a backup,
say) doesn't give the secrets away unless the key goes with it. Until `SECRETS_KEY` is set, the fields can't be saved.

Set it to a long random passphrase, for example in your `.env` file:

```sh
echo "SECRETS_KEY=$(openssl rand -base64 32)" >> .env
docker compose up -d
```

Keep it somewhere other than the data directory. If it's lost or changed, the saved credentials can't be read any
more. The app then says so and treats them all as not set, and you enter them again. Nothing else is affected.

> Anyone who can get into the server itself can read `SECRETS_KEY`, as they could the environment variables. The
> encryption protects copies of the data directory, not a compromised server.

## Environment variables still work

An environment variable wins over the same setting saved in the app: the app shows **Set by environment variable**
for it, and it can't be changed there. See the [configuration reference](configuration.md#environment-variables).
