# Filing inspections in Dropbox

Move-ins and move-outs file themselves into the folders Beaps already uses:

```
Longstay PICTURES/
    MOVE IN/
        MIN - Folkungagatan 59 1201 Lovable/
            Hall 2026-09-07 11-11-04.jpg
            Living room 2026-09-07 11-13-22.jpg
            Walkthrough 2026-09-07 11-24-00.mp4
            MIN Folkungagatan 59, 1201.pdf
    MOVE OUT/
        MOU - ...
```

The folder is created with the first photo and fills up as the inspector works, so the office
sees a job appearing live instead of an hour later. The PDF lands in the same folder when the
report is sent or signed, and the link in the PDF points at this folder.

Photos are named by room and capture time. That sorts them in the order they were taken and
means two photos can never overwrite each other, which plain "Hall 1" would once a photo has
been deleted and the rest have renumbered.

Only move-ins and move-outs are filed. Damage, annual and shortstay inspections do not live in
this structure and are left alone.

**Nothing happens until the four secrets in step 3 are set.** Without them the app behaves
exactly as it does today, and the PDF carries the ordinary gallery link.

---

## 0. First, the one thing that is easy to get wrong

Beaps has more than one Dropbox identity: a personal account (**Beautiful Apartments**,
reservations@beaps.se) and possibly a linked team account. They are separate, and each sees
different folders.

**Whichever account you are signed in as in step 2 is the one the app will file into.** Before
you start, open [dropbox.com](https://www.dropbox.com) → **All files** and check that you can
see **Longstay PICTURES** from the account you are signed in as. If you cannot, switch account
using your avatar in the top-right corner first.

Everything else follows from that. Whether it is a personal or a team account does not matter
to the code, which detects it on its own.

## 1. Create the Dropbox app

1. Go to [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) → **Create app**.
2. Choose **Scoped access**.
3. Choose **Full Dropbox**, not App folder. The files go into your existing
   `Longstay PICTURES`, which an App-folder app cannot reach.
4. Name it something recognisable, e.g. `Beaps Besiktning`.
5. Open the **Permissions** tab and tick exactly these, then **Submit**:

   | Scope | What it is for |
   |---|---|
   | `account_info.read` | finding the team space, so files land in the team's Dropbox and not in one member's own |
   | `files.content.write` | uploading photos, video and the PDF, and creating and renaming the folder |
   | `files.metadata.read` | checking what is already there |
   | `sharing.write` | creating the folder link that goes into the PDF |
   | `sharing.read` | finding the link again on a later report |

   Set the permissions **before** step 2. A token minted earlier does not gain scopes added later.

6. On the **Settings** tab, note the **App key** and **App secret**.

## 2. Get a refresh token

Access tokens last a few hours. The refresh token is what lets the server mint new ones forever
without anyone logging in again. You do this once.

1. Open this in a browser, with your own app key pasted in:

   ```
   https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline
   ```

   Sign in as the account that should own the files and click **Allow**. Dropbox shows an
   authorisation code. Copy it.

2. Exchange the code for a refresh token, within a few minutes. On Windows, open PowerShell and
   run this as a single line, with your own values pasted in:

   ```
   curl.exe -X POST https://api.dropbox.com/oauth2/token -d code=THE_CODE -d grant_type=authorization_code -u APP_KEY:APP_SECRET
   ```

   Write `curl.exe`, not `curl`. Plain `curl` in PowerShell is something else and will fail.

3. The reply contains `"refresh_token": "..."`. That is the value you need. It does not expire,
   so treat it like a password.

## 3. Put the secrets in Cloudflare

Pages project → **Settings** → **Environment variables** → **Production**:

| Name | Value | Type |
|---|---|---|
| `DROPBOX_APP_KEY` | from step 1 | **Secret** |
| `DROPBOX_APP_SECRET` | from step 1 | **Secret** |
| `DROPBOX_REFRESH_TOKEN` | from step 2 | **Secret** |
| `DROPBOX_ROOT` | `Longstay PICTURES` | Text |
| `DROPBOX_TEAM` | leave unset for a team account, set to `no` for a personal one | Text |

Then **redeploy**: Deployments → latest → **Retry deployment**. Variables are read at build time.

Do not put any of these in `wrangler.jsonc`. That file is in git.

## 4. Check that it works

1. Do a test move-in on a junk address, take two photos, wait about ten seconds.
2. A folder should appear under `Longstay PICTURES/MOVE IN/` with the two photos in it.
3. Send the report. The PDF should arrive with a Dropbox link at the top, and the PDF itself
   should be in the folder.
4. Open the link in a private browser window, signed out of Dropbox, to confirm a tenant can
   actually open it. See the note below if it asks them to sign in.

---

## How it behaves when things go wrong

Dropbox is never allowed to break an inspection. Every call is best effort:

- Photos go to the app's own storage first and are only then copied to Dropbox. If Dropbox
  fails, the photos are still safe and the gallery link still works.
- The PDF is filed before the email is sent, and a Dropbox failure does not stop the email.
- If the folder cannot be created, the PDF falls back to the ordinary gallery link.
- The access token is cached, so a normal inspection costs one token request, not one per photo.

## Things worth knowing

**Team link policies.** A Business team can be set so that shared links are visible to the team
only. If that is on, a tenant or relocation agent cannot open the link in the PDF, and they will
be asked to sign in. The code asks for a public link and quietly accepts whatever the team
allows, so the symptom is a link that works for you and not for them. Check it with step 4
above. An administrator changes it under **Admin console → Settings → Sharing**.

**A corrected address renames the folder.** If the address or the tenant's name is changed after
photos have already been uploaded, the folder is renamed to match before the report goes out,
and a fresh link is taken, because a Dropbox link does not reliably survive a move.

**Deleted photos.** A photo taken and then deleted is removed from the app's own gallery before
the report is sent. It is **not** removed from Dropbox: what is filed stays filed, so nothing
disappears from your records behind your back. Delete it in Dropbox yourself if you want it gone.

**Storage.** Roughly 60 MB per inspection with eighty photos, plus video. That is Dropbox
storage, not Cloudflare's, so watch the team quota rather than the R2 one.
