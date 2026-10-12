# Player-facing pages

[← Using the grimoire](grimoire.md) · [Documentation home](README.md) · Next: [Audio overview →](audio-overview.md)

Most of Clockmaker is for the storyteller and needs the site password. These pages are meant for players.

- [The script viewer](#the-script-viewer)
- [The rules slideshow](#the-rules-slideshow)
- [The feedback form](#the-feedback-form)

## The script viewer

**Address:** `/script/<script id>` · **Needs the password:** no

A phone-friendly list of a script's characters — icon, name, ability and setup text — grouped by type. Players can
open it on their own phones to read up on the characters, without signing in.

- **Tap a character** to highlight it. Highlighted characters are gathered in a **Highlighted** section at the top —
  handy for keeping track of claims or of the characters you're considering bluffing. Highlights are remembered on
  that phone, per script.
- The **share** button shows a QR code for the page, so a player can pass it on to the person next to them.
- A **back to top** button appears once you scroll down.

How players get to it:

- the **Script QR** option on the [town square](town-square.md#the--menu) shows a QR code for the current game's
  script;
- the list icon next to the script name on a game's card on **Play**;
- **View Script** on a script's page in [Settings → Scripts](settings/scripts.md).

## The rules slideshow

**Address:** `/rules` · **Needs the password:** yes

A full-screen slideshow of the images uploaded in [Settings → Rules Slides](settings/rules-slides.md), each shown
for 14 seconds with a progress bar and a row of dots for the slide position. Good for a second screen while players
arrive, or for teaching new players.

The **Rules** button appears on the home screen once at least one slide has been uploaded.

## The feedback form

**Address:** `/feedback` · **Needs the password:** no

A simple anonymous form: players type a message and send it. Nothing is stored except what they write. Submissions
are listed in [Settings → Feedback](settings/feedback.md), and can also be emailed to you.

The form is protected against bots with Cloudflare Turnstile, and needs some setup on the server:

| Variable | Needed for |
| --- | --- |
| `TURNSTILE_SITE_KEY` | The site key of your Turnstile widget. Without it, the form uses the original Clockmaker deployment's widget, which won't work on your domain. |
| `TURNSTILE_SECRET_KEY` | **Required** — the secret key of the same widget. Without it, every submission is rejected. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FEEDBACK_TO_EMAILS` | Optional — emails each submission (from a Gmail account using an app password) to the addresses in `FEEDBACK_TO_EMAILS`, separated by `;`. Without them, feedback is only saved on the server. |

> To get the keys, add a Turnstile widget for your Clockmaker's domain in the Cloudflare dashboard (a free account
> is enough), then copy its site key and secret key into your `.env`.

A good way to share the form is a [custom QR code](settings/qr-codes.md) on the town square pointing at
`/feedback`.
