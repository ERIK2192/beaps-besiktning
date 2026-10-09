# Sätta upp appen på Cloudflare Pages

Netlify rörs inte. Den sajten ligger kvar med all data som redan finns på telefonerna.
Det här är en andra plats att köra appen från, utan tak på antalet deployer.

Räkna med tjugo minuter.

---

## Innan du börjar

Ha detta till hands:

- Din **Resend API-nyckel** (finns i Resend under API Keys, eller i Netlify under
  Environment variables → `RESEND_API_KEY`)
- Värdet på **`MAIL_FROM`** från Netlify, samma ställe

---

## 1. Skapa konto och projekt

1. Gå till [dash.cloudflare.com](https://dash.cloudflare.com) och skapa ett konto. Gratis,
   inget kort behövs.
2. I vänsterspalten: **Workers & Pages** → **Create** → fliken **Pages** →
   **Connect to Git**.
3. Godkänn Cloudflares åtkomst till GitHub och välj repot **`ERIK2192/beaps-besiktning`**.

## 2. Byggnadsinställningar

När den frågar om build settings, fyll i exakt så här:

| Fält | Värde |
|---|---|
| Project name | `beaps-besiktning` |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | `npm install` |
| Build output directory | `/` |

Byggkommandot behövs för att `pdf-lib` ska installeras. Utan det fungerar allt utom
signeringen.

Klicka **Save and Deploy**. Första bygget tar ett par minuter. Adressen blir
`beaps-besiktning.pages.dev`.

## 3. Lagring för signeringslänkarna

Signeringen behöver en plats att lägga protokollen på medan de väntar på signatur.

1. **Workers & Pages** → **KV** → **Create a namespace**.
2. Döp den till `beaps-signeringar`. Spara.
3. Gå tillbaka till Pages-projektet → **Settings** → **Bindings**
   (heter ibland **Functions** → **KV namespace bindings**) → **Add binding**.
4. Fyll i:
   - Variable name: **`SIGNSTORE`** — måste stavas exakt så
   - KV namespace: `beaps-signeringar`
5. Lägg till den för **Production**. Vill du att förhandsvisningar också ska fungera,
   lägg till samma binding för **Preview**.

**The same namespace also holds the key log.** Besides the signing protocols, `SIGNSTORE`
holds every key-bundle check-out and check-in as a `kev/<ts>-<id>` entry - the event itself
rides in the key's metadata, kept for 3 years - read back by `/api/keys-log`. No extra binding
is needed for it; it shares the namespace set up above.

## 3b. Lagring för bilder och video

Galleriet — det som gör att mottagaren kan zooma i bilderna och spela videon — behöver
en R2-bucket.

1. **Storage & databases** → **R2 Object Storage** → **Create bucket**
2. Namn: **`beaps-media`** — exakt så, koden är kopplad till det namnet
3. Location: lämna som föreslaget. **Skapa inte** någon publik åtkomst; filerna serveras
   genom appen så att bara den som har länken kommer åt dem.

Bindningen ligger redan i [wrangler.jsonc](wrangler.jsonc), så du behöver inte koppla den
någonstans. Den gäller vid nästa deploy.

R2:s gratisnivå ger 10 GB, vilket räcker till ungefär 14 000 bilder.

## 4. Miljövariabler

Pages-projektet → **Settings** → **Environment variables** → **Production** → **Add**:

| Namn | Värde | Typ |
|---|---|---|
| `RESEND_API_KEY` | din nyckel från Resend | **Secret** (klicka Encrypt) |
| `MAIL_FROM` | `Beaps Besiktning <besiktning@bedoma.se>` | Text |
| `APP_PASSWORD` | teamets lösenord till appen | **Secret** (klicka Encrypt) |

Vill du styra mottagarna, lägg även till `MAIL_TO_LONGSTAY` och `MAIL_TO_SHORTSTAY`.
Utan dem används longstay@beaps.se och guestservice@beaps.se, precis som förut.

**`APP_PASSWORD` måste finnas innan den deploy som bär inloggningsväggen (2026-10-02).**
Väggen stänger hellre än står öppen: saknas lösenordet serveras appen inte alls, utan en sida
som säger vilket namn som ska sättas (503). Gästernas signeringssida, galleriet och det
mejltjänsten hämtar påverkas inte av väggen. Ordningen är alltså: lägg in secreten, pusha
sedan. Den läses av funktionerna direkt, utan ombyggnad.

**Två inställningar till i Cloudflare hör till väggen.** Koden har två spärrar mot
lösenordsgissning: fler än tio svar till samma adress på tio sekunder avvisas direkt, och tio
fel lösenord pausar adressen en kvart. Ingen av dem är vattentät (räkningen går via KV och
per instans), så regeln i Cloudflare är den som håller:

1. **Rate limiting.** Gratisplanen ger exakt en regel, med tio sekunders räkneperiod, tio
   sekunders blockering, räkning per IP och bara sökvägen som villkor (metod går inte att
   välja). Gå till zonens **Security rules** → **Create rule** → **Rate limiting rules**:
   *Rule name* `login`; *Field* Path, *Operator* equals, *Value* `/api/login`; *With the same
   characteristics* IP; *When rate exceeds* 5 requests per 10 seconds; *Then take action*
   Block; **Deploy**. Mer än fem anrop på tio sekunder från en adress blockeras i tio
   sekunder, vilket gör gissning meningslös tillsammans med kvartspausen i koden. (Regeln
   förutsätter att appen ligger under en zon i kontot — en egen domän på `bedoma.se` — eller
   att Pages-projektets zon tillåter den; på en ren `pages.dev`-adress kan den saknas, och då
   är kodens två spärrar det som finns.)
2. **Fail closed.** Pages-projektet → **Settings** → **Runtime** → *Fail open / Fail closed*:
   välj **Fail closed**. Med väggen går varje anrop genom en funktion, och gratisplanen ger
   100 000 funktionsanrop per dag (räcker med bred marginal: ett appöppnande är en handfull).
   Men tar de ändå slut serverar *Fail open* de statiska filerna rakt av — alltså appen utan
   vägg. *Fail closed* svarar fel i stället, tills midnatt UTC.

Inloggningen ligger i en kaka som servern sätter och själv kontrollerar; lösenordet sparas
aldrig på telefonen. Den gäller **180 dagar** räknat från senaste gången appen öppnades: varje
öppnande äldre än ett dygn ger en ny kaka. En telefon i bruk ska alltså inte behöva logga in
igen. **Vad som är provat:** i Chromium (headless Edge) — omladdning, webbläsaren stängd och
öppnad igen, kakan slut mitt i arbetet, utloggning. **Inte provat:** iPhone. Där bygger det på
WebKits egen regel: sjudagarsgränsen gäller kakor satta från JavaScript och annan
skriptlagring, inte HttpOnly-kakor satta av servern i ett svar (webkit.org, ITP 2.1 och
tracking-prevention-policyn), och en hemskärmsapp har sin egen kaka — sedan iOS 17.2 kopieras
Safaris kakor över en gång när ikonen läggs till, annars loggar man in en gång i ikonen också.
Prova på en iPhone innan det lovas: logga in i Safari, stäng Safari helt, vänta en dag, öppna
igen; lägg till på hemskärmen, öppna ikonen; stäng allt, öppna ikonen nästa dag.

Logga in igen behöver man efter 180 dagar utan att ha öppnat appen, efter **Logga ut** i menyn,
i ett privat fönster (ingenting sparas där), i en annan webbläsare eller ikon, om
webbplatsdata rensas — och när lösenordet byts. **Utloggning** tar bort kakan på den
telefonen och ingenting annat: servern håller ingen lista över sessioner, så andra telefoner
berörs inte. **Lösenordsbyte** loggar ut alla på en gång, eftersom nyckeln som signerar
kakorna härleds ur lösenordet; byt värdet i kontrollpanelen, klart. Vill du kunna byta
lösenord utan att logga ut alla, sätt dessutom `APP_SESSION_SECRET` (en lång slumpad sträng,
Secret); då är det den som signerar kakorna, och det är den man byter för att logga ut alla.

**Deploya om efter att du lagt in variablerna** — Deployments → senaste → **Retry deployment**.
Variabler läses in vid bygget, så de gäller inte förrän en ny deploy körts.

## 5. Kontrollera att det fungerar

Öppna i tur och ordning:

1. `https://beaps-besiktning.pages.dev/api/speed-ping` — ska visa bokstaven `p`.
   Gör den inte det byggdes inte funktionerna. Läs byggloggen.
2. `https://beaps-besiktning.pages.dev/` — appen ska starta.
3. Gör en testbesiktning och mejla PDF:en: en inflytt ska komma till longstay@beaps.se, ett nytt objekt till michal@beaps.se.
4. Gör en utflytt och skicka en **signeringslänk till dig själv**. Öppna den, signera,
   och se att **två** filer kommer i mejlen: protokollet och signatursidan.
5. Öppna `https://beaps-besiktning.pages.dev/` i ett **privat fönster** — du ska mötas av
   inloggningssidan, inte appen. Prova `…/ARBETSLOGG.md` och `…/nycklar.js` på samma sätt:
   de ska också stoppas (401), inte visa sitt innehåll. Prova `…/api/keys-log` — 401.
6. Logga in med teamets lösenord. Stäng webbläsaren helt och öppna adressen igen: appen ska
   starta utan att fråga efter lösenordet. Menyn har nu **Logga ut**.
7. Öppna signeringslänken från steg 4 i det privata fönstret — den ska fungera utan någon
   inloggning, liksom gallerilänken i ett protokoll.

Steg 4 är det viktiga. Det är den enda delen som aldrig körts skarpt någonstans.
Gör den gärna en gång till med en utflytt på **över 4 MB** — det är den vägen som är ny.
Steg 5 bekräftar att väggen står framför de statiska filerna också; det är så Cloudflare
beskriver en `functions/_middleware.js` i roten, men det ska ses en gång på riktigt.

## 5a. Inloggningen och det som ligger på telefonen

Kravet (Erik, 2026-10-02): allt som finns på telefonen ska finnas kvar — protokoll, utkast,
bilder, inställningar; man öppnar sin befintliga ikon, skriver lösenordet en gång och är inne
som vanligt; nästa gång kommer man direkt in, även efter att appen stängts eller telefonen
startats om; inloggning, utloggning och en utgången session får aldrig radera sparat arbete.

**Så är det byggt.** Väggen rör aldrig telefonens lagring. Den serverar inloggningssidan i
stället för appen på samma adress; lagringen hör till adressen och ligger kvar orörd bakom
sidan. Vid utloggning sparas det som är öppet, kakan tas bort, och ingenting annat. Går kakan
ut mitt i arbetet läggs ett inloggningsblad ovanpå appen — ingen omladdning, inget försvinner,
och efter lösenordet fortsätter man där man var. **Provat i Chromium** (headless Edge, genom
den riktiga väggen): ett utkast med bild, namnet i menyn och språkvalet är bit för bit
desamma efter utloggning och ny inloggning; ett utkast öppnas som förut; ikonen-stängd-och-
öppnad-igen motsvaras av webbläsaren stängd och öppnad igen; uppgraderingstestet (41
kontroller) öppnar en databas som den gamla appen skrivit.

**Provas på en riktig iPhone innan det lovas** — med appen på hemskärmen och ett sparat
utkast. Först på förhandsadressen (avsnitt 5b), sedan på den riktiga ikonen efter deployen:

1. Öppna ikonen. Förväntat: inloggningssidan, inte appen. Skriv lösenordet. Förväntat:
   startskärmen med samma lista som innan, utkastet öppnas med sina bilder, namnet står kvar
   i menyn.
2. Stäng appen helt (svep bort den). Öppna ikonen. Förväntat: direkt in, inget lösenord.
3. Starta om telefonen. Öppna ikonen. Förväntat: direkt in.
4. Vänta ett dygn, öppna ikonen. Förväntat: direkt in (kakan förnyas i tysthet).
5. Menyn → Logga ut. Förväntat: inloggningssidan. Logga in. Förväntat: samma lista, utkastet
   intakt.
6. Öppna samma adress i Safari (inte ikonen). Förväntat: inloggningssidan — Safari och ikonen
   har varsin kaka, precis som varsin lagring. Det är inte ett fel.

**Vilken adress ikonen använder.** Öppna ikonen → menyn → **Nyckellogg** → **Kopiera länk**,
klistra in i Anteckningar: adressen börjar med `beaps-besiktning.pages.dev` eller
`beaps-besiktning.netlify.app`. (Fungerar nyckelloggen och bilduppladdningen i ikonen är det
Cloudflare; på Netlify finns de inte.) Gör det på varje telefon i teamet innan Netlify-
adressen stängs.

**Om någon ikon pekar på Netlify: flytta arbetet först, stäng adressen sedan.** Lagringen
sitter fast vid adressen, så en omdirigering utan flytt skulle göra utkasten oåtkomliga.
Flytten: i den gamla ikonen, öppna varje ofärdigt utkast → avslutssidan → **Säkerhetskopia**
→ spara till Filer eller mejla till dig själv (en fil per utkast, bilder och video inuti);
färdiga protokoll är redan mejlade. Lägg sedan till Cloudflare-adressen på hemskärmen, logga
in, och i menyn → **Återställ från säkerhetskopia** → välj filen. Utkastet dyker upp i listan
med sina bilder; ett som redan finns skrivs aldrig över. Skriv in namnet i menyn igen (det
ligger också per adress). Först när varje telefon är flyttad går ändringen i `netlify.toml`
att pusha. Eftersom en push till `main` når båda värdarna samtidigt kan den ändringen hållas
utanför den första deployen om kontrollen inte hunnit göras.

**När lösenordet behöver anges igen** (ingen av dessa raderar arbete, utom den sista):
- efter 180 dagar utan att appen öppnats,
- efter **Logga ut**,
- när lösenordet (eller `APP_SESSION_SECRET`) byts i Cloudflare,
- i ett privat fönster, i en annan webbläsare, i Outlooks eller Teams inbyggda webbläsare,
  eller i en ny ikon — var och en har sin egen kaka och sin egen lagring,
- om webbplatsdata rensas. **Varning:** det raderar också protokollen som ligger där. Ta en
  säkerhetskopia av ofärdigt arbete innan något rensas, och ta aldrig bort ikonen medan den
  har osända protokoll (iOS raderar då allt i den).

## 5b. Prova i en förhandsmiljö först

Varje gren utom `main` byggs av sig själv till `<gren>.beaps-besiktning.pages.dev`, med samma
funktioner och (via `env.preview` i wrangler.jsonc) samma KV och R2 som produktionen. Det är
en skyddad testplats: ingen länkar dit, och väggen står där också så snart `APP_PASSWORD`
finns för **Preview**. Så här:

1. Pusha grenen. Vänta på bygget under **Deployments**.
2. **Settings → Environment variables → Preview**: lägg in `APP_PASSWORD` (gärna ett annat
   värde än produktionens) och `RESEND_API_KEY`. Deploya om grenen (Retry deployment).
3. Vill du ha dubbel vägg: **Settings → General → Enable access policy** lägger Cloudflare
   Access framför alla förhandsvisningar (Zero Trust, gratis för ett litet team).
4. Kör steg 1–7 ovan mot förhandsadressen. Steg 4 görs med `outputs/live-sign-test/live-sign.cjs`
   (se filens huvud): `prepare` bygger en TEST-utflytt i en huvudlös webbläsare och skickar
   länken till den testmottagare du anger, `sign` signerar som gästen om länken är din, `check`
   hämtar protokoll och signatursida och jämför fingeravtrycket. Mejlen går på riktigt, genom
   Resend; det signerade protokollet går till longstay@beaps.se precis som annars, med
   ämnesraden `BesiktningPDF MOU Upplandsgatan 61, 1103 C/O Miami - signed` och "TEST" i
   besiktningsmannens namn, så att det känns igen.
5. Posterna en provsignering lämnar i KV och R2 ligger under egna slumpade token och stör
   inget; de kan tas bort i kontrollpanelen efteråt (KV: `meta/`, `cert/`, `remind/`;
   R2: `sign/`).

---

## Det du måste veta om datan

**Den nya adressen är en tom app.** Webbläsare knyter lagring till adressen, så
besiktningar som gjorts på `beaps-besiktning.netlify.app` syns inte på
`beaps-besiktning.pages.dev`. De är inte borta — de ligger kvar på den gamla adressen,
som fortsätter fungera.

I praktiken betyder det:

- **Påbörjade besiktningar avslutas där de påbörjades.** Ett halvfärdigt jobb på
  Netlify-adressen måste bli klart och skickat därifrån.
- **Byt när ingen har ofärdigt arbete.** Bäst på morgonen efter att allt gårdagens
  är inskickat.
- **Har någon lagt appen på hemskärmen** pekar den ikonen på den gamla adressen. Den
  behöver tas bort och läggas till på nytt från den nya.
  **VARNING (iOS): när en hemskärmsapp tas bort raderas all dess data — varje besiktning
  som inte är mejlad eller säkerhetskopierad försvinner.** Ta bort ikonen först när
  listan i den är tom. Notera också att hemskärmsappen och Safari har **separata lager**
  på samma adress: en besiktning gjord via ikonen syns inte om man öppnar länken i Safari,
  och tvärtom. Det ser ut som att den raderats, men den ligger kvar där den gjordes.

## Vad som händer med Netlify den 21 september

När creditsen nollställs bygger Netlify automatiskt om sajten från senaste commit.
`netlify/`-mappen ligger kvar orörd, så den sajten får då **samma uppdatering** — med
allas befintliga data på plats. Ingenting behöver göras för det.

Det betyder att du efter 21 september har två fungerande appar med samma funktioner:
den gamla adressen med all historik, och Cloudflare-adressen utan tak på deployer.

**Läget 2026-10-02:** så blev det. `netlify.app` serverade samma `index.html` som
`pages.dev`, men bara de gamla Netlify-funktionerna — inte nyckelloggen, galleriet,
uppladdningen av bilder, påminnelsen eller **inloggningsväggen**. Att nyckelloggen och
bilderna bara fungerar på Cloudflare-adressen är i sig beviset för att det är den teamet
använder. Netlify-adressen stod öppen för alla med länken, och den stängs nu i
[netlify.toml](netlify.toml): `/` och `/index.html` skickas vidare till Cloudflare-adressen,
registren och anteckningarna svarar 404, och funktionerna som skickar mejl eller äter
bandbredd (`send-pdf`, `sign-request`, `speed-*`) svarar 404 både via en regel och via en
spärr i varje funktion (`RETIRED`). Kvar är `sign.html` och signeringsfunktionerna, så en
länk som en gång skickades från den adressen fortfarande går att signera; gallerilänkar
skickas vidare till Cloudflare, där galleriets data ändå ligger.

**Innan den ändringen pushas:** fråga runt om någon har en påbörjad besiktning på
Netlify-adressen (eller en hemskärmsikon som pekar dit). Omdirigeringen gör att den inte går
att öppna; data ligger kvar i den webbläsarens lagring och kan nås igen genom att tillfälligt
ta bort omdirigeringen, men den som har ofärdigt arbete där ska göra klart det först.
Bestäm då vilken som ska gälla, och sätt gärna en egen domän på `bedoma.se` framför
den — då slipper du frågan för alltid.

---

## Om signeringen strular

Cloudflares gratisnivå har ett tak på **10 millisekunder processortid per anrop**.
Det är därför signaturen sedan 2026-09-22 **inte** fogas in i protokollet: att låta
pdf-lib läsa in och skriva om ett protokoll på flera megabyte kostar långt mer än så.
I stället byggs signatursidan som ett eget ensidigt PDF (några millisekunder), och
mejlet bär två filer — protokollet precis som det signerades, plus signatursidan med
protokollets SHA-256 på sig. Protokollet självt ligger i R2 och hämtas av mejltjänsten
direkt från `/api/sign-pdf`; ingen funktion håller det någonsin i minnet.

Allt annat är opåverkat: appen, mejlutskicket och wifi-mätningen väntar på nätverk,
inte på processorn, och räknas därför inte mot taket.

Skulle signeringen ändå svara `Kunde inte färdigställa PDF:en` sitter felet i
signaturbilden, inte i storleken — den enda pdf-lib rör numera. Vill du ha tillbaka
**en** fil i stället för två krävs **Workers Paid, 5 dollar i månaden**, som tar bort
taket; då kan `sign-complete.js` foga ihop dem igen.

**R2 städas inte av sig självt.** Ett protokoll bakom en signeringslänk tas bort när
länken återkallas, men ett signerat ligger kvar (det ska gå att visa så länge länken
finns). Galleriets bilder fungerar likadant. Vill du ha ett tak, sätt en
livscykelregel på R2-hinken i Cloudflares kontrollpanel.

### Har gästen signerat, eller gick något fel?

Utan `wrangler` finns fyra ställen att titta. Token är de 48 tecknen efter `t=` i länken;
appen har den bakom **Kopiera länk** på kortet *Signering på distans*.

1. **I appen.** Öppna besiktningen, tryck **Kontrollera status** på kortet. *Väntar* betyder
   att servern inte har någon signatur; *Signerat* att allt gick igenom och protokollet är
   mejlat; *Länken har gått ut* att 30 dagar passerat. Väntar den fortfarande: **Påminn om
   signering** skickar samma länk igen med en kort text.
2. **Länken själv.** `https://beaps-besiktning.pages.dev/api/sign-load?t=<token>` visar
   `status`, `signedAt` och `signedName`. `…/api/sign-pdf?t=<token>&cert=1` svarar 200 med
   signatursidan **om och endast om** signeringen gick hela vägen till mejlet.
3. **Cloudflare.** Workers & Pages → KV → `beaps-signeringar`: nyckeln `meta/<token>` är
   posten (status, to, cc, url, created, expires), `cert/<token>` finns bara efter en
   signering, `remind/<token>` räknar påminnelserna. Pages → projektet → **Functions** →
   *Real-time logs* visar fel medan du reproducerar; inget sparas i efterhand.
4. **Resend** → Emails. Tre ämnesrader: `Sign inspection report - …` (länken),
   `Reminder: sign inspection report - …` (påminnelsen) och `BesiktningPDF … - signed`
   (klart). *Delivered* betyder att mottagarens server tog emot; skräppost syns inte här.

Det som **inte** registreras någonstans: om gästen öppnat länken, om ett signeringsförsök
misslyckats halvvägs, och Resends meddelande-id. Säger gästen att inget kom fram är Resend
det enda stället som vet.

**Hur länge finns det kvar?** En länk som väntar lever sina 30 dagar plus en vecka. En
signerad post, signatursidan i KV och protokollet i R2 har **inget slutdatum** alls: länken
visar de två filerna så länge som helst, och appen kan hämta statusen när som helst (före
2026-10-02 försvann posten efter fem veckor, och appen kunde då aldrig få veta att signaturen
fanns). Oberoende av det går båda filerna till longstay@beaps.se och till den som signerade i
samma stund som signeringen sker, och till Dropbox när det är uppsatt — de kopiorna är
protokollet; posten på servern är ett bokföringsspår.

**Vad "Skicka igen" gör.** Knappen finns bara när länken gått ut (30 dagar). Den bygger ett
nytt protokoll av rapporten som den är nu och skickar en **ny** länk med ny token; den gamla
återkallas på servern i samma stund (`sign-cancel`), så den gamla länken svarar "återkallad"
om någon klickar på den, och det gamla protokollet tas bort ur R2. En väntande länk har
i stället **Påminn om signering**, som skickar samma länk igen och inte ändrar någonting.

## Filerna, om du undrar

| Var | Vad |
|---|---|
| `functions/api/*.js` | Cloudflares versioner av funktionerna |
| `cflib/*.js` | delad mejl- och signeringshjälp för Cloudflare |
| `netlify/**` | Netlifys versioner, orörda |
| `package.json` | `pdf-lib` behövs av båda |

Samma app, två uppsättningar serverfunktioner. Skillnaden är att Cloudflare läser
miljövariabler från `env` i stället för `process.env`, använder KV i stället för Netlify
Blobs, och saknar `Buffer` — därför går all base64 via `atob`/`btoa`.
