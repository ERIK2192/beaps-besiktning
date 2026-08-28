# Beaps Besiktning — arbetslogg

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
| [package.json](package.json) | Beroenden för funktionerna: `@netlify/blobs`, `pdf-lib` |
| [netlify.toml](netlify.toml) | Publicerar rotmappen, pekar ut funktionsmappen |
| [netlify/lib/mail.mjs](netlify/lib/mail.mjs) | Delad mejlhjälp för signeringsfunktionerna |
| [netlify/functions/send-pdf.mjs](netlify/functions/send-pdf.mjs) | Mejlar PDF:en · `/api/send-pdf` |
| [netlify/functions/sign-request.mjs](netlify/functions/sign-request.mjs) | Skapar signeringslänken · `/api/sign-request` |
| [netlify/functions/sign-view.mjs](netlify/functions/sign-view.mjs) | Läser länken · `/api/sign-load`, `/api/sign-pdf` |
| [netlify/functions/sign-complete.mjs](netlify/functions/sign-complete.mjs) | Tar emot signaturen · `/api/sign-complete`, `/api/sign-cancel` |
| [netlify/functions/speedtest.mjs](netlify/functions/speedtest.mjs) | Wifi-mätningen · `/api/speed-ping`, `/api/speed-down`, `/api/speed-up` |
| [functions/api/](functions/api/) | Cloudflares versioner av funktionerna |
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
Är filen över ca 4 MB öppnas delningsmenyn i stället.

**Signering på distans** är det enda som lagras utanför telefonen. Protokollet läggs i
**Netlify Blobs** bakom en slumpad 48-teckens token, i 30 dagar. Se avsnitt 5.

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
