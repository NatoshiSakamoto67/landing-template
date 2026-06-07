# Werkstatt Landing-Page Template

Ein **wiederverwendbares, konfig-getriebenes** Landing-Page-Template in reinem
**Vanilla HTML/CSS/JS** — **kein Build, keine externen CDNs, keine externen Fonts**.
Eine neue Werkstatt (oder andere Branche) ist in **unter 5 Minuten** ausgerollt:
Du fuellst **nur `tenant.js`** aus.

Kern sind die **zwei Automatisierungs-Module**:

1. **Fahrzeugschein-Erfassung** (`modules/fahrzeugschein.js`)
2. **Unfallaufnahme-Wizard** (`modules/unfall.js`)

Beide sind eigenstaendig, datengetrieben und an genau einen Endpunkt-Schalter
gekoppelt (`whatsapp` heute, `api` spaeter — ohne UI-Aenderung).

---

## In unter 5 Minuten live

1. **Profil kopieren**

   ```bash
   cp tenant.example.js tenant.js
   ```

2. **`tenant.js` ausfuellen** — das ist die *einzige* Datei, die du anfasst:
   - `name`, `claim`, `logoUrl`, `heroPhoto`
   - `farbeBlau`, `farbeOrange` (CI — wird zur Laufzeit als CSS-Variable gesetzt)
   - `telefon`, `whatsapp` (international, **ohne `+`, ohne fuehrende 0**, z. B. `4915118553899`)
   - `adresse`, `geo`, `mapsUrl`, `oeffnungszeiten`
   - `leistungen`, `faq`, `reviews`, `team`, `about`
   - `endpunkte.mode` (`"whatsapp"` Default)

3. **Assets ersetzen**: Logo nach `assets/logo.svg`, Hero-Foto nach
   `assets/hero-werkstatt.jpg` (Pfade in `tenant.js` anpassen).

4. **`index.html` auf `tenant.js` umstellen** (unten im `<body>`):

   ```html
   <!-- aus -->
   <script src="tenant.example.js"></script>
   <!-- mach -->
   <script src="tenant.js"></script>
   ```

5. **Deployen** — siehe unten.

Lokal testen (kein Build noetig, nur ein statischer Server wegen `fetch`/Modulpfaden):

```bash
python3 -m http.server 8080
# -> http://localhost:8080
```

---

## Deployment (Cloudflare Pages)

Es ist eine statische Seite — jedes statische Hosting funktioniert.

**Cloudflare Pages (empfohlen, wie das Original):**

- Repo verbinden -> Framework preset: **None**.
- Build command: *(leer lassen)*.
- Build output directory: `landing-template` (oder Repo-Root, wenn du den
  Ordnerinhalt nach oben legst).
- Fertig. Keine Build-Pipeline noetig.

Alternativ: Netlify (Publish dir = Ordner), GitHub Pages, S3, jeder Webserver.

---

## Aufbau

```
landing-template/
├── index.html               # Sektions-Geruest + Mount-Punkte
├── tenant.example.js        # Referenz-Profil (kopieren -> tenant.js)
├── assets/
│   ├── template.css         # Design-System (Tokens, Layout, Komponenten)
│   └── template.js          # Theme + Nav + datengetriebene Sektionen + Konfigurator
└── modules/
    ├── fahrzeugschein.js    # Automatisierungs-Modul 1
    ├── unfall.js            # Automatisierungs-Modul 2
    └── modules.css          # Styles beider Module
```

Die optionale **Unfallskizze** (Canvas) ist als kleines Inline-Script in
`index.html` enthalten (`window.UnfallSkizze`) und wird vom Unfall-Wizard
per Feature-Detection eingeblendet — fehlt sie, degradiert das Modul sauber.

---

## Die zwei Module im Detail

### 1. Fahrzeugschein (`modules/fahrzeugschein.js`)

- **Aufnahmewege**: Foto (Kamera, `capture="environment"`), Datei/Galerie,
  Drag & Drop, optional QR-Scan (`BarcodeDetector`, Feature-Detection).
- **Strukturierte Felder** = exakt die amtlichen Schein-Felder:
  | Feld | Schein | tmERIK |
  |---|---|---|
  | Kennzeichen | A | `licensePlate` |
  | VIN/FIN (17, uppercase) | E | `vehicles.vin` |
  | HSN (2.1) + TSN (2.2) | 2.1 / 2.2 | KBA-Identifikation |
  | Erstzulassung | B | `erstzulassung` |
  | Marke/Modell | D.1 / D.3 | `bezeichnung` |
- **DSGVO**: Bild bleibt lokal (`URL.createObjectURL`), **kein Auto-Upload** —
  Versand erst auf Klick.
- **Emittiert** `document`-Event `schein:ready` -> wird vom **Konfigurator**
  *und* vom **Unfall-Wizard** konsumiert (DRY: ein Schein-Modul fuer beide).

### 2. Unfall-Wizard (`modules/unfall.js`)

- Verzweigte Schritte: **Hergang -> Beteiligte (Gegner ODER Kasko) -> Fotos
  (+ optional Skizze) -> Kontakt & Wuensche**.
- **Smart-Flags**: Personenschaden-Alarm, „nicht verkehrssicher", Quotenfall,
  Anspruch-Hinweis bei unverschuldet.
- Ausgaben: `reportText()` (lesbar) und `reportPayload()` (typisiertes JSON).

---

## Andocken an tmERIK / Orchestrator

> **Wichtig:** Der Browser ruft **tmERIK NIE direkt** auf. Alles laeuft ueber
> einen **eigenen Backend-Proxy**, der das Bearer-Token serverseitig haelt und
> PII pseudonymisiert. Das Template kennt nur die eigenen `endpunkte.*`.

### Der eine Schalter

```js
// tenant.js
endpunkte: {
  mode: "whatsapp",            // Phase 0: wa.me / mailto / Web-Share
  // mode: "api",              // Phase 1: Backend-Proxy -> tmERIK
  fahrzeugschein: "/api/uploads",          // -> tmERIK POST /uploads (chunked) -> fileId
  unfall:         "/api/unfall",           // Werkstatt-Posteingang (+ optional booking/request)
  termin:         "/api/booking/request",  // -> tmERIK POST /booking/request
}
```

`mode` ist die einzige Stelle, die den heutigen WhatsApp-Weg gegen den
tmERIK-Proxy tauscht — **ohne eine Zeile UI-Code anzufassen**.

### Field-Mapping Template -> Proxy -> tmERIK

| Template | Proxy-Route | tmERIK v1 |
|---|---|---|
| `leistungen[].tmerikServiceId` | `GET /api/booking/services` | `GET /booking/services` |
| `booking.leadDays` (Fallback) | `GET /api/booking/availability` | `schedulePolicy.minLeadMinutes` aus `/booking/locations` |
| Slots (wenn `useApiAvailability`) | `GET /api/booking/availability` | `/booking/locations/{id}/availability` |
| Terminanfrage | `POST /api/booking/request` | `POST /booking/request` |
| Schein-/Schadenfotos | `POST /api/uploads` (chunked) | `POST /uploads` -> `fileId` -> `attachments[]` |

Die Schein-Felder (VIN/Kennzeichen/HSN/TSN/Erstzulassung) entsprechen **1:1**
dem OCR-Output des tmERIK-Fahrzeugschein-Scanners — das Modul **speist und
validiert** den Scanner.

**Bewusst NICHT ueber tmERIK v1**: Angebot/Auftrag/Rechnung/Zahlstatus
(O365 -> Power Automate -> DATEV, vom Orchestrator angestossen).

### Phasen

- **Phase 0 (jetzt, ohne Token):** `mode:"whatsapp"`, Datenform schon
  tmERIK-kompatibel.
- **Phase 1 (Sandbox-Token):** `mode:"api"`, Proxy live — echte
  Services/Slots/Buchung/Upload, **ohne UI-Aenderung**.

---

## DSGVO-Hinweise

- **Foto-Upload-Einwilligung:** Bilder bleiben im Browser, bis aktiv gesendet
  wird. Ein klarer Hinweistext ist auf der Seite und im Footer hinterlegt —
  ergaenze ihn um deinen konkreten Verarbeitungszweck.
- **Keine Daten ohne Endpunkt:** Ist kein Endpunkt gesetzt, werden **keine**
  Daten serverseitig gespeichert; der WhatsApp-/E-Mail-Weg legt nichts im
  Browser ab (kein `localStorage` fuer PII).
- **Karte ohne Tracking:** OpenStreetMap-`iframe` statt Google Maps —
  DSGVO-freundlich, kein Drittanbieter-Cookie.
- **Keine externen Fonts/CDNs:** kein Request zu Google Fonts o. ä.;
  Schrift-Stacks sind system-/serif-basiert (`Fraunces, Georgia, serif`).
- Verlinke deine `datenschutz.html` / `impressum.html` ueber
  `datenschutzHref` / `impressumHref` in `tenant.js`.

---

## Barrierefreiheit & Performance

- Semantisches HTML, Skip-Link, ARIA-Labels, voll tastaturbedienbar.
- `prefers-reduced-motion` respektiert; Animation nur ueber `transform`/`opacity`.
- Hell / Dunkel / Schwarz-Weiss-Modus per Toggle (in `localStorage` gemerkt).
- Hero-Bild `fetchpriority="high"`, Karte/`iframe` `loading="lazy"`.

---

## Branchen-Generalisierung

`branche` in `tenant.js` (`"kfz"`, `"dachdecker"`, `"elektriker"`, …) ist der
Haken fuer branchenspezifisches Vokabular/Default-Leistungen. Konfigurator,
Fahrzeugschein und Unfall bleiben gleich — nur Inhalte aus `tenant.js` wechseln.
