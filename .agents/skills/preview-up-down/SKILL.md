---
name: preview-up-down
description: Put one self-contained HTML preview of a rig page on a public https link for review, and take it down again after the review (ADR 0003). Use for a plan's "Preview for review" and "Clean up" issues.
---

# preview-up-down

The review bucket is Workers KV plus a small Worker on workers.dev, in the Cloudflare account
`ArchieHQR` (`7900f87f432b35f4c98e2a7479ee801f`). R2 is not enabled on that account. Reach it
through the Cloudflare MCP server (`execute` tool, Cloudflare API). Never commit the preview.

## Up

1. Run rig (`pnpm start`, any free `PORT`) and save the page with a command, outside the repo:
   `curl -sS -f -o ../preview/<page>-<night>.html http://localhost:<port>/<path>`
   Check: lane banner with the marker is in it, no `<script>`, no `<link>`, no `src=`/`href=` to
   other hosts.
2. Create a KV namespace `rig-review` and put the file under one key `<page>-<night>.html`
   (`PUT /accounts/{id}/storage/kv/namespaces/{ns}/values/{key}`, raw body). Read it back.
3. Upload the Worker `rig-review` (module, binding `PREVIEWS` -> the namespace). It serves
   `GET /<key>.html` from KV with `content-type: text/html; charset=utf-8`,
   `cache-control: no-store`, `x-robots-tag: noindex`; anything else is 404.
4. Turn on its workers.dev route (`POST .../workers/scripts/rig-review/subdomain`
   `{enabled: true}`). The account subdomain is `archiehq`.
5. Open `https://rig-review.archiehq.workers.dev/<key>.html` from outside (curl): 200,
   `text/html; charset=utf-8`, and `cmp` equal to the local file. Only then send the link.

## Down (only after the reviewer has looked)

1. Delete the KV key, the Worker `rig-review` (`?force=true`) and the namespace.
2. Check the link: it must not return the page (it returns 404, `error code: 1042`).
3. Delete the local preview file.

An issue that sends the preview is not done when the link is sent. It is done when the reviewer
has looked.
