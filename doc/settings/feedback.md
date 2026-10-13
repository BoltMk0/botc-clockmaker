# Settings → Feedback

[← Settings overview](README.md) · [Documentation home](../README.md)

Lists the anonymous messages sent through the [feedback form](../player-pages.md#the-feedback-form), newest first,
each with the date and time it was sent. **✕** deletes a message.

Messages are stored as files in the feedback directory (`FEEDBACK_DATA_DIR`: `/data/feedback` in the Docker image,
so they're kept in your data volume — see the [configuration reference](../configuration.md#storage)).
If email is set up, each message is also emailed when it's sent.

The form itself needs `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` set to accept submissions — see
[The feedback form](../player-pages.md#the-feedback-form).
