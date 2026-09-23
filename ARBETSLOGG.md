# Beaps Besiktning — arbetslogg

**Appen används dagligen i verksamheten. Alla ändringar måste granskas noggrant och verifieras så att befintliga arbetsflöden och sparade uppgifter inte rubbas.**

Samlad logg över vad appen är, hur den hänger ihop och vad som ändrats.
Uppdatera den här filen när något ändras, så finns hela bilden på ett ställe.

---

## 1. Vad det är

En besiktningsapp som körs helt i webbläsaren på telefonen. Allt ligger i **en enda fil**,
[index.html](index.html) — HTML, CSS och JavaScript tillsammans. Inget byggsteg, inget ramverk.

Två lägen:

| Typ | Prefix | Flöde |
|---|---|---|
| **Shortstay upplåsning** | — | Checklista med ja/nej/E-T per punkt |
| Inflytt | MIN | Rum + bilder + signaturer |
| Utflytt | MOU | Rum + bilder + signaturer |
| Årlig | — | Rum + bilder, kan avslutas utan signatur |
| Skada | — | Rum + bilder, kan avslutas utan signatur |

## 2. Filer

| Fil | Vad den gör |
|---|---|
| [index.html](index.html) | Hela appen |
| [sign.html](sign.html) | Sidan motparten landar på när hen får en signeringslänk |
| [logo.png](logo.png) | Logotypen, används av sign.html (appen har sin inbakad) |
| [nycklar.js](nycklar.js) | Nyckelregistret (knippa → nycklar), hämtas först när det behövs |
| [fastigheter.js](fastigheter.js) | Fastighetsregistret (adress → lägenheter), hämtas först när det behövs |
| [jsqr.js](jsqr.js) | Inbäddad QR-avläsare (tredjepartsbibliotek, ingen CDN) |
| [package.json](package.json) | Beroenden för funktionerna: `@netlify/blobs`, `pdf-lib` |
| [netlify.toml](netlify.toml) | Publicerar rotmappen, pekar ut funktionsmappen |
| [netlify/lib/mail.mjs](netlify/lib/mail.mjs) | Delad mejlhjälp för signeringsfunktionerna |
| [netlify/functions/send-pdf.mjs](netlify/functions/send-pdf.mjs) | Mejlar PDF:en · `/api/send-pdf` |
| [netlify/functions/sign-request.mjs](netlify/functions/sign-request.mjs) | Skapar signeringslänken · `/api/sign-request` |
| [netlify/functions/sign-view.mjs](netlify/functions/sign-view.mjs) | Läser länken · `/api/sign-load`, `/api/sign-pdf` |
| [netlify/functions/sign-complete.mjs](netlify/functions/sign-complete.mjs) | Tar emot signaturen · `/api/sign-complete`, `/api/sign-cancel` |
| [netlify/functions/speedtest.mjs](netlify/functions/speedtest.mjs) | Wifi-mätningen · `/api/speed-ping`, `/api/speed-down`, `/api/speed-up` |
| [functions/api/](functions/api/) | Cloudflares versioner av funktionerna |
| [functions/api/keys-event.js](functions/api/keys-event.js) | Tar emot en in/utcheckning · `/api/keys-event` |
| [functions/api/keys-log.js](functions/api/keys-log.js) | Läser den delade nyckelloggen · `/api/keys-log` |
| [functions/api/report-put.js](functions/api/report-put.js) | Parkerar ett stort protokoll i R2 inför mejlet · `/api/report-put` |
| [functions/api/sign-upload.js](functions/api/sign-upload.js) | Tar emot protokollet till en signeringslänk · `/api/sign-upload` |
| [cflib/](cflib/) | delad mejl- och signeringshjälp för Cloudflare |
| [CLOUDFLARE.md](CLOUDFLARE.md) | steg för steg att sätta upp appen på Cloudflare Pages |
| [LASMIG.txt](LASMIG.txt) | Deploy- och mejlinstruktioner till den som sätter upp Netlify |
| ARBETSLOGG.md | Den här filen |

Appen körs på två håll. `netlify/**` och `functions/**` är samma funktioner skrivna för
var sin plattform, och båda ligger kvar i repot så båda sajterna fungerar. Skillnaderna:
Cloudflare läser miljövariabler från `env` i stället för `process.env`, använder KV
i stället för Netlify Blobs, och saknar `Buffer` — därför går all base64 via `atob`/`btoa`.

## 3. Så fungerar det tekniskt

**Lagring.** Allt sparas lokalt på telefonen i IndexedDB, med localStorage som reserv
(`store` i index.html). Undantaget är signering på distans, där protokollet mellanlagras
30 dagar — se längre ner. Nycklar:

- `bp:index` — listan över besiktningar
- `bp:insp:<id>` — själva besiktningen
- `bp:ph:<id>:<bildid>` — bilder, en post per bild
- `bp:vid:<id>` — video

**Bilder** komprimeras i telefonen innan de sparas, mål ca 720 kB per bild. Inför PDF:en
krymps de igen så att hela filen håller sig under ca 3,3 MB.

**PDF:en** byggs i telefonen med jsPDF, som hämtas från CDN först när den behövs.
Går det inte att ladda faller appen tillbaka på webbläsarens utskriftsfunktion.

**Mejl.** PDF:en skickas base64-kodad till `/api/send-pdf`, som mejlar den vidare via
Resend eller SendGrid beroende på vilken API-nyckel som är satt i Netlify.
Upplåsningar går till guestservice@beaps.se, allt annat till longstay@beaps.se.
Upp till 4 MB åker PDF:en base64-kodad i anropet. Större protokoll (upp till 16 MB)
laddas först upp som råa bytes till galleriets R2-mapp via `/api/report-put`, och mejlet
bär en länk till `/api/media-file` som Resend själv hämtar när det bygger meddelandet.
Över 16 MB, eller om galleriet saknas, öppnas delningsmenyn i stället.

**Signering på distans** är det enda som lagras utanför telefonen. På Netlify läggs
protokollet i **Netlify Blobs** bakom en slumpad 48-teckens token, i 30 dagar. På
Cloudflare laddas det upp som råa bytes till **R2** via `/api/sign-upload` och nås genom
länkens token; bara riktigt gamla länkar har kvar sin base64 i KV. Signaturen fogas inte
in i protokollet — den blir en egen ensidig PDF och mejlet bär båda filerna. Se avsnitt 5.

**Miljövariabler i Netlify** (se [LASMIG.txt](LASMIG.txt) för hela uppsättningen):
`RESEND_API_KEY` eller `SENDGRID_API_KEY`, `MAIL_FROM`,
valfritt `MAIL_TO_SHORTSTAY`, `MAIL_TO_LONGSTAY`, `MAIL_TO`.
Signeringen kräver inga nya variabler — den använder samma mejluppsättning och
Netlify Blobs, som ingår i Netlify utan extra kostnad eller konto.

## 4. Datamodellen

En besiktning (`S` i koden):

```js
{
  id, created, address, apt, type,
  inspector:{name}, counter:{name, role},
  rooms:  [{id, name, comment, photos:[{id, ts}], fixed}],  // inflytt/utflytt/årlig/skada
  checks: [{id, key, label, section, showIf, val, comment, open, photos:[]}],  // upplåsning
  video, comp:{in,out}, sig:{}, signReq, signedAt, closedAt, log:[]
}
```

`sig.inspector` och `sig.counter` är `{data, ts}` för en signatur ritad i appen, eller
`{remote:true, ts, name}` när motparten signerat via länk — då finns bilden bara i det
protokoll servern skickade ut.

`signReq` finns bara när en signeringslänk skickats:
`{token, url, to, cc, name, role, sentAt, expires, status, signedAt, signedName, signedRole}`
där `status` är `pending`, `signed`, `cancelled` eller `expired`.

Checklistan definieras av `CHECKS` i index.html. Varje rad har:

- **`key`** — stabil identitet. Byt aldrig en `key` på en befintlig fråga; det är den
  som gör att gamla besiktningar behåller sina svar när texten skrivs om.
- **`label`** — frågan som visas. Får skrivas om fritt.
- **`section`** — rubriken raden hamnar under, i listan och i PDF:en. Rader med samma
  sektion måste ligga i följd; rubriken sätts in där sektionen byter.
- **`showIf`** — valfri. Raden visas bara när frågan med den nyckeln är besvarad med **Ja**.
- **`INVERT`** — mängden nycklar där *Ja* är avvikelsen (röd knapp, kommentarsfält fälls ut).
  Just nu `router` och `stolar`.

`ensureChecks()` bygger om listan från `CHECKS` varje gång en besiktning öppnas och flyttar
över svar, kommentarer och bilder via `key`. Gamla besiktningar som bara sparade etiketten
matchas på texten, med `LEGACY_KEY` för de etiketter som skrivits om. Rader från en äldre
version som inte matchar någon nyckel läggs sist och behålls — inget svar försvinner.

---

## 5. Ändringslogg

### 2026-08-27 — E/T-knapp och följdfrågor

**E/T (ej tillämpligt).** Varje checklistrad har nu tre svar: Ja, Nej och E/T.
E/T räknas som besvarad men aldrig som avvikelse, och visas som `E/T` i PDF:en.
Knappraden bryts till egen rad på riktigt smala skärmar i stället för att spilla över.

**Följdfrågor.** En rad kan nu ha `showIf` och visas då bara när dess huvudfråga är
besvarad med Ja. Två frågor är omgjorda till par:

| Huvudfråga | Följdfråga |
|---|---|
| Finns öppen spis eller annan eldstad? | Finns skylt om att inte elda? |
| Har lägenheten säkerhetsdörr? | Finns skylt med instruktioner hur man låser? |

Tidigare låg villkoret inbakat i frågetexten (*"Om det finns öppen spis, finns skylt…"*,
*"Om ja, finns skylt…"*), vilket gjorde ett Nej tvetydigt — saknades skylten eller fanns
ingen eldstad? Nu är det två separata svar.

Följdfrågan visas indragen med en rad som säger vilket villkor som gäller. Svarar man om
huvudfrågan försvinner följdfrågan ur listan, ur räknarna och ur PDF:en, men svaret ligger
kvar och kommer tillbaka om man ändrar sig igen.

**Ripple-effekter som följde med:** framstegsräknaren, sammanfattningen på sista sidan
(som nu även visar antal E/T), varningen om obesvarade punkter innan man skickar,
rumslistan i fotoläget och PDF-genereringen räknar och skriver alla bara ut synliga rader.
Frågorna fick stabila `key`-värden och `INVERT` bygger på nycklar i stället för fritext.

**Verifierat med** 27 automatiska tester (migrering från gamla besiktningar, synlighetsregler,
inverterade rader, idempotens) plus renderingskontroll på 320 px och 390 px bredd.

### 2026-08-27 — signering på distans

När gästen inte är på plats vid in- eller utflytt går det nu att få signaturen ändå.

**Flödet.** På avslutssidan finns knappen **Gästen kan inte signera nu**. Den öppnar ett
formulär med *Mejla till*, *CC*, mottagarens namn och roll — mottagaren är ibland
relocation-agenten, ibland kunden direkt. Appen bygger protokollet, laddar upp det och
mejlar en länk. Mottagaren öppnar länken, ser **hela protokollet** i sidan, bockar för att
det är läst, ritar sin namnteckning och skickar. Servern fogar in signaturen som en sista
sida och mejlar det färdiga protokollet till longstay@beaps.se med kopia till den som
signerade. Nästa gång besiktningen öppnas i appen hämtas statusen automatiskt.

**Varning i formuläret.** En OBS-ruta påminner om att den man mejlar ser hela PDF:en —
alla rum, bilder och kommentarer — innan signaturen lämnas.

**Protokollet fryses vid utskicket.** `closedAt` sätts när länken går ut, så det motparten
signerar är exakt det som skickades. Låser man upp återkallas länken automatiskt och en ny
måste skickas. Har besiktningsmannen inte signerat själv står det i formuläret — men det
stoppar ingenting, se principen i avsnitt 8.

**Så här hänger delarna ihop:**

| Steg | Var | Vad |
|---|---|---|
| 1 | appen | `sendSignRequest()` bygger PDF, POST till `/api/sign-request` |
| 2 | `sign-request.mjs` | lägger PDF + metadata i Blobs, mejlar länken till *till* och *CC* |
| 3 | `sign.html` | hämtar `/api/sign-load`, visar `/api/sign-pdf`, samlar in signaturen |
| 4 | `sign-complete.mjs` | pdf-lib lägger till signatursidan, mejlar till longstay + kopia |
| 5 | appen | `checkSignStatus()` hämtar status, sätter `sig.counter` och `signedAt` |

**Att protokollet inte går att manipulera** ligger i att steg 4 hämtar PDF:en från Blobs,
inte från mottagarens webbläsare. Bara signaturbilden kommer utifrån.

**Länkarna** har en slumpad 48-teckens token, gäller 30 dagar, går bara att använda en gång
och kan återkallas. Sidorna är `noindex` och svaren `no-store`.

**Verifierat med** 27 automatiska tester (validering av adresser, hela utskicket, statusfrågan,
fjärrsignatur i vyn och i PDF:en, återkallning, upplåsning som återkallar) plus rendering av
appvyerna och signeringssidan i alla lägen på 320 px och 390 px.

### 2026-08-28 — sektioner, wifi-mätning och bort med tvånget

**Inget i appen kräver längre något.** Två dialogrutor som stod i vägen är borta: den som
frågade om obesvarade punkter innan man skickade till Camilla, och den som ville att man
signerat själv innan en signeringslänk gick ut. Informationen finns kvar, men som text man
kan läsa eller strunta i. Se principen i avsnitt 8.

**Checklistan är indelad i nio avsnitt** — Entré och post, Dörr och nycklar, Klimat och
teknik, Kök, Vatten och avlopp, Sovrum och textil, Säkerhet, Städning och överlämning,
Innan du går. Frågornas ordning är **oförändrad**; rubrikerna är bara insatta där rundan i
lägenheten naturligt byter plats. Varje rubrik visar hur långt just det avsnittet kommit
(`3/5`), och rubrikerna följer med i PDF:en. Sektionen sitter i `section` på varje rad i
`CHECKS`, så en ny fråga hamnar rätt bara genom att läggas på rätt ställe i listan.

**Nästa-knapp.** Nere i fältet står `Nästa · 19` när nitton punkter är obesvarade. Den
skrollar till första tomma raden och markerar den kort. Knappen försvinner när allt är
ifyllt. Den hoppar bara, den kräver ingenting.

**Avvikelsesammanfattning överst i PDF:en.** Före checklistan står nu
`3 avvikelser · 2 obesvarade · 5 ej tillämpliga · 31 punkter totalt`, följt av varje
avvikelse med sin kommentar. Saknas kommentar står det *ingen kommentar* — som upplysning,
inte som spärr. Samma markering finns på avslutssidan i appen.

**Wifi-mätning inbyggd.** På raden *Funkar internet?* finns knappen **Mät wifi**. Den mäter
mot Beaps egen Netlify-funktion — ingen tredjepartstjänst inblandad — och skriver in
`Ned 87 · Upp 41 Mbit/s · Latens 18 ms` i kommentaren. En handskriven kommentar som redan
står där behålls efter ett tankstreck, och en ny mätning byter bara ut den gamla.

Så här mäts det:

| Del | Hur |
|---|---|
| Latens | fem anrop till `/api/speed-ping`, medianen av dem |
| Nedladdning | 4 MB från `/api/speed-down`, klockan startar på första byten |
| Uppladdning | 2 MB till `/api/speed-up`, klockan startar när anropet går |

Servern skickar **slumpdata**, som inte går att komprimera. Annars hade gzip på vägen kunnat
blåsa upp siffrorna till något som såg bättre ut än verkligheten. Mätningen speglar vad en
gäst faktiskt får ut av nätet, inte vad routern klarar i teorin — det är det vi vill veta.
Upptäcker webbläsaren att telefonen kör på mobildata läggs `· mobildata` till i kommentaren,
så att en mätning på fel nät inte tas för en wifi-mätning. Klockslaget står i händelseloggen
och upprepas därför inte i kommentaren.

**Verifierat med** 31 automatiska tester utöver de tidigare (sektionsindelning och räknare,
nästa-knappen, att inga dialogrutor dyker upp, hela wifi-mätningen inklusive att en gammal
mätning byts ut och att kommentaren överlever, samt att ett serverfel inte rör kommentaren).
Totalt 85 tester passerar.

### 2026-08-28 — buggjakt före första skarpa deployen

Fyra fel hittades och rättades, alla i det som byggts de senaste två dagarna.

**Kapplöpning när man byter besiktning mitt i ett anrop.** `measureWifi`,
`checkSignStatus`, `sendSignRequest` och `cancelSignLink` skrev alla sitt resultat till
`S` *efter* ett await. Hann användaren gå ur besiktningen under tiden skrevs resultatet i
fel protokoll, eller kastade på `S` som blivit `null`. Alla fyra fångar nu besiktningen i
en variabel före anropet och kontrollerar `S !== insp` efteråt.

**Storleksgränsen skilde sig mellan app och server.** Appen släppte igenom protokoll upp
till 4,2 MB, servern nekade över 4,0 MB. Ett protokoll däremellan byggdes och laddades upp
i onödan för att sedan nekas. Båda står på 4,0 MB nu.

**Serverns felsvar kunde hälla ut HTML i felrutan.** Är funktionen inte igång svarar
Netlify med en hel 404-sida. Den texten visades rakt av. Nu visas bara korta klartextfel;
allt annat blir ett begripligt meddelande, och 404 säger uttryckligen att funktionen inte
är igång än.

**Bakgrundskollen kunde radera det man höll på att skriva.** `checkSignStatus` körs när
ett protokoll öppnas och ritar om vyn om statusen ändrats — utan att först spara texten i
ett öppet kommentarsfält. Den sparar nu först.

**Källkoden låg öppet.** `publish = "."` serverar hela mappen, så
`/netlify/functions/send-pdf.mjs` gick att läsa publikt. Inga hemligheter ligger i koden —
de är miljövariabler — men det finns ingen anledning att publicera den. `netlify.toml`
returnerar nu 404 för `/netlify/*` och `/ARBETSLOGG.md`. Funktionerna nås som förut på `/api/*`.

**Så här testades det — 168 automatiska kontroller:**

| Svit | Antal | Vad den bevisar |
|---|---|---|
| Enhetstester | 85 | checklistan, signeringen, wifi-mätningen |
| Migrering | 48 | data från gamla appen överlever uppdateringen |
| Buggjakt | 25 | XSS, trasig data, kapplöpningar, server nere, extremvärden |
| PDF-kedjan | 10 | jsPDF → pdf-lib, svenska tecken, signatursidan |

**Migreringstestet är det viktigaste.** Det kör den gamla appen — hämtad direkt ur commit
`fd844af` — i en riktig webbläsare över HTTP, låter den skapa två pågående besiktningar med
bilder, svar, kommentarer, egna rum och en signatur, och laddar sedan den nya appen mot
*samma* IndexedDB. Alla 48 kontroller passerar: ingenting försvinner.

**XSS-testet** matar in `"><img src=x onerror=...>` och `</div><script>` i kommentarer,
adress och namn. Ingenting körs som kod — `esc()` håller.

**PDF-kedjetestet** avslöjade att teckensaneringen i `sign-complete.mjs` är nödvändig, inte
bara försiktighet: pdf-lib kastar på tecken utanför Latin-1, så ett bockmärke eller en pil
i ett namn hade fällt hela signeringen.

### 2026-08-28 — andra buggjakten

En omgång till, riktad mot det första passet inte rörde: fotoläget, typbyten,
säkerhetskopian och PDF:en i ytterlägen. **Inga nya fel i logiken.** Två ställen
härdades ändå, båda sådana som hade kraschat eller tappat data om de nåtts:

**`paintCam` kunde krascha om listan krympte.** Fotoläget indexerar i listan över
synliga rader. Döljs en följdfråga medan kameran står öppen kunde indexet peka utanför
listan, och `r.name` på `undefined` fäller hela vyn. Indexet klampas nu, och saknas raden
stängs fotoläget i stället för att kasta.

**`backup()` tog bara med rummens bilder.** För en upplåsning ligger bilderna på
checklistraderna, så en säkerhetskopia hade blivit tyst ofullständig. Knappen visas i dag
bara för rumsprotokoll, så felet gick inte att nå — men det hade väntat på den som lade
till knappen. Funktionen tar nu med båda.

Testat: fotoläget mot dolda följdfrågor och okända id:n, typbyte med en aktiv
signeringslänk, bilder på en följdfråga som döljs (de ligger kvar i lagringen och kommer
tillbaka), dubblettnycklar, en fråga från en äldre version som får egen rubrik, wifi-mätning
när servern svarar med noll byte, samt PDF med fjärrsignatur, med enbart E/T och med
fjorton avvikelser med långa kommentarer. 33 kontroller, alla gröna.

**Totalt 201 automatiska kontroller** över fem sviter.

### 2026-09-08 — two reports from 2026-09-07: one went out unsigned, one "disappeared"

**What was established.** The move-in PDF for Folkungagatan 59, 1201 has only two lines in
its activity log: *Inspection created* and *Wifi measured*. No *Signed by*, no *Report
locked*. So the PDF was emailed while the report was still an unsigned draft: whatever ink
was on the pads had not been approved, and the app silently dropped it. Nothing else went
wrong — the PDF is complete apart from the signatures.

For Banérgatan 10, 1602 nothing exists outside the phone unless it was emailed, uploaded as
a gallery or sent as a signing link — the app keeps everything in the phone's IndexedDB.
Two things make a report *look* deleted while it is still there:

- **Two hosts.** `beaps-besiktning.netlify.app` still serves the app from before 2026-08-28
  (deploys paused until 21 September); `beaps-besiktning.pages.dev` serves current `main`.
  Storage is per address.
- **Two containers per address on iOS.** A home-screen icon and Safari have separate
  storage. A report made from the icon is invisible when the same link is opened in
  Safari. Deleting the home-screen icon deletes its storage outright — the earlier
  instruction in [CLOUDFLARE.md](CLOUDFLARE.md) to "remove the icon and add it again"
  now carries that warning.

**Links verified live on pages.dev:** `/sign.html?t=…` and `/galleri.html?t=…` answer
with a 308 to `/sign?t=…` and `/galleri?t=…` (Cloudflare drops the extension) and the
token survives the redirect. `sign-load`, `media-list`, `media-init`, `media-put` and
`media-file` all respond correctly, so KV, R2 and the app token are in place. On
netlify.app `/sign.html` is 404 and `/api/*` returns the app's HTML — any link pointing
there fails.

**Two changes in [index.html](index.html):**

- `loadIndex()` — the start screen now reconciles the list against the `bp:insp:*` keys and
  puts back any report whose row went missing from the index (interrupted write, closed
  database connection). If the index cannot be read nothing is written, so a truncated
  list is never saved over a good one.
- `commitPendingPads()` — a drawn but unapproved signature is kept when the report is
  emailed, shared or sent for signing, instead of being dropped. *Email PDF* and *Share*
  take both pads; the signing link takes only the inspector's. Nothing new is required,
  nothing blocks.

**Tested:** syntax check of the whole app script plus 18 unit checks on the two functions
(orphan restored newest first, complete index untouched, read failure never writes,
missing or corrupt index rebuilt, mismatching blob skipped; pads committed only when inked,
box redrawn, other pad kept, both inked locks the report, approved signature never
overwritten). Node is not on this machine — VS Code's Electron runs the tests with
`ELECTRON_RUN_AS_NODE=1`.

**Why the PDF carried no photo/video link.** The email for Folkungagatan was sent from the
current app (the PDF has the wifi line and English headings, which the old Netlify app
cannot produce; the email body "Attached: …" is identical on both hosts and proves
nothing). The link is only written into the PDF when the upload succeeds, and a
successful upload also writes *Photos uploaded* into the activity log. That line is
absent, so the upload failed on the phone before the PDF was built — the only sign was
a toast that vanished in seconds. Uploads with photo- and video-sized files were verified
working against pages.dev, so the failure was on the phone's side (a dropped request, or
a `Gallery not found` because KV had not yet propagated the manifest to the edge that
took the first file). Two changes in `uploadGallery()`:

- The gallery request and every file get one retry after 1.5 s.
- A failed upload is now written to the activity log as *Photo upload failed: reason*,
  so the cause is in the report itself the next time.

**One more container.** A link tapped inside Outlook, Teams, WhatsApp, Gmail or Slack
opens in that app's built-in browser, which has its own storage — not Safari's. A report
made there is only visible by tapping the same link in the same app again. A Safari
private tab loses everything when the tab is closed.

**Home-screen card on the start screen.** `homeScreenCard()` shows a small yellow-edged
card — *Save the app to the home screen*, one sentence on why, and a *Show how* button
that unfolds the steps (Safari steps on iPhone, Chrome steps elsewhere) plus the warning
that reports made in the browser do not move to the icon and that the icon must not be
deleted while it holds unsent reports. It is hidden when the app already runs from an
icon (`isStandalone()`: `navigator.standalone` or `display-mode: standalone`). Nothing is
required — it is information, not a gate. Tested with 8 checks (standalone detection on
iOS and Android, collapsed/expanded, platform steps, full Swedish translation) and
rendered in headless Edge at 390 px in both languages.

### 2026-09-08 — the real cause of the Banérgatan loss: the app ran the phone out of memory

The colleague reported that everything vanished the moment he added a third bedroom to a long
inspection with roughly eighty photos. That is not a coincidence, and it was not his mistake.

**The app kept every photo in memory for the whole session.** `photoCache` held the full
image of every photo as a base64 data URL, and `loadMedia()` read all of them back in as soon
as a report was opened. A photo is compressed to about 720 kB, which is roughly 960 kB as a
data URL. Eighty photos is therefore some 77 MB of text, on top of every decoded image in the
open room and in the camera strip, and on top of the camera's own video buffers. That is more
than an iPhone grants one web page. Adding a room forces a full redraw, which allocates again
on top of the peak, so that tap is precisely where the phone kills the page.

**Only a thumbnail is kept in memory now.** Every photo is saved twice: the full image under
`bp:ph:<insp>:<id>` as before, and a 384 px thumbnail under `bp:th:<insp>:<id>`. `photoCache`
holds the thumbnail. The full image is read one at a time, and released again, by the three
places that genuinely need it: the PDF, the gallery upload and the backup. Reports made before
this build have no thumbnails, so `loadMedia()` builds them on first open, one photo at a time,
and saves them so the next open is cheap. Nothing is lost and no report needs converting by hand.

`backup()` also stopped building the whole file as one giant string; it now streams the pieces
straight into the Blob. `delPhoto`, `delRoom` and `wipe` clear the thumbnail as well, and
`delPhoto` now drops its memory copy too, which it never did.

Measured in a real browser, the same probe run against the previous commit and against this one:

| | before | after |
|---|---|---|
| memory for six photos | 1283 kB | 159 kB |
| photos reaching the PDF builder | 6, at 1283 kB | 6, at 1311 kB |
| resulting PDF | 165 kB | 168 kB |

The PDF is unchanged, which is the point: the same bytes reach it, they are simply no longer
all held at once. For eighty real photos the memory figure falls from about 77 MB to about 2 MB.

**Verified with** 21 unit checks (thumbnail written and cached rather than the full photo, a
failed write leaving no phantom photo, canvas failure falling back to the full image, migration
of an old report and that it never keeps a full image, a reopen reading no full photos at all,
deletion clearing both copies, backup streaming into pieces and still carrying every photo at
full resolution) plus an end-to-end run in headless Edge over http against real IndexedDB.

**Still open.** The video is still held in memory as one data URL, so a long walkthrough is a
smaller version of the same problem.

### 2026-09-08 — photos are copied to the server while the inspection is running

The memory fix stops the app from being killed. This stops a killed, lost, wiped or
wrong-browser phone from taking the report with it. Until now the photos were uploaded only
when the report was sent or signed, so everything before that moment existed in exactly one
place, and an inspection that never reached the send button was simply gone.

**Now.** Four seconds after a photo is saved, it is copied to the gallery in the background.
The gallery is created once, on the first photo, and every later photo is added to the same
one, so a report still has a single link. `S.gallery.done` holds the ids that are on the
server, so the list survives a reload and a phone switched off mid-job, and nothing is ever
uploaded twice. The background run is silent: no toasts, no log line, because a minute without
coverage is normal and the next photo retries it. A failure at send time, where it matters, is
still both shown and written into the report. It is the same bytes that were being uploaded at
send time anyway, only sent earlier, so it costs no extra data.

**Two server changes were needed** ([media-put.js](functions/api/media-put.js),
[media-list.js](functions/api/media-list.js)). A photo taken mid-inspection is not in the
manifest, and `media-put` used to reject anything it did not already know. It now accepts the
file and takes its name, kind and timestamp from the query, storing them as KV metadata on the
per-file `/up/` key that already existed. `media-list` builds its listing from those keys, so
it needs no extra read per file and the manifest is never rewritten — which is what the
per-file keys were introduced for in the first place. Files sort by timestamp.

**Verified with** 20 unit checks (gallery created once and reused, only new files sent, the
description travelling with the file, background runs silent on success and on failure, the
same failure logged at send time, per-file retry, partial upload keeping the link and marking
itself incomplete, a dropped connection, the app's own HTML coming back from an unknown path,
switching inspection mid-upload, and an unreadable photo never being marked as uploaded).

**A photo that is deleted must not reach the recipient.** Uploading during the inspection means
a photo taken by mistake may already be on the server when it is deleted on the phone. Before a
report goes out, `tidyGallery()` sends the list of photos that actually remain to the new
[media-sync.js](functions/api/media-sync.js), which removes everything else from R2 and KV. An
empty list is refused rather than obeyed: a gallery is only ever tidied down to what remains,
never emptied, so a bug on the phone cannot erase the one copy that exists off it. A failed
tidy never blocks a send; it is retried the next time.

**One more found by testing against the live server.** `media-list` listed the photos uploaded
mid-inspection, but `media-file` still demanded a manifest entry and answered 404 for exactly
those files, so the gallery would have listed every photo and shown none of them. The manifest
cannot be the gatekeeper for a photo that is not in it; the R2 fetch is the real check and the
48-character token is the lock. Verified live: three files serve, an unknown id gives 404, and
a wrong token gives 404.

**What is still only on the phone:** the room names, comments and answers. They are small, and
the next step, if wanted, is to send that little bit of text along with the photos so a lost
phone loses nothing at all.

### 2026-09-09 — move-ins and move-outs file themselves into Dropbox

Beaps already keeps every photo and video in Dropbox by hand. The app now does the filing
itself, into the folders that already exist:

```
Longstay PICTURES/MOVE IN/MIN - Folkungagatan 59 1201 Lovable/
    Hall 2026-09-07 11-11-04.jpg
    Walkthrough 2026-09-07 11-24-00.mp4
    MIN Folkungagatan 59, 1201.pdf
```

The folder is made with the first photo and fills as the inspector works, so the office sees a
job appearing live. The PDF is filed when the report is sent, and the signed PDF when it comes
back from a signing link. The link at the top of the PDF is the Dropbox folder. Only move-ins
and move-outs are filed; damage, annual and shortstay inspections do not live in that structure
and are left alone. Setup is in [DROPBOX.md](DROPBOX.md).

**The credentials never touch the phone.** index.html is a static page anyone can read the
source of, so a token there would hand out the whole team Dropbox. All of it runs in the
functions, with the refresh token in Cloudflare's encrypted secrets beside the mail key.
Without those secrets every part of this is inert and the app behaves exactly as before.

**Decisions worth remembering:**

- **Files are named by room and capture time**, `Hall 2026-09-07 11-11-04.jpg`, not `Hall 1`.
  Two photos can then never overwrite each other, which plain `Hall 1` would once a photo has
  been deleted and the rest have renumbered. It also sorts the folder chronologically.
- **A corrected address renames the folder** before the report goes out, and a fresh share link
  is taken, because a Dropbox link does not reliably survive a move.
- **A deleted photo is removed from the gallery but left in Dropbox.** What is filed stays
  filed; nothing disappears from the records behind anyone's back.
- **A team account roots every call in the member's own space** unless `Dropbox-API-Path-Root`
  is sent, so the root namespace is looked up once and cached. Set `DROPBOX_TEAM=no` for a
  personal account; the lookup is harmless either way.
- **`Dropbox-API-Arg` is an HTTP header and must be plain ASCII.** Every Swedish street name
  would otherwise break its own upload, so the JSON is escaped to `\uXXXX` before it is sent.
- **The share link is much longer than the gallery link**, so the PDF shrinks that line until
  it fits instead of running off the page.

**Verified with** 31 unit checks against a stubbed Dropbox (path building, Swedish characters
surviving as escapes and decoding back, characters Dropbox rejects, a climb out of the root
being flattened, file naming and collisions, token caching, an existing folder counting as
success, and the app naming folders exactly as Dropbox already does) plus an import check that
every one of the 18 function files parses and resolves - a broken import there would take
`/api/*` down and with it mail, signing and the gallery at once.

### 2026-09-15 — key bundles: one tap to check out, and a log that keeps old check-outs

A tag carries only the bundle number, e.g. "112:3" - the register behind it (which keys, which
apartment) lives in `nycklar.js`, and the QR decoder is the vendored `jsqr.js`. Every check-out
and check-in is one row in KV, written by `functions/api/keys-event.js` and read back by every
phone from `functions/api/keys-log.js`.

**Today:** checking out no longer opens a second sheet - the name field and the reason chips
live on the bundle view itself, and the yellow button writes the event in one tap. The bundle
view syncs with the server the moment it opens. A bundle's status is now recomputed from the
server's last-event-per-bundle projection, not just the recent tail, so an old check-out that
was never checked back in can no longer fall off the log and start looking "in the cabinet"
again. Anything not yet on the server shows "Waiting to sync" on the bundle, the shared log and
the start screen, and a queued event retries on reconnect or when the app returns to the
foreground, rather than waiting for the next visit to the start screen.

**Fixed along the way:** KV lists this prefix oldest-first, so the old 5000-event scan cap would
have dropped the *newest* events once the log grew past it. The scan now reads everything (a
page cap of 200 × 1000 only guards against a runaway loop) and returns the per-bundle state
next to the 500-event tail. Two events in the same millisecond used to be settled by whichever
was read last; both the phones and the server now break the tie on id (KV's own key order), and
a new event is stamped later than the one that currently decides that bundle, so a check-in
registers even after a check-out from a phone whose clock runs ahead.

**Open decision:** the tag holds a bare number ("112:3") that only the in-app scanner
understands. A QR code the phone's ordinary camera can open would have to be a URL, and that
page would need staff-only protection before it could show a bundle - the app token guarding
`/api/keys-event` and `/api/keys-log` ships inside the client and only deters casual scraping.
Cloudflare Access in front of the app is the obvious candidate; it is not built.

### 2026-09-15 — the same QR code, two ways in

New tags may carry a link instead of a bare number: `https://beaps.se/#nyckel=112:3`.
Scanned with the phone's ordinary camera it opens beaps.se - the company website, which
knows nothing about keys and gets nothing built for it here. Scanned inside the app, the
scanner reads the number out of the link (`tagNumber()` in `index.html`, just above
`gotCode`) and opens the same bundle sheet a bare number would, with no extra tap. Only an
exact shape is accepted - `https`, host `beaps.se` or `www.beaps.se`, path `/`,
`#nyckel=<number>` - and the link itself is never opened or followed, only read; anything
else falls into the existing "not a key tag" message. Old bare-number tags and manual entry
are unchanged.

This is QR parsing only: it grants no access, adds no endpoint, and exposes nothing new.
Protecting the scanner and the bundle view from a stranger who finds one of these links is
a separate task, and Cloudflare Access must not be switched on in front of the whole app
before mapping what that does to daily users, signing links (`sign.html`) and the external
galleries (`galleri.html`). A new test sheet, `Downloads/Beaps-nyckelbrickor-testark-url.pdf`,
is being built alongside the older sheets, which are kept.

### 2026-09-15 — a direct link to the shared log

`https://beaps-besiktning.pages.dev/#nyckellogg` opens the shared key log straight away, on a
first visit as well as on a reload: the app boots to the start screen as always and then opens
the log sheet on top of it, so the report list and any queued key events are exactly where they
were. The hash follows the sheet - set when the log opens (from the menu too), cleared when it
closes - and a "Copy link" sits in the log's hint line. The log says "Updating…" while it fetches,
and keeps the existing "not fetched yet" / "could not reach the log — showing it as of HH:MM"
lines when it cannot. The link is a shortcut into the app, not around it: the data still comes
through `/api/keys-log` with the same guard as everything else, and whatever access check the
app gets later must run at boot, before `LOG_HASH` is looked at (the last lines of the script).

### 2026-09-22 — a bundle is left in the apartment from inside the inspection; four colour proposals

**The third place.** A bundle used to be either in the cabinet or with a person. It can now be
left in an apartment, with a guest or tenant, or both: a new event kind `place` in
[functions/api/keys-event.js](functions/api/keys-event.js) (`apt` = the object number, 112 in
112:3; `place` = the label the log shows, "lgh 1102 TÄRNA"; `guest` = the name it went to; any
may be empty) and a third status, `placed`, in the phones' projection (`applyEvents` in
index.html). Where a bundle is stays "the last event for it, whatever kind", so Holdings, the
placed list, the bundle sheet and the shared log all read one fact, and a bundle can never
show in two places.

**Only inside an inspection.** Erik's call, for simplicity: the hand-over happens on a card
*Nycklar till lägenheten* in a shortstay unlock, a move-in or a move-out (`HANDOVER_TYPES`), at
the end of the door-and-keys section of the checklist, or right after the Keys room. The
apartment is the inspection's own, matched to the register on address and apartment number
(`inspApt`); an address the register has not got yet is named by what the inspection says,
address included, so the log line still says which house. The name it goes to is the
counterparty, or whatever is typed in *Till*. The bundle is scanned (same scanner, same tag as
a check-out, `openScan('hand')`) or typed in the number field, and the event is written the
moment the tag is read: from the cabinet straight into the apartment, or from the inspector's
own holdings, both without questions. Only a bundle registered with somebody else, or
belonging to another apartment, gets a second look first (*Lämna ändå* / *Skanna en annan*).
The card shows the confirmation, what is already here, and what you carry for this apartment
(tap to fill the field). The line also goes into the inspection's own activity log, and so
into the PDF. Closing the scanner or the review writes nothing; a failed local save rolls back
and says so. The start screen and the bundle sheet have no hand-over button; a placed bundle's
sheet offers *Ta med* (out, to you) and *Checka in*, both logging where it came from.

**Log and history.** A hand-over reads
`2026-09-22 10:00 · 112:3 · TÄRNA — Lämnad i lgh 1102 TÄRNA · till Anna Svensson · av Erik`.
The shared log has a new section *I lägenhet / hos gäst* beside *Utlånade just nu*. Nothing
old is rewritten. A phone still on the previous index.html shows a placed bundle as "in the
cabinet" until it reloads (it knows only `out`); the server takes both versions' events.

**Also fixed on the way.** `keyWrite` rolls back and says so when the phone cannot store the
event. Two overlapping flushes (the write's own and the sync behind it) no longer post the
same event twice - the server deduped by id, but each was a KV write.

**Three design proposals (1, 3, 4)**, menu → *Nyckeldesign*, remembered per phone. They cover the key
screens only - Holdings card, the key card in an inspection, bundle sheet, review sheet, shared
log, the scanner's chrome - in the Beautiful Apartments palette: yellow #FFD340, dark peach
#E2987D, light peach #F9D7C5, emerald #16453E; no grey, no black. 1 light peach base, 3 dark
peach base, and **4 emerald base with peach text, white headings and numbers, yellow only on
the buttons - the default, and the general line to go by** (Erik, 2026-09-22). A yellow-based
2 was tried and dropped the same day, 1 lost its yellow bar on the tag, and 4's yellow text
became white. They are `:root[data-ktheme]` token sets in index.html; a phone that still has 2
stored falls back to 4. All three run the same code. Text in the key
screens runs horizontally: the bundle header on one line at 22 px, key rows and log lines
flowing.

**The tags.** Front 37.5 × 23.5 mm landscape: the wordmark on *one* line across the width (the
two rows of `beaps-web-logo.svg` measured in a browser and set side by side, `tags.cjs`),
smaller and quieter, phone number under it. Back 23.5 × 37.5 mm portrait: the QR code on a
plain light-peach field with four modules of quiet zone, the number along the width beneath
it, bigger. The code is black on a white field on all three (Erik's call, after an emerald-on-
peach round); the number is black, white on the green. The phone number is bold (7 pt, 600)
on all three, and the corners are square - the real tags are rectangular. Green: wordmark,
phone and number white. Dark peach (3): wordmark, phone and
number in a deeper emerald, #0D2F2A - black was too harsh, the brand green too faint, and a
fattened wordmark was tried and dropped. Light peach (1): wordmark and phone emerald, number
black. The QR
codes are now generated here (`qrgen.cjs`, version 1, byte mode, level M) and every one is
decoded with the app's own `jsqr.js` before it is used, so the sheet covers all 30 bundles in
the register instead of the six sample codes. Print sheet:
`outputs/qr-design/Beaps-nyckelbrickor-gron.pdf` (also copied to Downloads) - six test pairs,
every back for Upplandsgatan 91B, a page of fronts, and the other two palettes to compare.
Presentation: `outputs/qr-design/Beaps-nyckelflode-3-forslag.html` and `.pdf`.

**Verified** in headless Edge against a mock ledger, 50 checks: the lists after sync, the card
prefilled from the inspection, typed and scanned hand-overs, the review and its cancel leaving
everything unchanged, cabinet straight to apartment, take-over from a colleague, the checklist
placement for a shortstay unlock, no card on an annual inspection, an address the register does
not know, no address at all, check-in and take-it from an apartment, a failed save rolling
back, the three themes. Harness in `outputs/keyflow-test/` (README there). Not run against
Cloudflare; the function parses.

### 2026-09-22 — big longstay reports go out by mail instead of stopping at the share sheet

**The problem.** The PDF builder gives each photo `3.3 MB / photo count`, but never less
than 80 KB, so a move-out with seventy photos comes out at about 5.6 MB. `mailPdf` refused
anything over 4.2 MB and opened the share sheet. That cap was a leftover from Netlify's 6 MB
request limit; Cloudflare takes 100 MB, Resend 40 MB per mail, and beaps.se (Microsoft 365)
about 25 MB.

**Why not just raise the cap.** The PDF travelled base64-encoded inside a JSON body that the
worker parses and re-serialises. On the free plan's ten milliseconds of CPU per request, a
15 MB JSON body is a coin toss. So the bytes must never sit in a worker as text.

**What happens now.** Up to 4 MB nothing changed. Above it, and up to 16 MB, the app PUTs
the raw PDF to the new `/api/report-put?t=<gallery token>`, which streams it into R2 under
`gallery/<token>/report-<16 random hex>` (no CPU: the stream goes straight through) and
answers with that id. `send-pdf` is then called with `hosted:<id>` instead of `pdf`, checks
the shape of the id and that the object is there, and mails a Resend `path` attachment
pointing at `/api/media-file?t=<token>&id=<id>` - Resend fetches the file itself while it
builds the message. Dropbox filing reads the bytes back out of R2 on this road. Over 16 MB,
or when there is no gallery to park in, the share sheet opens as before.

**Why the id is random.** The report has no `/up/` marker in KV, so the gallery never lists
it and `media-sync` never deletes it - but the gallery token is printed in the report and
may be passed on to a tenant, and a fixed `id=report` would let anyone holding that link
guess their way to a PDF with names and signatures the photos do not carry. A new send gets
a new id and `report-put` deletes the previous one, so a gallery keeps exactly one report.

The upload shows "Uploading the report NN %" while it runs (XHR, since fetch has no upload
progress), retries once on a dropped connection like the photo upload, and has the same
120 s timeout. `send-pdf` refuses a base64 body over 6 MB with 413 so nobody can push a big
JSON body through the old road. `sendMail` accepts `{filename, path}` next to
`{filename, content}`; the SendGrid branch fetches and inlines a hosted file since SendGrid
has no URL attachments.

**Not changed:** the signing link still takes 4 MB at most (`MAX_PDF`) - `sign-complete`
runs pdf-lib over the whole file in the worker, which is a separate CPU problem.

**Verified with 118 checks** in `outputs/report-mail-test/` (Electron as Node, README there):
the whole app script parses; every function file imports; `report-put` refuses GET, a missing
app header, a bad or unknown or expired token, an empty body and 17 MB, stores 12 bytes under
a random id as `application/pdf`, deletes nothing on the first send, and on the second gives a
different id, deletes exactly the previous report and keeps the new one; `send-pdf` forwards
base64 unchanged, routes check-ins to guestservice, refuses 6 MB+ base64 and a body with
neither field, refuses a `hosted` id that is `true`, `report`, a path traversal, uppercase or
too short - without mailing anything - answers 404 for a gallery or an object that is not
there, builds the media-file URL on the request's own origin with filename and content type,
reads R2 exactly once for Dropbox and uploads to `<folder>/<name>.pdf`; SendGrid gets the
fetched bytes as base64. On the phone side: 2 MB and exactly 4 MB go inline with the gallery
token, 9 MB uploads first with the app header and 120 s timeout and passes the id it got back
as `hosted`, the post waits 60 s hosted against 25 s inline, progress toasts fire once per
percentage, 16.5 MB and 9 MB-without-gallery return `size` with no traffic, PUT 413 → size and
401 → reload without retry, one dropped connection retries and succeeds, two give up with the
last reason and never post, neither an HTML 200 from Cloudflare nor a 200 without an id counts
as an upload, and a 404 or 429 from send-pdf maps to the existing toasts. **Not run against
Cloudflare yet** - the first live send over 4 MB is the real test; watch for Cloudflare's bot
rules blocking Resend's fetch of `/api/media-file` (the mail would then fail with 502 and the
share sheet opens).

### 2026-09-22 — the property register: addresses and apartments behind the two fields

**Where the data was.** The app's key register, [nycklar.js](nycklar.js), holds 30 bundles, all
Upplandsgatan 91B, objects 112-119. The full list it was seeded from - `Nyckellista Pondus
Pro.pdf`, in Downloads - is intact and was read out in full: 1 184 key rows, **369 bundles, 100
apartments, 23 addresses**, objects 112 to 403. Even 91B is short in the app: the list has 41
bundles there, and objects 123, 125 and 126 (eleven bundles, apartments 1501 and up) never made
it in. Nothing in the app is missing from the list, and the key count per bundle matches for all
30, so what is there is right as far as it goes. 20 rows are still marked "vart går denna???"
and 79 have no key type - that is the review the full import waits on.

**A second source arrived:** the door-code list out of Beaps (Dataverse, `bdev_property`, active
properties with a code filled in, taken 2026-09-22) - 73 addresses with codes and the hours they
work. 59 of them have no keys in the key list at all, and 9 addresses in the key list have no
door code. "S:t Eriksgatan 53B" in one list is "Sankt Eriksgatan 53B" in the other.

**What was built from it.** [fastigheter.js](fastigheter.js), a property register: **82
addresses, 100 apartments**, the addresses merged from both sources, the apartment numbers and
names from the key list. It is fetched on demand the first time the Property step is shown, like
the key register, so a phone that never opens that step pays nothing for it.

Both fields on that step now suggest as you type (`paintPropSug` in index.html). The address
field offers matches once anything is typed; matching is word by word in any order, so "eriksg
53b" finds Sankt Eriksgatan 53B and "91b uppl" finds Upplandsgatan 91B, and S:t folds to Sankt
so either spelling lands on the same property. Once the address names a property, its
apartments are listed straight away, number and name, and a tap fills the field. **Nothing is
forced**: both fields still take anything typed, an address the register has not got simply
suggests nothing, and the suggestions disappear once a field names something exactly. Picking
writes through the same path as typing, so nothing downstream has to know where the value came
from.

**The point of it, beyond the typing:** the key card inside an inspection finds its apartment by
matching the inspection's address and apartment number against the key register. An address
written the same way every time is what makes that match land, and a picked address always is.

**The door codes are deliberately not in the app.** index.html and everything beside it is
served as-is from a public address, so a code in a file there is a code anyone who finds the app
can read. The list is kept in `outputs/fastigheter/portkoder.txt`, outside the deploy, together
with the generator and a merge report. `outputs/` is now in [.gitignore](.gitignore) so neither
the codes nor the extracted key list can be committed by an absent-minded `git add -A`. If the
codes should reach the phones, the way to do it is an endpoint behind the same guard as the key
log - or better, Cloudflare Access - not a file in the deploy.

**Verified** in headless Edge, 68 checks in Swedish and English (the 50 key-flow ones plus 18
for this): the register loading on the Property step, an empty field suggesting nothing, typing
narrowing, word matching in any order, the two spellings of S:t, an unknown address suggesting
nothing and keeping what was typed, picking writing address and apartment, apartments matching
on name as well as number, an address with no apartments in the list, free text surviving, the
key card matching the apartment after a pick, and the door codes being absent from the register.

### 2026-09-22 — the signing link takes a big report too, and stops rewriting it

Same day, same cause as the entry above, but a harder one. The signing link capped at 4 MB,
and raising the cap alone would have made things worse: the link would go out fine and then
fail at the moment the counterparty signed.

**Why.** `sign-complete` did the heaviest thing in the codebase. It read the report back out
of KV as base64, turned it into bytes one byte at a time, had pdf-lib parse and re-serialise
the whole document to append the signature page, then encoded the result back to base64.
That is hundreds of milliseconds of CPU for a real report, against the free plan's ten. The
setup notes had flagged it as untested and probably over budget, and step 4 in
[CLOUDFLARE.md](CLOUDFLARE.md) - send a link, sign it, receive the report - is on record as
the one part never run live anywhere.

**The decision.** Two ways out: Workers Paid at five dollars a month, which lifts CPU to
30 s and lets the merge stand; or stop merging. We chose to stop merging and stay on free.

**What the recipient gets now.** Two files instead of one: the report exactly as it was
signed, and a one-page signature certificate carrying who signed, when, the signature image,
the confirmation text, the report's filename, and the report's **SHA-256** so the pair can be
told to belong together. Building one page from scratch is a few milliseconds. Nothing
rewrites the report - which is also the stronger position: what the counterparty saw is
byte-for-byte what is filed, rather than something re-serialised afterwards.

**The rest of the road.** The report now goes up as raw bytes to the new
`/api/sign-upload`, which streams it into R2 under `sign/<48 random hex>` and answers with
the id; `sign-request` ties that id to the link's token instead of putting base64 in KV
(16 MB of PDF is 21 MB of base64, near KV's 25 MB ceiling for one value). `sign-pdf` streams
from R2 and answers Range, so the signer's phone can page through a large document instead
of waiting for all of it - and that same URL is what the mail service fetches to attach the
report, so no worker ever holds it. The signature certificate is small, so it stays in KV and
`sign-pdf?t=…&cert=1` serves it; the signed page in `sign.html` now links to both files.
Revoking a link deletes the R2 object. Dropbox gets both files, the report streamed out of R2
rather than held in memory.

**The fingerprint is computed on the phone**, not here: hashing 16 MB would eat the request's
whole CPU budget. That is safe because it is the inspector's own phone that supplies both the
report and the hash, so there is nothing to be gained by it lying about one of them - the
signer, who is the party the integrity guarantee is about, never touches either.

**Nothing old breaks.** Links already out there keep their base64 in KV and are still served,
still signable, and get the same two files. A host without `sign-upload` - an older Netlify
deploy answers 404, Cloudflare answers the app's own HTML with 200 - makes the app fall back
to the base64 road at the old 4 MB cap, so `netlify.app` behaves exactly as it did.

**Verified with 206 checks** across three harnesses in `outputs/report-mail-test/` (Electron
as Node; pdf-lib is not installed here, so `sign-complete`'s PDFDocument is stubbed and what
is checked is the orchestration around it). For the signing flow specifically: `sign-upload`
refuses GET, a missing app header, an empty body and 17 MB, and stores under `sign/<id>`
without touching KV; `sign-request` takes the uploaded road and records the id and
fingerprint, refuses an id with no object behind it without mailing, drops a malformed
fingerprint, and still takes the legacy base64 road into KV at the old 4 MB cap; `sign-pdf`
streams from R2 with Range and the right filename, falls back to KV for an old link, 404s
when the report is gone, 410s on a revoked link, and serves the certificate under its own
name; `sign-complete` creates a document rather than loading one, draws exactly one page with
the signature image, never reads the report into the worker, mails two attachments with the
report as a fetched path and the certificate inline, prints the signer, both halves of the
fingerprint and the report's name, stores `cert/` and no longer stores a merged file, and
still refuses an already-signed, revoked or expired link, a missing or oversized signature,
and a report that has gone; an old KV link signs and gets its TTL renewed; Dropbox receives
both files - only the certificate for an old KV link, since decoding it to hand over is the
cost being avoided; revoking deletes the R2 object. **Not run against Cloudflare yet** - and since
pdf-lib is stubbed here, the certificate's real rendering is unverified: send one signing
link to yourself before the first sharp one.

### 2026-09-23 — the review before it went out: proving the phones lose nothing

Everything above went live in one go, so the whole of it was read through first, with one
question in front: an inspector is halfway through a move-out on his phone right now, and
opening the new app must not cost him a single photo or comment.

**What the storage actually shows.** The database is untouched: same name `beaps-besiktning`,
same version 1, same store `kv`, and the key map (`bp:index`, `bp:insp:`, `bp:ph:`, `bp:th:`,
`bp:vid:`) is byte for byte what it was. localStorage still holds only the language, plus the
new key-design choice. Every delete path in the app is the one that was already there -
`wipe`, deleting a photo, deleting a video - and the only new deletion in the whole diff is
`store.del('bp:keys')`, the retired key projection, which is recomputed from the shared log
and so carries nothing of its own. The app token is the same in all five files.

**The upgrade run** (`outputs/migrate-test/`, 39 checks, headless Edge). A mock server serves
*both* versions on one origin - `?ver=old` is `git show HEAD:index.html`, the copy the phones
are running - so the new app opens the very database the old one wrote. The old app does a
day's work through its own `newInsp`/`save`/`log`: a move-out seven rooms in with comments,
three photos and an activity log; a shortstay unlock with six checklist points answered and a
comment; a signed and closed move-in with both signatures and a gallery token; and a bundle
checked out. Then the new app opens it. Every report is in the list and painted; no stored
record disappeared and none was rewritten; every room, comment, hand-added room, photo
reference and photo byte is there; the checklist keeps its rows, its answers and its comment;
the signed one is still signed, still locked, still has both signatures; the key log keeps its
name and the bundle is still out with the same person; and the new app writes back into the
same record without losing a room. No script error, and nothing the app had to warn about.

**The chain nobody had run** (`outputs/report-mail-test/chain-test.mjs`, 27 checks). The other
harnesses mock `/api/media-file` away, so the one link that had never been exercised was the
endpoint Resend actually fetches. Run for real against a shared R2: the report parks, comes
back byte for byte whole and by Range, the mail's own URL resolves, a wrong gallery token and
the guessable id `report` get nothing, `media-sync` leaves the report alone, the gallery never
lists it, and a second send replaces the first so a gallery keeps exactly one.

**Fixed in the review.** `sign.html` now offers a signature-page link on every signed page,
but a link signed *before* the split has no `cert/` - back then the page was merged in and
archived under `signed/`. That link would have answered 404 on reports signed in the last 30
days. `sign-pdf` now falls back to the archived document and names it accordingly.

**Totals:** 236 function checks, 68 key-flow checks in the browser, 39 upgrade checks, every
`T()` string in the code has a Swedish translation, and no debug hook, `console.log` or
hard-coded host anywhere in a shipped file. Still not run against Cloudflare: the first live
send over 4 MB and the first signing link are the real tests - watch for Cloudflare's bot
rules blocking Resend's fetch of `/api/media-file` and `/api/sign-pdf`.

### 2026-09-23 — the key screens join the rest of the app: white, and half the words

Erik, on seeing the green: *"kör på en vit ruta som bara visar innehav, och initialer ...
samma i inspektionerna, gör det inte till grön färg, istället vitt som allt annat ... byt ALL
robott text, och fixa färgerna och ta bort onödig text, fokus på simplicitiet."*

**The three design proposals are gone.** 1 (light peach), 3 (dark peach) and 4 (emerald) were
built the day before as something to choose between; the choice turned out to be none of them.
The `:root[data-ktheme]` token sets, every `.ksheet`/`.kcard` colour rule, the switch in the
menu and the scanner's own chrome all came out - about a hundred lines of CSS for roughly
thirty of layout. What is left carries no palette: the key screens are white cards on the
app's paper, navy text, yellow only on the button you press, exactly like every other screen.
A phone with a theme stored has it removed on the next load, so nobody keeps a dark one.

**Initials instead of names.** A name on every row was the bulk of the text on the log, and
the number is what anyone is actually looking for. `initials()` turns "Erik Gardbring" into a
navy circle reading EG; the full name is in the row's `title` and spelled out on the bundle
itself. The two lists, *Utlånade just nu* and *I lägenhet / hos gäst*, are now one: everything
that is not in the cabinet, newest first, the apartment on the row when it is in one.

**The "Till — frivilligt" field is gone** from the key card in an inspection. The inspection
already asked for the counterparty on its first step, so the field was asking twice; the
hand-over takes that name. An inspection that still carries something typed into the old field
keeps it.

**And the wording.** Sentences became labels throughout the key flow: *Loggen har inte hämtats
än — statusen kan vara fel* → *Ej hämtad*; *Du har inga nycklar utcheckade* → *Inga hos dig*;
*tryck för att lämna den här* → *lämna här*; *Lämna i lägenheten* → *Lämna här*; *Utcheckad av
Erik — Visning* → *Utlånad · Visning* with EG beside it. The three warnings before a hand-over
went from sentences to phrases (*Hos Maria · 09:15*, *Hör till lgh 1301 TRAST*). What was
dropped is wording, not fact: where a bundle came from is still written on the event and still
visible in the bundle's own history, and the apartment and the guest both stay on a hand-over
line. 38 entries left the Swedish table; every `T()` string in the code still has one.

**Also corrected:** three lines still promised "den färdiga rapporten med signatursidan" as one
file. Since the signing split the day before, that had been untrue - the mail carries two.

**Verified:** 236 function checks, 66 key-flow checks in the browser, and the upgrade run again
from the deployed app to this one - the storage contract is untouched (same database, same key
map, the only localStorage write removed is the theme), so nothing in progress is affected.
Eight browser assertions were rewritten rather than deleted: where a line got shorter, the
check now reads the stored event instead of the sentence, since the data is what has to
survive a rewording.

**Left alone:** the explanatory text elsewhere in the app - camera permissions, the
home-screen warning, what the gallery link is for. Those are read once by someone who needs
them, and shortening them would cost more than it saves. Say so if they should go too.

### 2026-09-23 — the key card moves to the bottom, drops the address, and becomes a receipt

Three things Erik asked for the same afternoon, while testing.

**The card sits last.** It used to be wedged in mid-page: after the Keys room on a move-in or
move-out, and at the end of the door-and-keys section of a shortstay checklist. Both are gone;
it is now the last card on the page in either view. `checkList()` is back to doing only what
its name says.

**No address needed.** `hoBegin` refused a hand-over until the Property step had been filled
in. That guard is gone - the bundle number already says which apartment the keys belong to, so
requiring the address as well was the app demanding something, which is the one thing it must
not do (see section 8). Without an address the event simply carries no place and the line
reads *Lämnad till Nina Nilsson*, or *Lämnad* when there is no name either. The card also
lists everything you are carrying when the apartment is unknown, rather than nothing, so there
is still something to tap.

**And the PDF gets a receipt, not a question.** Erik: *"Det ska också komma upp som något
annat på PDF:en. Inte en fråga men bara separat, keys handed over? Kom på nått smart."* A
yes/no would have said nothing that the activity log did not. What the report now carries is a
boxed block, *KEYS HANDED OVER*, listing **every physical key on the ring** by type and
marking:

```
KEYS HANDED OVER
112:3  TÄRNA
lgh 1102 TÄRNA · Anna Svensson
2026-09-23 12:07  ·  handed over by Erik
  1  Lägenhetsnyckel   1352574
  2  Postboxnyckel     Din Box
  3  HG-nyckel         AS 19S
  4  Oidentifierad     38R
  5  Bricka            MFR198549179
```

That is the thing a move-out argument is actually about, and no free-text "3 nycklar + bricka"
in the Keys room can settle it. The block appears only when a bundle was handed over, so an
inspection without one is unchanged. It is drawn from a new `S.keysOut`, written at the moment
of the hand-over with the keys copied off the register as they stood then - so the report says
what was handed over even if the register is corrected later, and the PDF needs nothing loaded
to draw it. A second hand-over of the same bundle replaces its row rather than adding one.
`S.keysOut` rides along in backups and restores, since those serialise the whole inspection.

**Caught while looking at the output:** the register's fourth field is an internal note, and
twenty rows still say *"vart går denna???"*. The first draft printed it straight into the
report. Type and marking only now, both in the PDF and in what is stored.

**Verified:** 81 key-flow checks in the browser (13 new: the card's position in both views, a
hand-over with no address at all, the receipt's contents, and that re-leaving a bundle does not
duplicate it), 236 function checks, and the upgrade run. The PDF was built for real in the
browser and its text read back out of the file - `outputs/keyflow-test/shots/receipt.pdf`,
`cdp.cjs shots 4 pdf`.

### 2026-09-23 — checking a key in or out moves into the menu

The start screen had two buttons stacked at the bottom, *Ny besiktning* in yellow and *Checka
in/ut nyckel* in navy. Erik asked for the second one under the hamburger, and it belongs
there: starting an inspection is what the screen is for, a key errand is a side trip. The menu
now reads *Checka in/ut nyckel · Nyckellogg · Språk* - the action first, then the view of it -
and the bar is one full-width button.

Nothing else moved. The Keys card on the start screen still shows what you are carrying and
still opens the log in one tap; what costs an extra tap now is the scanner. The menu only
exists on the start screen (the hamburger is drawn in `renderStart`, not in `topbar`), which is
where the scanner was reachable from before, so nothing became harder to find from inside an
inspection - it was never there.

**Swept out while in there:** `.btn.navy`, whose only user was that button, and the dead
translation `'Write the address first'` left behind when the address stopped being required.

**Verified:** 86 key-flow checks (5 new: the bar holds one button and it is the right one, the
scanner is in the menu and comes first, the log is beside it), 236 function checks, and the
upgrade run.

### 2026-09-23 — the start button stops floating in the middle of the report list

Erik: *"gör den vita outlinen bakom ny besiktningsknappen lite tydligare, så att den inte
smälter in bland alla rapporter."* Screenshotting the start screen with five reports on it
showed the real trouble, which was worse than a weak backdrop: `.bar.raised` pins the bar
**25vh up from the bottom**, so with a list on the screen it floated in the middle of it,
slicing whichever report happened to be level with it in half and leaving more reports
visible below the button. The bar's background was a gradient fading to transparent at the
top, so white cards showed straight through behind the yellow button. It did not look like a
button over a list; it looked like a row in one.

Two changes. The bar is now a **shelf**: solid paper, a hairline (`#D4D0C8`, darker than the
card border so it reads against the paper), and a soft upward shadow, so the list clearly
slides underneath. And the lift is kept **only for an empty start screen**, where it puts the
one button in thumb reach with nothing to scroll; as soon as there is a report the bar sits at
the bottom, where a bottom bar belongs. `body.start` reserves the smaller bottom padding, and
`body.start.empty` keeps the old generous one, set from `renderStart` and cleared in `go()`
with the `start` class.

The lifted bar drops the shelf again - transparent, no hairline, no shadow - because nothing
scrolls under it and a line across an empty screen is just a stray line. That was visible
immediately on the screenshot after the first attempt, which put the band there in both states.

**Verified:** 86 key-flow checks, 236 function checks, the upgrade run, and both start states
screenshotted (`cdp.cjs shots 4 list` builds five reports for the case that was broken).

### 2026-09-23 — the app gets a serif, initials you can set, and one less number

Erik: *"jag vill att du byter robott-formateringen, formatet som ser stilrent ut, men ALLA
Claude kodade projekt har samma."*

**A serif.** The system sans plus monospace micro-labels in wide-tracked uppercase is what
every app built this way looks like, and he is right that it is a tell. `--serif` is now
`ui-serif, Georgia, "Times New Roman", Times, serif` - **New York** on an iPhone, Apple's own
screen serif, Georgia on Windows and Android, Times where neither exists. `--sans` and
`--mono` are kept as names pointing at it, so the ~30 rules below did not all have to change
at once, and a new `--num` carries the tabular face to the dozen places where digits have to
line up: bundle numbers, the numbered circles beside each key, the initials badge, the
scanner's field, the camera counter, timestamp columns. The eyebrow labels went up a point and
a weight, since small caps in a serif need more than a monospace did.

The log was all tabular, which made it read as a terminal dump rather than a record. Now the
timestamp and the bundle number keep their column and **what happened** is read in the serif.

**Initials are yours to set.** They were two letters taken off the name, and that guess is
wrong often enough - Erik's own came out EW. A field sits beside the name field wherever the
name is edited, saved in `bp:keyini` on this phone. It is stored **only when it is not what
either the old or the new name would have given**, so leaving it alone lets the initials
follow a changed name, and typing your own pins them. Everyone else's are still worked out
from what they wrote, since this phone has nothing else to go on. The collapsed line now reads
*Erik · ER · ändra*, so you can see what will be logged without opening anything.

**And "15 rapporter" is gone** from above the list - the list is right there. The count stays
on *Ta bort alla 15 rapporter*, where it is the whole point of the sentence.

**Fixed on the way:** yesterday's `body.start.empty` collided with `.empty`, the dashed
empty-state card - the whole page was picking up a dashed border, centred text and the wrong
background. Renamed `noreports`. It was visible in the screenshot and not in any test, which
is the argument for looking at the thing.

**Verified:** 96 key-flow checks (10 new: the count is gone but the list is not, the initials
field appears and starts from the name, an untouched field stores nothing, your own are kept
and saved and used for you but not for others, and a stale pair follows a changed name), 236
function checks, the upgrade run.

**Not changed:** the PDF still sets its text in Helvetica. jsPDF has Times built in and the
report is the one document a customer keeps, so it is worth doing - but every line width
changes with the font, so it wants its own pass and its own look at the output.

---

## 6. Kvar att göra

Inget beslutat just nu. Idéer som dykt upp men inte prioriterats:

- **Hämta signaturen automatiskt** i stället för att appen frågar när protokollet öppnas.
- **Mät wifi på fler ställen** i lägenheten och spara flera mätningar, om det visar sig att
  en punkt inte räcker.

---

## 6b. Appen körs på Cloudflare Pages sedan 2026-08-28

`beaps-besiktning.pages.dev` är i drift med hela den nya versionen. Netlify ligger kvar
orörd med all befintlig data. Uppsättningen står i [CLOUDFLARE.md](CLOUDFLARE.md).

**Fällan som kostade en halv dag:** i Cloudflares nya dashboard hamnar man lätt i
*Create a Worker* i stället för Pages. Det skapade ett andra projekt med **samma namn**,
och KV-bindningen lades där i stället för på Pages-projektet. Två lyckade Pages-deployer
i rad svarade ändå *"KV-lagringen SIGNSTORE ar inte kopplad"*, eftersom bindningen satt
på fel projekt.

Så skiljer man dem åt i byggloggen:

| Pages, rätt | Worker, fel |
|---|---|
| `Installing project dependencies: npm install` | `Installing project dependencies: bun install` |
| `Found Functions directory at /functions` | `Executing user deploy command: npx wrangler deploy` |
| `Compiled Worker successfully` | `Missing entry-point to Worker script` |

Worker-projektet är borttaget. Finns bara ett projekt går det inte att klicka fel igen.

**Bindningen ligger numera i [wrangler.jsonc](wrangler.jsonc)**, inte i dashboarden. Den
följer då med varje deploy och kan inte hamna på fel projekt eller fel miljö. Priset är
att filen blir facit: när den finns läses **vanliga miljövariabler därifrån och inte från
dashboarden**. Secrets — `RESEND_API_KEY` — ligger kvar i dashboarden och ska aldrig in
i filen, eftersom den ligger i git.

Det betyder att varje `MAIL_TO`-variabel måste stå i `vars` i wrangler.jsonc för att gälla.
Slutar mejlen komma fram är det första stället att titta.

---

## 7. Deploy

Netlify **är** kopplat till GitHub — projektet står som *Deploys from GitHub*. En push till
`main` ska alltså gå live av sig själv.

**Men 2026-08-28 är produktionsdeployer pausade.** Teamet kör på operational credits, och
Netlify skriver: *"Your published sites are still live, but production deploys and Agent
Runners are paused."* Commit `841fbbe` och `55f1f56` ligger på `origin/main`, men live-sajten
är oförändrad — det är inte ett trasigt bygge, Netlify vägrar bygga alls.

Publicerade sajter fortsätter fungera, så inget är sönder för dem som använder appen. Men
ingenting nytt når ut.

**Budgeten, avläst 2026-08-28:**

| Post | Förbrukning |
|---|---|
| Produktionsdeployer, 18 st | **270 credits** |
| AI inference (OpenAI, 142K tokens) | 30,6 credits |
| Compute | 2,6 credits |
| Web requests + bandbredd | 0,2 credits |
| **Totalt** | **303,4 av 300** |

Det viktiga talet: **en produktionsdeploy kostar ungefär 15 credits**, alltså rymmer
gratisplanens 300 credits bara **omkring 20 deployer i månaden**. Perioden löper
21 augusti till 20 september och nollställs **21 september 2026**. Hela månadsbudgeten
gick åt på en vecka.

Två slutsatser att arbeta efter:

- **Samla ihop ändringar innan du pushar.** Med tjugo deployer i månaden går det inte att
  pusha per ändring. Testa lokalt, slå ihop, deploya en gång.
- **Kontrollera vad AI inference är.** 30,6 credits gick till OpenAI via Netlifys AI Gateway
  eller Agent Runners. Är det inget medvetet, stäng av det — det är två deployer i månaden.

Alternativen just nu:

- **Vänta till 21 september.** Gratis, deployerna återupptas av sig själva, och pushen
  ligger redan på GitHub.
- **Uppgradera teamet.** Släpper loss deployerna direkt, kostar pengar.
- **Deploy Preview på en gren.** Gratisplanen listar *Unlimited deploy previews*, så en
  gren kan mycket väl gå att bygga även nu. Värt att prova — men se varningen nedan.
- **Flytta till Cloudflare Pages.** Ingen kostnad per deploy och 500 byggen i månaden.
  Kräver att funktionerna skrivs om: routingen använder Netlifys `config.path` och
  lagringen använder Netlify Blobs, som får bli Cloudflare KV. Några timmars arbete.
  Rimligt om deployerna tar slut igen.

**Varning om Deploy Previews:** en förhandsvisning ligger på en annan adress, och
IndexedDB är knutet till adressen. Besiktningar som görs på förhandsvisningen finns
alltså **inte** på den riktiga sajten. Använd den bara för att prova funktioner, aldrig
för skarpa besiktningar.

**Dra inte in mappen manuellt som ett kringgående.** Det har fungerat förr, men nu finns
`package.json`. En manuell drop installerar inte beroendena, så `@netlify/blobs` och
`pdf-lib` skulle saknas och signeringen vara trasig medan resten fungerar — sämsta sortens
halvtrasigt. Bara ett riktigt bygge från Git installerar dem.

- `package.json` gör att Netlify installerar `@netlify/blobs` och `pdf-lib` åt funktionerna
  vid varje deploy. Appen själv har fortfarande inget byggsteg, den är statisk.
- **Efter första lyckade deployen med de nya funktionerna:** kontrollera under Functions
  att `sign-request`, `sign-view`, `sign-complete` och `speedtest` finns där. Saknas de har
  installationen av beroendena fallerat. Då svarar signeringen och wifi-mätningen med ett
  felmeddelande i appen — resten av appen påverkas inte.
- Skicka en signeringslänk till dig själv först. Funktionerna är testade mot stubbade anrop,
  men har aldrig körts mot riktiga Netlify Blobs eller Resend.
- Ett snabbt sätt att se om en deploy gått fram: `/api/speed-ping` ska svara 200 och
  `/sign.html` ska finnas. Ger de 404 är den nya versionen inte ute.

---

## 7b. Mejl som blockeras av beaps.se

Mejl via Resend fastnar på väg till @beaps.se, medan mejl från Gmail går fram.
DNS-kontroll 2026-08-28 visar att **autentiseringen inte är problemet**:

| Post | Värde | Status |
|---|---|---|
| `bedoma.se` MX | `smtp.google.com` | Google Workspace |
| `resend._domainkey.bedoma.se` | DKIM-nyckel publicerad | ✓ |
| `send.bedoma.se` MX | `feedback-smtp.eu-west-1.amazonses.com` | ✓ |
| `send.bedoma.se` SPF | innehåller `amazonses.com` | ✓ |
| `bedoma.se` DMARC | `p=none` | ✓ |
| `beaps.se` MX | `beaps-se.mail.protection.outlook.com` | **Microsoft 365** |

SPF passerar på `send.bedoma.se`, DKIM signerar med `d=bedoma.se`, DMARC ligger i linje.
Kvar står **Microsoft 365:s ryktesfiltrering** — en helt ny avsändardomän som skickar
automatiska mejl med PDF-bilagor till en organisation som aldrig sett den förr är ett
läroboksfall för karantän hos Exchange Online Protection. Gmail går fram därför att
Googles servrar har årtionden av rykte bakom sig, inte för att något är fel i vår uppsättning.

**Kontrollera först:** står `MAIL_FROM` verkligen satt i Netlifys miljövariabler? Är den
tom skickar koden från `onboarding@resend.dev` — Resends delade testdomän, som Microsoft
filtrerar hårt. Det ensamt skulle förklara alltihop. Se `netlify/functions/send-pdf.mjs`.

**Sedan, i tur och ordning:**

1. **Resends dashboard** visar per mejl om det blev *Delivered*, *Bounced* eller
   *Complained*. Studs med Outlook-felkod betyder hård blockering; levererat men osett
   betyder skräpposten. De två kräver olika åtgärder. Två minuters jobb, störst utdelning.
2. **Låt beaps.se:s Microsoft 365-administratör vitlista avsändaren.** Microsoft Defender →
   Policies & rules → Threat policies → Tenant Allow/Block List → Domains & addresses →
   tillåt `besiktning@bedoma.se` eller hela `bedoma.se`. Det är den varaktiga lösningen och
   tar fem minuter för den som har behörighet.
3. **Att Camilla mejlar avsändaren hjälper delvis.** Svarar hon på ett mejl från
   `besiktning@bedoma.se` läggs adressen bland hennes kontakter, och Outlook väger kända
   kontakter positivt. Det löser troligen *hennes* brevlåda — men inte `longstay@beaps.se`
   eller någon annans, och det står sig inte mot en spärr på organisationsnivå. Gör det
   gärna som snabb nödlösning, men punkt 2 är fixen.
4. **Om de inte vill vitlista:** verifiera en subdomän under beaps.se i Resend, t.ex.
   `mail.beaps.se`, och skicka som `besiktning@mail.beaps.se`. Mejl från deras egen domän
   filtreras betydligt mildare. Det kräver tre DNS-poster på en *subdomän* och rör inte
   deras befintliga mejlflöde alls — värt att ompröva givet besväret.

---

## 8. Principer

**Appen används dagligen i verksamheten. Alla ändringar måste granskas noggrant och verifieras så att befintliga arbetsflöden och sparade uppgifter inte rubbas.**

**Appen kräver aldrig något.** Man ska kunna lämna punkter obesvarade, skicka utan
kommentar och signera i vilken ordning som helst. Appen får upplysa, räkna och markera —
men inte spärra, tvinga fram ett svar eller lägga en dialogruta i vägen. Bekräftelserutor
finns bara kvar där något går förlorat: radera ett rum, låsa upp ett protokoll, återkalla
en länk. Lägg inte till nya krav på ifyllnad utan att fråga först.

**Ordningen i checklistan följer rundan i lägenheten**, inte en logisk gruppering. Flytta
inte om frågor för att de passar bättre ihop på pappret.

**Nycklar är för alltid.** `key` på en checklistrad får aldrig ändras — den är enda skälet
till att gamla besiktningar behåller sina svar när frågetexten skrivs om.

---

## 9. Bra att veta

- Appen fungerar utan mejlkonfiguration — då öppnas delningsmenyn i stället.
  Signeringslänkar kräver dock att Resend eller SendGrid är uppsatt.
- Bilder och video ligger **bara** på telefonen tills PDF:en skickas. Töms webbläsarens
  data försvinner de. Knappen *Säkerhetskopia* på avslutssidan finns för det.
- Det finns inget `</body>`/`</html>` i index.html; filen slutar med `renderStart()`.
