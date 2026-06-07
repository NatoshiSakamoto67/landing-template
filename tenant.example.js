/* =============================================================================
 *  tenant.example.js  —  DAS EINE Tenant-Profil
 * -----------------------------------------------------------------------------
 *  So rollst du in <5 Minuten eine neue Landingpage aus:
 *
 *    1. Diese Datei nach  tenant.js  kopieren.
 *    2. Werte unten ausfuellen (Marke, Farben, Telefon, WhatsApp, Adresse,
 *       Leistungen, Endpunkte).
 *    3. Logo/Hero-Foto in /assets ablegen und Pfade unten eintragen.
 *    4. Deployen (statisches Hosting / Cloudflare Pages) — KEIN Build noetig.
 *
 *  Es gibt genau EIN globales Objekt: window.TENANT.
 *  Alle Module (Template, Fahrzeugschein, Unfall) lesen NUR daraus.
 *  Kein Framework, kein Bundler — reines Vanilla JS.
 * ========================================================================== */

window.TENANT = {
  /* ------------------------------------------------------------------ MARKE */
  // Anzeigename in Hero, Nav, Footer, og:title.
  name: "Musterwerkstatt GmbH",
  // Kurzer Claim unter dem Namen (eine Zeile).
  claim: "Ihre Meisterwerkstatt fuer alle Marken im Herzen der Stadt.",
  // Logo als Bildpfad (PNG/SVG). Leer lassen -> es wird ein Text-Logo erzeugt.
  logoUrl: "assets/logo.svg",
  // Optionales Hero-Foto (Werkstatt). Leer lassen -> dezenter Farb-Platzhalter.
  heroPhoto: "assets/hero-werkstatt.jpg",
  // Branche schaltet Vokabular + Default-Leistungen (kfz, dachdecker, elektriker, ...).
  branche: "kfz",

  /* ------------------------------------------------------------------ FARBEN */
  // CI-Farben. Werden zur Laufzeit als CSS-Custom-Properties gesetzt
  // (siehe template.js -> setzeTheme). Umfaerben = NUR hier aendern.
  farbeBlau: "#146DAB", // Primaer / CI-Blau  (--blau)
  farbeOrange: "#FBAF3A", // Akzent / Warm     (--orange)

  /* ------------------------------------------------------------------ KONTAKT */
  telefon: "+49 30 1234567",
  // WhatsApp-Nummer im internationalen Format OHNE +, OHNE fuehrende 0.
  // Beispiel Deutschland: 49 + Nummer ohne 0  ->  "4915118553899"
  whatsapp: "4915118553899",
  email: "kontakt@musterwerkstatt.de",
  // Separate Adresse fuer Unfall-/Schadenmeldungen (Posteingang). Optional.
  unfallEmail: "schaden@musterwerkstatt.de",

  adresse: {
    strasse: "Musterstrasse 1",
    plz: "10115",
    ort: "Berlin",
    land: "DE",
  },
  // Geo-Koordinaten fuer die OpenStreetMap-Einbettung (DSGVO-frei, kein Google).
  geo: { lat: 52.5321, lng: 13.3849 },
  // Fertiger Maps-/Routen-Link (z. B. Google Maps oder OSM). Frei waehlbar.
  mapsUrl: "https://www.openstreetmap.org/?mlat=52.5321&mlon=13.3849#map=17/52.5321/13.3849",

  /* -------------------------------------------------------------- OEFFNUNGSZEITEN
   * day: 1=Mo ... 6=Sa, 0=So.  Geschlossene Tage: { day, geschlossen:true }.
   */
  oeffnungszeiten: [
    { day: 1, von: "08:00", bis: "18:00" },
    { day: 2, von: "08:00", bis: "18:00" },
    { day: 3, von: "08:00", bis: "18:00" },
    { day: 4, von: "08:00", bis: "18:00" },
    { day: 5, von: "08:00", bis: "17:00" },
    { day: 6, von: "09:00", bis: "13:00" },
    { day: 0, geschlossen: true },
  ],

  /* -------------------------------------------------------------- LEISTUNGEN
   * Speisen den Konfigurator (Chips) UND die Leistungs-Sektion.
   * tmerikServiceId: spaeter aus tmERIK GET /booking/services (Dauer/Preis).
   * Heute null -> Mock; UI bleibt identisch, wenn echte IDs kommen.
   */
  leistungen: [
    { id: "inspektion", titel: "Inspektion & Wartung", dauer: "ca. 2 Std.", preis: "ab 129 €", tmerikServiceId: null },
    { id: "oelwechsel", titel: "Oelwechsel", dauer: "ca. 45 Min.", preis: "ab 79 €", tmerikServiceId: null },
    { id: "bremsen", titel: "Bremsen-Service", dauer: "ca. 1,5 Std.", preis: "ab 149 €", tmerikServiceId: null },
    { id: "hu", titel: "HU/AU (TUEV)", dauer: "ca. 1 Std.", preis: "ab 109 €", tmerikServiceId: null },
    { id: "klima", titel: "Klima-Service", dauer: "ca. 1 Std.", preis: "ab 89 €", tmerikServiceId: null },
    { id: "reifen", titel: "Reifenwechsel & -lagerung", dauer: "ca. 30 Min.", preis: "ab 39 €", tmerikServiceId: null },
  ],

  /* -------------------------------------------------------------------- FAQ */
  faq: [
    { q: "Brauche ich vorher einen Termin?", a: "Fuer planbare Arbeiten ja — am schnellsten ueber den Konfigurator hier auf der Seite oder per WhatsApp. Pannen nehmen wir kurzfristig an." },
    { q: "Arbeitet ihr an allen Marken?", a: "Ja, wir betreuen alle gaengigen Pkw-Marken inklusive Original-Diagnose und Wartung nach Herstellervorgaben." },
    { q: "Bekomme ich einen Kostenvoranschlag?", a: "Sie erhalten vor jeder Reparatur einen transparenten Kostenvoranschlag. Es wird nichts ohne Ihre Freigabe gemacht." },
    { q: "Was passiert bei einem Unfall?", a: "Nutzen Sie die Unfallaufnahme auf dieser Seite. Wir uebernehmen die Abwicklung mit der Versicherung, organisieren Gutachter und Ersatzwagen." },
  ],

  /* ---------------------------------------------------------------- REVIEWS */
  reviews: {
    googleUrl: "https://www.google.com/maps", // Link zum Profil
    score: 4.9,
    count: 137,
    items: [
      { name: "Sandra K.", text: "Schnell, ehrlich und fair im Preis. Endlich eine Werkstatt, der man vertrauen kann." },
      { name: "Mehmet Y.", text: "Top Beratung, alles transparent erklaert. Mein Auto laeuft wie neu." },
      { name: "Thomas B.", text: "Unfallabwicklung komplett abgenommen — ich musste mich um nichts kuemmern." },
    ],
  },

  /* ------------------------------------------------------------------- TEAM */
  team: [
    { name: "Max Mustermann", rolle: "Inhaber & Kfz-Meister", foto: "", tag: "Seit 1998" },
    { name: "Anna Schmidt", rolle: "Serviceberatung", foto: "", tag: "Ihr erster Kontakt" },
    { name: "Jonas Weber", rolle: "Karosserie & Lack", foto: "", tag: "Unfallspezialist" },
  ],

  /* ------------------------------------------------------------------ UEBER UNS */
  about: {
    heading: "Aus einer Hand. Seit ueber 25 Jahren.",
    body: [
      "Was als kleine Familienwerkstatt begann, ist heute Ihre Anlaufstelle fuer alles rund ums Auto.",
      "Bei uns zaehlt ehrliche Arbeit: klare Preise, echte Beratung und Technik, die haelt.",
    ],
    signatur: "Max Mustermann",
    pills: ["Meisterbetrieb", "Alle Marken", "Faire Preise", "Unfall-Service"],
  },

  /* ------------------------------------------------------------ KONFIGURATOR */
  booking: {
    // Vorlaufzeit in Tagen, bis ein Wunschtermin moeglich ist.
    // Fallback, bis minLeadMinutes aus tmERIK /booking/locations kommt.
    leadDays: 7,
    requireService: true, // Mindestens eine Leistung muss gewaehlt sein.
    useApiAvailability: false, // true -> echter Slot-Kalender aus tmERIK.
  },

  /* ------------------------------------------------------------------ ENDPUNKTE
   * mode "whatsapp" (Default, Phase 0): baut wa.me-Deeplink / mailto.
   * mode "api"     (Phase 1): POSTet an den eigenen Backend-Proxy,
   *                           der das tmERIK-Bearer-Token serverseitig haelt.
   * Browser ruft tmERIK NIE direkt. Endpunkte zeigen auf den Proxy.
   * Leer lassen -> Modul faellt automatisch auf WhatsApp/E-Mail zurueck.
   */
  endpunkte: {
    mode: "whatsapp",
    fahrzeugschein: "", // z. B. "/api/uploads"      -> tmERIK /uploads + /booking/request
    unfall: "", // z. B. "/api/unfall"       -> Werkstatt-Posteingang
    termin: "", // z. B. "/api/booking/request" -> tmERIK /booking/request
  },

  /* ---------------------------------------------------------------- RECHTLICHES */
  datenschutzHref: "datenschutz.html",
  impressumHref: "impressum.html",
};
