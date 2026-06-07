/* =============================================================================
 *  whitelabel.js — White-Label-Engine v2 (Vanilla, kein Build, kein CDN)
 * -----------------------------------------------------------------------------
 *  EINE Datei, identisch in Landing / Kundenportal / Werkhof. Liest das flache
 *  window.TENANT und kleidet das Produkt allein ueber den --ds-* TOKEN-KONTRAKT
 *  ein. KEIN <link>-Swap mehr: das aktive Paket wird ueber
 *  document.documentElement.dataset.theme = "papier|stahl|glas|edel|minimal"
 *  gewaehlt; die werkstatt.theme.css (einmal geladen) definiert pro
 *  [data-theme] alle --ds-* Tokens. Die Produkte konsumieren NUR --ds-*.
 *
 *  WAS DIESE DATEI SETZT:
 *    1) data-theme am <html> (Allowlist-gehaertet, kein Pfad/Injection).
 *    2) --cust-accent / --cust-accent-2 (safeColor: NUR #hex / rgb() / oklch(),
 *       sonst verworfen). theme.css leitet daraus die Akzent-Palette ab
 *       (--ds-accent, --ds-accent-hover, --ds-accent-soft, --ds-on-accent ...).
 *    3) --cust-font NUR aus fester Font-Registry {fraunces,playfair,space,
 *       inter,oswald}. theme.css mappt das auf --ds-font-display/-body.
 *    4) Marke (textContent) in [data-tenant="name"], Logo (img.src/alt) in
 *       [data-tenant="logo"]. NIE innerHTML mit Tenant-Text.
 *    5) WhatsApp-Deeplinks (wa.me) inkl. Demo-Guard bis whatsappReady === true.
 *    6) Telefon / E-Mail / Maps / Adresse als sichere Slots.
 *
 *  FOUC: bootstrap.js (winziges Inline-Snippet ganz oben im <head>) setzt
 *  data-theme + --cust-accent + --cust-font bereits VOR dem ersten Paint.
 *  Diese Datei laeuft danach synchron (Pre-Paint-Teil) und ergaenzt die
 *  DOM-abhaengigen Schritte bei DOMContentLoaded.
 *
 *  DSGVO: kein Netzwerkzugriff nach aussen. Schriften lokal (../fonts/), Themes
 *  lokal (werkstatt.theme.css). Kein Google-Fonts, kein CDN, kein Tracking.
 * ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------------
   *  Konstanten — keine Magic-Strings im Code verstreut.
   * ------------------------------------------------------------------------- */
  var DEFAULT_THEME = "papier"; // papier = :root-Default in theme.css

  // Erlaubte Theme-Slugs. data-theme wird NUR aus dieser Allowlist gesetzt,
  // damit Tenant-Daten niemals einen beliebigen Attributwert einschleusen.
  var ALLOWED_THEMES = ["papier", "stahl", "glas", "edel", "minimal"];

  // Feste Font-Registry: Tenant-Key -> Registry-Variable (siehe fonts.css).
  // Nur diese Keys sind zulaessig; alles andere wird verworfen (Theme-Default).
  var FONT_REGISTRY = {
    fraunces: "var(--font-fraunces)",
    playfair: "var(--font-playfair)",
    space: "var(--font-space)",
    inter: "var(--font-inter)",
    oswald: "var(--font-oswald)"
  };

  // safeColor-Allowlist: ausschliesslich #hex (3/4/6/8), rgb()/rgba(),
  // oklch()/oklab(). Alles andere (named colors, url(), expressions, ...) wird
  // verworfen, damit kein unkontrollierter Wert in den :root-Style gelangt.
  var HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  var FUNC_RE = /^(?:rgb|rgba|oklch|oklab)\(\s*[0-9a-z%.,/\s+-]+\)$/i;

  var root = document.documentElement;

  /* ---------------------------------------------------------------------------
   *  Kleine, defensive Helfer.
   * ------------------------------------------------------------------------- */
  function isObj(v) { return v !== null && typeof v === "object"; }
  function isStr(v) { return typeof v === "string" && v.length > 0; }

  // Erster nicht-leerer Wert aus der Argumentliste (string|number).
  function firstOf() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  }

  // Boolean-Default: true ausser explizit false. (whatsappReady etc.)
  function boolDefault(v, fallback) {
    if (v === undefined || v === null) return fallback;
    return !!v;
  }

  /**
   * safeColor — gibt den getrimmten Farbstring NUR zurueck, wenn er exakt einem
   * erlaubten Format entspricht (#hex / rgb()/rgba() / oklch()/oklab()).
   * Sonst "" (verwerfen). So kann ein Tenant nie etwas anderes als eine Farbe
   * in den Style schreiben.
   * @param {unknown} v
   * @returns {string} valider Farbstring oder ""
   */
  function safeColor(v) {
    if (!isStr(v)) return "";
    var t = v.trim();
    if (HEX_RE.test(t)) return t;
    if (FUNC_RE.test(t)) return t;
    return "";
  }

  // Setzt eine CSS-Custom-Property defensiv (leere Werte werden ignoriert).
  function setVar(name, value) {
    if (value === undefined || value === null || value === "") return;
    try { root.style.setProperty(name, String(value)); } catch (e) { /* noop */ }
  }
  function removeVar(name) {
    try { root.style.removeProperty(name); } catch (e) { /* noop */ }
  }

  /* ---------------------------------------------------------------------------
   *  1) TENANT einlesen + normalisieren.
   *     Flaches Schema: { theme, accent, accent2, font, name, logo, claim,
   *                       telefon, email, mapsUrl, whatsapp, whatsappReady,
   *                       adresse:{strasse,plz,ort} }
   * ------------------------------------------------------------------------- */
  function readTenant() {
    var T = isObj(window.TENANT) ? window.TENANT : {};

    return {
      // Theme erst NACH der Allowlist verwenden -> applyTheme haertet final.
      theme: firstOf(T.theme, DEFAULT_THEME),

      // Farben werden in applyAccent ueber safeColor gefiltert.
      accent: T.accent,
      accent2: T.accent2,

      // Font-Key (lowercase), gegen Registry geprueft in applyFont.
      font: firstOf(T.font, ""),

      name: firstOf(T.name, ""),
      claim: firstOf(T.claim, T.tag, ""),
      logo: firstOf(T.logo, T.logoUrl, ""),

      telefon: firstOf(T.telefon, ""),
      email: firstOf(T.email, ""),
      mapsUrl: firstOf(T.mapsUrl, ""),

      // Nur Ziffern zulassen — Deeplink darf nichts anderes enthalten.
      whatsapp: String(firstOf(T.whatsapp, "")).replace(/[^0-9]/g, ""),
      whatsappReady: boolDefault(T.whatsappReady, true),

      adresse: isObj(T.adresse) ? T.adresse : {}
    };
  }

  /* ---------------------------------------------------------------------------
   *  2) Theme waehlen — data-theme statt link-swap. Slug strikt aus Allowlist.
   *     theme.css definiert pro [data-theme] alle --ds-* Tokens; ein unbekannter
   *     Slug faellt auf den Default (papier = :root) zurueck.
   * ------------------------------------------------------------------------- */
  function applyTheme(t) {
    var slug = String(t.theme || DEFAULT_THEME).toLowerCase();
    if (ALLOWED_THEMES.indexOf(slug) === -1) slug = DEFAULT_THEME;
    root.dataset.theme = slug; // -> <html data-theme="...">
    return slug;
  }

  /* ---------------------------------------------------------------------------
   *  3) Akzent — EINE (oder zwei) Kundenfarbe(n). Wir setzen NUR --cust-accent
   *     und --cust-accent-2; die GESAMTE Palette (hover/soft/on-accent ...)
   *     leitet theme.css algorithmisch via color-mix / contrast-color ab.
   *     Ungueltige Werte werden verworfen -> Theme-Default greift automatisch.
   * ------------------------------------------------------------------------- */
  function applyAccent(t) {
    var a = safeColor(t.accent);
    var a2 = safeColor(t.accent2);

    // Gueltig -> setzen; ungueltig/leer -> entfernen, damit der theme.css-
    // Default (--ds-accent: var(--cust-accent, <theme-default>)) wirkt.
    if (a) { setVar("--cust-accent", a); } else { removeVar("--cust-accent"); }
    if (a2) { setVar("--cust-accent-2", a2); } else { removeVar("--cust-accent-2"); }
  }

  /* ---------------------------------------------------------------------------
   *  4) Schrift — NUR aus der festen Registry. Setzt --cust-font (Headlines);
   *     theme.css liest das in --ds-font-display. Unbekannter/leerer Key ->
   *     entfernen, damit die Theme-Standardschrift greift.
   * ------------------------------------------------------------------------- */
  function applyFont(t) {
    var key = String(t.font || "").toLowerCase();
    if (FONT_REGISTRY.hasOwnProperty(key)) {
      setVar("--cust-font", FONT_REGISTRY[key]);
    } else {
      removeVar("--cust-font");
    }
  }

  /* ---------------------------------------------------------------------------
   *  5) DOM-Branding — Name, Claim, Logo, Telefon, E-Mail, Maps, Adresse.
   *     IMMER textContent fuer Tenant-Text (kein innerHTML). Logo als <img>.
   * ------------------------------------------------------------------------- */
  function applyBrand(t) {
    setText('[data-tenant="name"]', t.name);
    setText('[data-tenant="claim"]', t.claim);

    applyLogo(t);

    setText('[data-tenant="telefon"]', t.telefon);
    setHref('[data-tenant="telefon-link"]', t.telefon ? "tel:" + t.telefon.replace(/\s/g, "") : "");
    setText('[data-tenant="email"]', t.email);
    setHref('[data-tenant="email-link"]', t.email ? "mailto:" + t.email : "");
    setHref('[data-tenant="maps"]', t.mapsUrl);
    applyAddress(t);

    applyWaLinks(t);
  }

  function applyLogo(t) {
    var slots = document.querySelectorAll('[data-tenant="logo"]');
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (isStr(t.logo)) {
        // Echtes Logo als <img>. src/alt werden als Properties gesetzt, nicht
        // als HTML — kein innerHTML mit Tenant-Daten.
        var img = document.createElement("img");
        img.src = t.logo;          // Browser validiert/encodet die URL
        img.alt = t.name || "Logo"; // textbasiert, kein Markup
        img.decoding = "async";
        slot.textContent = "";      // vorhandenen Inhalt sicher leeren
        slot.appendChild(img);
      } else if (isStr(t.name)) {
        // Fallback ohne Logo: Initialen als reiner Text (Go-Live ohne Asset).
        slot.textContent = initials(t.name);
        slot.setAttribute("data-mark", "initials");
      }
    }
  }

  function initials(name) {
    var parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function applyAddress(t) {
    var a = t.adresse || {};
    var line = [a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")]
      .filter(Boolean).join(", ");
    setText('[data-tenant="address"]', line);
  }

  /* ---------------------------------------------------------------------------
   *  6) WhatsApp-Deeplinks + Demo-Guard.
   *     Nummer ist auf Ziffern reduziert; Text wird URL-encodet. Solange
   *     whatsappReady=false ODER keine Nummer -> href="#" + Hinweis statt
   *     Platzhalter-Ziel.
   * ------------------------------------------------------------------------- */
  function buildWaUrl(t, text) {
    var msg = text ? ("?text=" + encodeURIComponent(text)) : "";
    return "https://wa.me/" + t.whatsapp + msg;
  }

  function makeWaHandler(t) {
    return function (ev) {
      if (!t.whatsappReady || !t.whatsapp) {
        if (ev) ev.preventDefault();
        toast("Demo-Modus: WhatsApp ist fuer diesen Auftritt noch nicht freigeschaltet.");
        return false;
      }
      return true; // ready -> href oeffnet das echte Ziel
    };
  }

  function applyWaLinks(t) {
    var links = document.querySelectorAll('[data-tenant="whatsapp"]');
    for (var i = 0; i < links.length; i++) {
      var el = links[i];
      // Vorgabetext defensiv: data-wa-text (Attribut, vom Autor kontrolliert)
      // oder ein neutraler Gruss mit dem Tenant-Namen.
      var text = el.getAttribute("data-wa-text") ||
                 (t.name ? "Hallo " + t.name + ", " : "");
      el.setAttribute("href", (t.whatsappReady && t.whatsapp) ? buildWaUrl(t, text) : "#");
      el.addEventListener("click", makeWaHandler(t));
    }
  }

  /* ---------------------------------------------------------------------------
   *  Minimaler, abhaengigkeitsfreier Toast (compositor-only: opacity/transform).
   * ------------------------------------------------------------------------- */
  function toast(message) {
    var el = document.createElement("div");
    el.setAttribute("role", "status");
    el.textContent = message;
    el.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(8px);" +
      "max-width:90vw;padding:.7rem 1rem;border-radius:10px;z-index:99999;" +
      "background:#111;color:#fff;font:500 14px/1.4 system-ui,sans-serif;" +
      "box-shadow:0 8px 30px rgba(0,0,0,.35);opacity:0;" +
      "transition:opacity .2s ease, transform .2s ease;pointer-events:none;";
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.style.opacity = "1";
      el.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(8px)";
      setTimeout(function () { el.remove(); }, 220);
    }, 3200);
  }

  /* ---------------------------------------------------------------------------
   *  Sichere DOM-Setter (immer textContent / setAttribute, nie innerHTML).
   * ------------------------------------------------------------------------- */
  function setText(sel, value) {
    if (!isStr(value)) return;
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
  }
  function setHref(sel, value) {
    if (!isStr(value)) return;
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) nodes[i].setAttribute("href", value);
  }

  /* ---------------------------------------------------------------------------
   *  Bootstrap. Pre-Paint (Theme/Akzent/Font) sofort und synchron — auch wenn
   *  das Inline-bootstrap.js sie schon gesetzt hat, ist das idempotent. Das
   *  DOM-Branding laeuft bei DOMContentLoaded.
   * ------------------------------------------------------------------------- */
  var tenant = readTenant();
  var activeTheme = applyTheme(tenant);
  applyAccent(tenant);
  applyFont(tenant);

  function onReady() { applyBrand(tenant); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

  /* ---------------------------------------------------------------------------
   *  Oeffentliche API. Produkte lesen hieraus statt CI-/WA-Logik zu duplizieren.
   * ------------------------------------------------------------------------- */
  window.XDAB = {
    tenant: tenant,
    theme: activeTheme,
    accent: safeColor(tenant.accent),
    accent2: safeColor(tenant.accent2),
    waURL: function (text) { return buildWaUrl(tenant, text); },
    waGuard: function () { return makeWaHandler(tenant); },
    safeColor: safeColor,
    initials: initials,
    toast: toast,
    // Theme zur Laufzeit wechseln (Preview/Umschalter) — gehaertet.
    setTheme: function (slug) {
      tenant = readTenant();
      tenant.theme = slug;
      activeTheme = applyTheme(tenant);
      window.XDAB.theme = activeTheme;
      return activeTheme;
    },
    // Komplett neu anwenden, falls window.TENANT zur Laufzeit geaendert wurde.
    refresh: function () {
      tenant = readTenant();
      activeTheme = applyTheme(tenant);
      applyAccent(tenant);
      applyFont(tenant);
      applyBrand(tenant);
      window.XDAB.tenant = tenant;
      window.XDAB.theme = activeTheme;
      window.XDAB.accent = safeColor(tenant.accent);
      window.XDAB.accent2 = safeColor(tenant.accent2);
    }
  };
})();
