"use strict";
const $ = (s) => document.querySelector(s);
const form = $("#form");

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}

function fill(cfg) {
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") el.checked = !!cfg[el.name];
    else if (cfg[el.name] != null) el.value = cfg[el.name];
  }
}

function collect() {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type === "number") out[el.name] = Number(el.value);
    else out[el.name] = el.value;
  }
  return out;
}

function flash(text, cls) {
  const m = $("#msg");
  m.textContent = text;
  m.className = "msg " + (cls || "");
  if (text) setTimeout(() => { m.textContent = ""; m.className = "msg"; }, 2500);
}

async function refreshStatus() {
  try {
    const h = await api("/health");
    $("#status").textContent = `živ · ${h.hotkey} · ${h.mode} · :${h.port}`;
    $("#status").classList.add("live");
  } catch {
    $("#status").textContent = "nedostupan";
    $("#status").classList.remove("live");
  }
}

$("#save").addEventListener("click", async () => {
  try {
    const cfg = await api("/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collect()),
    });
    fill(cfg);
    flash("Sačuvano ✓", "ok");
    refreshStatus();
  } catch (e) {
    flash("Greška: " + e.message, "err");
  }
});

document.querySelectorAll(".qbtn").forEach((b) =>
  b.addEventListener("click", async () => {
    flash("Hvatam…");
    try {
      const r = await api("/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: b.dataset.mode }),
      });
      if (r.cancelled) flash("Otkazano");
      else if (r.error) flash("Greška: " + r.error, "err");
      else flash((r.dest === "clipboard" ? "→ clipboard" : "→ " + (r.path || "")), "ok");
    } catch (e) {
      flash("Greška: " + e.message, "err");
    }
  })
);

(async () => {
  try { fill(await api("/settings")); } catch {}
  refreshStatus();
})();
