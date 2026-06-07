/* =============================================================================
 *  tenant.js  —  LIVE-Profil dieser Landingpage
 * -----------------------------------------------------------------------------
 *  Demo/Pilot: KFZ Gorski (Cremlingen). Fuer eine neue Werkstatt einfach
 *  tenant.example.js ueber diese Datei kopieren und die Werte anpassen.
 *  Es gibt genau EIN globales Objekt: window.TENANT. Kein Build noetig.
 * ========================================================================== */

window.TENANT = {
  /* MARKE */
  name: "KFZ Gorski",
  claim: "Ihre Meisterwerkstatt in Cremlingen — ehrlich, schnell, fuer alle Marken.",
  logoUrl: "assets/logo.svg",
  heroPhoto: "assets/hero-werkstatt.jpg",
  branche: "kfz",

  /* FARBEN (CI) */
  farbeBlau: "#146DAB",
  farbeOrange: "#FBAF3A",

  /* KONTAKT */
  telefon: "+49 1511 8553899",
  whatsapp: "4915118553899", // international, ohne + / ohne fuehrende 0
  email: "kontakt@kfz-gorski.de", // TODO: echte Adresse vor Go-Live
  unfallEmail: "schaden@kfz-gorski.de", // TODO: echte Adresse vor Go-Live

  adresse: {
    strasse: "Schapener Strasse 1",
    plz: "38162",
    ort: "Cremlingen",
    land: "DE",
  },
  geo: { lat: 52.27404, lng: 10.61901 },
  mapsUrl: "https://www.google.com/maps/dir/?api=1&destination=Schapener+Strasse+1,+38162+Cremlingen",

  /* OEFFNUNGSZEITEN (TODO: echte Zeiten von Marco bestaetigen) */
  oeffnungszeiten: [
    { day: 1, von: "08:00", bis: "18:00" },
    { day: 2, von: "08:00", bis: "18:00" },
    { day: 3, von: "08:00", bis: "18:00" },
    { day: 4, von: "08:00", bis: "18:00" },
    { day: 5, von: "08:00", bis: "17:00" },
    { day: 6, geschlossen: true },
    { day: 0, geschlossen: true },
  ],

  /* LEISTUNGEN — speisen Konfigurator + Leistungs-Sektion.
   * tmerikServiceId: spaeter aus tmERIK GET /booking/services. */
  leistungen: [
    { id: "inspektion", titel: "Inspektion & Wartung", dauer: "ca. 2 Std.", preis: "ab 129 €", tmerikServiceId: null },
    { id: "oelwechsel", titel: "Oelwechsel", dauer: "ca. 45 Min.", preis: "ab 79 €", tmerikServiceId: null },
    { id: "bremsen", titel: "Bremsen-Service", dauer: "ca. 1,5 Std.", preis: "ab 149 €", tmerikServiceId: null },
    { id: "hu", titel: "HU/AU (TUEV)", dauer: "ca. 1 Std.", preis: "ab 109 €", tmerikServiceId: null },
    { id: "klima", titel: "Klima-Service", dauer: "ca. 1 Std.", preis: "ab 89 €", tmerikServiceId: null },
    { id: "reifen", titel: "Reifenwechsel & -einlagerung", dauer: "ca. 30 Min.", preis: "ab 39 €", tmerikServiceId: null },
  ],

  /* FAQ */
  faq: [
    { q: "Brauche ich vorher einen Termin?", a: "Fuer planbare Arbeiten ja — am schnellsten ueber den Konfigurator hier oder per WhatsApp. Pannen nehmen wir kurzfristig an." },
    { q: "Arbeitet ihr an allen Marken?", a: "Ja, wir betreuen alle gaengigen Pkw-Marken inklusive Diagnose und Wartung nach Herstellervorgaben." },
    { q: "Bekomme ich einen Kostenvoranschlag?", a: "Vor jeder Reparatur erhalten Sie einen transparenten Kostenvoranschlag. Nichts wird ohne Ihre Freigabe gemacht." },
    { q: "Was passiert bei einem Unfall?", a: "Nutzen Sie die Unfallaufnahme auf dieser Seite. Wir uebernehmen die Abwicklung mit der Versicherung." },
  ],

  /* REVIEWS (TODO: echtes Google-Profil verlinken, sobald 'KFZ Hase' umbenannt) */
  reviews: {
    googleUrl: "https://www.google.com/search?q=KFZ+Gorski+Cremlingen",
    score: 4.9,
    count: 137,
    items: [
      { name: "Sandra K.", text: "Schnell, ehrlich und fair im Preis. Endlich eine Werkstatt, der man vertrauen kann." },
      { name: "Mehmet Y.", text: "Top Beratung, alles transparent erklaert. Mein Auto laeuft wie neu." },
      { name: "Thomas B.", text: "Unfallabwicklung komplett abgenommen — ich musste mich um nichts kuemmern." },
    ],
  },

  /* TEAM (TODO: echte Fotos/Namen von Marco) */
  team: [
    { name: "Marco Gorski", rolle: "Inhaber & Kfz-Meister", foto: "", tag: "Ihr Meister" },
    { name: "Serviceberatung", rolle: "Annahme & Termine", foto: "", tag: "Ihr erster Kontakt" },
    { name: "Karosserie & Lack", rolle: "Unfallinstandsetzung", foto: "", tag: "Unfallspezialist" },
  ],

  /* UEBER UNS */
  about: {
    heading: "Aus einer Hand. Meisterqualitaet.",
    body: [
      "Bei KFZ Gorski zaehlt ehrliche Arbeit: klare Preise, echte Beratung und Technik, die haelt.",
      "Vom Oelwechsel bis zur kompletten Unfallabwicklung — alles aus einer Hand, fuer alle Marken.",
    ],
    signatur: "Marco Gorski",
    pills: ["Meisterbetrieb", "Alle Marken", "Faire Preise", "Unfall-Service"],
  },

  /* KONFIGURATOR */
  booking: {
    leadDays: 7, // Fallback bis minLeadMinutes aus tmERIK /booking/locations kommt
    requireService: true,
    useApiAvailability: false, // true -> echter Slot-Kalender aus tmERIK
  },

  /* ENDPUNKTE — Phase 0: WhatsApp-Fallback. Phase 1: Proxy, der das
   * tmERIK-Bearer-Token SERVERSEITIG haelt. Browser ruft tmERIK NIE direkt. */
  endpunkte: {
    mode: "whatsapp",
    fahrzeugschein: "", // spaeter "/api/uploads"          -> tmERIK /uploads + /booking/request
    unfall: "", //        spaeter "/api/unfall"           -> Werkstatt-Posteingang
    termin: "", //        spaeter "/api/booking/request"  -> tmERIK /booking/request
  },

  /* RECHTLICHES */
  datenschutzHref: "datenschutz.html",
  impressumHref: "impressum.html",
};
