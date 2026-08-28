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

Vill du styra mottagarna, lägg även till `MAIL_TO_LONGSTAY` och `MAIL_TO_SHORTSTAY`.
Utan dem används longstay@beaps.se och guestservice@beaps.se, precis som förut.

**Deploya om efter att du lagt in variablerna** — Deployments → senaste → **Retry deployment**.
Variabler läses in vid bygget, så de gäller inte förrän en ny deploy körts.

## 5. Kontrollera att det fungerar

Öppna i tur och ordning:

1. `https://beaps-besiktning.pages.dev/api/speed-ping` — ska visa bokstaven `p`.
   Gör den inte det byggdes inte funktionerna. Läs byggloggen.
2. `https://beaps-besiktning.pages.dev/` — appen ska starta.
3. Gör en testbesiktning och tryck **Mät wifi** på raden *Funkar internet?*.
4. Gör en utflytt och skicka en **signeringslänk till dig själv**. Öppna den, signera,
   och se att protokollet kommer i mejlen.

Steg 4 är det viktiga. Det är den enda delen som aldrig körts skarpt någonstans.

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

## Vad som händer med Netlify den 21 september

När creditsen nollställs bygger Netlify automatiskt om sajten från senaste commit.
`netlify/`-mappen ligger kvar orörd, så den sajten får då **samma uppdatering** — med
allas befintliga data på plats. Ingenting behöver göras för det.

Det betyder att du efter 21 september har två fungerande appar med samma funktioner:
den gamla adressen med all historik, och Cloudflare-adressen utan tak på deployer.
Bestäm då vilken som ska gälla, och sätt gärna en egen domän på `bedoma.se` framför
den — då slipper du frågan för alltid.

---

## Om signeringen strular

Cloudflares gratisnivå har ett tak på **10 millisekunder processortid per anrop**.
Att foga in signatursidan i ett protokoll på flera megabyte tar sannolikt mer än så.

Allt annat är opåverkat: appen, mejlutskicket och wifi-mätningen väntar på nätverk,
inte på processorn, och räknas därför inte mot taket.

Blir signeringen svaret `Kunde inte färdigställa PDF:en` eller ett fel om överskridna
resurser finns två vägar:

1. **Workers Paid, 5 dollar i månaden.** Tar bort taket. Billigare än att uppgradera Netlify.
2. **Flytta ihopfogningen till mottagarens webbläsare.** Kostar inget, men då bygger
   signerarens telefon ihop den färdiga PDF:en i stället för servern — vilket i teorin
   gör det möjligt att ändra protokollet innan det skickas vidare. En halvtimmes
   omskrivning. Säg till om det behövs.

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
