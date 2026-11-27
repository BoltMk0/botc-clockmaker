# Settings → Feedback

[← Settings overview](README.md) · [Documentation home](../README.md)

The [feedback form](../player-pages.md#the-feedback-form) and the messages sent through it, on two tabs.

## Messages

The anonymous messages sent through the feedback form, newest first, each with the date and time it was sent.
**✕** deletes a message.

Messages are stored as files in the feedback directory (`FEEDBACK_DATA_DIR`: `/data/feedback` in the Docker image,
so they're kept in your data volume — see the [configuration reference](../configuration.md#storage)).
If email is set up, each message is also emailed when it's sent.

## Setup

**Accept feedback** turns the form on and off. It's **off** until you turn it on: while it's off, anyone opening
`/feedback` is told feedback isn't being accepted.

**Bot check** (optional): the site key and secret key of a Cloudflare Turnstile widget. With a secret key set, each
submission is checked with Turnstile. Without one, the form is open to anyone with no bot check, and only a limit of
3 messages a minute from each visitor applies. To get the keys, add a Turnstile widget for your Clockmaker's domain in
the Cloudflare dashboard (a free account is enough).

**Emails** (optional): a Gmail address and app password to send each message from, and the addresses to send it to
(separated by `;`). Without them, messages are only saved on the server.

The keys and passwords are write-only, and can only be saved here once the server has `SECRETS_KEY` set — see
[Credentials and `SECRETS_KEY`](../credentials.md). They can be set as environment variables instead.
