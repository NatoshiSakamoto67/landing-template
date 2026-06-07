/* =============================================================================
 *  unfall.js — Gefuehrter Unfall-/Schaden-Assistent (Step-Wizard)
 * -----------------------------------------------------------------------------
 *  AUTOMATISIERUNGS-MODUL 2 von 2 (Kern der Vorlage).
 *
 *  Verzweigter Step-Wizard:
 *    1) Hergang (Quiz/Auswahl: Was ist passiert? + Datum/Uhrzeit/Ort)
 *    2) Beteiligte (Schuldfrage -> verzweigt: Gegner ODER Kasko)
 *    3) Fotos (Mehrfach-Upload, Kamera + Galerie) + optionale Skizze (Canvas)
 *    4) Kontakt & Wuensche (Gutachter, Mietwagen, Abschleppen, Reparaturauftrag)
 *
 *  Smart-Flags: Personenschaden-Alarm, "nicht verkehrssicher", Quotenfall-Hinweis,
 *  Anspruch-Hinweis bei unverschuldet.
 *
 *  Ausgabe:
 *    - reportText()    = lesbarer Bericht (Sektionen) fuer WhatsApp/E-Mail.
 *    - reportPayload() = typisiertes JSON (gleiche Felder strukturiert) fuer
 *      TENANT.endpunkte.unfall bzw. tmERIK /booking/request mit attachments[].
 *
 *  Senden ueber TENANT.endpunkte.mode:
 *    mode "whatsapp" (Default): navigator.share mit Fotos -> WhatsApp; sonst
 *      wa.me-Deeplink; E-Mail (mailto) als PC-Fallback.
 *    mode "api": Fotos chunked an /uploads (reuse fahrzeugschein-Primitiv-Idee),
 *      JSON an TENANT.endpunkte.unfall.
 *
 *  DRY: nutzt dasselbe Upload-/Foto-Pattern wie fahrzeugschein.js; die optionale
 *  Skizze (unfall-skizze.js) liefert einen PNG-Blob in DENSELBEN Fotokanal.
 *
 *  API (window.Unfall): mount(selector|element)
 * ========================================================================== */
(function () {
  "use strict";

  function T() { return window.TENANT || {}; }
  function elH(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  // -------------------------------------------------------------- Datenmodell
  var data = {
    hergang: "", // Freitext
    art: "", // gewaehlte Unfallart
    datum: "",
    uhrzeit: "",
    ort: "",
    zeugen: "",
    schuld: "", // "ich" | "gegner" | "unklar"
    versichert: "", // "haftpflicht" | "kasko"
    personenschaden: false,
    verkehrssicher: true,
    polizei: false,
    // Gegner (nur wenn schuld != ich)
    gegnerKennzeichen: "",
    gegnerVersicherung: "",
    gegnerVsNr: "",
    // Kontakt
    name: "",
    telefon: "",
    kennzeichen: "",
    // Wuensche
    wuensche: [], // ids
    fotos: [], // { file, url, name }
    skizze: null, // { file, url, name } aus unfall-skizze
  };

  var root, schritt = 0;
  var SCHRITTE = ["Hergang", "Beteiligte", "Fotos", "Kontakt"];

  var UNFALLARTEN = [
    "Auffahrunfall",
    "Parkschaden",
    "Wildunfall",
    "Glas / Steinschlag",
    "Vandalismus / Diebstahl",
    "Sturm / Hagel",
    "Sonstiges",
  ];
  var WUENSCHE = [
    { id: "gutachter", label: "Gutachter beauftragen" },
    { id: "mietwagen", label: "Mietwagen / Nutzungsausfall" },
    { id: "abschleppen", label: "Abschleppen" },
    { id: "leihwagen", label: "Leihwagen waehrend Reparatur" },
    { id: "reparatur", label: "Reparaturauftrag erteilen" },
  ];

  /* ----------------------------------------------------------------- Mount */
  function mount(target) {
    root = typeof target === "string" ? document.querySelector(target) : target;
    if (!root) { console.warn("[unfall] Mount-Punkt fehlt:", target); return; }
    root.classList.add("unfall-modul");
    render();
    return window.Unfall;
  }

  /* ---------------------------------------------------------------- Render */
  function render() {
    root.innerHTML = "";
    var card = document.createElement("div");
    card.className = "unfall-card card";

    card.appendChild(
      elH(
        '<div class="unfall-head"><span class="overline">// Unfallaufnahme</span>' +
          "<h3>Schaden melden — wir kuemmern uns</h3>" +
          '<p class="unfall-hint">In wenigen Schritten erfasst. Ihre Daten verlassen das Geraet erst beim Absenden.</p></div>'
      )
    );

    // Fortschritt
    var prog = document.createElement("ol");
    prog.className = "unfall-progress";
    prog.setAttribute("aria-label", "Fortschritt");
    SCHRITTE.forEach(function (s, i) {
      var li = document.createElement("li");
      li.textContent = s;
      if (i === schritt) { li.className = "active"; li.setAttribute("aria-current", "step"); }
      else if (i < schritt) li.className = "done";
      prog.appendChild(li);
    });
    card.appendChild(prog);

    var body = document.createElement("div");
    body.className = "unfall-step";
    body.appendChild([renderHergang, renderBeteiligte, renderFotos, renderKontakt][schritt]());
    card.appendChild(body);

    // Smart-Flags
    var flags = renderFlags();
    if (flags) card.appendChild(flags);

    // Navigation
    var nav = document.createElement("div");
    nav.className = "unfall-nav";
    var prev = elH('<button type="button" class="btn btn--ghost">Zurueck</button>');
    prev.style.visibility = schritt === 0 ? "hidden" : "visible";
    prev.addEventListener("click", function () { go(-1); });
    nav.appendChild(prev);

    if (schritt < SCHRITTE.length - 1) {
      var next = elH('<button type="button" class="btn">Weiter</button>');
      next.addEventListener("click", function () { go(1); });
      nav.appendChild(next);
    } else {
      var send = elH('<button type="button" class="btn btn--warm">Schaden absenden</button>');
      send.addEventListener("click", senden);
      nav.appendChild(send);
    }
    card.appendChild(nav);

    var status = elH('<p class="unfall-status" aria-live="polite"></p>');
    status.id = "unfall-status";
    card.appendChild(status);

    root.appendChild(card);
  }

  function go(dir) {
    if (dir > 0 && !validiere()) return;
    schritt = Math.min(SCHRITTE.length - 1, Math.max(0, schritt + dir));
    render();
    root.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
  }

  function validiere() {
    if (schritt === 0 && !data.art) { setStatus("Bitte waehlen, was passiert ist."); return false; }
    if (schritt === 1 && !data.schuld) { setStatus("Bitte die Schuldfrage einschaetzen."); return false; }
    return true;
  }

  function setStatus(t, ok) {
    var s = document.getElementById("unfall-status");
    if (s) { s.textContent = t; s.style.color = ok ? "var(--blau)" : "var(--orange-deep)"; }
  }

  /* ---------------------------------------------------- Schritt 1: Hergang */
  function renderHergang() {
    var box = document.createElement("div");
    box.appendChild(elH("<h4>Was ist passiert?</h4>"));
    var chips = document.createElement("div");
    chips.className = "chips";
    UNFALLARTEN.forEach(function (a) {
      var c = elH('<button type="button" class="chip">' + a + "</button>");
      c.setAttribute("aria-pressed", data.art === a ? "true" : "false");
      c.addEventListener("click", function () {
        data.art = a;
        render();
      });
      chips.appendChild(c);
    });
    box.appendChild(chips);

    box.appendChild(
      elH(
        '<div class="unfall-grid">' +
          field("datum", "Datum", "date", data.datum) +
          field("uhrzeit", "Uhrzeit", "time", data.uhrzeit) +
          "</div>"
      )
    );
    box.appendChild(elH(field("ort", "Unfallort", "text", data.ort, "Strasse, Ort")));
    box.appendChild(
      elH(
        '<label class="field"><span>Hergang (kurz beschreiben)</span>' +
          '<textarea data-bind="hergang" rows="3" placeholder="Was ist genau passiert?">' +
          escapeHtml(data.hergang) +
          "</textarea></label>"
      )
    );
    box.appendChild(elH(field("zeugen", "Zeugen (Name, Kontakt)", "text", data.zeugen, "optional")));
    bindFields(box);
    return box;
  }

  /* ------------------------------------------------- Schritt 2: Beteiligte */
  function renderBeteiligte() {
    var box = document.createElement("div");
    box.appendChild(elH("<h4>Schuldfrage</h4>"));
    var opts = [
      { v: "gegner", t: "Anderer ist schuld (unverschuldet)" },
      { v: "ich", t: "Ich bin (mit-)schuld" },
      { v: "unklar", t: "Unklar / strittig" },
    ];
    var cards = document.createElement("div");
    cards.className = "opt-cards";
    opts.forEach(function (o) {
      var c = elH(
        '<button type="button" class="opt-card"><strong>' + o.t + "</strong></button>"
      );
      c.setAttribute("aria-pressed", data.schuld === o.v ? "true" : "false");
      c.addEventListener("click", function () { data.schuld = o.v; render(); });
      cards.appendChild(c);
    });
    box.appendChild(cards);

    // Toggles fuer Smart-Flags
    box.appendChild(checkbox("personenschaden", "Es gab Verletzte (Personenschaden)", data.personenschaden));
    box.appendChild(checkbox("polizei", "Polizei war vor Ort / hat aufgenommen", data.polizei));
    box.appendChild(
      checkbox("verkehrssicher", "Fahrzeug ist noch fahrbereit / verkehrssicher", data.verkehrssicher)
    );

    // VERZWEIGUNG: Gegnerdaten nur wenn nicht allein selbst schuld.
    if (data.schuld === "gegner" || data.schuld === "unklar") {
      box.appendChild(elH('<h4 style="margin-top:1.2rem">Unfallgegner</h4>'));
      box.appendChild(elH(field("gegnerKennzeichen", "Kennzeichen Gegner", "text", data.gegnerKennzeichen, "z. B. M-AB 123")));
      box.appendChild(elH(field("gegnerVersicherung", "Versicherung Gegner", "text", data.gegnerVersicherung, "")));
      box.appendChild(elH(field("gegnerVsNr", "Versicherungsschein-Nr.", "text", data.gegnerVsNr, "optional")));
    } else if (data.schuld === "ich") {
      // Kasko-Pfad
      box.appendChild(elH('<h4 style="margin-top:1.2rem">Versicherung</h4>'));
      box.appendChild(
        elH(
          '<p class="unfall-note">Bei selbstverschuldeten Schaeden laeuft die Regulierung in der Regel ueber Ihre Kaskoversicherung. Wir pruefen das gemeinsam.</p>'
        )
      );
      data.versichert = "kasko";
    }
    bindFields(box);
    return box;
  }

  /* ----------------------------------------------------- Schritt 3: Fotos */
  function renderFotos() {
    var box = document.createElement("div");
    box.appendChild(elH("<h4>Fotos vom Schaden</h4>"));
    box.appendChild(
      elH('<p class="unfall-hint">Mehrere Bilder moeglich (bis 12). Fotos bleiben lokal bis zum Absenden.</p>')
    );

    var actions = document.createElement("div");
    actions.className = "unfall-actions";
    actions.appendChild(makeUpload("Foto aufnehmen", true));
    actions.appendChild(makeUpload("Aus Galerie", false));

    // Optionale Skizze via unfall-skizze.js (Feature-Detection).
    if (window.UnfallSkizze) {
      var sk = elH('<button type="button" class="btn btn--ghost">Skizze zeichnen</button>');
      sk.addEventListener("click", function () {
        window.UnfallSkizze.open(function (blob) {
          var f = new File([blob], "skizze.png", { type: "image/png" });
          data.skizze = { file: f, url: URL.createObjectURL(f), name: "Unfallskizze" };
          renderGalerie(box);
        });
      });
      actions.appendChild(sk);
    }
    box.appendChild(actions);

    var gal = document.createElement("div");
    gal.className = "unfall-galerie";
    gal.id = "unfall-galerie";
    box.appendChild(gal);
    renderGalerie(box);
    return box;
  }

  function makeUpload(label, camera) {
    var id = "uf-" + label.replace(/\s/g, "");
    var wrap = document.createElement("span");
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.multiple = true;
    if (camera) inp.setAttribute("capture", "environment");
    inp.className = "sr-only";
    inp.id = id;
    inp.addEventListener("change", function () {
      Array.prototype.forEach.call(this.files, function (f) {
        if (data.fotos.length + (data.skizze ? 1 : 0) >= 12) return;
        data.fotos.push({ file: f, url: URL.createObjectURL(f), name: f.name });
      });
      this.value = "";
      renderGalerie(root.querySelector(".unfall-step"));
    });
    var btn = elH('<button type="button" class="btn btn--ghost">' + label + "</button>");
    btn.addEventListener("click", function () { inp.click(); });
    wrap.appendChild(inp);
    wrap.appendChild(btn);
    return wrap;
  }

  function renderGalerie(scope) {
    var gal = (scope || root).querySelector("#unfall-galerie");
    if (!gal) return;
    gal.innerHTML = "";
    var alle = data.fotos.slice();
    if (data.skizze) alle.push(data.skizze);
    alle.forEach(function (item, idx) {
      var fig = document.createElement("figure");
      fig.className = "unfall-thumb";
      var img = document.createElement("img");
      img.src = item.url;
      img.alt = item.name || "Schadenfoto";
      var rm = elH('<button type="button" class="schein-remove" aria-label="Foto entfernen">×</button>');
      rm.addEventListener("click", function () {
        if (item === data.skizze) { URL.revokeObjectURL(data.skizze.url); data.skizze = null; }
        else {
          URL.revokeObjectURL(item.url);
          data.fotos = data.fotos.filter(function (x) { return x !== item; });
        }
        renderGalerie(scope);
      });
      fig.appendChild(img);
      fig.appendChild(rm);
      gal.appendChild(fig);
    });
  }

  /* --------------------------------------------------- Schritt 4: Kontakt */
  function renderKontakt() {
    var box = document.createElement("div");
    box.appendChild(elH("<h4>Ihre Wuensche</h4>"));
    var chips = document.createElement("div");
    chips.className = "chips";
    WUENSCHE.forEach(function (w) {
      var c = elH('<button type="button" class="chip">' + w.label + "</button>");
      c.setAttribute("aria-pressed", data.wuensche.indexOf(w.id) > -1 ? "true" : "false");
      c.addEventListener("click", function () {
        var i = data.wuensche.indexOf(w.id);
        if (i > -1) data.wuensche.splice(i, 1);
        else data.wuensche.push(w.id);
        c.setAttribute("aria-pressed", i > -1 ? "false" : "true");
      });
      chips.appendChild(c);
    });
    box.appendChild(chips);

    box.appendChild(elH('<h4 style="margin-top:1.2rem">Kontakt</h4>'));
    box.appendChild(elH(field("name", "Name", "text", data.name, "Vor- und Nachname")));
    box.appendChild(elH(field("telefon", "Telefon", "tel", data.telefon, "")));
    box.appendChild(elH(field("kennzeichen", "Ihr Kennzeichen", "text", data.kennzeichen, "")));
    bindFields(box);

    // Zusammenfassungs-Vorschau
    box.appendChild(elH('<h4 style="margin-top:1.2rem">Zusammenfassung</h4>'));
    var pre = document.createElement("pre");
    pre.className = "unfall-report";
    pre.textContent = reportText();
    box.appendChild(pre);
    return box;
  }

  /* ------------------------------------------------------------ Smart-Flags */
  function renderFlags() {
    var flags = [];
    if (data.personenschaden)
      flags.push({ t: "Personenschaden — bitte umgehend Notruf 112 verstaendigen und Polizei hinzuziehen.", lvl: "alarm" });
    if (!data.verkehrssicher)
      flags.push({ t: "Fahrzeug nicht verkehrssicher — nicht weiterfahren, Abschleppdienst noetig.", lvl: "warn" });
    if (data.schuld === "unklar")
      flags.push({ t: "Quotenfall moeglich — eine genaue Dokumentation (Fotos, Zeugen) ist wichtig.", lvl: "info" });
    if (data.schuld === "gegner")
      flags.push({ t: "Unverschuldet — Sie haben i. d. R. Anspruch auf Gutachter, Mietwagen und Anwalt auf Kosten der Gegenseite.", lvl: "info" });
    if (!flags.length) return null;
    var box = document.createElement("div");
    box.className = "unfall-flags";
    flags.forEach(function (f) {
      box.appendChild(elH('<p class="flag flag--' + f.lvl + '">' + f.t + "</p>"));
    });
    return box;
  }

  /* ----------------------------------------------------- Report (lesbar) */
  function reportText() {
    var L = [];
    L.push("UNFALLMELDUNG — " + (T().name || ""));
    L.push("═══════════════════════");
    L.push("[Unfall]");
    L.push("Art: " + (data.art || "—"));
    L.push("Datum/Zeit: " + (data.datum || "—") + " " + (data.uhrzeit || ""));
    L.push("Ort: " + (data.ort || "—"));
    if (data.hergang) L.push("Hergang: " + data.hergang);
    if (data.zeugen) L.push("Zeugen: " + data.zeugen);
    L.push("");
    L.push("[Schuld & Lage]");
    L.push("Schuldfrage: " + ({ ich: "selbst (mit-)schuld", gegner: "unverschuldet", unklar: "unklar" }[data.schuld] || "—"));
    L.push("Personenschaden: " + (data.personenschaden ? "JA" : "nein"));
    L.push("Verkehrssicher: " + (data.verkehrssicher ? "ja" : "NEIN"));
    L.push("Polizei: " + (data.polizei ? "ja" : "nein"));
    if (data.gegnerKennzeichen || data.gegnerVersicherung) {
      L.push("");
      L.push("[Unfallgegner]");
      if (data.gegnerKennzeichen) L.push("Kennzeichen: " + data.gegnerKennzeichen);
      if (data.gegnerVersicherung) L.push("Versicherung: " + data.gegnerVersicherung);
      if (data.gegnerVsNr) L.push("VS-Nr.: " + data.gegnerVsNr);
    }
    L.push("");
    L.push("[Kontakt]");
    L.push("Name: " + (data.name || "—"));
    L.push("Telefon: " + (data.telefon || "—"));
    L.push("Kennzeichen: " + (data.kennzeichen || "—"));
    if (data.wuensche.length) {
      var labels = data.wuensche.map(function (id) {
        var w = WUENSCHE.find(function (x) { return x.id === id; });
        return w ? w.label : id;
      });
      L.push("Wuensche: " + labels.join(", "));
    }
    var nFotos = data.fotos.length + (data.skizze ? 1 : 0);
    L.push("Anhaenge: " + nFotos + " Bild(er)" + (data.skizze ? " inkl. Skizze" : ""));
    return L.join("\n");
  }

  /* ------------------------------------ Report (typisiert, fuer API/tmERIK) */
  function reportPayload() {
    return {
      type: "unfall",
      unfall: {
        art: data.art,
        datum: data.datum,
        uhrzeit: data.uhrzeit,
        ort: data.ort,
        hergang: data.hergang,
        zeugen: data.zeugen,
      },
      schuld: data.schuld,
      flags: {
        personenschaden: data.personenschaden,
        verkehrssicher: data.verkehrssicher,
        polizei: data.polizei,
      },
      gegner:
        data.schuld === "ich"
          ? null
          : {
              kennzeichen: data.gegnerKennzeichen,
              versicherung: data.gegnerVersicherung,
              vsNr: data.gegnerVsNr,
            },
      versicherung: data.versichert || (data.schuld === "ich" ? "kasko" : "haftpflicht"),
      customer: { name: data.name, phone: data.telefon },
      licensePlate: data.kennzeichen,
      wuensche: data.wuensche,
      // attachments werden nach dem Upload (mode api) mit fileIds ersetzt.
      attachmentsCount: data.fotos.length + (data.skizze ? 1 : 0),
    };
  }

  /* ---------------------------------------------------------------- Senden */
  function senden() {
    if (!data.name || !data.telefon) { setStatus("Bitte Name und Telefon angeben."); return; }
    var t = T();
    var mode = (t.endpunkte && t.endpunkte.mode) || "whatsapp";
    var url = t.endpunkte && t.endpunkte.unfall;

    if (mode === "api" && url) {
      sendeApi(url);
      return;
    }
    sendeWhatsapp();
  }

  function alleDateien() {
    var arr = data.fotos.map(function (f) { return f.file; });
    if (data.skizze) arr.push(data.skizze.file);
    return arr;
  }

  function sendeWhatsapp() {
    var text = reportText();
    var dateien = alleDateien();
    if (dateien.length && navigator.canShare && navigator.canShare({ files: dateien })) {
      navigator
        .share({ title: "Unfallmeldung", text: text, files: dateien })
        .then(function () { setStatus("Geteilt. Bitte in WhatsApp absenden.", true); })
        .catch(function () { deeplink(text); });
    } else {
      deeplink(text);
    }
  }

  function deeplink(text) {
    var link =
      window.LP && window.LP.waLink
        ? window.LP.waLink(text)
        : "https://wa.me/" + (T().whatsapp || "") + "?text=" + encodeURIComponent(text);
    window.open(link, "_blank", "noopener");
    // E-Mail-Fallback (PC) zusaetzlich anbieten.
    var mail = T().unfallEmail || T().email;
    setStatus(
      "WhatsApp geoeffnet." +
        (data.fotos.length ? " Bitte Fotos manuell anhaengen." : "") +
        (mail ? " Alternativ per E-Mail an " + mail + "." : ""),
      true
    );
  }

  function sendeApi(url) {
    setStatus("Schaden wird gesendet …", true);
    // 1) Fotos chunked hochladen (gegen denselben /uploads-Proxy wie der Schein).
    var dateien = alleDateien();
    Promise.all(dateien.map(uploadEine))
      .then(function (fileIds) {
        var payload = reportPayload();
        payload.attachments = fileIds.filter(Boolean);
        return fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        setStatus("Danke! Ihre Unfallmeldung ist eingegangen. Wir melden uns umgehend.", true);
      })
      .catch(function (err) {
        console.error("[unfall] API-Fehler:", err);
        setStatus("Senden fehlgeschlagen — wir oeffnen WhatsApp als Fallback.");
        sendeWhatsapp();
      });
  }

  // Upload eines Bildes -> nutzt den uploads-Endpunkt des Schein-Moduls (DRY).
  function uploadEine(file) {
    var t = T();
    var uploadsUrl = t.endpunkte && t.endpunkte.fahrzeugschein; // = /api/uploads
    if (!uploadsUrl) return Promise.resolve(null);
    var total = file.size, offset = 0, CHUNK = 1024 * 512;
    var uploadId = "ul_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    function next() {
      if (offset >= total) {
        return fetch(uploadsUrl + "?finish=1&uploadId=" + uploadId, { method: "POST" })
          .then(function (r) { return r.json(); })
          .then(function (j) { return j.fileId || uploadId; });
      }
      var end = Math.min(offset + CHUNK, total);
      return fetch(uploadsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Range": "bytes " + offset + "-" + (end - 1) + "/" + total,
          "X-Upload-Id": uploadId,
          "X-File-Name": encodeURIComponent(file.name || "foto.jpg"),
        },
        body: file.slice(offset, end),
      }).then(function (r) {
        if (!r.ok) throw new Error("chunk HTTP " + r.status);
        offset = end;
        return next();
      });
    }
    return next();
  }

  /* ---------------------------------------------------------------- Helfer */
  function field(name, label, type, val, ph) {
    return (
      '<label class="field"><span>' + label + "</span>" +
      '<input type="' + type + '" data-bind="' + name + '" value="' +
      escapeAttr(val || "") + '" placeholder="' + (ph || "") + '"></label>'
    );
  }
  function checkbox(name, label, checked) {
    var lbl = elH(
      '<label class="unfall-check"><input type="checkbox"' +
        (checked ? " checked" : "") + "> <span>" + label + "</span></label>"
    );
    lbl.querySelector("input").addEventListener("change", function () {
      data[name] = this.checked;
      render();
    });
    return lbl;
  }
  function bindFields(scope) {
    scope.querySelectorAll("[data-bind]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        data[this.getAttribute("data-bind")] = this.value;
      });
    });
  }
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }
  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------------------------------------------------------------- Export */
  window.Unfall = { mount: mount, reportText: reportText, reportPayload: reportPayload };

  document.addEventListener("DOMContentLoaded", function () {
    var auto = document.getElementById("unfall-mount");
    if (auto) mount(auto);
  });
})();
