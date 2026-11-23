
import { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, memo } from "react";
import { createRoot } from "react-dom/client";

/* =====================================================================
   1. DONNÉES : index dérivé de window.VGACHA_DB
   ===================================================================== */
// @@DATA-START
const LS_PROGRESS = "vgacha-tags-toutes-les-cartes"; // même clé que les anciennes versions
const LS_DRAFT = "vgacha-db-draft-v2";
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
   5. ADMIN
   ===================================================================== */
const ruleOk = (rule, series, rarities) =>
  series.includes(rule.series) && (!rule.rarities || rule.rarities.some(r => rarities.includes(r)));
const move = (arr, i, dir) => { const j = i + dir; if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]]; };
const input = "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm";
const btn = "px-4 py-2 rounded-lg text-sm";
const btnMain = `${btn} bg-indigo-600 hover:bg-indigo-500 font-semibold`;

// Génère le contenu complet d'un nouveau vgacha-db.js
function generateDb(db) {
  const q = JSON.stringify;
  const rows = (arr) => arr.map(x => "    " + q(x)).join(",\n");
  return `/* VGacha — base de données (v2), exportée depuis le panel admin. Voir la structure : rarities / sections / series / cards. */
window.VGACHA_DB = {
  rev: ${q(Date.now().toString(36))},
  rarities: [
${rows(db.rarities)}
  ],
  sections: [
${rows(db.sections)}
  ],
  series: [
${rows(db.series)}
  ],
  bonusCards: ${q(db.bonusCards || [])},
  cards: [
${rows(db.cards)}
  ],
};
`;
}

function PersonForm({ ix, person, onSave, onClose }) {
  const { db } = ix;
  const [text, setText] = useState(person ? person.name : "");
  const [ss, setSs] = useState(person ? person.series : []);
  const [rs, setRs] = useState(person ? person.rarities : ["Base"]);
  const [sc, setSc] = useState(person ? person.sections : []);
  const listed = db.sections.filter(s => !s.all);
  const names = text.split("\n").map(s => s.trim()).filter(Boolean);

  // Cocher une série / une rareté coche ou décoche automatiquement les sections concernées
  const apply = (ns, nr) => {
    setSc(prev => {
      let out = prev;
      for (const s of listed) {
        if (!s.rule) continue;
        const was = ruleOk(s.rule, ss, rs), now = ruleOk(s.rule, ns, nr);
        if (was !== now) out = now ? uniq([...out, s.key]) : out.filter(x => x !== s.key);
      }
      return out;
    });
    setSs(ns); setRs(nr);
  };
  const togS = (v) => apply(ss.includes(v) ? ss.filter(x => x !== v) : [...ss, v], rs);
  const togR = (v) => {
    const on = !rs.includes(v);
    const implied = (db.rarities.find(r => r.key === v) || {}).series;
    apply(on && implied && !ss.includes(implied) ? [...ss, implied] : ss, on ? [...rs, v] : rs.filter(x => x !== v));
  };
  const chip = (list, v, onClick) => <Pill key={v} active={list.includes(v)} onClick={onClick}>{v}</Pill>;

  return (
    <Overlay onClose={onClose} top>
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl my-8 p-5">
        <h2 className="text-lg font-bold mb-4">{person ? "Modifier " + person.name : "Ajouter des personnes"}</h2>
        <label className="block text-sm text-slate-300 mb-1">{person ? "Pseudo" : "Pseudos (un par ligne)"}</label>
        {person
          ? <input autoFocus value={text} onChange={e => setText(e.target.value)} className={input + " w-full !bg-slate-900 mb-1"} />
          : <textarea autoFocus rows={4} value={text} onChange={e => setText(e.target.value)} placeholder={"Pseudo1\nPseudo2"} className={input + " w-full !bg-slate-900 mb-1"} />}
        <p className="text-xs text-slate-500 mb-4">
          {person ? "Si le nouveau pseudo existe déjà, les deux fiches sont fusionnées (la progression aussi)."
                  : "Un pseudo déjà présent n'est pas dupliqué : les séries, raretés et sections cochées lui sont ajoutées."}
        </p>
        <p className="text-sm text-slate-300 mb-1">Raretés <span className="text-slate-500">(« Base » = la carte existe)</span></p>
        <div className="flex flex-wrap gap-2 mb-4">{db.rarities.map(r => chip(rs, r.key, () => togR(r.key)))}</div>
        <p className="text-sm text-slate-300 mb-1">Séries</p>
        <div className="flex flex-wrap gap-2 mb-5">{db.series.map(s => chip(ss, s.key, () => togS(s.key)))}</div>
        {listed.length > 0 && <>
          <p className="text-sm text-slate-300 mb-1">Sections affichées sur la carte <span className="text-slate-500">(cochées automatiquement selon la série et la rareté, modifiables)</span></p>
          <div className="flex flex-wrap gap-2 mb-5">
            {listed.map(s => chip(sc, s.key, () => setSc(sc.includes(s.key) ? sc.filter(x => x !== s.key) : [...sc, s.key])))}
          </div>
        </>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={`${btn} bg-slate-700 hover:bg-slate-600`}>Annuler</button>
          <button disabled={!names.length} onClick={() => onSave(person, names, ss, rs, sc)} className={`${btnMain} disabled:opacity-40`}>
            {person ? "Enregistrer" : `Ajouter ${names.length || ""}`}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function PeopleTab({ ix, edit, onRename, flash }) {
  const { db } = ix;
  const [q, setQ] = useState(""), [fs, setFs] = useState(""), [fr, setFr] = useState("");
  const [limit, setLimit] = useState(100);
  const [form, setForm] = useState(null);                 // null | "new" | carte
  useEffect(() => setLimit(100), [q, fs, fr]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ix.cards.filter(c => (!s || c.lower.includes(s)) && (!fs || c.series.includes(fs)) && (!fr || c.rarities.includes(fr)));
  }, [ix, q, fs, fr]);
  const rank = (arr) => arr.slice().sort((a, b) => db.rarities.findIndex(r => r.key === a) - db.rarities.findIndex(r => r.key === b));

  const save = (person, names, series, rarities, sections) => {
    const rs = rank(rarities), ss = series.length ? series : ["Base"];
    if (person) {
      const newName = ix.strip(names[0]);
      const dup = db.cards.find(c => c.name !== person.name && ix.norm(c.name) === ix.norm(newName));
      edit(d => {
        const p = d.cards.find(c => c.name === person.name);
        Object.assign(p, { name: newName, series: ss, rarities: rs, sections });
        const other = d.cards.find(c => c !== p && ix.norm(c.name) === ix.norm(newName));
        if (other) {
          p.series = uniq([...p.series, ...other.series]);
          p.sections = uniq([...p.sections, ...other.sections]);
          p.rarities = rank(uniq([...p.rarities, ...other.rarities]));
          d.cards = d.cards.filter(c => c !== other);
        }
        return d;
      });
      onRename(person.name, newName);
      if (dup) onRename(dup.name, newName);
    } else {
      edit(d => {
        names.forEach(n => {
          n = ix.strip(n);
          let p = d.cards.find(c => ix.norm(c.name) === ix.norm(n));
          if (!p) { p = { name: n, rarities: [], series: [], sections: [] }; d.cards.push(p); }
          p.series = uniq([...p.series, ...ss]);
          p.sections = uniq([...p.sections, ...sections]);
          p.rarities = rank(uniq([...p.rarities, ...rs]));
        });
        return d;
      });
    }
    setForm(null);
    flash(person ? "Fiche enregistrée." : `${names.length} personne(s) ajoutée(s) ou mise(s) à jour.`);
  };
  const del = (c) => {
    if (!confirm(`Supprimer « ${c.name} » de la base ?`)) return;
    edit(d => { d.cards = d.cards.filter(x => x.name !== c.name); return d; });
    flash("Personne supprimée.");
  };
  const tag = "px-1.5 py-0.5 text-[10px] rounded-full";

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un pseudo…" className={input + " w-56"} />
        <select value={fs} onChange={e => setFs(e.target.value)} className={input}>
          <option value="">Toutes les séries</option>
          {db.series.map(s => <option key={s.key}>{s.key}</option>)}
        </select>
        <select value={fr} onChange={e => setFr(e.target.value)} className={input}>
          <option value="">Toutes les raretés</option>
          {db.rarities.map(r => <option key={r.key}>{r.key}</option>)}
        </select>
        <button onClick={() => setForm("new")} className={`ml-auto ${btnMain}`}>Ajouter des personnes</button>
      </div>
      <p className="text-xs text-slate-500 mb-2">{list.length} résultat(s)</p>
      <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
        {list.slice(0, limit).map(c => (
          <div key={c.name} className="flex flex-wrap items-center gap-2 px-3 py-2 hover:bg-slate-900">
            <span className="font-semibold text-indigo-300 w-48 truncate" title={c.name}>{c.name}</span>
            <span className="flex flex-wrap gap-1 grow">
              {c.rarities.map(r => <span key={r} className={`${tag} bg-amber-900/50 text-amber-200`}>{r}</span>)}
              {c.displaySeries.map(s => <span key={s} className={`${tag} bg-slate-800 border border-slate-600 text-slate-300`}>{s}</span>)}
              {c.sections.filter(s => !db.sections.find(x => x.key === s.key).all).map(s => <span key={"s" + s.key} className={`${tag} bg-teal-900/50 text-teal-200`}>{s.key}</span>)}
            </span>
            <button onClick={() => setForm(db.cards.find(x => x.name === c.name))} className="text-xs px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600">Modifier</button>
            <button onClick={() => del(c)} className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-red-700">Supprimer</button>
          </div>
        ))}
        {list.length === 0 && <p className="p-4 text-sm text-slate-500">Aucun résultat. Ajoute cette personne avec le bouton ci-dessus.</p>}
      </div>
      {list.length > limit && <button onClick={() => setLimit(l => l + 200)} className={`mt-3 ${btn} bg-slate-800 hover:bg-slate-700`}>Afficher plus ({list.length - limit} restants)</button>}
      {form && <PersonForm key={form === "new" ? "new" : form.name} ix={ix} person={form === "new" ? null : form} onSave={save} onClose={() => setForm(null)} />}
    </>
  );
}

function StructureTab({ ix, edit }) {
  const { db } = ix;
  const [newSerie, setNewSerie] = useState("");
  const [newSec, setNewSec] = useState({ name: "", count: 1 });
  const [openSerie, setOpenSerie] = useState(null);
  const small = "px-2 rounded bg-slate-800 hover:bg-slate-700";

  const addSerie = () => {
    const n = newSerie.trim(); if (!n) return;
    if (db.series.some(s => s.key === n)) return alert("Cette série existe déjà.");
    edit(d => { d.series.push({ key: n, sections: d.sections.filter(s => s.key === n).map(s => s.key) }); return d; });
    setNewSerie("");
  };
  const renameSerie = (s) => {
    const n = (prompt("Nouveau nom de la série :", s) || "").trim();
    if (!n || n === s) return;
    if (db.series.some(x => x.key === n)) return alert("Cette série existe déjà.");
    edit(d => {
      d.series.find(x => x.key === s).key = n;
      d.cards.forEach(c => { c.series = c.series.map(x => x === s ? n : x); });
      d.sections.forEach(x => { if (x.rule && x.rule.series === s) x.rule.series = n; });
      d.rarities.forEach(r => { if (r.series === s) r.series = n; });
      return d;
    });
  };
  const delSerie = (s) => {
    if (!confirm(`Supprimer la série « ${s} » ? Les personnes restent dans la base.`)) return;
    edit(d => { d.series = d.series.filter(x => x.key !== s); d.cards.forEach(c => { c.series = c.series.filter(x => x !== s); }); return d; });
  };
  const toggleSerieSection = (s, key) => edit(d => {
    const e = d.series.find(x => x.key === s);
    e.sections = e.sections.includes(key) ? e.sections.filter(x => x !== key) : [...e.sections, key];
    return d;
  });
  const setSec = (key, patch) => edit(d => { Object.assign(d.sections.find(s => s.key === key), patch); return d; });
  const addSection = () => {
    const n = newSec.name.trim(); if (!n) return;
    if (db.sections.some(s => s.key === n)) return alert("Cette section existe déjà.");
    edit(d => {
      const s = { key: n, count: Math.max(1, +newSec.count || 1), color: "#6366f1" };
      if (d.series.some(x => x.key === n)) s.rule = { series: n };
      d.sections.push(s);
      const ser = d.series.find(x => x.key === n); if (ser && !ser.sections.includes(n)) ser.sections.push(n);
      return d;
    });
    setNewSec({ name: "", count: 1 });
  };
  const delSection = (key) => {
    if (!confirm(`Supprimer la section « ${key} » ? Elle disparaît de toutes les cartes (la progression cochée reste en mémoire).`)) return;
    edit(d => {
      d.sections = d.sections.filter(s => s.key !== key);
      d.cards.forEach(c => { c.sections = c.sections.filter(x => x !== key); });
      d.series.forEach(s => { s.sections = s.sections.filter(x => x !== key); });
      return d;
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h2 className="font-semibold mb-2">Séries</h2>
        <p className="text-xs text-slate-500 mb-3">L'ordre ici est l'ordre des boutons sur le site. « Sections » = cadres comptés dans le « possédées / total » du bouton.</p>
        <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 mb-3">
          {db.series.map((s, i) => (
            <div key={s.key} className="px-3 py-2 text-sm">
              <div className="flex items-center gap-1">
                <span className="grow truncate">{s.key} <span className="text-slate-500 text-xs">({db.cards.filter(c => c.series.includes(s.key)).length})</span></span>
                <button onClick={() => edit(d => (move(d.series, i, -1), d))} title="Monter" className={small}>↑</button>
                <button onClick={() => edit(d => (move(d.series, i, 1), d))} title="Descendre" className={small}>↓</button>
                <button onClick={() => setOpenSerie(openSerie === s.key ? null : s.key)} className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Sections</button>
                <button onClick={() => renameSerie(s.key)} className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Renommer</button>
                <button onClick={() => delSerie(s.key)} className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-red-700">Supprimer</button>
              </div>
              {openSerie === s.key && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {db.sections.map(x => <Pill key={x.key} active={(s.sections || []).includes(x.key)} onClick={() => toggleSerieSection(s.key, x.key)}>{x.key}</Pill>)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newSerie} onChange={e => setNewSerie(e.target.value)} onKeyDown={e => e.key === "Enter" && addSerie()} placeholder="Nouvelle série" className={input + " grow"} />
          <button onClick={addSerie} className={btnMain}>Créer</button>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Cadres / sections</h2>
        <p className="text-xs text-slate-500 mb-3">Nombre de numéros, couleur et portée. « Toutes » = affiché sur toutes les cartes ; sinon seulement sur celles qui l'ont cochée.</p>
        <div className="space-y-2 mb-3">
          {db.sections.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 text-sm">
              <input type="color" value={s.color} onChange={e => setSec(s.key, { color: e.target.value })} className="w-7 h-7 bg-transparent cursor-pointer" />
              <span className="grow truncate">{s.key}</span>
              <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" checked={!!s.all} onChange={e => setSec(s.key, { all: e.target.checked || undefined })} className="accent-indigo-500" />Toutes
              </label>
              <input type="number" min="1" value={s.count} onChange={e => setSec(s.key, { count: Math.max(1, parseInt(e.target.value) || 1) })} className={input + " w-20"} />
              <button onClick={() => edit(d => (move(d.sections, i, -1), d))} title="Monter" className={small}>↑</button>
              <button onClick={() => edit(d => (move(d.sections, i, 1), d))} title="Descendre" className={small}>↓</button>
              <button onClick={() => delSection(s.key)} title="Supprimer" className="px-2 rounded bg-slate-800 hover:bg-red-700">&times;</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newSec.name} onChange={e => setNewSec({ ...newSec, name: e.target.value })} placeholder="Nouvelle section" className={input + " grow"} />
          <input type="number" min="1" value={newSec.count} onChange={e => setNewSec({ ...newSec, count: e.target.value })} className={input + " w-20"} title="Nombre de numéros" />
          <button onClick={addSection} className={btnMain}>Créer</button>
        </div>
      </div>
    </div>
  );
}

function ExportTab({ db, markExported, resetDraft, flash }) {
  const out = useMemo(() => generateDb(db), [db]);
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([out], { type: "text/javascript" }));
    a.download = "vgacha-db.js"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); markExported();
  };
  const saveDirect = async () => {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: "vgacha-db.js", types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }] });
      const w = await h.createWritable(); await w.write(out); await w.close();
      markExported(); flash("vgacha-db.js enregistré.");
    } catch (e) {}
  };
  return (
    <div className="max-w-xl">
      <p className="text-sm text-slate-300 mb-2">Génère un nouveau <code className="text-indigo-300">vgacha-db.js</code> à remplacer dans le dossier du site. Ta progression de collection n'est pas touchée.</p>
      <p className="text-xs text-slate-500 mb-4">Tes modifications s'affichent déjà sur l'onglet Collection de ce navigateur ; l'export sert à les rendre définitives (et à les voir ailleurs).</p>
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={download} className={btnMain}>Télécharger vgacha-db.js</button>
        {typeof window.showSaveFilePicker === "function" && <button onClick={saveDirect} className={`${btn} bg-slate-700 hover:bg-slate-600`}>Enregistrer dans le fichier (Chrome/Edge)</button>}
        <button onClick={() => navigator.clipboard.writeText(out).then(() => flash("Contenu copié."), () => flash("Copie impossible : utilise le téléchargement."))} className={`${btn} bg-slate-800 hover:bg-slate-700`}>Copier le contenu</button>
      </div>
      <button onClick={() => { if (confirm("Abandonner toutes les modifications et recharger depuis vgacha-db.js ?")) resetDraft(); }}
        className={`${btn} bg-slate-800 hover:bg-red-800 border border-slate-700`}>Abandonner les modifications</button>
    </div>
  );
}

function AdminPanel({ ix, dirty, edit, markExported, resetDraft, onRename }) {
  const [tab, setTab] = useState("people");
  const [msg, setMsg] = useState("");
  const flash = useCallback((t) => { setMsg(t); setTimeout(() => setMsg(""), 3500); }, []);
  const tabs = [["people", "Personnes"], ["structure", "Séries et cadres"], ["export", "Exporter"]];
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">VGacha — Admin</h1>
            <p className="text-sm text-slate-400">{ix.cards.length} personnes · {ix.db.series.length} séries · {ix.db.sections.length} cadres</p>
          </div>
          {dirty && <button onClick={() => setTab("export")} className="text-xs px-3 py-1.5 rounded-lg bg-amber-900/60 border border-amber-700 text-amber-200">Modifications non exportées</button>}
        </div>
        <div className="flex gap-1 mb-4 border-b border-slate-800">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === k ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>{l}</button>
          ))}
        </div>
        {msg && <div className="mb-3 text-sm rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-200 px-3 py-2">{msg}</div>}
        {tab === "people" && <PeopleTab ix={ix} edit={edit} onRename={onRename} flash={flash} />}
        {tab === "structure" && <StructureTab ix={ix} edit={edit} />}
        {tab === "export" && <ExportTab db={ix.db} markExported={markExported} resetDraft={resetDraft} flash={flash} />}
      </div>
    </div>
  );
}

/* =====================================================================
   6. APPLICATION : navigation Collection <-> Admin
   ===================================================================== */
// Brouillon admin : gardé dans le navigateur tant que vgacha-db.js n'a pas changé (rev identique)
function loadDraft() {
  const base = window.VGACHA_DB;
  try {
    const d = JSON.parse(localStorage.getItem(LS_DRAFT));
    if (d && d.baseRev === base.rev && d.db && Array.isArray(d.db.cards)) { buildIndex(d.db); return { db: d.db, dirty: !!d.dirty, touched: true }; }
  } catch (e) {}
  return { db: base, dirty: false, touched: false };
}

function Root() {
  const [draft, setDraft] = useState(loadDraft);
  const ix = useMemo(() => buildIndex(draft.db), [draft.db]);
  const ixRef = useRef(ix); ixRef.current = ix;
  const progress = useProgress(ixRef);

  const edit = useCallback((fn) => setDraft(s => ({ db: fn(structuredClone(s.db)), dirty: true, touched: true })), []);
  const markExported = useCallback(() => setDraft(s => ({ ...s, dirty: false })), []);
  const resetDraft = useCallback(() => {
    try { localStorage.removeItem(LS_DRAFT); } catch (e) {}
    setDraft({ db: window.VGACHA_DB, dirty: false, touched: false });
  }, []);

  useEffect(() => {
    if (!draft.touched) return;
    try { localStorage.setItem(LS_DRAFT, JSON.stringify({ baseRev: window.VGACHA_DB.rev, db: draft.db, dirty: draft.dirty })); } catch (e) {}
  }, [draft]);
  useEffect(() => {
    const h = (e) => { if (draft.dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [draft.dirty]);

  const [view, setView] = useState(location.hash === "#admin" ? "admin" : "collection");
  const go = (v) => {
    setView(v);
    history.replaceState(null, "", v === "admin" ? "#admin" : location.pathname + location.search);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <nav className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center gap-1 px-4">
          <span className="font-bold text-white mr-4">VGacha</span>
          {[["collection", "Collection"], ["admin", "Admin"]].map(([k, l]) => (
            <button key={k} onClick={() => go(k)}
              className={`px-4 py-3 text-sm border-b-2 -mb-px transition ${view === k ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
              {l}{k === "admin" && draft.dirty && <span className="ml-1 text-amber-400">●</span>}
            </button>
          ))}
        </div>
      </nav>
      {/* Les deux vues restent montées (masquées en CSS) : filtres et saisies ne sont pas perdus */}
      <div style={{ display: view === "collection" ? "block" : "none" }}><Collection ix={ix} progress={progress} /></div>
      <div style={{ display: view === "admin" ? "block" : "none" }}>
        <AdminPanel ix={ix} dirty={draft.dirty} edit={edit} markExported={markExported} resetDraft={resetDraft} onRename={progress.rename} />
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
  