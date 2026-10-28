(() => {
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const RATES = ["Meh", "Fine", "Good", "Real good", "Marry it"];

  // ---- build the menu ----
  const menu = $("menu");
  for (const m of MENU) {
    const el = document.createElement("div");
    el.className = "item"; el.dataset.id = m.id;
    el.innerHTML = `
      <button type="button" aria-expanded="false" aria-controls="more-${m.id}">
        <span class="nm"></span><span class="tick" aria-hidden="true">+</span><span class="ds"></span>
      </button>
      <div class="more" id="more-${m.id}" hidden>
        ${m.ways ? `<div><div class="row-label">Which way?</div><div class="chips" style="margin-top:8px">
          ${m.ways.map((w, i) => `<label class="chip" for="${m.id}-way-${i}"><input type="radio" id="${m.id}-way-${i}" name="${m.id}_way" value="${w}"><span>${w}</span></label>`).join("")}
        </div></div>` : ""}
        <div><div class="row-label">How'd it land?</div><div class="dots" style="margin-top:8px">
          ${RATES.map((r, i) => `<label for="${m.id}-r${i + 1}"><input type="radio" id="${m.id}-r${i + 1}" name="${m.id}_rating" value="${i + 1}"><span></span>${r}</label>`).join("")}
        </div></div>
        <label class="f" for="${m.id}-note" style="color:var(--ink)">Tell us more (optional)<textarea id="${m.id}-note" name="${m.id}_note"></textarea></label>
      </div>`;
    el.querySelector(".nm").textContent = m.name;
    el.querySelector(".ds").textContent = m.desc;
    const btn = el.querySelector("button"), more = el.querySelector(".more"), tick = el.querySelector(".tick");
    btn.addEventListener("click", () => {
      const on = !el.classList.contains("on");
      el.classList.toggle("on", on); more.hidden = !on; btn.setAttribute("aria-expanded", on);
      tick.textContent = on ? "✓" : "+";
    });
    menu.appendChild(el);
  }

  // ---- send to Netlify Forms (queues on failure, retries next load) ----
  const encode = (o) => Object.keys(o).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(o[k] ?? "")).join("&");
  async function send(payload) {
    const r = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: encode(payload) });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }
  async function flushQueue() {
    const q = store.get("ff-queue") || []; const left = [];
    for (const p of q) { try { await send(p); } catch { left.push(p); } }
    store.set("ff-queue", left);
  }
  flushQueue();

  // ---- pick a card: random, but never the same one twice in a row on this phone ----
  function pick() {
    const last = store.get("ff-last");
    const pool = CARDS.filter((c) => c.title !== last);
    const c = pool[Math.floor(Math.random() * pool.length)];
    store.set("ff-last", c.title);
    return c;
  }

  // ---- submit ----
  $("fb").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("err"); err.hidden = true;
    const name = $("name").value.trim(), email = $("email").value.trim();
    const chosen = [...document.querySelectorAll(".item.on")].map((el) => el.dataset.id);
    let msg = "";
    if (!name) msg = "Add your name so the Sergeants know who they're reading for.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) msg = "That email looks off. Give it another look?";
    else if (!chosen.length) msg = "Tap at least one thing you ate.";
    if (msg) { err.textContent = msg; err.hidden = false; err.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

    const card = pick();
    const omen = OMENS[Math.floor(Math.random() * OMENS.length)];
    const fd = new FormData($("fb"));
    const payload = { "form-name": "freckled-feedback", "bot-field": $("bot").value, name, email,
      news: $("news").checked ? "yes" : "no", overall: fd.get("overall") || "",
      ordered: chosen.map((id) => MENU.find((m) => m.id === id).name).join(", "),
      card: card.n + " " + card.title };
    for (const id of chosen) {
      payload[id + "_rating"] = fd.get(id + "_rating") ? RATES[fd.get(id + "_rating") - 1] + " (" + fd.get(id + "_rating") + "/5)" : "";
      if (fd.get(id + "_way") !== null) payload[id + "_way"] = fd.get(id + "_way") || "";
      payload[id + "_note"] = fd.get(id + "_note") || "";
    }

    const go = $("go"); go.disabled = true; go.textContent = "Shuffling the deck...";
    send(payload).catch(() => { const q = store.get("ff-queue") || []; q.push(payload); store.set("ff-queue", q); });

    try { await reveal(card, name.split(" ")[0], omen); }
    catch (x) { go.disabled = false; go.textContent = "Pull my card"; err.textContent = "The deck got stuck. Tap Pull my card again."; err.hidden = false; }
  });

  // ---- reveal ----
  let blob = null, fileName = "";
  async function reveal(card, first, omen) {
    const cv = await renderCard($("cv"), card, { name: first, omen });
    const url = cv.toDataURL("image/jpeg", 0.9);
    $("cardimg").src = url; $("cardimg").alt = `${card.title} tarot card featuring ${CATS[card.cat]}, pulled for ${first}`;
    blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9));
    fileName = `freckled-fork-${card.title.toLowerCase().replace(/[^a-z]+/g, "-")}.jpg`;
    $("rh").textContent = first + ", you pulled";
    $("ct").textContent = card.n + " · " + card.title;
    $("ck").textContent = card.key;
    $("cx").textContent = card.text;
    $("ask").hidden = true; $("result").hidden = false;
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => setTimeout(() => $("flip").classList.add("done"), 450));
  }

  $("save").addEventListener("click", async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/jpeg" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "My Freckled Fork card" }); return; }
    } catch (x) { if (x && x.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    $("savehint").textContent = "If nothing downloaded, press and hold the card to save it.";
  });
})();
