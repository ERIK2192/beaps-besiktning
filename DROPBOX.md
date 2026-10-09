# Filing inspections in Dropbox

Move-ins, move-outs and new properties file themselves into three separate branches, one folder
per inspection:

```
Longstay PICTURES/
    MOVE IN/
        MIN - Folkungagatan 59 1201 2026-10-09 k3x9a0b7q2m/
            Hall 2026-10-09 11-11-04.jpg
            Living room 2026-10-09 11-13-22.jpg
            Walkthrough 2026-10-09 11-24-00.mp4
            MIN Folkungagatan 59, 1201.pdf
    MOVE OUT/
        MOU - Folkungagatan 59 1201 2026-12-01 p8w2c4d6e1f/
    NYA OBJEKT/
        NYTT - Folkungagatan 59 1201 2026-10-09 z5y7x3w1v9u/
            Hall 2026-10-09 09-02-11.jpg
            Electricity meter 2026-10-09 09-30-00.jpg
            Nytt objekt Folkungagatan 59, 1201.pdf
```

The folder name is `<code> - <address> <apartment> <date> <inspection id>`. Long address text is
shortened to fit the server's 120-character folder-name limit, always preserving date and id.
The date is the day
the inspection was created and the id is the inspection's own, so:

- two inspections of the same apartment never share a folder, not even on the same day;
- uploading the same inspection again (a retry, a resend, a later photo) finds the same folder,
  because the gallery remembers where it was filed and never asks for a new one;
- a move-in, a move-out and a new property cannot share a folder. The server only accepts
  `MOVE IN/MIN - ...`, `MOVE OUT/MOU - ...` and `NYA OBJEKT/NYTT - ...`, exactly one level deep.
  Anything else is not filed, and the inspection carries on with the app's own gallery.

A new property needs no tenant name. `NYA OBJEKT` is created by the server the first time a new
property is filed; nobody has to make it by hand.

The folder is created with the first photo and fills up as the inspector works, so the office
sees a job appearing live instead of an hour later. The PDF lands in the same folder when the
report is sent or signed, and the link in the PDF points at this folder. A report sent again
replaces its own PDF in its own folder.

Photos are named by room and capture time. That sorts them in the order they were taken and
means two photos can never overwrite each other, which plain "Hall 1" would once a photo has
been deleted and the rest have renumbered. The photos from a new property's *Installations and
equipment* section use a short name for the item, for example `Electricity meter ...jpg`, or the
inspector's own name for an item they added.

Shortstay inspections are not filed, and neither are the old annual and damage inspections that
can still be opened (new ones can no longer be created).

**Before 2026-10-09** the name was `MIN - <address> <apartment> <tenant>`, without date and id.
An inspection that was already filed under such a name keeps it, so its folder and the link in
the PDFs already sent stay where they are. Only inspections filed from 2026-10-09 get the new
name. See *Folders from before 2026-10-09* at the end.

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
2. A folder should appear under `Longstay PICTURES/MOVE IN/` with the two photos in it, named
   `MIN - <address> <apartment> <today> <id>`.
3. Send the report. The PDF should arrive with a Dropbox link at the top, and the PDF itself
   should be in the folder.
4. Open the link in a private browser window, signed out of Dropbox, to confirm a tenant can
   actually open it. See the note below if it asks them to sign in.
5. Do the same with a **New property** on a junk address. `Longstay PICTURES/NYA OBJEKT/` should
   appear by itself, with `NYTT - ...` inside it.
6. Start a second new property on the same junk address. It must get a folder of its own.

Delete the junk folders afterwards.

---

## How it behaves when things go wrong

Dropbox is never allowed to break an inspection. Every call is best effort:

- Photos go to the app's own storage first and are only then copied to Dropbox. If Dropbox
  fails, the photos are still safe and the gallery link still works.
- The PDF is filed before the email is sent, and a Dropbox failure does not stop the email.
- If the folder cannot be created, the PDF falls back to the ordinary gallery link.
- Sharing, *Share* and the local PDF never wait for Dropbox at all.
- The access token is cached, so a normal inspection costs one token request, not one per photo.

**An inspection that changes type.** A move-in with a new date/id folder changed into a move-out
(or a new property) is moved into the right branch when the report is sent, retaining its id.
A historical folder without the date/id suffix is never moved automatically, even when the
type, address or counterparty changes: it may contain several inspections. A gallery that was
made while the type had no branch (a shortstay changed into a new property, say, or photos taken
before Dropbox was set up) gets its folder at the next send, and the phone then sends the photos
once more in the background so they are copied into it. An inspection changed from a move-in to
shortstay keeps the folder it already has.

## Things worth knowing

**Team link policies.** A Business team can be set so that shared links are visible to the team
only. If that is on, a tenant or relocation agent cannot open the link in the PDF, and they will
be asked to sign in. The code asks for a public link and quietly accepts whatever the team
allows, so the symptom is a link that works for you and not for them. Check it with step 4
above. An administrator changes it under **Admin console → Settings → Sharing**.

**A corrected address can rename a new date/id folder.** Historical folders stay at their saved
paths. New folders can be renamed while retaining the inspection id; a destination conflict
leaves the original folder and saved path in place, without automatic renaming or merging.
After a successful move, a fresh sharing link is requested.

**Deleted photos.** A photo taken and then deleted is removed from the app's own gallery before
the report is sent. It is **not** removed from Dropbox: what is filed stays filed, so nothing
disappears from your records behind your back. Delete it in Dropbox yourself if you want it gone.
The retention list includes saved photo references from rooms, checklist and equipment regardless
of the selected type or whether their thumbnails could currently be read. A missing thumbnail
or temporarily unreadable video is not treated as a deletion.

Local regression checks: `node tests/new-property-safety.mjs` and
`node tests/dropbox-filing.mjs`. The latter mocks Dropbox, storage and mail; it does not contact
the real account. A live check remains necessary after deployment.

**Storage.** Roughly 60 MB per inspection with eighty photos, plus video. That is Dropbox
storage, not Cloudflare's, so watch the team quota rather than the R2 one.

---

## Folders from before 2026-10-09

The new naming does not depend on the old folders being tidied. Nothing old is moved by the app.
Any reorganisation is done by hand, from a list, after someone has looked at it.

**What the old naming could get wrong.** These are the only ways the app itself could have
filed something wrongly between 2026-09-09 and 2026-10-09. Folders made by hand are not the
app's and are left alone.

| Kind | How it happened | What to do |
|---|---|---|
| `MIN -` or `MOU -` with no address | Photos taken before the address was typed. Every such inspection went into the same folder, and the first one sent renamed that folder to its own name, taking the others' photos with it. | Look at it. Split by photo date into one folder per inspection. |
| Two jobs in one folder | The same apartment and tenant twice (a move-in done again). The photos mixed, and the second PDF **replaced** the first, which had the same name. | Split by photo date. The first PDF can be restored from the file's version history in Dropbox (kept 30 or 180 days, depending on the plan). |
| A report of another type in `MOVE IN`/`MOVE OUT` | A move-in changed to annual, damage or shortstay after its folder was made. The folder stayed and the PDF has no `MIN`/`MOU` at the start of its name. | Decide whether it belongs there at all. |
| A sub-folder inside an inspection folder | A slash in the address (`Storgatan 1/3`) made a folder inside a folder. | Move the sub-folder up as one folder, `MIN - Storgatan 1-3 ...`. |
| No folder at all | Photos taken while the inspection was still shortstay, then changed to move-in. | Nothing to move. The PDF carries the gallery link. |

**Getting the actual list.** As of 2026-10-09 no folder in Beaps' Dropbox has been looked at:
the change was made without access to it, so the table above lists what *can* be wrong, not what
is. A read-only script that lists the three branches and prints proposed moves and a list for a
person to check is on Erik's machine at `outputs/newprop-test/dbx-inventory.mjs` (not in git).
It makes no changes: its only calls are `users/get_current_account`, `files/list_folder` and
`files/list_folder/continue`. Run it with a short-lived token from the App Console
(app → Settings → *Generated access token*):

```
DBX_TOKEN=sl.xxxxx ELECTRON_RUN_AS_NODE=1 "<VS Code>/Code.exe" dbx-inventory.mjs > inventory.md
```

**Before moving anything by hand, know what a move does:**

- **Links in PDFs already sent** point at the folder as it was. A Dropbox link does not reliably
  survive a move, so assume those links break. Every PDF that has been sent keeps its old link
  for good. Only a report sent again from the app gets a fresh link.
- **The app's own record of the folder** (on the phone, and in the gallery's record on the
  server for a year) still holds the old path. If that inspection is opened and sent again, the
  PDF and any new photo go to the **old** path, and Dropbox creates the folder again there. So
  do not move the folder of an inspection that is still being worked on, and do not send an old
  report again after moving its folder.
- **Signed reports** that come back from a signing link are filed the same way, by the stored
  path. Wait until any signing link for that inspection is signed, revoked or expired (30 days).
- **The app's gallery** (the link in PDFs when Dropbox was not used) is not affected by anything
  done in Dropbox.

Nothing in this section has to be done for the new folders to work.
