(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // react-globals:react
  var require_react = __commonJS({
    "react-globals:react"(exports, module) {
      module.exports = window.React;
    }
  });

  // react-globals:react-dom/client
  var require_client = __commonJS({
    "react-globals:react-dom/client"(exports, module) {
      module.exports = window.ReactDOMClient;
    }
  });

  // src/app.jsx
  var import_react = __toESM(require_react());
  var import_client = __toESM(require_client());
  var LS_PROGRESS = "vgacha-tags-toutes-les-cartes";
  var LS_DRAFT = "vgacha-db-draft-v2";
  var PAGE = 60;
  var EMPTY = {};
  var BLOCKED = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  var isNum = (n) => Number.isInteger(n) && n > 0 && n < 1e4;
  var SECTION_RENAMES = { "R:ZEVENT": "Zevent", "R:Fullart": "Fullart" };
  var byName = (a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  var uniq = (a) => [...new Set(a)];
  function buildIndex(db) {
    const prefixRe = new RegExp("^(" + [...db.rarities.map((r) => r.key), "SPOOKY"].sort((a, b) => b.length - a.length).join("|") + ")-", "i");
    const strip = (n) => n.replace(prefixRe, "").trim();
    const norm = (n) => strip(n).toLowerCase().replace(/_/g, " ");
    const rarityBy = new Map(db.rarities.map((r) => [r.key, r]));
    const bonus = new Set((db.bonusCards || []).map(norm));
    const cards = db.cards.map((c) => {
      const key = norm(c.name);
      const series = [...c.series];
      for (const r of c.rarities) {
        const s = rarityBy.get(r) && rarityBy.get(r).series;
        if (s && !series.includes(s)) series.push(s);
      }
      if (!series.length) series.push("Base");
      const mine = new Set(c.sections || []);
      const sections = db.sections.filter((s) => s.all || mine.has(s.key)).map((s) => ({ key: s.key, color: s.color, max: s.count + (s.bonus && bonus.has(key) ? 1 : 0) }));
      return {
        name: c.name,
        key,
        lower: c.name.toLowerCase(),
        rarities: c.rarities,
        series,
        displaySeries: series.filter((s) => s !== "Base"),
        sections,
        total: sections.reduce((n, s) => n + s.max, 0)
      };
    }).sort(byName);
    return {
      db,
      cards,
      strip,
      norm,
      byKey: new Map(cards.map((c) => [c.key, c])),
      byName: new Map(cards.map((c) => [c.name, c])),
      rarityChips: db.rarities.filter((r) => r.chip !== false).map((r) => r.key),
      seriesOrder: new Map(db.series.map((s, i) => [s.key, i])),
      seriesHidden: new Set(db.series.filter((s) => s.hidden).map((s) => s.key)),
      seriesSections: new Map(db.series.map((s) => [s.key, s.sections || []])),
      colors: new Map(db.sections.map((s) => [s.key, s.color]))
    };
  }
  var ownedIn = (st, sections) => {
    let n = 0;
    if (st) for (const s of sections) {
      const v = st[s.key];
      if (v) n += v.length;
    }
    return n;
  };
  var hasAny = (st) => {
    if (st) {
      for (const k in st) if (Array.isArray(st[k]) && st[k].length) return true;
    }
    return false;
  };
  var mergeStates = (a, b) => {
    const out = { ...a };
    for (const [card, secs] of Object.entries(b || {})) {
      if (BLOCKED.has(card)) continue;
      const cur = { ...out[card] || {} };
      for (const [sec, nums] of Object.entries(secs || {})) {
        if (BLOCKED.has(sec) || !Array.isArray(nums) || !nums.length) continue;
        cur[sec] = uniq([...cur[sec] || [], ...nums]).sort((x, y) => x - y);
      }
      if (Object.keys(cur).length) out[card] = cur;
    }
    return out;
  };
  var parseProgress = (text) => JSON.parse(text.replace(/^\s*window\.VGACHA_PROGRESSION\s*=\s*/, "").replace(/;\s*$/, ""));
  var toProgressFile = (s) => "window.VGACHA_PROGRESSION = " + JSON.stringify(s, null, 1) + ";\n";
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
        cur[dest] = uniq([...cur[dest] || [], ...nums]).sort((a, b) => a - b);
      }
    }
    return out;
  }
  function loadProgress(ix) {
    try {
      const raw = localStorage.getItem(LS_PROGRESS);
      if (raw) {
        const s = migrate(JSON.parse(raw), ix);
        if (Object.keys(s).length) return s;
      }
    } catch (e) {
    }
    try {
      if (window.VGACHA_PROGRESSION) return migrate(window.VGACHA_PROGRESSION, ix);
    } catch (e) {
    }
    return {};
  }
  var saveProgress = (s) => {
    try {
      localStorage.setItem(LS_PROGRESS, JSON.stringify(s));
    } catch (e) {
    }
  };
  function useProgress(ixRef) {
    const [state, setState] = (0, import_react.useState)(() => loadProgress(ixRef.current));
    const [linked, setLinked] = (0, import_react.useState)(false);
    const latest = (0, import_react.useRef)(state);
    latest.current = state;
    const handle = (0, import_react.useRef)(null);
    (0, import_react.useEffect)(() => {
      const t = setTimeout(async () => {
        saveProgress(state);
        if (!handle.current) return;
        try {
          const w = await handle.current.createWritable();
          await w.write(toProgressFile(state));
          await w.close();
        } catch (e) {
        }
      }, 300);
      return () => clearTimeout(t);
    }, [state]);
    (0, import_react.useEffect)(() => {
      const flush = () => saveProgress(latest.current);
      window.addEventListener("pagehide", flush);
      return () => window.removeEventListener("pagehide", flush);
    }, []);
    const toggle = (0, import_react.useCallback)((card, section, n) => setState((prev) => {
      const cur = prev[card] || {};
      const list = cur[section] || [];
      const next = list.includes(n) ? list.filter((x) => x !== n) : [...list, n].sort((a, b) => a - b);
      const c = { ...cur };
      if (next.length) c[section] = next;
      else delete c[section];
      const out = { ...prev };
      if (Object.keys(c).length) out[card] = c;
      else delete out[card];
      return out;
    }), []);
    const rename = (0, import_react.useCallback)((from, to) => setState((prev) => {
      if (from === to || !prev[from]) return prev;
      const { [from]: moved, ...rest } = prev;
      return mergeStates(rest, { [to]: moved });
    }), []);
    const exportFile = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([toProgressFile(state)], { type: "text/javascript" }));
      a.download = "vgacha-progression.js";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
    };
    const importFile = async (file) => {
      try {
        const imported = migrate(parseProgress(await file.text()), ixRef.current);
        setState((p) => mergeStates(p, imported));
      } catch (e) {
        alert("Fichier de progression invalide.");
      }
    };
    const linkFile = async () => {
      try {
        handle.current = await window.showSaveFilePicker({
          suggestedName: "vgacha-progression.js",
          types: [{ description: "Progression VGacha", accept: { "text/javascript": [".js"] } }]
        });
        setLinked(true);
        const w = await handle.current.createWritable();
        await w.write(toProgressFile(latest.current));
        await w.close();
      } catch (e) {
      }
    };
    return { state, toggle, rename, exportFile, importFile, linkFile, linked, canLink: typeof window.showSaveFilePicker === "function" };
  }
  var Pill = ({ active, all, onClick, title, children, stat }) => /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick,
      title,
      className: `px-2.5 py-1 rounded-full text-xs font-medium border transition ${active ? all ? "bg-slate-100 border-slate-100 text-slate-900" : "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"}`
    },
    children,
    stat && /* @__PURE__ */ React.createElement("span", { className: `ml-1 text-[10px] font-bold ${active ? "text-white/80" : "text-slate-500"}` }, stat)
  );
  var Bar = ({ pct, color, h = "h-1.5" }) => /* @__PURE__ */ React.createElement("div", { className: `${h} rounded-full bg-slate-800 overflow-hidden` }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "h-full rounded-full transition-all",
      style: { width: Math.min(100, pct) + "%", background: color || "linear-gradient(to right,#6366f1,#22d3ee)" }
    }
  ));
  var Overlay = ({ onClose, children, top }) => /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center overflow-y-auto p-4 ${top ? "items-start" : "items-center"}`,
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      }
    },
    children
  );
  var Card = (0, import_react.memo)(function Card2({ card, own, onOpen, onAdd, onRemove }) {
    const owned = ownedIn(own, card.sections);
    const pct = card.total ? Math.round(owned / card.total * 100) : 0;
    const complete = card.total > 0 && owned === card.total;
    return /* @__PURE__ */ React.createElement("div", { className: `rounded-xl border p-4 flex flex-col transition ${complete ? "border-emerald-500/60 bg-emerald-950/20" : hasAny(own) ? "border-slate-700 bg-slate-900" : "border-slate-800 bg-slate-900/60"}` }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => onOpen(card.name),
        className: "font-bold text-indigo-300 hover:text-indigo-100 hover:underline text-left mb-1"
      },
      card.name
    ), card.displaySeries.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1 mb-2" }, card.displaySeries.map((s) => /* @__PURE__ */ React.createElement("span", { key: s, className: "px-1.5 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 border border-slate-600" }, s))), /* @__PURE__ */ React.createElement("div", { className: "mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs mb-1" }, /* @__PURE__ */ React.createElement("span", { className: complete ? "text-emerald-400 font-semibold" : "text-slate-400" }, owned, "/", card.total, " (", pct, "%)"), complete && /* @__PURE__ */ React.createElement("span", { className: "text-emerald-400 font-semibold" }, "Compl\xE8te !")), /* @__PURE__ */ React.createElement(Bar, { pct })), /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, card.sections.map(({ key, max, color }) => {
      const count = own[key] ? own[key].length : 0;
      return /* @__PURE__ */ React.createElement("div", { key, className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "w-2 h-2 rounded-full shrink-0", style: { background: color } }), /* @__PURE__ */ React.createElement("span", { className: "text-xs w-28 shrink-0 flex items-baseline gap-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-300 font-medium" }, key), /* @__PURE__ */ React.createElement("span", { className: count === max ? "text-emerald-400 font-bold" : "text-slate-400" }, count, "/", max)), /* @__PURE__ */ React.createElement("span", { className: "grow", style: { minWidth: 24 } }, /* @__PURE__ */ React.createElement(Bar, { pct: count / max * 100, color, h: "h-1" })), /* @__PURE__ */ React.createElement("span", { className: "flex gap-1 justify-end" }, count > 0 && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => onRemove(card.name, key),
          title: "Retirer un num\xE9ro",
          className: "px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-red-700 rounded-full"
        },
        "\u2212"
      ), count < max && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => onAdd(card.name, key),
          title: "Ajouter un num\xE9ro",
          className: "px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded-full"
        },
        "+"
      )));
    })));
  });
  function NumberPicker({ picker, onConfirm, onClose }) {
    const [num, setNum] = (0, import_react.useState)(picker.options[0]);
    const adding = picker.mode === "add";
    return /* @__PURE__ */ React.createElement(Overlay, { onClose }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 rounded-lg p-4 w-64 relative" }, /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: "absolute top-2 right-2 text-slate-400 hover:text-white text-xl" }, "\xD7"), /* @__PURE__ */ React.createElement("h3", { className: "text-white mb-2" }, adding ? "Ajouter" : "Retirer", " ", picker.key), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400 mb-2" }, "Pour : ", picker.name), /* @__PURE__ */ React.createElement("select", { value: num, onChange: (e) => setNum(+e.target.value), className: "w-full bg-slate-700 rounded p-2 mb-3" }, picker.options.map((n) => /* @__PURE__ */ React.createElement("option", { key: n, value: n }, n))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: () => onConfirm(num), className: `${adding ? "bg-indigo-600" : "bg-red-600"} text-white px-3 py-1 rounded` }, adding ? "Ajouter" : "Retirer"), /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: "bg-slate-700 text-white px-3 py-1 rounded" }, "Annuler"))));
  }
  function Pokecardex({ card, own, onToggle, onClose }) {
    const owned = ownedIn(own, card.sections);
    const pct = card.total ? Math.round(owned / card.total * 100) : 0;
    return /* @__PURE__ */ React.createElement(Overlay, { onClose, top: true }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl my-8 p-5 relative shadow-2xl" }, /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: "absolute top-3 right-3 text-slate-400 hover:text-white text-2xl leading-none" }, "\xD7"), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold text-white mb-2" }, "Collection de ", /* @__PURE__ */ React.createElement("span", { className: "text-indigo-400" }, card.name)), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1 mb-2" }, card.series.map((s) => /* @__PURE__ */ React.createElement("span", { key: s, className: "px-2 py-0.5 text-[11px] rounded-full bg-slate-800 text-slate-300 border border-slate-600" }, s))), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400 mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-emerald-400 font-semibold" }, owned), " / ", card.total, " cartes poss\xE9d\xE9es (", pct, "%)"), /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(Bar, { pct, h: "h-2" })), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mb-3" }, "Clique sur une carte pour l'ajouter / la retirer de ta collection."), card.sections.map(({ key, max, color }) => {
      const have = new Set(own[key] || []);
      return /* @__PURE__ */ React.createElement("div", { key, className: "mb-4" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-slate-300 mb-2" }, key, " ", /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-500" }, "(", have.size, "/", max, ")")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const on = have.has(n);
        return /* @__PURE__ */ React.createElement(
          "div",
          {
            key: n,
            onClick: () => onToggle(card.name, key, n),
            title: `${key} #${n}${on ? " \u2014 poss\xE9d\xE9e (cliquer pour retirer)" : " \u2014 manquante (cliquer pour ajouter)"}`,
            className: `w-11 h-[4.2rem] rounded-lg cursor-pointer relative overflow-hidden select-none transition-transform hover:scale-105 ${on ? "" : "opacity-60"}`,
            style: {
              border: "2px solid",
              borderColor: on ? color : "#334155",
              background: on ? "radial-gradient(circle at 50% 30%, rgba(99,102,241,0.35), rgba(15,23,42,0.9))" : "#1e293b",
              filter: on ? "none" : "grayscale(1) brightness(0.6)"
            }
          },
          /* @__PURE__ */ React.createElement("div", { className: `w-full h-full flex flex-col items-center justify-center gap-0.5 ${on ? "text-white" : "text-slate-500"}` }, /* @__PURE__ */ React.createElement("div", { className: `w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${on ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"}` }, card.name[0].toUpperCase()), /* @__PURE__ */ React.createElement("span", { className: `text-base font-extrabold leading-none ${on ? "text-cyan-300" : ""}`, style: { textShadow: "0 1px 3px rgba(0,0,0,0.8)" } }, "#", n)),
          !on && /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 right-0.5 text-lg font-extrabold text-slate-300/70", style: { textShadow: "0 1px 4px #000" } }, "?")
        );
      })));
    })));
  }
  function ProgressMenu({ progress }) {
    const [open, setOpen] = (0, import_react.useState)(false);
    const input2 = (0, import_react.useRef)(null);
    const item = "w-full text-left px-3 py-2 rounded hover:bg-slate-700";
    return /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setOpen((o) => !o),
        title: "Menu progression",
        className: "text-base leading-none px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
      },
      "\u2630"
    ), open && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-40", onClick: () => setOpen(false) }), /* @__PURE__ */ React.createElement("div", { className: "absolute right-0 mt-1 w-56 z-50 rounded-lg border border-slate-700 bg-slate-800 shadow-xl p-1 text-sm" }, /* @__PURE__ */ React.createElement("button", { className: item, onClick: () => {
      progress.exportFile();
      setOpen(false);
    } }, "Exporter la progression"), /* @__PURE__ */ React.createElement("button", { className: item, onClick: () => {
      input2.current.click();
      setOpen(false);
    } }, "Importer (fusion)"), progress.canLink && /* @__PURE__ */ React.createElement("button", { className: item, onClick: () => {
      progress.linkFile();
      setOpen(false);
    } }, progress.linked ? "Fichier li\xE9 \u2713 (changer)" : "Lier un fichier (auto-save)"))), /* @__PURE__ */ React.createElement(
      "input",
      {
        ref: input2,
        type: "file",
        accept: ".js,.json,application/json,text/javascript",
        className: "hidden",
        onChange: (e) => {
          const f = e.target.files[0];
          e.target.value = "";
          if (f) progress.importFile(f);
        }
      }
    ));
  }
  function Collection({ ix, progress }) {
    const { state, toggle } = progress;
    const [search, setSearch] = (0, import_react.useState)("");
    const dSearch = (0, import_react.useDeferredValue)(search);
    const [rarity, setRarity] = (0, import_react.useState)(null);
    const [serie, setSerie] = (0, import_react.useState)(null);
    const [ownFilter, setOwnFilter] = (0, import_react.useState)(null);
    const [sortBy, setSortBy] = (0, import_react.useState)("alpha");
    const [openName, setOpenName] = (0, import_react.useState)(null);
    const [picker, setPicker] = (0, import_react.useState)(null);
    const [limit, setLimit] = (0, import_react.useState)(PAGE);
    const [sentinel, setSentinel] = (0, import_react.useState)(null);
    const live = (0, import_react.useRef)();
    live.current = { ix, state };
    (0, import_react.useEffect)(() => {
      const onKey = (e) => {
        if (e.key === "Escape") {
          setPicker(null);
          setOpenName(null);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);
    (0, import_react.useEffect)(() => {
      document.body.style.overflow = openName ? "hidden" : "";
      return () => {
        document.body.style.overflow = "";
      };
    }, [openName]);
    const onAdd = (0, import_react.useCallback)((name, key) => {
      const { ix: ix2, state: state2 } = live.current;
      const sec = ix2.byName.get(name)?.sections.find((s) => s.key === key);
      if (!sec) return;
      const have = state2[name] && state2[name][key] || [];
      const options = [];
      for (let i = 1; i <= sec.max; i++) if (!have.includes(i)) options.push(i);
      if (!options.length) return alert(`Toutes les variantes (1-${sec.max}) sont d\xE9j\xE0 coch\xE9es pour ${key}!`);
      if (options.length === 1) return toggle(name, key, options[0]);
      setPicker({ mode: "add", name, key, options });
    }, [toggle]);
    const onRemove = (0, import_react.useCallback)((name, key) => {
      const have = ((live.current.state[name] || {})[key] || []).slice().sort((a, b) => a - b);
      if (!have.length) return;
      if (have.length === 1) return toggle(name, key, have[0]);
      setPicker({ mode: "remove", name, key, options: have });
    }, [toggle]);
    const stats = (0, import_react.useMemo)(() => {
      const perCard = /* @__PURE__ */ new Map();
      const names = /* @__PURE__ */ new Set();
      let total = 0, owned = 0;
      for (const c of ix.cards) {
        const st = state[c.name], n = ownedIn(st, c.sections);
        perCard.set(c.name, n);
        total += c.total;
        owned += n;
        if (hasAny(st)) names.add(c.name);
      }
      return { perCard, names, total, owned };
    }, [ix, state]);
    const inSeries = (0, import_react.useCallback)((card, label) => {
      const st = state[card.name];
      return !!st && (ix.seriesSections.get(label) || []).some((k) => st[k] && st[k].length);
    }, [state, ix]);
    const cards = (0, import_react.useMemo)(() => {
      const q = dSearch.trim().toLowerCase();
      const list = ix.cards.filter((c) => (!q || c.lower.includes(q)) && (!rarity || c.rarities.includes(rarity)) && (!serie || c.series.includes(serie)) && (!ownFilter || ownFilter === "owned" === (serie ? inSeries(c, serie) : stats.names.has(c.name))));
      if (sortBy !== "alpha") {
        const dir = sortBy === "owned-desc" ? -1 : 1;
        list.sort((a, b) => (stats.perCard.get(a.name) - stats.perCard.get(b.name)) * dir || byName(a, b));
      }
      return list;
    }, [ix, dSearch, rarity, serie, ownFilter, sortBy, stats, inSeries]);
    (0, import_react.useEffect)(() => {
      setLimit(PAGE);
    }, [dSearch, rarity, serie, ownFilter, sortBy]);
    (0, import_react.useEffect)(() => {
      if (!sentinel) return;
      const io = new IntersectionObserver((e) => {
        if (e[0].isIntersecting) setLimit((l) => l + PAGE);
      }, { rootMargin: "800px" });
      io.observe(sentinel);
      return () => io.disconnect();
    }, [sentinel]);
    const rarityStats = (0, import_react.useMemo)(() => {
      const m = /* @__PURE__ */ new Map();
      for (const c of ix.cards) {
        if (serie && !c.series.includes(serie)) continue;
        for (const r of c.rarities) {
          if (!ix.rarityChips.includes(r)) continue;
          const e = m.get(r) || { total: 0, owned: 0 };
          e.total++;
          if (stats.names.has(c.name)) e.owned++;
          m.set(r, e);
        }
      }
      return ix.rarityChips.filter((r) => m.has(r)).map((r) => ({ key: r, ...m.get(r) }));
    }, [ix, serie, stats]);
    const seriesStats = (0, import_react.useMemo)(() => {
      const m = /* @__PURE__ */ new Map();
      for (const c of ix.cards) {
        if (rarity && !c.rarities.includes(rarity)) continue;
        for (const s of c.series) {
          const e = m.get(s) || { total: 0, owned: 0 };
          e.total++;
          if (inSeries(c, s)) e.owned++;
          m.set(s, e);
        }
      }
      return [...m.entries()].filter(([s]) => !ix.seriesHidden.has(s)).sort((a, b) => (ix.seriesOrder.get(a[0]) ?? 999) - (ix.seriesOrder.get(b[0]) ?? 999)).map(([key, v]) => ({ key, ...v }));
    }, [ix, rarity, inSeries]);
    const opened = openName && ix.byName.get(openName);
    const reset = () => {
      setSearch("");
      setRarity(null);
      setSerie(null);
      setOwnFilter(null);
    };
    const withVariants = cards.reduce((n, c) => n + (stats.names.has(c.name) ? 1 : 0), 0);
    const labelCls = "text-[10px] uppercase tracking-wide text-slate-500 w-14";
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "text-2xl font-bold text-white" }, "VGacha \u2014 Collection Compl\xE8te (Vue Cartes)"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, "Clique sur un pseudo pour ouvrir sa collection, sur \xAB + \xBB / \xAB \u2212 \xBB pour ajouter ou retirer un num\xE9ro")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        value: search,
        onChange: (e) => setSearch(e.target.value),
        placeholder: "Rechercher une carte\u2026",
        className: "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm w-56"
      }
    ), /* @__PURE__ */ React.createElement("button", { onClick: reset, className: "text-xs px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700" }, "Reset"), /* @__PURE__ */ React.createElement(ProgressMenu, { progress }))), /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-3 mb-4 space-y-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: labelCls }, "Raret\xE9"), /* @__PURE__ */ React.createElement(Pill, { all: true, active: rarity === null, onClick: () => setRarity(null) }, "Toutes"), rarityStats.map(({ key, owned, total }) => /* @__PURE__ */ React.createElement(
      Pill,
      {
        key,
        active: rarity === key,
        stat: `${owned}/${total}`,
        title: `Afficher uniquement les cartes avec le tag ${key}`,
        onClick: () => setRarity(rarity === key ? null : key)
      },
      key
    ))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: labelCls }, "S\xE9rie"), /* @__PURE__ */ React.createElement(Pill, { all: true, active: serie === null, onClick: () => setSerie(null) }, "Toutes"), seriesStats.map(({ key, owned, total }) => /* @__PURE__ */ React.createElement(
      Pill,
      {
        key,
        active: serie === key,
        stat: `${owned}/${total}`,
        title: `Afficher uniquement les cartes de la s\xE9rie ${key}`,
        onClick: () => setSerie(serie === key ? null : key)
      },
      key
    )), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: sortBy,
        onChange: (e) => setSortBy(e.target.value),
        title: "Trier les cartes",
        className: "bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 cursor-pointer"
      },
      /* @__PURE__ */ React.createElement("option", { value: "alpha" }, "Tri : Alphab\xE9tique"),
      /* @__PURE__ */ React.createElement("option", { value: "owned-desc" }, "Tri : Nombre de cartes \u2193"),
      /* @__PURE__ */ React.createElement("option", { value: "owned-asc" }, "Tri : Nombre de cartes \u2191")
    ), /* @__PURE__ */ React.createElement("span", { className: "ml-auto flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
      Pill,
      {
        active: ownFilter === "owned",
        title: "Cartes dont tu poss\xE8des au moins un num\xE9ro",
        onClick: () => setOwnFilter(ownFilter === "owned" ? null : "owned")
      },
      "Poss\xE9d\xE9"
    ), /* @__PURE__ */ React.createElement(
      Pill,
      {
        active: ownFilter === "missing",
        title: "Cartes dont tu ne poss\xE8des aucun num\xE9ro",
        onClick: () => setOwnFilter(ownFilter === "missing" ? null : "missing")
      },
      "Non poss\xE9d\xE9"
    ))), (rarity || serie) && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400" }, "Filtres actifs : ", rarity && /* @__PURE__ */ React.createElement("span", { className: "text-indigo-300 font-semibold" }, rarity), rarity && serie && " + ", serie && /* @__PURE__ */ React.createElement("span", { className: "text-indigo-300 font-semibold" }, serie), " ", "(clique \xE0 nouveau sur un chip pour le retirer)")), /* @__PURE__ */ React.createElement("div", { className: "mb-4 text-sm text-slate-400" }, /* @__PURE__ */ React.createElement("span", { className: "text-emerald-400 font-semibold" }, withVariants), " / ", cards.length, " cartes affich\xE9es avec variantes", /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, " \u2014 ", ix.cards.length, " cartes au total dans la collection"), /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, " \u2014 ", /* @__PURE__ */ React.createElement("span", { className: "text-cyan-300 font-semibold" }, stats.owned), " / ", stats.total, " num\xE9ros de cartes au total")), cards.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-slate-500 text-sm" }, "Aucune carte trouv\xE9e", search ? /* @__PURE__ */ React.createElement(React.Fragment, null, " pour \xAB ", search, " \xBB") : "", ".") : /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" }, cards.slice(0, limit).map((c) => /* @__PURE__ */ React.createElement(Card, { key: c.name, card: c, own: state[c.name] || EMPTY, onOpen: setOpenName, onAdd, onRemove })), cards.length > limit && /* @__PURE__ */ React.createElement("div", { ref: setSentinel, className: "col-span-full py-4 text-center text-xs text-slate-500" }, "Chargement\u2026")), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mt-4 leading-relaxed" }, /* @__PURE__ */ React.createElement("strong", null, "Instructions :"), /* @__PURE__ */ React.createElement("br", null), "- Clique sur un pseudo pour ouvrir sa vue Pokecardex (poss\xE9d\xE9es en couleur, manquantes en gris\xE9)", /* @__PURE__ */ React.createElement("br", null), "- Sur chaque carte : \xAB Basique 10/137 \xBB = num\xE9ros obtenus / total possibles pour ce cadre", /* @__PURE__ */ React.createElement("br", null), "- \xAB + \xBB ajoute un num\xE9ro, \xAB \u2212 \xBB en retire un", /* @__PURE__ */ React.createElement("br", null), "- Ta progression est sauvegard\xE9e automatiquement dans le navigateur (menu \u2630 pour l'exporter, l'importer ou la lier \xE0 un fichier)")), opened && /* @__PURE__ */ React.createElement(Pokecardex, { card: opened, own: state[opened.name] || EMPTY, onToggle: toggle, onClose: () => setOpenName(null) }), picker && /* @__PURE__ */ React.createElement(
      NumberPicker,
      {
        key: picker.name + picker.key + picker.mode,
        picker,
        onClose: () => setPicker(null),
        onConfirm: (n) => {
          toggle(picker.name, picker.key, n);
          setPicker(null);
        }
      }
    ));
  }
  var ruleOk = (rule, series, rarities) => series.includes(rule.series) && (!rule.rarities || rule.rarities.some((r) => rarities.includes(r)));
  var move = (arr, i, dir) => {
    const j = i + dir;
    if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]];
  };
  var input = "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm";
  var btn = "px-4 py-2 rounded-lg text-sm";
  var btnMain = `${btn} bg-indigo-600 hover:bg-indigo-500 font-semibold`;
  function generateDb(db) {
    const q = JSON.stringify;
    const rows = (arr) => arr.map((x) => "    " + q(x)).join(",\n");
    return `/* VGacha \u2014 base de donn\xE9es (v2), export\xE9e depuis le panel admin. Voir la structure : rarities / sections / series / cards. */
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
    const [text, setText] = (0, import_react.useState)(person ? person.name : "");
    const [ss, setSs] = (0, import_react.useState)(person ? person.series : []);
    const [rs, setRs] = (0, import_react.useState)(person ? person.rarities : ["Base"]);
    const [sc, setSc] = (0, import_react.useState)(person ? person.sections : []);
    const listed = db.sections.filter((s) => !s.all);
    const names = text.split("\n").map((s) => s.trim()).filter(Boolean);
    const apply = (ns, nr) => {
      setSc((prev) => {
        let out = prev;
        for (const s of listed) {
          if (!s.rule) continue;
          const was = ruleOk(s.rule, ss, rs), now = ruleOk(s.rule, ns, nr);
          if (was !== now) out = now ? uniq([...out, s.key]) : out.filter((x) => x !== s.key);
        }
        return out;
      });
      setSs(ns);
      setRs(nr);
    };
    const togS = (v) => apply(ss.includes(v) ? ss.filter((x) => x !== v) : [...ss, v], rs);
    const togR = (v) => {
      const on = !rs.includes(v);
      const implied = (db.rarities.find((r) => r.key === v) || {}).series;
      apply(on && implied && !ss.includes(implied) ? [...ss, implied] : ss, on ? [...rs, v] : rs.filter((x) => x !== v));
    };
    const chip = (list, v, onClick) => /* @__PURE__ */ React.createElement(Pill, { key: v, active: list.includes(v), onClick }, v);
    return /* @__PURE__ */ React.createElement(Overlay, { onClose, top: true }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl my-8 p-5" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold mb-4" }, person ? "Modifier " + person.name : "Ajouter des personnes"), /* @__PURE__ */ React.createElement("label", { className: "block text-sm text-slate-300 mb-1" }, person ? "Pseudo" : "Pseudos (un par ligne)"), person ? /* @__PURE__ */ React.createElement("input", { autoFocus: true, value: text, onChange: (e) => setText(e.target.value), className: input + " w-full !bg-slate-900 mb-1" }) : /* @__PURE__ */ React.createElement("textarea", { autoFocus: true, rows: 4, value: text, onChange: (e) => setText(e.target.value), placeholder: "Pseudo1\nPseudo2", className: input + " w-full !bg-slate-900 mb-1" }), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mb-4" }, person ? "Si le nouveau pseudo existe d\xE9j\xE0, les deux fiches sont fusionn\xE9es (la progression aussi)." : "Un pseudo d\xE9j\xE0 pr\xE9sent n'est pas dupliqu\xE9 : les s\xE9ries, raret\xE9s et sections coch\xE9es lui sont ajout\xE9es."), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-300 mb-1" }, "Raret\xE9s ", /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, "(\xAB Base \xBB = la carte existe)")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 mb-4" }, db.rarities.map((r) => chip(rs, r.key, () => togR(r.key)))), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-300 mb-1" }, "S\xE9ries"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 mb-5" }, db.series.map((s) => chip(ss, s.key, () => togS(s.key)))), listed.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-300 mb-1" }, "Sections affich\xE9es sur la carte ", /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, "(coch\xE9es automatiquement selon la s\xE9rie et la raret\xE9, modifiables)")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 mb-5" }, listed.map((s) => chip(sc, s.key, () => setSc(sc.includes(s.key) ? sc.filter((x) => x !== s.key) : [...sc, s.key]))))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: `${btn} bg-slate-700 hover:bg-slate-600` }, "Annuler"), /* @__PURE__ */ React.createElement("button", { disabled: !names.length, onClick: () => onSave(person, names, ss, rs, sc), className: `${btnMain} disabled:opacity-40` }, person ? "Enregistrer" : `Ajouter ${names.length || ""}`))));
  }
  function PeopleTab({ ix, edit, onRename, flash }) {
    const { db } = ix;
    const [q, setQ] = (0, import_react.useState)(""), [fs, setFs] = (0, import_react.useState)(""), [fr, setFr] = (0, import_react.useState)("");
    const [limit, setLimit] = (0, import_react.useState)(100);
    const [form, setForm] = (0, import_react.useState)(null);
    (0, import_react.useEffect)(() => setLimit(100), [q, fs, fr]);
    const list = (0, import_react.useMemo)(() => {
      const s = q.trim().toLowerCase();
      return ix.cards.filter((c) => (!s || c.lower.includes(s)) && (!fs || c.series.includes(fs)) && (!fr || c.rarities.includes(fr)));
    }, [ix, q, fs, fr]);
    const rank = (arr) => arr.slice().sort((a, b) => db.rarities.findIndex((r) => r.key === a) - db.rarities.findIndex((r) => r.key === b));
    const save = (person, names, series, rarities, sections) => {
      const rs = rank(rarities), ss = series.length ? series : ["Base"];
      if (person) {
        const newName = ix.strip(names[0]);
        const dup = db.cards.find((c) => c.name !== person.name && ix.norm(c.name) === ix.norm(newName));
        edit((d) => {
          const p = d.cards.find((c) => c.name === person.name);
          Object.assign(p, { name: newName, series: ss, rarities: rs, sections });
          const other = d.cards.find((c) => c !== p && ix.norm(c.name) === ix.norm(newName));
          if (other) {
            p.series = uniq([...p.series, ...other.series]);
            p.sections = uniq([...p.sections, ...other.sections]);
            p.rarities = rank(uniq([...p.rarities, ...other.rarities]));
            d.cards = d.cards.filter((c) => c !== other);
          }
          return d;
        });
        onRename(person.name, newName);
        if (dup) onRename(dup.name, newName);
      } else {
        edit((d) => {
          names.forEach((n) => {
            n = ix.strip(n);
            let p = d.cards.find((c) => ix.norm(c.name) === ix.norm(n));
            if (!p) {
              p = { name: n, rarities: [], series: [], sections: [] };
              d.cards.push(p);
            }
            p.series = uniq([...p.series, ...ss]);
            p.sections = uniq([...p.sections, ...sections]);
            p.rarities = rank(uniq([...p.rarities, ...rs]));
          });
          return d;
        });
      }
      setForm(null);
      flash(person ? "Fiche enregistr\xE9e." : `${names.length} personne(s) ajout\xE9e(s) ou mise(s) \xE0 jour.`);
    };
    const del = (c) => {
      if (!confirm(`Supprimer \xAB ${c.name} \xBB de la base ?`)) return;
      edit((d) => {
        d.cards = d.cards.filter((x) => x.name !== c.name);
        return d;
      });
      flash("Personne supprim\xE9e.");
    };
    const tag = "px-1.5 py-0.5 text-[10px] rounded-full";
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 mb-3" }, /* @__PURE__ */ React.createElement("input", { value: q, onChange: (e) => setQ(e.target.value), placeholder: "Rechercher un pseudo\u2026", className: input + " w-56" }), /* @__PURE__ */ React.createElement("select", { value: fs, onChange: (e) => setFs(e.target.value), className: input }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Toutes les s\xE9ries"), db.series.map((s) => /* @__PURE__ */ React.createElement("option", { key: s.key }, s.key))), /* @__PURE__ */ React.createElement("select", { value: fr, onChange: (e) => setFr(e.target.value), className: input }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Toutes les raret\xE9s"), db.rarities.map((r) => /* @__PURE__ */ React.createElement("option", { key: r.key }, r.key))), /* @__PURE__ */ React.createElement("button", { onClick: () => setForm("new"), className: `ml-auto ${btnMain}` }, "Ajouter des personnes")), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mb-2" }, list.length, " r\xE9sultat(s)"), /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-slate-800 divide-y divide-slate-800" }, list.slice(0, limit).map((c) => /* @__PURE__ */ React.createElement("div", { key: c.name, className: "flex flex-wrap items-center gap-2 px-3 py-2 hover:bg-slate-900" }, /* @__PURE__ */ React.createElement("span", { className: "font-semibold text-indigo-300 w-48 truncate", title: c.name }, c.name), /* @__PURE__ */ React.createElement("span", { className: "flex flex-wrap gap-1 grow" }, c.rarities.map((r) => /* @__PURE__ */ React.createElement("span", { key: r, className: `${tag} bg-amber-900/50 text-amber-200` }, r)), c.displaySeries.map((s) => /* @__PURE__ */ React.createElement("span", { key: s, className: `${tag} bg-slate-800 border border-slate-600 text-slate-300` }, s)), c.sections.filter((s) => !db.sections.find((x) => x.key === s.key).all).map((s) => /* @__PURE__ */ React.createElement("span", { key: "s" + s.key, className: `${tag} bg-teal-900/50 text-teal-200` }, s.key))), /* @__PURE__ */ React.createElement("button", { onClick: () => setForm(db.cards.find((x) => x.name === c.name)), className: "text-xs px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600" }, "Modifier"), /* @__PURE__ */ React.createElement("button", { onClick: () => del(c), className: "text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-red-700" }, "Supprimer"))), list.length === 0 && /* @__PURE__ */ React.createElement("p", { className: "p-4 text-sm text-slate-500" }, "Aucun r\xE9sultat. Ajoute cette personne avec le bouton ci-dessus.")), list.length > limit && /* @__PURE__ */ React.createElement("button", { onClick: () => setLimit((l) => l + 200), className: `mt-3 ${btn} bg-slate-800 hover:bg-slate-700` }, "Afficher plus (", list.length - limit, " restants)"), form && /* @__PURE__ */ React.createElement(PersonForm, { key: form === "new" ? "new" : form.name, ix, person: form === "new" ? null : form, onSave: save, onClose: () => setForm(null) }));
  }
  function StructureTab({ ix, edit }) {
    const { db } = ix;
    const [newSerie, setNewSerie] = (0, import_react.useState)("");
    const [newSec, setNewSec] = (0, import_react.useState)({ name: "", count: 1 });
    const [openSerie, setOpenSerie] = (0, import_react.useState)(null);
    const small = "px-2 rounded bg-slate-800 hover:bg-slate-700";
    const addSerie = () => {
      const n = newSerie.trim();
      if (!n) return;
      if (db.series.some((s) => s.key === n)) return alert("Cette s\xE9rie existe d\xE9j\xE0.");
      edit((d) => {
        d.series.push({ key: n, sections: d.sections.filter((s) => s.key === n).map((s) => s.key) });
        return d;
      });
      setNewSerie("");
    };
    const renameSerie = (s) => {
      const n = (prompt("Nouveau nom de la s\xE9rie :", s) || "").trim();
      if (!n || n === s) return;
      if (db.series.some((x) => x.key === n)) return alert("Cette s\xE9rie existe d\xE9j\xE0.");
      edit((d) => {
        d.series.find((x) => x.key === s).key = n;
        d.cards.forEach((c) => {
          c.series = c.series.map((x) => x === s ? n : x);
        });
        d.sections.forEach((x) => {
          if (x.rule && x.rule.series === s) x.rule.series = n;
        });
        d.rarities.forEach((r) => {
          if (r.series === s) r.series = n;
        });
        return d;
      });
    };
    const delSerie = (s) => {
      if (!confirm(`Supprimer la s\xE9rie \xAB ${s} \xBB ? Les personnes restent dans la base.`)) return;
      edit((d) => {
        d.series = d.series.filter((x) => x.key !== s);
        d.cards.forEach((c) => {
          c.series = c.series.filter((x) => x !== s);
        });
        return d;
      });
    };
    const toggleSerieSection = (s, key) => edit((d) => {
      const e = d.series.find((x) => x.key === s);
      e.sections = e.sections.includes(key) ? e.sections.filter((x) => x !== key) : [...e.sections, key];
      return d;
    });
    const setSec = (key, patch) => edit((d) => {
      Object.assign(d.sections.find((s) => s.key === key), patch);
      return d;
    });
    const addSection = () => {
      const n = newSec.name.trim();
      if (!n) return;
      if (db.sections.some((s) => s.key === n)) return alert("Cette section existe d\xE9j\xE0.");
      edit((d) => {
        const s = { key: n, count: Math.max(1, +newSec.count || 1), color: "#6366f1" };
        if (d.series.some((x) => x.key === n)) s.rule = { series: n };
        d.sections.push(s);
        const ser = d.series.find((x) => x.key === n);
        if (ser && !ser.sections.includes(n)) ser.sections.push(n);
        return d;
      });
      setNewSec({ name: "", count: 1 });
    };
    const delSection = (key) => {
      if (!confirm(`Supprimer la section \xAB ${key} \xBB ? Elle dispara\xEEt de toutes les cartes (la progression coch\xE9e reste en m\xE9moire).`)) return;
      edit((d) => {
        d.sections = d.sections.filter((s) => s.key !== key);
        d.cards.forEach((c) => {
          c.sections = c.sections.filter((x) => x !== key);
        });
        d.series.forEach((s) => {
          s.sections = s.sections.filter((x) => x !== key);
        });
        return d;
      });
    };
    return /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-6" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "font-semibold mb-2" }, "S\xE9ries"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mb-3" }, "L'ordre ici est l'ordre des boutons sur le site. \xAB Sections \xBB = cadres compt\xE9s dans le \xAB poss\xE9d\xE9es / total \xBB du bouton."), /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-slate-800 divide-y divide-slate-800 mb-3" }, db.series.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.key, className: "px-3 py-2 text-sm" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement("span", { className: "grow truncate" }, s.key, " ", /* @__PURE__ */ React.createElement("span", { className: "text-slate-500 text-xs" }, "(", db.cards.filter((c) => c.series.includes(s.key)).length, ")")), /* @__PURE__ */ React.createElement("button", { onClick: () => edit((d) => (move(d.series, i, -1), d)), title: "Monter", className: small }, "\u2191"), /* @__PURE__ */ React.createElement("button", { onClick: () => edit((d) => (move(d.series, i, 1), d)), title: "Descendre", className: small }, "\u2193"), /* @__PURE__ */ React.createElement("button", { onClick: () => setOpenSerie(openSerie === s.key ? null : s.key), className: "text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" }, "Sections"), /* @__PURE__ */ React.createElement("button", { onClick: () => renameSerie(s.key), className: "text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" }, "Renommer"), /* @__PURE__ */ React.createElement("button", { onClick: () => delSerie(s.key), className: "text-xs px-2 py-1 rounded bg-slate-800 hover:bg-red-700" }, "Supprimer")), openSerie === s.key && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5 mt-2" }, db.sections.map((x) => /* @__PURE__ */ React.createElement(Pill, { key: x.key, active: (s.sections || []).includes(x.key), onClick: () => toggleSerieSection(s.key, x.key) }, x.key)))))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("input", { value: newSerie, onChange: (e) => setNewSerie(e.target.value), onKeyDown: (e) => e.key === "Enter" && addSerie(), placeholder: "Nouvelle s\xE9rie", className: input + " grow" }), /* @__PURE__ */ React.createElement("button", { onClick: addSerie, className: btnMain }, "Cr\xE9er"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "font-semibold mb-2" }, "Cadres / sections"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mb-3" }, "Nombre de num\xE9ros, couleur et port\xE9e. \xAB Toutes \xBB = affich\xE9 sur toutes les cartes ; sinon seulement sur celles qui l'ont coch\xE9e."), /* @__PURE__ */ React.createElement("div", { className: "space-y-2 mb-3" }, db.sections.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.key, className: "flex items-center gap-2 text-sm" }, /* @__PURE__ */ React.createElement("input", { type: "color", value: s.color, onChange: (e) => setSec(s.key, { color: e.target.value }), className: "w-7 h-7 bg-transparent cursor-pointer" }), /* @__PURE__ */ React.createElement("span", { className: "grow truncate" }, s.key), /* @__PURE__ */ React.createElement("label", { className: "flex items-center gap-1 text-xs text-slate-400 cursor-pointer" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: !!s.all, onChange: (e) => setSec(s.key, { all: e.target.checked || void 0 }), className: "accent-indigo-500" }), "Toutes"), /* @__PURE__ */ React.createElement("input", { type: "number", min: "1", value: s.count, onChange: (e) => setSec(s.key, { count: Math.max(1, parseInt(e.target.value) || 1) }), className: input + " w-20" }), /* @__PURE__ */ React.createElement("button", { onClick: () => edit((d) => (move(d.sections, i, -1), d)), title: "Monter", className: small }, "\u2191"), /* @__PURE__ */ React.createElement("button", { onClick: () => edit((d) => (move(d.sections, i, 1), d)), title: "Descendre", className: small }, "\u2193"), /* @__PURE__ */ React.createElement("button", { onClick: () => delSection(s.key), title: "Supprimer", className: "px-2 rounded bg-slate-800 hover:bg-red-700" }, "\xD7")))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("input", { value: newSec.name, onChange: (e) => setNewSec({ ...newSec, name: e.target.value }), placeholder: "Nouvelle section", className: input + " grow" }), /* @__PURE__ */ React.createElement("input", { type: "number", min: "1", value: newSec.count, onChange: (e) => setNewSec({ ...newSec, count: e.target.value }), className: input + " w-20", title: "Nombre de num\xE9ros" }), /* @__PURE__ */ React.createElement("button", { onClick: addSection, className: btnMain }, "Cr\xE9er"))));
  }
  function ExportTab({ db, markExported, resetDraft, flash }) {
    const out = (0, import_react.useMemo)(() => generateDb(db), [db]);
    const download = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([out], { type: "text/javascript" }));
      a.download = "vgacha-db.js";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
      markExported();
    };
    const saveDirect = async () => {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: "vgacha-db.js", types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }] });
        const w = await h.createWritable();
        await w.write(out);
        await w.close();
        markExported();
        flash("vgacha-db.js enregistr\xE9.");
      } catch (e) {
      }
    };
    return /* @__PURE__ */ React.createElement("div", { className: "max-w-xl" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-300 mb-2" }, "G\xE9n\xE8re un nouveau ", /* @__PURE__ */ React.createElement("code", { className: "text-indigo-300" }, "vgacha-db.js"), " \xE0 remplacer dans le dossier du site. Ta progression de collection n'est pas touch\xE9e."), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mb-4" }, "Tes modifications s'affichent d\xE9j\xE0 sur l'onglet Collection de ce navigateur ; l'export sert \xE0 les rendre d\xE9finitives (et \xE0 les voir ailleurs)."), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 mb-6" }, /* @__PURE__ */ React.createElement("button", { onClick: download, className: btnMain }, "T\xE9l\xE9charger vgacha-db.js"), typeof window.showSaveFilePicker === "function" && /* @__PURE__ */ React.createElement("button", { onClick: saveDirect, className: `${btn} bg-slate-700 hover:bg-slate-600` }, "Enregistrer dans le fichier (Chrome/Edge)"), /* @__PURE__ */ React.createElement("button", { onClick: () => navigator.clipboard.writeText(out).then(() => flash("Contenu copi\xE9."), () => flash("Copie impossible : utilise le t\xE9l\xE9chargement.")), className: `${btn} bg-slate-800 hover:bg-slate-700` }, "Copier le contenu")), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          if (confirm("Abandonner toutes les modifications et recharger depuis vgacha-db.js ?")) resetDraft();
        },
        className: `${btn} bg-slate-800 hover:bg-red-800 border border-slate-700`
      },
      "Abandonner les modifications"
    ));
  }
  function AdminPanel({ ix, dirty, edit, markExported, resetDraft, onRename }) {
    const [tab, setTab] = (0, import_react.useState)("people");
    const [msg, setMsg] = (0, import_react.useState)("");
    const flash = (0, import_react.useCallback)((t) => {
      setMsg(t);
      setTimeout(() => setMsg(""), 3500);
    }, []);
    const tabs = [["people", "Personnes"], ["structure", "S\xE9ries et cadres"], ["export", "Exporter"]];
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-5xl mx-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "text-2xl font-bold" }, "VGacha \u2014 Admin"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, ix.cards.length, " personnes \xB7 ", ix.db.series.length, " s\xE9ries \xB7 ", ix.db.sections.length, " cadres")), dirty && /* @__PURE__ */ React.createElement("button", { onClick: () => setTab("export"), className: "text-xs px-3 py-1.5 rounded-lg bg-amber-900/60 border border-amber-700 text-amber-200" }, "Modifications non export\xE9es")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 mb-4 border-b border-slate-800" }, tabs.map(([k, l]) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: k,
        onClick: () => setTab(k),
        className: `px-4 py-2 text-sm -mb-px border-b-2 ${tab === k ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`
      },
      l
    ))), msg && /* @__PURE__ */ React.createElement("div", { className: "mb-3 text-sm rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-200 px-3 py-2" }, msg), tab === "people" && /* @__PURE__ */ React.createElement(PeopleTab, { ix, edit, onRename, flash }), tab === "structure" && /* @__PURE__ */ React.createElement(StructureTab, { ix, edit }), tab === "export" && /* @__PURE__ */ React.createElement(ExportTab, { db: ix.db, markExported, resetDraft, flash })));
  }
  function loadDraft() {
    const base = window.VGACHA_DB;
    try {
      const d = JSON.parse(localStorage.getItem(LS_DRAFT));
      if (d && d.baseRev === base.rev && d.db && Array.isArray(d.db.cards)) {
        buildIndex(d.db);
        return { db: d.db, dirty: !!d.dirty, touched: true };
      }
    } catch (e) {
    }
    return { db: base, dirty: false, touched: false };
  }
  function Root() {
    const [draft, setDraft] = (0, import_react.useState)(loadDraft);
    const ix = (0, import_react.useMemo)(() => buildIndex(draft.db), [draft.db]);
    const ixRef = (0, import_react.useRef)(ix);
    ixRef.current = ix;
    const progress = useProgress(ixRef);
    const edit = (0, import_react.useCallback)((fn) => setDraft((s) => ({ db: fn(structuredClone(s.db)), dirty: true, touched: true })), []);
    const markExported = (0, import_react.useCallback)(() => setDraft((s) => ({ ...s, dirty: false })), []);
    const resetDraft = (0, import_react.useCallback)(() => {
      try {
        localStorage.removeItem(LS_DRAFT);
      } catch (e) {
      }
      setDraft({ db: window.VGACHA_DB, dirty: false, touched: false });
    }, []);
    (0, import_react.useEffect)(() => {
      if (!draft.touched) return;
      try {
        localStorage.setItem(LS_DRAFT, JSON.stringify({ baseRev: window.VGACHA_DB.rev, db: draft.db, dirty: draft.dirty }));
      } catch (e) {
      }
    }, [draft]);
    (0, import_react.useEffect)(() => {
      const h = (e) => {
        if (draft.dirty) {
          e.preventDefault();
          e.returnValue = "";
        }
      };
      window.addEventListener("beforeunload", h);
      return () => window.removeEventListener("beforeunload", h);
    }, [draft.dirty]);
    const [view, setView] = (0, import_react.useState)(location.hash === "#admin" ? "admin" : "collection");
    const go = (v) => {
      setView(v);
      history.replaceState(null, "", v === "admin" ? "#admin" : location.pathname + location.search);
      window.scrollTo(0, 0);
    };
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("nav", { className: "sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto flex items-center gap-1 px-4" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold text-white mr-4" }, "VGacha"), [["collection", "Collection"], ["admin", "Admin"]].map(([k, l]) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: k,
        onClick: () => go(k),
        className: `px-4 py-3 text-sm border-b-2 -mb-px transition ${view === k ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`
      },
      l,
      k === "admin" && draft.dirty && /* @__PURE__ */ React.createElement("span", { className: "ml-1 text-amber-400" }, "\u25CF")
    )))), /* @__PURE__ */ React.createElement("div", { style: { display: view === "collection" ? "block" : "none" } }, /* @__PURE__ */ React.createElement(Collection, { ix, progress })), /* @__PURE__ */ React.createElement("div", { style: { display: view === "admin" ? "block" : "none" } }, /* @__PURE__ */ React.createElement(AdminPanel, { ix, dirty: draft.dirty, edit, markExported, resetDraft, onRename: progress.rename })));
  }
  (0, import_client.createRoot)(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(Root, null));
})();
