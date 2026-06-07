/* =============================================================================
 *  template.js — Kern der Landing-Page-Vorlage
 * -----------------------------------------------------------------------------
 *  Aufgaben:
 *    1) Theme: liest window.TENANT.farbe* und setzt CSS-Custom-Properties.
 *    2) Marke/Nav/Footer aus TENANT befuellen.
 *    3) Datengetriebene Sektionen rendern (Leistungen, FAQ, Reviews, Team,
 *       Oeffnungszeiten mit Heute-Markierung, Stats, Karte).
 *    4) 3-Schritt-Termin-Konfigurator mit Live-WhatsApp-Vorschau + wa.me-Deeplink.
 *
 *  Reines Vanilla JS, kein Build. Module (Fahrzeugschein/Unfall) haengen sich
 *  eigenstaendig ueber ihre Mount-Punkte ein und lesen ebenfalls aus TENANT.
 * ========================================================================== */
(function () {
  "use strict";

  var T = window.TENANT;
  if (!T) {
    console.error("[template] window.TENANT fehlt — bitte tenant.js laden.");
    return;
  }

  var WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  /* --------------------------------------------------------- DOM-Helfer */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function")
          node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }
  function mount(id) {
    return document.getElementById(id);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  /* ============================================================ 1) THEME */
  function setzeTheme() {
    var root = document.documentElement;
    if (T.farbeBlau) root.style.setProperty("--blau", T.farbeBlau);
    if (T.farbeOrange) root.style.setProperty("--orange", T.farbeOrange);

    // Titel + OG-Tags pflegen
    if (T.name) {
      document.title = T.name + (T.claim ? " — " + T.claim : "");
      var og = $('meta[property="og:title"]');
      if (og) og.setAttribute("content", T.name);
    }
  }

  /* ===================================================== 2) MARKE / NAV */
  function renderMarke() {
    document.querySelectorAll("[data-brand-name]").forEach(function (n) {
      n.textContent = T.name;
    });
    document.querySelectorAll("[data-brand-claim]").forEach(function (n) {
      n.textContent = T.claim;
    });

    // Logo (Bild oder Text-Mark als Fallback)
    document.querySelectorAll("[data-brand-logo]").forEach(function (slot) {
      slot.innerHTML = "";
      if (T.logoUrl) {
        slot.appendChild(
          el("img", { src: T.logoUrl, alt: T.name + " Logo" })
        );
      } else {
        var initials = (T.name || "?")
          .split(/\s+/)
          .map(function (w) { return w[0]; })
          .join("")
          .slice(0, 2)
          .toUpperCase();
        slot.appendChild(el("span", { class: "brand-mark", text: initials }));
      }
      slot.appendChild(el("span", { "data-brand-name": "", text: T.name }));
    });

    // Hero-Foto
    var heroV = mount("hero-visual");
    if (heroV) {
      if (T.heroPhoto) {
        heroV.insertBefore(
          el("img", {
            src: T.heroPhoto,
            alt: "Werkstatt " + T.name,
            loading: "eager",
            fetchpriority: "high",
          }),
          heroV.firstChild
        );
      } else {
        heroV.insertBefore(
          el("div", { class: "placeholder", text: "Hero-Foto: assets/hero-werkstatt.jpg" }),
          heroV.firstChild
        );
      }
    }

    // WhatsApp-Links (Float + CTA)
    document.querySelectorAll("[data-wa-link]").forEach(function (a) {
      a.href = waLink("Hallo " + T.name + ", ich habe eine Frage.");
      a.target = "_blank";
      a.rel = "noopener";
    });
    document.querySelectorAll("[data-tel-link]").forEach(function (a) {
      a.href = "tel:" + (T.telefon || "").replace(/[^+\d]/g, "");
    });
  }

  function waLink(text) {
    return "https://wa.me/" + (T.whatsapp || "") + "?text=" + encodeURIComponent(text);
  }

  /* ============================================== 3) DATENGETRIEBENE SEKTIONEN */

  function renderLeistungenAccordion() {
    var box = mount("leistungen-accordion");
    if (!box) return;
    (T.leistungen || []).forEach(function (l, i) {
      var panelId = "lpanel-" + i;
      var item = el("div", { class: "acc-item" }, [
        el("h3", { style: "margin:0" }, [
          el("button", {
            class: "acc-trigger",
            type: "button",
            "aria-expanded": "false",
            "aria-controls": panelId,
            onclick: function () { toggleAcc(item, this); },
          }, [
            el("span", {}, [
              document.createTextNode(l.titel),
              el("span", { class: "meta", text: "  " + [l.dauer, l.preis].filter(Boolean).join(" · ") }),
            ]),
            el("span", { class: "chev", "aria-hidden": "true", html: "&#9662;" }),
          ]),
        ]),
        el("div", { class: "acc-panel", id: panelId, role: "region" }, [
          el("div", {}, [
            el("p", {
              text:
                "Professionelle Ausfuehrung nach Herstellervorgaben. Termin direkt ueber den Konfigurator oder per WhatsApp. " +
                (l.preis ? "Preis: " + l.preis + ". " : "") +
                (l.dauer ? "Dauer: " + l.dauer + "." : ""),
            }),
          ]),
        ]),
      ]);
      box.appendChild(item);
    });
  }

  function renderFaq() {
    var box = mount("faq-accordion");
    if (!box || !T.faq) return;
    T.faq.forEach(function (f, i) {
      var panelId = "fpanel-" + i;
      var item = el("div", { class: "acc-item" }, [
        el("h3", { style: "margin:0" }, [
          el("button", {
            class: "acc-trigger",
            type: "button",
            "aria-expanded": "false",
            "aria-controls": panelId,
            onclick: function () { toggleAcc(item, this); },
          }, [
            el("span", { text: f.q }),
            el("span", { class: "chev", "aria-hidden": "true", html: "&#9662;" }),
          ]),
        ]),
        el("div", { class: "acc-panel", id: panelId, role: "region" }, [
          el("div", {}, [el("p", { text: f.a })]),
        ]),
      ]);
      box.appendChild(item);
    });
  }

  function toggleAcc(item, btn) {
    var open = item.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderReviews() {
    var box = mount("reviews-grid");
    var head = mount("reviews-head");
    var r = T.reviews;
    if (!r) return;
    if (head) {
      head.appendChild(
        el("a", { class: "score-badge", href: r.googleUrl || "#", target: "_blank", rel: "noopener" }, [
          el("span", { class: "stars", "aria-hidden": "true", text: "★★★★★" }),
          el("b", { text: (r.score || "").toString() }),
          el("span", { text: r.count ? r.count + " Bewertungen" : "Google" }),
        ])
      );
    }
    if (box && r.items) {
      r.items.forEach(function (it) {
        box.appendChild(
          el("article", { class: "card review reveal" }, [
            el("div", { class: "stars", "aria-hidden": "true", text: "★★★★★" }),
            el("p", { text: "„" + it.text + "“" }),
            el("div", { class: "who", text: it.name }),
          ])
        );
      });
    }
  }

  function renderTeam() {
    var box = mount("team-grid");
    if (!box || !T.team) return;
    T.team.forEach(function (m) {
      var photo = el("div", { class: "team-photo" });
      if (m.foto) photo.appendChild(el("img", { src: m.foto, alt: m.name }));
      else photo.appendChild(document.createTextNode((m.name || "?").charAt(0)));
      box.appendChild(
        el("article", { class: "card team-card reveal" }, [
          photo,
          el("h3", { style: "margin:.3rem 0 .1rem;font-size:1.15rem", text: m.name }),
          el("div", { class: "tag", text: m.tag || "" }),
          el("p", { style: "margin:.4rem 0 0;color:var(--muted)", text: m.rolle }),
        ])
      );
    });
  }

  function renderAbout() {
    if (!T.about) return;
    var box = mount("about-body");
    if (box) {
      (T.about.body || []).forEach(function (p) {
        box.appendChild(el("p", { text: p }));
      });
      if (T.about.pills) {
        var pills = el("div", { class: "chips", style: "margin-top:1rem" });
        T.about.pills.forEach(function (p) {
          pills.appendChild(el("span", { class: "chip", "aria-pressed": "true", text: p }));
        });
        box.appendChild(pills);
      }
      if (T.about.signatur) {
        box.appendChild(
          el("p", {
            style: "font-family:var(--display);font-size:1.5rem;margin-top:1.2rem",
            text: T.about.signatur,
          })
        );
      }
    }
    var h = mount("about-heading");
    if (h && T.about.heading) h.textContent = T.about.heading;
  }

  function renderOeffnungszeiten() {
    var box = mount("hours-list");
    if (!box || !T.oeffnungszeiten) return;
    var heute = new Date().getDay();
    // Reihenfolge Mo..So fuer die Anzeige
    var order = [1, 2, 3, 4, 5, 6, 0];
    order.forEach(function (d) {
      var entry = T.oeffnungszeiten.find(function (e) { return e.day === d; });
      if (!entry) return;
      var li = el("li", {}, [
        el("span", { text: WOCHENTAGE[d] }),
        el("span", { text: entry.geschlossen ? "geschlossen" : entry.von + " – " + entry.bis }),
      ]);
      if (d === heute) {
        li.classList.add("today");
        li.appendChild(el("span", { class: "pill", text: "Heute" }));
      }
      box.appendChild(li);
    });
  }

  function renderAdresseUndKarte() {
    document.querySelectorAll("[data-address]").forEach(function (n) {
      var a = T.adresse || {};
      n.innerHTML =
        esc(T.name) + "<br>" + esc(a.strasse) + "<br>" + esc(a.plz) + " " + esc(a.ort);
    });
    document.querySelectorAll("[data-maps-link]").forEach(function (a) {
      a.href = T.mapsUrl || "#";
      a.target = "_blank";
      a.rel = "noopener";
    });

    // DSGVO-freie OpenStreetMap-Einbettung (kein Google-Tracking).
    var map = mount("map-embed");
    if (map && T.geo) {
      var lat = T.geo.lat, lng = T.geo.lng;
      var d = 0.006;
      var bbox = [lng - d, lat - d / 1.6, lng + d, lat + d / 1.6].join("%2C");
      var src =
        "https://www.openstreetmap.org/export/embed.html?bbox=" +
        bbox +
        "&layer=mapnik&marker=" +
        lat +
        "%2C" +
        lng;
      map.appendChild(
        el("iframe", {
          src: src,
          title: "Standort " + T.name,
          loading: "lazy",
          referrerpolicy: "no-referrer-when-downgrade",
        })
      );
    }
  }

  function renderStats() {
    var box = mount("stats-grid");
    if (!box) return;
    var years = (function () {
      // Versuche eine Jahreszahl aus about.signatur/pills zu schaetzen -> sonst Default.
      return T._jahre || 25;
    })();
    var data = [
      { n: years, suf: "+", label: "Jahre Erfahrung" },
      { n: (T.leistungen || []).length, suf: "", label: "Leistungen" },
      { n: T.reviews ? T.reviews.count : 100, suf: "+", label: "Bewertungen" },
      { n: 98, suf: "%", label: "Weiterempfehlung" },
    ];
    data.forEach(function (s) {
      box.appendChild(
        el("div", { class: "stat reveal" }, [
          el("b", { "data-count": s.n, "data-suf": s.suf, text: "0" + s.suf }),
          el("span", { text: s.label }),
        ])
      );
    });
    starteZaehler();
  }

  function starteZaehler() {
    var els = document.querySelectorAll("[data-count]");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.textContent = e.getAttribute("data-count") + (e.getAttribute("data-suf") || ""); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        animiereZahl(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.4 });
    els.forEach(function (e) { io.observe(e); });
  }

  function animiereZahl(node) {
    var ziel = parseInt(node.getAttribute("data-count"), 10) || 0;
    var suf = node.getAttribute("data-suf") || "";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.textContent = ziel + suf;
      return;
    }
    var start = performance.now(), dauer = 1100;
    function frame(now) {
      var p = Math.min(1, (now - start) / dauer);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(ziel * eased) + suf;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* =========================================================== NAVIGATION */
  function initNav() {
    var burger = mount("burger");
    var links = mount("nav-links");
    if (burger && links) {
      burger.addEventListener("click", function () {
        var open = links.classList.toggle("open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
      });
      links.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          links.classList.remove("open");
          burger.setAttribute("aria-expanded", "false");
        });
      });
    }

    // Dark / SW-Mode Toggle
    var toggle = mount("mode-toggle");
    if (toggle) {
      var stored = localStorage.getItem("lp-mode");
      if (stored) document.documentElement.classList.add(stored);
      toggle.addEventListener("click", function () {
        var root = document.documentElement;
        // Zyklus: hell -> dark -> bw -> hell
        if (root.classList.contains("dark")) {
          root.classList.remove("dark");
          root.classList.add("bw");
          localStorage.setItem("lp-mode", "bw");
        } else if (root.classList.contains("bw")) {
          root.classList.remove("bw");
          localStorage.removeItem("lp-mode");
        } else {
          root.classList.add("dark");
          localStorage.setItem("lp-mode", "dark");
        }
      });
    }
  }

  function initReveal() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach(function (e) { e.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(function (e) { io.observe(e); });
  }

  /* ================================================= 4) TERMIN-KONFIGURATOR */
  var konf = {
    schritt: 1,
    leistungen: [], // gewaehlte Leistungs-IDs
    wunschtag: "",
    name: "",
    telefon: "",
    bemerkung: "",
    schein: null, // wird vom fahrzeugschein-Modul gesetzt (onScheinReady)
  };

  function initKonfigurator() {
    var root = mount("konfigurator");
    if (!root) return;

    // Chips aus TENANT.leistungen
    var chipBox = $("#konf-chips", root);
    if (chipBox) {
      (T.leistungen || []).forEach(function (l) {
        chipBox.appendChild(
          el("button", {
            type: "button",
            class: "chip",
            "aria-pressed": "false",
            "data-id": l.id,
            onclick: function () {
              var on = this.getAttribute("aria-pressed") === "true";
              this.setAttribute("aria-pressed", on ? "false" : "true");
              if (on) konf.leistungen = konf.leistungen.filter(function (x) { return x !== l.id; });
              else konf.leistungen.push(l.id);
              aktualisiereVorschau();
            },
          }, [document.createTextNode(l.titel)])
        );
      });
    }

    // Mindest-Datum aus leadDays (Fallback bis minLeadMinutes aus API).
    var dateInput = $("#konf-wunschtag", root);
    if (dateInput) {
      var min = new Date();
      var lead = (T.booking && T.booking.leadDays) || 0;
      min.setDate(min.getDate() + lead);
      dateInput.min = min.toISOString().slice(0, 10);
      dateInput.addEventListener("change", function () {
        konf.wunschtag = this.value;
        aktualisiereVorschau();
      });
    }

    ["name", "telefon", "bemerkung"].forEach(function (f) {
      var input = $("#konf-" + f, root);
      if (input) input.addEventListener("input", function () {
        konf[f] = this.value;
        aktualisiereVorschau();
      });
    });

    $("#konf-next", root).addEventListener("click", function () { naechsterSchritt(1); });
    $("#konf-prev", root).addEventListener("click", function () { naechsterSchritt(-1); });
    $("#konf-submit", root).addEventListener("click", absenden);

    // Fahrzeugschein-Modul meldet erfassten Schein hierher (Repository-Naht).
    document.addEventListener("schein:ready", function (e) {
      konf.schein = e.detail;
      aktualisiereVorschau();
    });

    zeigeSchritt();
    aktualisiereVorschau();
  }

  function naechsterSchritt(dir) {
    var root = mount("konfigurator");
    // Validierung Schritt 1: mind. eine Leistung, wenn requireService.
    if (dir > 0 && konf.schritt === 1 && T.booking && T.booking.requireService && konf.leistungen.length === 0) {
      meldung(root, "Bitte mindestens eine Leistung waehlen.");
      return;
    }
    if (dir > 0 && konf.schritt === 2 && !konf.wunschtag) {
      meldung(root, "Bitte einen Wunschtag waehlen.");
      return;
    }
    konf.schritt = Math.min(3, Math.max(1, konf.schritt + dir));
    zeigeSchritt();
  }

  function meldung(root, txt) {
    var m = $("#konf-msg", root);
    if (m) { m.textContent = txt; m.style.color = "var(--orange-deep)"; }
  }

  function zeigeSchritt() {
    var root = mount("konfigurator");
    $$(".konf-step", root).forEach(function (s, i) {
      s.classList.toggle("active", i + 1 === konf.schritt);
    });
    $$(".konf-progress .dot", root).forEach(function (d, i) {
      d.classList.toggle("active", i + 1 <= konf.schritt);
    });
    $("#konf-prev", root).style.visibility = konf.schritt === 1 ? "hidden" : "visible";
    $("#konf-next", root).style.display = konf.schritt === 3 ? "none" : "inline-flex";
    $("#konf-submit", root).style.display = konf.schritt === 3 ? "inline-flex" : "none";
    var m = $("#konf-msg", root);
    if (m) m.textContent = "";
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function nachrichtText() {
    var labels = (konf.leistungen || []).map(function (id) {
      var l = (T.leistungen || []).find(function (x) { return x.id === id; });
      return l ? l.titel : id;
    });
    var z = [];
    z.push("Terminanfrage — " + T.name);
    z.push("———————————————");
    z.push("Leistung(en): " + (labels.join(", ") || "—"));
    z.push("Wunschtag: " + (konf.wunschtag || "—"));
    z.push("Name: " + (konf.name || "—"));
    z.push("Telefon: " + (konf.telefon || "—"));
    if (konf.bemerkung) z.push("Bemerkung: " + konf.bemerkung);
    if (konf.schein) {
      z.push("");
      z.push("Fahrzeug:");
      if (konf.schein.kennzeichen) z.push("  Kennzeichen: " + konf.schein.kennzeichen);
      if (konf.schein.vin) z.push("  VIN/FIN: " + konf.schein.vin);
      if (konf.schein.hsn || konf.schein.tsn) z.push("  HSN/TSN: " + (konf.schein.hsn || "?") + "/" + (konf.schein.tsn || "?"));
      if (konf.schein.erstzulassung) z.push("  Erstzulassung: " + konf.schein.erstzulassung);
      if (konf.schein.foto) z.push("  (Fahrzeugschein-Foto wird separat gesendet)");
    }
    return z.join("\n");
  }

  function aktualisiereVorschau() {
    var pre = $("#konf-wa-text");
    if (pre) pre.textContent = nachrichtText();
  }

  function absenden() {
    var root = mount("konfigurator");
    if (!konf.name || !konf.telefon) {
      meldung(root, "Bitte Name und Telefonnummer angeben.");
      return;
    }
    var mode = (T.endpunkte && T.endpunkte.mode) || "whatsapp";
    var apiUrl = T.endpunkte && T.endpunkte.termin;

    // Phase 1 (mode api + konfigurierter Endpunkt): an Backend-Proxy -> tmERIK.
    if (mode === "api" && apiUrl) {
      sendeApi(apiUrl, root);
      return;
    }

    // Phase 0 (Default): wa.me-Deeplink mit strukturierter Nachricht.
    window.open(waLink(nachrichtText()), "_blank", "noopener");
    meldung(root, "WhatsApp wird geoeffnet — bitte Nachricht absenden.");
    var m = $("#konf-msg", root);
    if (m) m.style.color = "var(--blau)";
  }

  function sendeApi(url, root) {
    /* Strukturierter Payload — kompatibel zu tmERIK POST /booking/request:
       { services[], date, customer:{name,phone}, comment, licensePlate, vin,
         hsn, tsn, attachments:[fileId,...] }. Der Backend-Proxy haelt das
       Bearer-Token und reicht an tmERIK durch (Browser ruft tmERIK NIE direkt). */
    var payload = {
      services: konf.leistungen,
      date: konf.wunschtag,
      customer: { name: konf.name, phone: konf.telefon },
      comment: konf.bemerkung || "",
      licensePlate: konf.schein ? konf.schein.kennzeichen : "",
      vin: konf.schein ? konf.schein.vin : "",
      hsn: konf.schein ? konf.schein.hsn : "",
      tsn: konf.schein ? konf.schein.tsn : "",
      attachments: konf.schein && konf.schein.fileId ? [konf.schein.fileId] : [],
    };
    meldung(root, "Anfrage wird gesendet …");
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json().catch(function () { return {}; });
      })
      .then(function () {
        meldung(root, "Danke! Ihre Terminanfrage ist eingegangen. Wir melden uns.");
        $("#konf-msg", root).style.color = "var(--blau)";
      })
      .catch(function (err) {
        console.error("[konfigurator] API-Fehler:", err);
        // Robuster Fallback: WhatsApp-Deeplink, damit keine Anfrage verloren geht.
        meldung(root, "Senden fehlgeschlagen — wir oeffnen WhatsApp als Fallback.");
        window.open(waLink(nachrichtText()), "_blank", "noopener");
      });
  }

  /* ======================================================= JAHR IM FOOTER */
  function setzeFooter() {
    var y = mount("footer-year");
    if (y) y.textContent = new Date().getFullYear();
    document.querySelectorAll("[data-datenschutz]").forEach(function (a) {
      a.href = T.datenschutzHref || "#";
    });
    document.querySelectorAll("[data-impressum]").forEach(function (a) {
      a.href = T.impressumHref || "#";
    });
  }

  /* ============================================================ BOOTSTRAP */
  function init() {
    setzeTheme();
    renderMarke();
    renderLeistungenAccordion();
    renderFaq();
    renderReviews();
    renderTeam();
    renderAbout();
    renderOeffnungszeiten();
    renderAdresseUndKarte();
    renderStats();
    setzeFooter();
    initNav();
    initKonfigurator();
    initReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Oeffentliche Hilfsfunktion fuer die Module (DRY: ein wa-Link-Bauer).
  window.LP = { waLink: waLink };
})();
