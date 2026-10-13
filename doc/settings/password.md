# Settings → Password

[← Settings overview](README.md) · [Documentation home](../README.md)

Clockmaker is protected by a single shared password, set the first time the site is opened (see
[First run](../first-run.md#setting-the-password)).

## Resetting the password

**Reset password** (after a confirmation) removes the current password and **signs out every device**. You're taken
straight to the sign-in page to choose a new one.

> Until a new password is set, anyone who opens the site can claim it — so set the new one straight away.

Use this to change the password, or to lock out devices you no longer trust (every device has to sign in again with
the new password).

## Forgotten the password?

If you can't sign in to reach this page, delete the password from the data directory and restart, then set a new one
on the sign-in page:

```sh
# Docker Compose, with the data volume mounted at /data
docker compose exec server rm /data/singletons/auth.json
docker compose restart
```

(Adjust the path if your data directory is elsewhere — see the
[configuration reference](../configuration.md#the-data-directory).)
