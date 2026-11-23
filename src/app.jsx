
import { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, memo } from "react";
import { createRoot } from "react-dom/client";

/* =====================================================================
   1. DONNÉES : index dérivé de window.VGACHA_DB
   ===================================================================== */
// @@DATA-START
const LS_PROGRESS = "vgacha-tags-toutes-les-cartes"; // même clé que les anciennes versions
const PAGE = 60;   // cartes rendues à la fois (chargement progressif)
const EMPTY = {};
const BLOCKED = new Set(["__proto__", "constructor", "prototype"]); // clés interdites dans un fichier importé
const isNum = (n) => Number.isInteger(n) && n > 0 && n < 10000;
const SECTION_RENAMES = { "R:ZEVENT": "Zevent", "R:Fullart": "Fullart" }; // anciennes clés de progression
const byName = (a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
const uniq = (a) => [...new Set(a)];

function buildIndex(db) {
  // "UR-Pseudo" -> "Pseudo" ; clé de fusion : minuscules, "_" = espace
  const prefixRe = new RegExp("^(" + [...db.rarities.map(r => r.key), "SPOOKY"].sort((a, b) => b.length - a.length).join("|") + ")-", "i");
  const strip = (n) => n.replace(prefixRe, "").trim();
  const norm = (n) => strip(n).toLowerCase().replace(/_/g, " ");

  const rarityBy = new Map(db.rarities.map(r => [r.key, r]));
  const bonus = new Set((db.bonusCards || []).map(norm));

  const cards = db.cards.map(c => {
    const key = norm(c.name);
    const series = [...c.series];
    for (const r of c.rarities) {            // une rareté peut impliquer une série (ZEVENT -> Zevent)
      const s = rarityBy.get(r) && rarityBy.get(r).series;
      if (s && !series.includes(s)) series.push(s);
    }
    if (!series.length) series.push("Base");
    const mine = new Set(c.sections || []);
    const sections = db.sections
      .filter(s => s.all || mine.has(s.key))
      .map(s => ({ key: s.key, color: s.color, max: s.count + (s.bonus && bonus.has(key) ? 1 : 0) }));
    return {
      name: c.name, key, lower: c.name.toLowerCase(),
      rarities: c.rarities, series, displaySeries: series.filter(s => s !== "Base"),
      sections, total: sections.reduce((n, s) => n + s.max, 0),
    };
  }).sort(byName);

  return {
    db, cards, strip, norm,
    byKey: new Map(cards.map(c => [c.key, c])),
    byName: new Map(cards.map(c => [c.name, c])),
    rarityChips: db.rarities.filter(r => r.chip !== false).map(r => r.key),
    seriesOrder: new Map(db.series.map((s, i) => [s.key, i])),
    seriesHidden: new Set(db.series.filter(s => s.hidden).map(s => s.key)),
    seriesSections: new Map(db.series.map(s => [s.key, s.sections || []])),
    colors: new Map(db.sections.map(s => [s.key, s.color])),
  };
}

const ownedIn = (st, sections) => {
  let n = 0;
  if (st) for (const s of sections) { const v = st[s.key]; if (v) n += v.length; }
  return n;
};
const hasAny = (st) => {
  if (st) for (const k in st) if (Array.isArray(st[k]) && st[k].length) return true;
  return false;
};
// @@DATA-END

/* =====================================================================
   2. PROGRESSION (localStorage + fichier vgacha-progression.js)
   ===================================================================== */
const mergeStates = (a, b) => {                // union des numéros, rien n'est écrasé
  const out = { ...a };
  for (const [card, secs] of Object.entries(b || {})) {
    if (BLOCKED.has(card)) continue;
    const cur = { ...(out[card] || {}) };
    for (const [sec, nums] of Object.entries(secs || {})) {
      if (BLOCKED.has(sec) || !Array.isArray(nums) || !nums.length) continue;
      cur[sec] = uniq([...(cur[sec] || []), ...nums]).sort((x, y) => x - y);
    }
    if (Object.keys(cur).length) out[card] = cur;
  }
  return out;
};
const parseProgress = (text) =>
  JSON.parse(text.replace(/^\s*window\.VGACHA_PROGRESSION\s*=\s*/, "").replace(/;\s*$/, ""));
const toProgressFile = (s) => "window.VGACHA_PROGRESSION = " + JSON.stringify(s, null, 1) + ";\n";

// Ramène d'anciennes clés (préfixées, casse différente…) sur le pseudo exact de la db
function migrate(saved, ix) {
  const out = {};
  for (const [key, val] of Object.entries(saved || {})) {
    const card = ix.byKey.get(ix.norm(key));
    const name = card ? card.name : ix.strip(key);
    if (BLOCKED.has(name) || !val || typeof val !== "object") continue;
    for (const [sec, raw] of Object.entries(val)) {
      const nums = Array.isArray(raw) ? raw.filter(isNum) : [];
      const dest = Object.prototype.hasOwnProperty.call(SECTION_RENAMES, sec) ? SECTION_RENAMES[sec] : sec;
      if (!nums.length || BLOCKED.has(dest)) continue;
      const cur = out[name] || (out[name] = {});
      cur[dest] = uniq([...(cur[dest] || []), ...nums]).sort((a, b) => a - b);
    }
  }
  return out;
}
function loadProgress(ix) {
  try {
    const raw = localStorage.getItem(LS_PROGRESS);
    if (raw) { const s = migrate(JSON.parse(raw), ix); if (Object.keys(s).length) return s; }
  } catch (e) {}
  try { if (window.VGACHA_PROGRESSION) return migrate(window.VGACHA_PROGRESSION, ix); } catch (e) {}
  return {};
}
const saveProgress = (s) => { try { localStorage.setItem(LS_PROGRESS, JSON.stringify(s)); } catch (e) {} };

function useProgress(ixRef) {
  const [state, setState] = useState(() => loadProgress(ixRef.current));
  const [linked, setLinked] = useState(false);
  const latest = useRef(state); latest.current = state;
  const handle = useRef(null);                       // fichier lié (Chrome/Edge)

  useEffect(() => {                                  // sauvegarde différée
    const t = setTimeout(async () => {
      saveProgress(state);
      if (!handle.current) return;
      try { const w = await handle.current.createWritable(); await w.write(toProgressFile(state)); await w.close(); } catch (e) {}
    }, 300);
    return () => clearTimeout(t);
  }, [state]);
  useEffect(() => {
    const flush = () => saveProgress(latest.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const toggle = useCallback((card, section, n) => setState(prev => {
    const cur = prev[card] || {};
    const list = cur[section] || [];
    const next = list.includes(n) ? list.filter(x => x !== n) : [...list, n].sort((a, b) => a - b);
    const c = { ...cur };
    if (next.length) c[section] = next; else delete c[section];
    const out = { ...prev };
    if (Object.keys(c).length) out[card] = c; else delete out[card];
    return out;
  }), []);

  const rename = useCallback((from, to) => setState(prev => {   // pseudo renommé dans l'admin
    if (from === to || !prev[from]) return prev;
    const { [from]: moved, ...rest } = prev;
    return mergeStates(rest, { [to]: moved });
  }), []);

  const exportFile = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toProgressFile(state)], { type: "text/javascript" }));
    a.download = "vgacha-progression.js"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importFile = async (file) => {
    try { const imported = migrate(parseProgress(await file.text()), ixRef.current); setState(p => mergeStates(p, imported)); }
    catch (e) { alert("Fichier de progression invalide."); }
  };
  const linkFile = async () => {
    try {
      handle.current = await window.showSaveFilePicker({
        suggestedName: "vgacha-progression.js",
        types: [{ description: "Progression VGacha", accept: { "text/javascript": [".js"] } }],
      });
      setLinked(true);
      const w = await handle.current.createWritable(); await w.write(toProgressFile(latest.current)); await w.close();
    } catch (e) {}
  };
  return { state, toggle, rename, exportFile, importFile, linkFile, linked, canLink: typeof window.showSaveFilePicker === "function" };
}

/* =====================================================================
   3. PETITS COMPOSANTS
   ===================================================================== */
const Pill = ({ active, all, onClick, title, children, stat }) => (
  <button type="button" onClick={onClick} title={title}
    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
      active ? (all ? "bg-slate-100 border-slate-100 text-slate-900" : "bg-indigo-600 border-indigo-500 text-white")
             : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"}`}>
    {children}
    {stat && <span className={`ml-1 text-[10px] font-bold ${active ? "text-white/80" : "text-slate-500"}`}>{stat}</span>}
  </button>
);

const Bar = ({ pct, color, h = "h-1.5" }) => (
  <div className={`${h} rounded-full bg-slate-800 overflow-hidden`}>
    <div className="h-full rounded-full transition-all"
      style={{ width: Math.min(100, pct) + "%", background: color || "linear-gradient(to right,#6366f1,#22d3ee)" }}></div>
  </div>
);

const Overlay = ({ onClose, children, top }) => (
  <div className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center overflow-y-auto p-4 ${top ? "items-start" : "items-center"}`}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    {children}
  </div>
);

/* =====================================================================
   4. COLLECTION
   ===================================================================== */
const Card = memo(function Card({ card, own, onOpen, onAdd, onRemove }) {
  const owned = ownedIn(own, card.sections);
  const pct = card.total ? Math.round(owned / card.total * 100) : 0;
  const complete = card.total > 0 && owned === card.total;
  return (
    <div className={`rounded-xl border p-4 flex flex-col transition ${
      complete ? "border-emerald-500/60 bg-emerald-950/20"
        : hasAny(own) ? "border-slate-700 bg-slate-900" : "border-slate-800 bg-slate-900/60"}`}>
      <button onClick={() => onOpen(card.name)}
        className="font-bold text-indigo-300 hover:text-indigo-100 hover:underline text-left mb-1">{card.name}</button>

      {card.displaySeries.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.displaySeries.map(s => (
            <span key={s} className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 border border-slate-600">{s}</span>
          ))}
        </div>
      )}

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className={complete ? "text-emerald-400 font-semibold" : "text-slate-400"}>{owned}/{card.total} ({pct}%)</span>
          {complete && <span className="text-emerald-400 font-semibold">Complète !</span>}
        </div>
        <Bar pct={pct} />
      </div>

      <div className="space-y-1.5">
        {card.sections.map(({ key, max, color }) => {
          const count = own[key] ? own[key].length : 0;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }}></span>
              <span className="text-xs w-28 shrink-0 flex items-baseline gap-1">
                <span className="text-slate-300 font-medium">{key}</span>
                <span className={count === max ? "text-emerald-400 font-bold" : "text-slate-400"}>{count}/{max}</span>
              </span>
              <span className="grow" style={{ minWidth: 24 }}><Bar pct={count / max * 100} color={color} h="h-1" /></span>
              <span className="flex gap-1 justify-end">
                {count > 0 && <button onClick={() => onRemove(card.name, key)} title="Retirer un numéro"
                  className="px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-red-700 rounded-full">&minus;</button>}
                {count < max && <button onClick={() => onAdd(card.name, key)} title="Ajouter un numéro"
                  className="px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded-full">+</button>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

function NumberPicker({ picker, onConfirm, onClose }) {
  const [num, setNum] = useState(picker.options[0]);
  const adding = picker.mode === "add";
  return (
    <Overlay onClose={onClose}>
      <div className="bg-slate-800 rounded-lg p-4 w-64 relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-slate-400 hover:text-white text-xl">&times;</button>
        <h3 className="text-white mb-2">{adding ? "Ajouter" : "Retirer"} {picker.key}</h3>
        <p className="text-xs text-slate-400 mb-2">Pour : {picker.name}</p>
        <select value={num} onChange={(e) => setNum(+e.target.value)} className="w-full bg-slate-700 rounded p-2 mb-3">
          {picker.options.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={() => onConfirm(num)} className={`${adding ? "bg-indigo-600" : "bg-red-600"} text-white px-3 py-1 rounded`}>{adding ? "Ajouter" : "Retirer"}</button>
          <button onClick={onClose} className="bg-slate-700 text-white px-3 py-1 rounded">Annuler</button>
        </div>
      </div>
    </Overlay>
  );
}

function Pokecardex({ card, own, onToggle, onClose }) {
  const owned = ownedIn(own, card.sections);
  const pct = card.total ? Math.round(owned / card.total * 100) : 0;
  return (
    <Overlay onClose={onClose} top>
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl my-8 p-5 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
        <h2 className="text-xl font-bold text-white mb-2">Collection de <span className="text-indigo-400">{card.name}</span></h2>
        <div className="flex flex-wrap gap-1 mb-2">
          {card.series.map(s => <span key={s} className="px-2 py-0.5 text-[11px] rounded-full bg-slate-800 text-slate-300 border border-slate-600">{s}</span>)}
        </div>
        <p className="text-sm text-slate-400 mb-2"><span className="text-emerald-400 font-semibold">{owned}</span> / {card.total} cartes possédées ({pct}%)</p>
        <div className="mb-4"><Bar pct={pct} h="h-2" /></div>
        <p className="text-xs text-slate-500 mb-3">Clique sur une carte pour l'ajouter / la retirer de ta collection.</p>

        {card.sections.map(({ key, max, color }) => {
          const have = new Set(own[key] || []);
          return (
            <div key={key} className="mb-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">{key} <span className="text-xs text-slate-500">({have.size}/{max})</span></h3>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: max }, (_, i) => i + 1).map(n => {
                  const on = have.has(n);
                  return (
                    <div key={n} onClick={() => onToggle(card.name, key, n)}
                      title={`${key} #${n}${on ? " — possédée (cliquer pour retirer)" : " — manquante (cliquer pour ajouter)"}`}
                      className={`w-11 h-[4.2rem] rounded-lg cursor-pointer relative overflow-hidden select-none transition-transform hover:scale-105 ${on ? "" : "opacity-60"}`}
                      style={{
                        border: "2px solid", borderColor: on ? color : "#334155",
                        background: on ? "radial-gradient(circle at 50% 30%, rgba(99,102,241,0.35), rgba(15,23,42,0.9))" : "#1e293b",
                        filter: on ? "none" : "grayscale(1) brightness(0.6)",
                      }}>
                      <div className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${on ? "text-white" : "text-slate-500"}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${on ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"}`}>{card.name[0].toUpperCase()}</div>
                        <span className={`text-base font-extrabold leading-none ${on ? "text-cyan-300" : ""}`} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>#{n}</span>
                      </div>
                      {!on && <div className="absolute top-0 right-0.5 text-lg font-extrabold text-slate-300/70" style={{ textShadow: "0 1px 4px #000" }}>?</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Overlay>
  );
}

function ProgressMenu({ progress }) {
  const [open, setOpen] = useState(false);
  const input = useRef(null);
  const item = "w-full text-left px-3 py-2 rounded hover:bg-slate-700";
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} title="Menu progression"
        className="text-base leading-none px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700">&#9776;</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}></div>
          <div className="absolute right-0 mt-1 w-56 z-50 rounded-lg border border-slate-700 bg-slate-800 shadow-xl p-1 text-sm">
            <button className={item} onClick={() => { progress.exportFile(); setOpen(false); }}>Exporter la progression</button>
            <button className={item} onClick={() => { input.current.click(); setOpen(false); }}>Importer (fusion)</button>
            {progress.canLink && (
              <button className={item} onClick={() => { progress.linkFile(); setOpen(false); }}>
                {progress.linked ? "Fichier lié ✓ (changer)" : "Lier un fichier (auto-save)"}
              </button>
            )}
          </div>
        </>
      )}
      <input ref={input} type="file" accept=".js,.json,application/json,text/javascript" className="hidden"
        onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) progress.importFile(f); }} />
    </div>
  );
}

function Collection({ ix, progress }) {
  const { state, toggle } = progress;
  const [search, setSearch] = useState("");
  const dSearch = useDeferredValue(search);
  const [rarity, setRarity] = useState(null);
  const [serie, setSerie] = useState(null);
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [sortBy, setSortBy] = useState("alpha");           // alpha | owned-desc | owned-asc
  const [openName, setOpenName] = useState(null);          // popup Pokecardex
  const [picker, setPicker] = useState(null);              // popup choix de numéro
  const [limit, setLimit] = useState(PAGE);
  const [sentinel, setSentinel] = useState(null);

  const live = useRef(); live.current = { ix, state };

  // --- Échap + verrouillage du scroll quand une popup est ouverte
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setPicker(null); setOpenName(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.body.style.overflow = openName ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [openName]);

  // --- + / − sur une carte : un seul choix possible => direct, sinon on demande le numéro
  const onAdd = useCallback((name, key) => {
    const { ix, state } = live.current;
    const sec = ix.byName.get(name)?.sections.find(s => s.key === key);
    if (!sec) return;
    const have = (state[name] && state[name][key]) || [];
    const options = [];
    for (let i = 1; i <= sec.max; i++) if (!have.includes(i)) options.push(i);
    if (!options.length) return alert(`Toutes les variantes (1-${sec.max}) sont déjà cochées pour ${key}!`);
    if (options.length === 1) return toggle(name, key, options[0]);
    setPicker({ mode: "add", name, key, options });
  }, [toggle]);
  const onRemove = useCallback((name, key) => {
    const have = ((live.current.state[name] || {})[key] || []).slice().sort((a, b) => a - b);
    if (!have.length) return;
    if (have.length === 1) return toggle(name, key, have[0]);
    setPicker({ mode: "remove", name, key, options: have });
  }, [toggle]);

  // --- Compteurs
  const stats = useMemo(() => {
    const perCard = new Map(); const names = new Set();
    let total = 0, owned = 0;
    for (const c of ix.cards) {
      const st = state[c.name], n = ownedIn(st, c.sections);
      perCard.set(c.name, n); total += c.total; owned += n;
      if (hasAny(st)) names.add(c.name);
    }
    return { perCard, names, total, owned };
  }, [ix, state]);

  // La carte a-t-elle au moins un numéro dans une des sections de cette série ?
  const inSeries = useCallback((card, label) => {
    const st = state[card.name];
    return !!st && (ix.seriesSections.get(label) || []).some(k => st[k] && st[k].length);
  }, [state, ix]);

  // --- Filtres / tri
  const cards = useMemo(() => {
    const q = dSearch.trim().toLowerCase();
    const list = ix.cards.filter(c =>
      (!q || c.lower.includes(q)) &&
      (!rarity || c.rarities.includes(rarity)) &&
      (!serie || c.series.includes(serie)) &&
      (!onlyOwned || (serie ? inSeries(c, serie) : stats.names.has(c.name))));
    if (sortBy !== "alpha") {
      const dir = sortBy === "owned-desc" ? -1 : 1;
      list.sort((a, b) => (stats.perCard.get(a.name) - stats.perCard.get(b.name)) * dir || byName(a, b));
    }
    return list;
  }, [ix, dSearch, rarity, serie, onlyOwned, sortBy, stats, inSeries]);

  useEffect(() => { setLimit(PAGE); }, [dSearch, rarity, serie, onlyOwned, sortBy]);
  useEffect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver(e => { if (e[0].isIntersecting) setLimit(l => l + PAGE); }, { rootMargin: "800px" });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [sentinel]);

  // --- Pastilles : raretés (selon la série active) et séries (selon la rareté active)
  const rarityStats = useMemo(() => {
    const m = new Map();
    for (const c of ix.cards) {
      if (serie && !c.series.includes(serie)) continue;
      for (const r of c.rarities) {
        if (!ix.rarityChips.includes(r)) continue;
        const e = m.get(r) || { total: 0, owned: 0 };
        e.total++; if (stats.names.has(c.name)) e.owned++;
        m.set(r, e);
      }
    }
    return ix.rarityChips.filter(r => m.has(r)).map(r => ({ key: r, ...m.get(r) }));
  }, [ix, serie, stats]);
  const seriesStats = useMemo(() => {
    const m = new Map();
    for (const c of ix.cards) {
      if (rarity && !c.rarities.includes(rarity)) continue;
      for (const s of c.series) {
        const e = m.get(s) || { total: 0, owned: 0 };
        e.total++; if (inSeries(c, s)) e.owned++;
        m.set(s, e);
      }
    }
    return [...m.entries()].filter(([s]) => !ix.seriesHidden.has(s))
      .sort((a, b) => (ix.seriesOrder.get(a[0]) ?? 999) - (ix.seriesOrder.get(b[0]) ?? 999))
      .map(([key, v]) => ({ key, ...v }));
  }, [ix, rarity, inSeries]);

  const opened = openName && ix.byName.get(openName);
  const reset = () => { setSearch(""); setRarity(null); setSerie(null); setOnlyOwned(false); };
  const withVariants = cards.reduce((n, c) => n + (stats.names.has(c.name) ? 1 : 0), 0);
  const labelCls = "text-[10px] uppercase tracking-wide text-slate-500 w-14";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">VGacha — Collection Complète (Vue Cartes)</h1>
            <p className="text-sm text-slate-400">Clique sur un pseudo pour ouvrir sa collection, sur « + » / « − » pour ajouter ou retirer un numéro</p>
          </div>
          <div className="flex items-center gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une carte…"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm w-56" />
            <button onClick={reset} className="text-xs px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700">Reset</button>
            <ProgressMenu progress={progress} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={labelCls}>Rareté</span>
            <Pill all active={rarity === null} onClick={() => setRarity(null)}>Toutes</Pill>
            {rarityStats.map(({ key, owned, total }) => (
              <Pill key={key} active={rarity === key} stat={`${owned}/${total}`} title={`Afficher uniquement les cartes avec le tag ${key}`}
                onClick={() => setRarity(rarity === key ? null : key)}>{key}</Pill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={labelCls}>Série</span>
            <Pill all active={serie === null} onClick={() => setSerie(null)}>Toutes</Pill>
            {seriesStats.map(({ key, owned, total }) => (
              <Pill key={key} active={serie === key} stat={`${owned}/${total}`} title={`Afficher uniquement les cartes de la série ${key}`}
                onClick={() => setSerie(serie === key ? null : key)}>{key}</Pill>
            ))}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} title="Trier les cartes"
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 cursor-pointer">
              <option value="alpha">Tri : Alphabétique</option>
              <option value="owned-desc">Tri : Nombre de cartes ↓</option>
              <option value="owned-asc">Tri : Nombre de cartes ↑</option>
            </select>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} className="accent-indigo-500 cursor-pointer" />
              Masquer les cartes vierges
            </label>
          </div>
          {(rarity || serie) && (
            <p className="text-xs text-slate-400">
              Filtres actifs : {rarity && <span className="text-indigo-300 font-semibold">{rarity}</span>}
              {rarity && serie && " + "}
              {serie && <span className="text-indigo-300 font-semibold">{serie}</span>}
              {" "}(clique à nouveau sur un chip pour le retirer)
            </p>
          )}
        </div>

        <div className="mb-4 text-sm text-slate-400">
          <span className="text-emerald-400 font-semibold">{withVariants}</span> / {cards.length} cartes affichées avec variantes
          <span className="text-slate-500"> — {ix.cards.length} cartes au total dans la collection</span>
          <span className="text-slate-500"> — <span className="text-cyan-300 font-semibold">{stats.owned}</span> / {stats.total} numéros de cartes au total</span>
        </div>

        {cards.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucune carte trouvée{search ? <> pour « {search} »</> : ""}.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {cards.slice(0, limit).map(c => (
              <Card key={c.name} card={c} own={state[c.name] || EMPTY} onOpen={setOpenName} onAdd={onAdd} onRemove={onRemove} />
            ))}
            {cards.length > limit && <div ref={setSentinel} className="col-span-full py-4 text-center text-xs text-slate-500">Chargement…</div>}
          </div>
        )}

        <p className="text-xs text-slate-500 mt-4 leading-relaxed">
          <strong>Instructions :</strong><br />
          - Clique sur un pseudo pour ouvrir sa vue Pokecardex (possédées en couleur, manquantes en grisé)<br />
          - Sur chaque carte : « Basique 10/137 » = numéros obtenus / total possibles pour ce cadre<br />
          - « + » ajoute un numéro, « − » en retire un<br />
          - Ta progression est sauvegardée automatiquement dans le navigateur (menu ☰ pour l'exporter, l'importer ou la lier à un fichier)
        </p>
      </div>

      {opened && <Pokecardex card={opened} own={state[opened.name] || EMPTY} onToggle={toggle} onClose={() => setOpenName(null)} />}
      {picker && <NumberPicker key={picker.name + picker.key + picker.mode} picker={picker} onClose={() => setPicker(null)}
        onConfirm={(n) => { toggle(picker.name, picker.key, n); setPicker(null); }} />}
    </div>
  );
}

/* =====================================================================
   5. APPLICATION
   ===================================================================== */
function Root() {
  const ix = useMemo(() => buildIndex(window.VGACHA_DB), []);
  const ixRef = useRef(ix);
  const progress = useProgress(ixRef);
  return <Collection ix={ix} progress={progress} />;
}

createRoot(document.getElementById("root")).render(<Root />);
