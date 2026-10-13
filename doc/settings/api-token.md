# Settings → API Token

[← Settings overview](README.md) · [Documentation home](../README.md)

The API token lets other programs, such as [Lightscapes](../lightscapes.md), use Clockmaker's API and follow its
games without the password. A program sends it with each request, as `Authorization: Bearer <token>`. It works for the
API and the games' event streams only, not the site's pages.

There's one token at a time. Only give it to programs you trust: it can do anything the clock remote can.

## Creating or replacing the token

- **Create token** makes one. It's shown **once**, so copy it straight away. Clockmaker only keeps a fingerprint of it,
  and can't show it again.
- **Replace token** (after a confirmation) makes a new one, and the old one stops working at once. Use it if you've
  lost the token, or no longer trust a program that has it, then give the new one to the programs that should keep
  access.

## Revoking it

**Revoke token** (after a confirmation) removes it, so no program can use the API until a new one is made.

Resetting the [password](password.md) doesn't change the token.
