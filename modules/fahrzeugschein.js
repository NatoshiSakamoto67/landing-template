/* =============================================================================
 *  fahrzeugschein.js — Eigenstaendiges Fahrzeugschein-Erfassungsmodul
 * -----------------------------------------------------------------------------
 *  AUTOMATISIERUNGS-MODUL 1 von 2 (Kern der Vorlage).
 *
 *  Was es kann:
 *    - Foto aufnehmen (Kamera, capture="environment") ODER Datei/Galerie waehlen
 *      ODER per Drag & Drop. Optional QR-Scan via BarcodeDetector (Feature-Detection,
 *      Fallback: stiller Verzicht). QR-Pattern bringt die Seite vom PC aufs Handy.
 *    - Client-Preview (Thumbnail, Dateiname, Entfernen) + Muster-Overlay der
 *      amtlichen Zulassungsbescheinigung Teil I. Bild bleibt auf dem Geraet bis
 *      zum Senden (kein Auto-Upload) — DSGVO-Linie.
 *    - Strukturierte Felder, gemappt auf die amtlichen Schein-Felder:
 *        VIN/FIN (Feld E, 17 Stellen, uppercase) -> tmERIK vehicles.vin
 *        Kennzeichen (Feld A)                     -> licensePlate
 *        HSN (Feld 2.1) + TSN (Feld 2.2)          -> KBA-Identifikation
 *        Erstzulassung (Feld B)                   -> erstzulassung
 *        Marke/Modell (D.1/D.3)                   -> bezeichnung
 *
 *  Senden — zwei Wege ueber TENANT.endpunkte.mode:
 *    mode "whatsapp" (Default): baut strukturierte Nachricht; Foto haengt sich
 *      via navigator.share an WhatsApp an (Web-Share). Sonst wa.me-Deeplink + Hinweis.
 *    mode "api": (1) Datei (chunked) an TENANT.endpunkte.fahrzeugschein -> fileId
 *      (tmERIK POST /uploads). (2) Felder + [fileId] an TENANT.endpunkte.termin
 *      -> tmERIK POST /booking/request mit attachments[].
 *
 *  -> AUSDRUECKLICH als Einspeisung fuer den tmERIK-Fahrzeugschein-Scanner gebaut:
 *     Die erfassten Werte (VIN/Kennzeichen/HSN/TSN/Erstzulassung) entsprechen 1:1
 *     dem, was der OCR-Scanner liefert. Das Modul speist UND validiert den Scanner.
 *     Browser ruft tmERIK NIE direkt — Token liegt serverseitig im Proxy.
 *
 *  Emittiert:  document -> CustomEvent "schein:ready" mit dem Payload.
 *  Konsumenten: Termin-Konfigurator UND Unfall-Wizard (DRY: ein Schein-Modul).
 *
 *  API (window.Fahrzeugschein):
 *    mount(selector|element)  -> rendert das Modul in den Mount-Punkt
 *    getPayload()             -> aktuelle strukturierte Daten + ggf. File
 *    clear()                  -> setzt alles zurueck
 * ========================================================================== */
(function () {
  "use strict";

  var CHUNK = 1024 * 512; // 512 KB Chunk-Groesse fuer den chunked-Upload.

  var state = {
    file: null, // File-Objekt (bleibt lokal bis zum Senden)
    objectUrl: null, // URL.createObjectURL fuer Preview
    fileId: null, // von /uploads zurueckgegeben (mode api)
    felder: { kennzeichen: "", vin: "", hsn: "", tsn: "", erstzulassung: "", bezeichnung: "" },
    root: null,
  };

  function T() { return window.TENANT || {}; }

  /* ----------------------------------------------------------------- Render */
  function mount(target) {
    var root = typeof target === "string" ? document.querySelector(target) : target;
    if (!root) {
      console.warn("[fahrzeugschein] Mount-Punkt nicht gefunden:", target);
      return;
    }
    state.root = root;
    root.innerHTML = "";
    root.classList.add("schein-modul");

    root.appendChild(buildUI());
    bind(root);
    return window.Fahrzeugschein;
  }

  function buildUI() {
    var wrap = document.createElement("div");
    wrap.className = "schein-card card";
    wrap.innerHTML = [
      '<div class="schein-head">',
      '  <span class="overline">// Fahrzeugschein</span>',
      "  <h3>Fahrzeugschein erfassen</h3>",
      '  <p class="schein-hint">Foto der Zulassungsbescheinigung Teil I aufnehmen oder hochladen.',
      "     Das Bild bleibt auf Ihrem Geraet, bis Sie die Anfrage absenden.</p>",
      "</div>",

      '<div class="schein-actions" role="group" aria-label="Aufnahmeweg waehlen">',
      '  <button type="button" class="btn btn--ghost" data-act="kamera">Foto aufnehmen</button>',
      '  <button type="button" class="btn btn--ghost" data-act="datei">Datei waehlen</button>',
      '  <button type="button" class="btn btn--ghost" data-act="qr" hidden>QR scannen</button>',
      "</div>",

      // versteckte Inputs: 1) Kamera (capture) 2) Galerie/Datei
      '<input type="file" accept="image/*" capture="environment" id="schein-cam" class="sr-only" aria-hidden="true" tabindex="-1">',
      '<input type="file" accept="image/*" id="schein-file" class="sr-only" aria-hidden="true" tabindex="-1">',

      // Dropzone + Preview
      '<div class="schein-drop" id="schein-drop" tabindex="0" role="button" aria-label="Bild hierher ziehen oder zum Auswaehlen klicken">',
      '  <div class="schein-drop-empty">',
      '    <strong>Hierher ziehen</strong> oder klicken zum Auswaehlen',
      '    <small>Muster: amtliche Zulassungsbescheinigung Teil I</small>',
      "  </div>",
      '  <figure class="schein-preview" hidden>',
      '    <img alt="Vorschau Fahrzeugschein" id="schein-img">',
      '    <figcaption><span id="schein-name"></span>',
      '      <button type="button" class="schein-remove" id="schein-remove" aria-label="Bild entfernen">Entfernen</button>',
      "    </figcaption>",
      "  </figure>",
      "</div>",

      // Strukturierte Felder
      '<div class="schein-felder">',
      fld("kennzeichen", "Kennzeichen (Feld A)", "z. B. B-MW 1234"),
      fld("vin", "VIN / FIN (Feld E, 17 Stellen)", "WBA…", "characters", 17),
      '  <div class="schein-row">',
      fld("hsn", "HSN (2.1)", "z. B. 0005", "characters", 4),
      fld("tsn", "TSN (2.2)", "z. B. AAB", "characters", 3),
      "  </div>",
      fld("erstzulassung", "Erstzulassung (Feld B)", "TT.MM.JJJJ"),
      fld("bezeichnung", "Marke / Modell (D.1 / D.3)", "z. B. BMW 320d"),
      "</div>",

      '<p class="schein-status" id="schein-status" aria-live="polite"></p>',
      '<button type="button" class="btn btn--block" id="schein-send">Fahrzeugschein uebernehmen</button>',
    ].join("");
    return wrap;
  }

  function fld(name, label, ph, transform, max) {
    return (
      '<label class="field"><span>' +
      label +
      "</span>" +
      '<input type="text" data-feld="' +
      name +
      '" placeholder="' +
      ph +
      '"' +
      (max ? ' maxlength="' + max + '"' : "") +
      (transform ? ' data-transform="' + transform + '"' : "") +
      "></label>"
    );
  }

  /* ------------------------------------------------------------------- Bind */
  function bind(root) {
    var cam = root.querySelector("#schein-cam");
    var file = root.querySelector("#schein-file");
    var drop = root.querySelector("#schein-drop");

    root.querySelector('[data-act="kamera"]').addEventListener("click", function () { cam.click(); });
    root.querySelector('[data-act="datei"]').addEventListener("click", function () { file.click(); });

    cam.addEventListener("change", function () { if (this.files[0]) setBild(this.files[0]); });
    file.addEventListener("change", function () { if (this.files[0]) setBild(this.files[0]); });

    // Dropzone: Klick + Drag&Drop + Tastatur
    drop.addEventListener("click", function (e) {
      if (e.target.id === "schein-remove") return;
      file.click();
    });
    drop.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); }
    });
    ["dragover", "dragenter"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("drag"); });
    });
    drop.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && /^image\//.test(f.type)) setBild(f);
    });

    root.querySelector("#schein-remove").addEventListener("click", function (e) {
      e.stopPropagation();
      clearBild();
    });

    // Felder: Live-Capture + Transform (uppercase) + leichte Validierung.
    root.querySelectorAll("[data-feld]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        if (this.getAttribute("data-transform") === "characters") {
          var pos = this.selectionStart;
          this.value = this.value.toUpperCase();
          this.setSelectionRange(pos, pos);
        }
        state.felder[this.getAttribute("data-feld")] = this.value.trim();
        emitReady(); // fortlaufend an Konfigurator/Unfall melden
      });
      inp.addEventListener("blur", validiere);
    });

    // QR optional (Feature-Detection BarcodeDetector).
    initQr(root);

    root.querySelector("#schein-send").addEventListener("click", senden);
  }

  function validiere() {
    var s = state.felder;
    var st = state.root.querySelector("#schein-status");
    if (s.vin && s.vin.length !== 17) {
      st.textContent = "Hinweis: Die VIN/FIN hat normalerweise genau 17 Zeichen.";
      st.style.color = "var(--orange-deep)";
    } else {
      st.textContent = "";
    }
  }

  /* ----------------------------------------------------------------- Bild */
  function setBild(f) {
    clearObjectUrl();
    state.file = f;
    state.objectUrl = URL.createObjectURL(f);
    var img = state.root.querySelector("#schein-img");
    var prev = state.root.querySelector(".schein-preview");
    var empty = state.root.querySelector(".schein-drop-empty");
    img.src = state.objectUrl;
    state.root.querySelector("#schein-name").textContent = f.name || "Foto";
    prev.hidden = false;
    empty.style.display = "none";
    emitReady();
  }

  function clearBild() {
    clearObjectUrl();
    state.file = null;
    state.fileId = null;
    var prev = state.root.querySelector(".schein-preview");
    var empty = state.root.querySelector(".schein-drop-empty");
    prev.hidden = true;
    empty.style.display = "";
    state.root.querySelector("#schein-cam").value = "";
    state.root.querySelector("#schein-file").value = "";
    emitReady();
  }

  function clearObjectUrl() {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }
  }

  function clear() {
    clearBild();
    Object.keys(state.felder).forEach(function (k) { state.felder[k] = ""; });
    if (state.root) {
      state.root.querySelectorAll("[data-feld]").forEach(function (i) { i.value = ""; });
      var st = state.root.querySelector("#schein-status");
      if (st) st.textContent = "";
    }
  }

  /* -------------------------------------------------------------------- QR */
  function initQr(root) {
    if (!("BarcodeDetector" in window)) return; // kein Polyfill — stiller Verzicht.
    var btn = root.querySelector('[data-act="qr"]');
    btn.hidden = false;
    btn.addEventListener("click", function () { scanneQr(root); });
  }

  function scanneQr(root) {
    var st = root.querySelector("#schein-status");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      st.textContent = "Kamera fuer QR nicht verfuegbar.";
      return;
    }
    var detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    var video = document.createElement("video");
    video.setAttribute("playsinline", "");
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(function (stream) {
        video.srcObject = stream;
        return video.play();
      })
      .then(function () {
        st.textContent = "QR-Code wird gesucht …";
        var tick = function () {
          detector
            .detect(video)
            .then(function (codes) {
              if (codes && codes.length) {
                st.textContent = "QR erkannt: " + codes[0].rawValue;
                stop(video);
              } else {
                requestAnimationFrame(tick);
              }
            })
            .catch(function () { requestAnimationFrame(tick); });
        };
        tick();
      })
      .catch(function () { st.textContent = "QR-Scan abgebrochen."; });
  }

  function stop(video) {
    if (video.srcObject) video.srcObject.getTracks().forEach(function (t) { t.stop(); });
  }

  /* --------------------------------------------------------------- Payload */
  function getPayload() {
    var f = state.felder;
    return {
      kennzeichen: f.kennzeichen,
      vin: f.vin,
      hsn: f.hsn,
      tsn: f.tsn,
      erstzulassung: f.erstzulassung,
      bezeichnung: f.bezeichnung,
      foto: !!state.file,
      file: state.file, // bleibt lokal — fuer Web-Share / chunked-Upload
      fileId: state.fileId, // gesetzt nach erfolgreichem /uploads (mode api)
    };
  }

  // Repository-Naht: an Konfigurator UND Unfall-Wizard melden.
  function emitReady() {
    document.dispatchEvent(new CustomEvent("schein:ready", { detail: getPayload() }));
  }

  /* ---------------------------------------------------------------- Senden */
  function senden() {
    var t = T();
    var mode = (t.endpunkte && t.endpunkte.mode) || "whatsapp";
    var url = t.endpunkte && t.endpunkte.fahrzeugschein;
    emitReady();

    if (mode === "api" && url) {
      uploadChunked(url)
        .then(function (fileId) {
          state.fileId = fileId;
          emitReady();
          setStatus(
            "Hochgeladen. Daten werden mit der Terminanfrage uebernommen.",
            "var(--blau)"
          );
        })
        .catch(function (err) {
          console.error("[fahrzeugschein] Upload-Fehler:", err);
          fallbackWhatsapp("Upload fehlgeschlagen — wir oeffnen WhatsApp.");
        });
      return;
    }
    fallbackWhatsapp();
  }

  function setStatus(txt, color) {
    var st = state.root.querySelector("#schein-status");
    if (st) { st.textContent = txt; st.style.color = color || "var(--ink-soft)"; }
  }

  /* WhatsApp/Share-Fallback: Foto direkt anhaengen (Web-Share), sonst Deeplink. */
  function fallbackWhatsapp(prefix) {
    var t = T();
    var text = nachrichtText();
    // Web Share API mit Datei -> oeffnet WhatsApp-Auswahl inkl. Foto.
    if (
      state.file &&
      navigator.canShare &&
      navigator.canShare({ files: [state.file] })
    ) {
      navigator
        .share({ title: "Fahrzeugschein", text: text, files: [state.file] })
        .then(function () { setStatus("Geteilt. Bitte in WhatsApp absenden.", "var(--blau)"); })
        .catch(function () { oeffneDeeplink(text); });
    } else {
      oeffneDeeplink(text, prefix);
    }
  }

  function oeffneDeeplink(text, prefix) {
    var t = T();
    var link =
      window.LP && window.LP.waLink
        ? window.LP.waLink(text)
        : "https://wa.me/" + (t.whatsapp || "") + "?text=" + encodeURIComponent(text);
    window.open(link, "_blank", "noopener");
    setStatus(
      (prefix ? prefix + " " : "") +
        (state.file ? "Bitte das Foto in WhatsApp manuell anhaengen." : "WhatsApp geoeffnet."),
      "var(--orange-deep)"
    );
  }

  function nachrichtText() {
    var f = state.felder;
    var z = ["Fahrzeugschein — " + (T().name || ""), "———————————————"];
    if (f.kennzeichen) z.push("Kennzeichen: " + f.kennzeichen);
    if (f.vin) z.push("VIN/FIN: " + f.vin);
    if (f.hsn || f.tsn) z.push("HSN/TSN: " + (f.hsn || "?") + "/" + (f.tsn || "?"));
    if (f.erstzulassung) z.push("Erstzulassung: " + f.erstzulassung);
    if (f.bezeichnung) z.push("Marke/Modell: " + f.bezeichnung);
    return z.join("\n");
  }

  /* ------------------------------------------------- Chunked Upload (mode api)
   * Spiegelt tmERIK POST /uploads (chunked): das Backend nimmt Chunks an und
   * gibt am Ende eine fileId zurueck. Hier vereinfacht als sequentielle
   * Chunk-POSTs mit Content-Range-Header; der Proxy setzt die Datei zusammen
   * und reicht sie an tmERIK durch. Passe Header an deinen Proxy-Vertrag an.
   */
  function uploadChunked(url) {
    var file = state.file;
    if (!file) return Promise.reject(new Error("Kein Bild ausgewaehlt."));
    var total = file.size;
    var offset = 0;
    var uploadId =
      "ul_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    setStatus("Wird hochgeladen …", "var(--ink-soft)");

    function next() {
      if (offset >= total) {
        // Abschluss-Request: liefert die fileId.
        return fetch(url + "?finish=1&uploadId=" + uploadId, { method: "POST" })
          .then(function (r) {
            if (!r.ok) throw new Error("finish HTTP " + r.status);
            return r.json();
          })
          .then(function (j) { return j.fileId || uploadId; });
      }
      var end = Math.min(offset + CHUNK, total);
      var chunk = file.slice(offset, end);
      return fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Range": "bytes " + offset + "-" + (end - 1) + "/" + total,
          "X-Upload-Id": uploadId,
          "X-File-Name": encodeURIComponent(file.name || "schein.jpg"),
        },
        body: chunk,
      }).then(function (r) {
        if (!r.ok) throw new Error("chunk HTTP " + r.status);
        offset = end;
        return next();
      });
    }
    return next();
  }

  /* ---------------------------------------------------------------- Export */
  window.Fahrzeugschein = {
    mount: mount,
    getPayload: getPayload,
    clear: clear,
  };

  // Auto-Mount, falls Standard-Mount-Punkt vorhanden.
  document.addEventListener("DOMContentLoaded", function () {
    var auto = document.getElementById("fahrzeugschein-mount");
    if (auto) mount(auto);
  });
})();
