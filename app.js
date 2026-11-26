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
  function parseRanges(text, max) {
    const nums = /* @__PURE__ */ new Set();
    let bad = false;
    for (const part of text.replace(/\s*[-–]\s*/g, "-").split(/[,;\s]+/).filter(Boolean)) {
      const m = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) {
        bad = true;
        continue;
      }
      let a = +m[1], b = m[2] ? +m[2] : a;
      if (a > b) [a, b] = [b, a];
      for (let i = Math.max(1, a); i <= Math.min(max, b); i++) nums.add(i);
    }
    return { nums: [...nums], bad };
  }
  function toRanges(nums) {
    const out = [];
    for (let i = 0; i < nums.length; ) {
      let j = i;
      while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      out.push(j > i ? nums[i] + "-" + nums[j] : "" + nums[i]);
      i = j + 1;
    }
    return out.join(", ");
  }
  function missingParts(card, own) {
    const parts = [];
    for (const s of card.sections) {
      const have = new Set(own[s.key] || []), miss = [];
      for (let n = 1; n <= s.max; n++) if (!have.has(n)) miss.push(n);
      if (miss.length) parts.push(s.key + " " + toRanges(miss));
    }
    return parts;
  }
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
  function withList(prev, card, section, list) {
    const c = { ...prev[card] || {} };
    if (list.length) c[section] = list.slice().sort((a, b) => a - b);
    else delete c[section];
    const out = { ...prev };
    if (Object.keys(c).length) out[card] = c;
    else delete out[card];
    return out;
  }
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
    const history = (0, import_react.useRef)([]);
    const [undoLabel, setUndoLabel] = (0, import_react.useState)(null);
    const commit = (0, import_react.useCallback)((fn, label) => {
      const prev = latest.current, next = fn(prev);
      if (next === prev) return;
      history.current.push({ prev, label });
      if (history.current.length > 50) history.current.shift();
      latest.current = next;
      setState(next);
      setUndoLabel(label);
    }, []);
    const undo = (0, import_react.useCallback)(() => {
      const last = history.current.pop();
      if (!last) return;
      latest.current = last.prev;
      setState(last.prev);
      const top = history.current[history.current.length - 1];
      setUndoLabel(top ? top.label : null);
    }, []);
    const toggle = (0, import_react.useCallback)((card, section, n) => {
      const had = ((latest.current[card] || {})[section] || []).includes(n);
      commit((prev) => {
        const list = (prev[card] || {})[section] || [];
        return withList(prev, card, section, had ? list.filter((x) => x !== n) : [...list, n]);
      }, `${had ? "Retrait" : "Ajout"} ${section} #${n} \u2014 ${card}`);
    }, [commit]);
    const bulk = (0, import_react.useCallback)((card, section, nums, on) => commit((prev) => {
      const before = (prev[card] || {})[section] || [];
      const set = new Set(before);
      nums.forEach((n) => on ? set.add(n) : set.delete(n));
      if (set.size === before.length && before.every((n) => set.has(n))) return prev;
      return withList(prev, card, section, [...set]);
    }, `${on ? "Ajout" : "Retrait"} de ${nums.length} num\xE9ro(s) ${section} \u2014 ${card}`), [commit]);
    const rename = (0, import_react.useCallback)((from, to) => {
      const prev = latest.current;
      if (from === to || !prev[from]) return;
      const { [from]: moved, ...rest } = prev;
      const next = mergeStates(rest, { [to]: moved });
      history.current = [];
      setUndoLabel(null);
      latest.current = next;
      setState(next);
    }, []);
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
        commit((p) => mergeStates(p, imported), "Import de progression");
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
    return { state, toggle, bulk, undo, undoLabel, rename, exportFile, importFile, linkFile, linked, canLink: typeof window.showSaveFilePicker === "function" };
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
  function SectionBlock({ card, sec, have, onToggle, onBulk }) {
    const { key, max, color } = sec;
    const [txt, setTxt] = (0, import_react.useState)("");
    const [err, setErr] = (0, import_react.useState)("");
    const all = Array.from({ length: max }, (_, i) => i + 1);
    const run = (on) => {
      const { nums, bad } = parseRanges(txt, max);
      if (!nums.length) return setErr(`Format attendu : 1-20, 35, 40-50 (num\xE9ros entre 1 et ${max})`);
      onBulk(card.name, key, nums, on);
      setErr(bad ? "Une partie de la saisie n'a pas \xE9t\xE9 comprise et a \xE9t\xE9 ignor\xE9e." : "");
      if (!bad) setTxt("");
    };
    const small = "px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600";
    return /* @__PURE__ */ React.createElement("div", { className: "mb-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2 mb-2" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-slate-300" }, key, " ", /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-500" }, "(", have.size, "/", max, ")")), max > 3 && /* @__PURE__ */ React.createElement("span", { className: "ml-auto flex flex-wrap items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        value: txt,
        onChange: (e) => {
          setTxt(e.target.value);
          setErr("");
        },
        onKeyDown: (e) => e.key === "Enter" && run(true),
        placeholder: "ex : 1-20, 35, 40-50",
        title: "Num\xE9ros ou plages s\xE9par\xE9s par des virgules",
        className: "w-40 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs"
      }
    ), /* @__PURE__ */ React.createElement("button", { onClick: () => run(true), className: small }, "Cocher"), /* @__PURE__ */ React.createElement("button", { onClick: () => run(false), className: small }, "D\xE9cocher"))), err && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-amber-400 mb-2" }, err), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, all.map((n) => {
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
  }
  function Pokecardex({ card, own, onToggle, onBulk, onCopy, onClose }) {
    const owned = ownedIn(own, card.sections);
    const pct = card.total ? Math.round(owned / card.total * 100) : 0;
    const parts = missingParts(card, own);
    const [copied, setCopied] = (0, import_react.useState)(false);
    const copyMissing = async () => {
      if (await onCopy(`${card.name} \u2014 manquantes :
${parts.join("\n")}`)) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2e3);
      }
    };
    return /* @__PURE__ */ React.createElement(Overlay, { onClose, top: true }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl my-8 p-5 relative shadow-2xl" }, /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: "absolute top-3 right-3 text-slate-400 hover:text-white text-2xl leading-none" }, "\xD7"), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold text-white mb-2" }, "Collection de ", /* @__PURE__ */ React.createElement("span", { className: "text-indigo-400" }, card.name)), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1 mb-2" }, card.series.map((s) => /* @__PURE__ */ React.createElement("span", { key: s, className: "px-2 py-0.5 text-[11px] rounded-full bg-slate-800 text-slate-300 border border-slate-600" }, s))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2 mb-2" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, /* @__PURE__ */ React.createElement("span", { className: "text-emerald-400 font-semibold" }, owned), " / ", card.total, " cartes poss\xE9d\xE9es (", pct, "%)"), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: copyMissing,
        disabled: !parts.length,
        title: "Copie la liste des num\xE9ros qu'il te manque pour cette carte",
        className: "text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40"
      },
      !parts.length ? "Rien ne manque" : copied ? "Copi\xE9 \u2713" : "Copier mes manquantes"
    )), /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(Bar, { pct, h: "h-2" })), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mb-3" }, "Clique sur une carte pour l'ajouter / la retirer, ou saisis des plages (ex : 1-20, 35) pour en cocher plusieurs d'un coup."), card.sections.map((sec) => /* @__PURE__ */ React.createElement(SectionBlock, { key: sec.key, card, sec, have: new Set(own[sec.key] || []), onToggle, onBulk }))));
  }
  function CopyFallback({ text, onClose }) {
    return /* @__PURE__ */ React.createElement(Overlay, { onClose }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 rounded-lg p-4 w-full max-w-lg relative" }, /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: "absolute top-2 right-3 text-slate-400 hover:text-white text-xl" }, "\xD7"), /* @__PURE__ */ React.createElement("h3", { className: "text-white mb-1" }, "Copie manuelle"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400 mb-2" }, "Le navigateur a refus\xE9 la copie automatique : s\xE9lectionne et copie le texte (Ctrl+C)."), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        readOnly: true,
        autoFocus: true,
        value: text,
        onFocus: (e) => e.target.select(),
        rows: 12,
        className: "w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono"
      }
    )));
  }
  function ProgressMenu({ progress }) {
    const [open, setOpen] = (0, import_react.useState)(false);
    const input = (0, import_react.useRef)(null);
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
      input.current.click();
      setOpen(false);
    } }, "Importer (fusion)"), progress.canLink && /* @__PURE__ */ React.createElement("button", { className: item, onClick: () => {
      progress.linkFile();
      setOpen(false);
    } }, progress.linked ? "Fichier li\xE9 \u2713 (changer)" : "Lier un fichier (auto-save)"))), /* @__PURE__ */ React.createElement(
      "input",
      {
        ref: input,
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
    const { state, toggle, bulk, undo, undoLabel } = progress;
    const [search, setSearch] = (0, import_react.useState)("");
    const dSearch = (0, import_react.useDeferredValue)(search);
    const [rarity, setRarity] = (0, import_react.useState)(null);
    const [serie, setSerie] = (0, import_react.useState)(null);
    const [ownFilter, setOwnFilter] = (0, import_react.useState)(null);
    const [sortBy, setSortBy] = (0, import_react.useState)("alpha");
    const [fallback, setFallback] = (0, import_react.useState)(null);
    const [copied, setCopied] = (0, import_react.useState)(false);
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
          setFallback(null);
        } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || "")) {
          e.preventDefault();
          undo();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [undo]);
    const copy = (0, import_react.useCallback)(async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        setFallback(text);
        return false;
      }
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
        const val = sortBy.startsWith("pct") ? (c) => stats.perCard.get(c.name) / (c.total || 1) : (c) => stats.perCard.get(c.name);
        const dir = sortBy.endsWith("desc") ? -1 : 1;
        list.sort((a, b) => (val(a) - val(b)) * dir || byName(a, b));
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
    const copyMissing = async () => {
      const lines = cards.map((c) => {
        const parts = missingParts(c, state[c.name] || EMPTY);
        return parts.length ? `${c.name} : ${parts.join(" | ")}` : null;
      }).filter(Boolean);
      const filters = [rarity, serie].filter(Boolean).join(" + ");
      const head = "VGacha \u2014 cartes manquantes" + (filters ? ` (${filters})` : "");
      if (await copy(head + "\n" + (lines.length ? lines.join("\n") : "Rien ne manque !"))) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2e3);
      }
    };
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
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: undo,
        disabled: !undoLabel,
        title: undoLabel ? `Annuler : ${undoLabel} (Ctrl+Z)` : "Rien \xE0 annuler",
        className: "text-xs px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800"
      },
      "\u21B6 Annuler"
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
      /* @__PURE__ */ React.createElement("option", { value: "owned-asc" }, "Tri : Nombre de cartes \u2191"),
      /* @__PURE__ */ React.createElement("option", { value: "pct-desc" }, "Tri : Compl\xE9tion % \u2193"),
      /* @__PURE__ */ React.createElement("option", { value: "pct-asc" }, "Tri : Compl\xE9tion % \u2191")
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
    ))), (rarity || serie) && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400" }, "Filtres actifs : ", rarity && /* @__PURE__ */ React.createElement("span", { className: "text-indigo-300 font-semibold" }, rarity), rarity && serie && " + ", serie && /* @__PURE__ */ React.createElement("span", { className: "text-indigo-300 font-semibold" }, serie), " ", "(clique \xE0 nouveau sur un chip pour le retirer)")), /* @__PURE__ */ React.createElement("div", { className: "mb-4 text-sm text-slate-400" }, /* @__PURE__ */ React.createElement("span", { className: "text-emerald-400 font-semibold" }, withVariants), " / ", cards.length, " cartes affich\xE9es avec variantes", /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, " \u2014 ", ix.cards.length, " cartes au total dans la collection"), /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, " \u2014 ", /* @__PURE__ */ React.createElement("span", { className: "text-cyan-300 font-semibold" }, stats.owned), " / ", stats.total, " num\xE9ros de cartes au total"), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: copyMissing,
        title: "Copie, pour les cartes affich\xE9es, la liste des num\xE9ros qu'il te manque (utile pour les \xE9changes)",
        className: "ml-3 text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
      },
      copied ? "Copi\xE9 \u2713" : "Copier les manquantes"
    )), cards.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-slate-500 text-sm" }, "Aucune carte trouv\xE9e", search ? /* @__PURE__ */ React.createElement(React.Fragment, null, " pour \xAB ", search, " \xBB") : "", ".") : /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" }, cards.slice(0, limit).map((c) => /* @__PURE__ */ React.createElement(Card, { key: c.name, card: c, own: state[c.name] || EMPTY, onOpen: setOpenName, onAdd, onRemove })), cards.length > limit && /* @__PURE__ */ React.createElement("div", { ref: setSentinel, className: "col-span-full py-4 text-center text-xs text-slate-500" }, "Chargement\u2026")), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mt-4 leading-relaxed" }, /* @__PURE__ */ React.createElement("strong", null, "Instructions :"), /* @__PURE__ */ React.createElement("br", null), "- Clique sur un pseudo pour ouvrir sa vue Pokecardex (poss\xE9d\xE9es en couleur, manquantes en gris\xE9)", /* @__PURE__ */ React.createElement("br", null), "- Sur chaque carte : \xAB Basique 10/137 \xBB = num\xE9ros obtenus / total possibles pour ce cadre", /* @__PURE__ */ React.createElement("br", null), "- \xAB + \xBB ajoute un num\xE9ro, \xAB \u2212 \xBB en retire un ; dans la vue Pokecardex, saisis des plages (\xAB 1-20, 35 \xBB) pour en cocher plusieurs d'un coup", /* @__PURE__ */ React.createElement("br", null), "- \xAB \u21B6 Annuler \xBB (ou Ctrl+Z) revient en arri\xE8re sur tes 50 derni\xE8res actions", /* @__PURE__ */ React.createElement("br", null), "- \xAB Copier les manquantes \xBB g\xE9n\xE8re la liste de ce qu'il te manque pour les cartes affich\xE9es (utile pour les \xE9changes)", /* @__PURE__ */ React.createElement("br", null), "- Ta progression est sauvegard\xE9e automatiquement dans le navigateur (menu \u2630 pour l'exporter, l'importer ou la lier \xE0 un fichier)")), opened && /* @__PURE__ */ React.createElement(Pokecardex, { card: opened, own: state[opened.name] || EMPTY, onToggle: toggle, onBulk: bulk, onCopy: copy, onClose: () => setOpenName(null) }), picker && /* @__PURE__ */ React.createElement(
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
    ), fallback && /* @__PURE__ */ React.createElement(CopyFallback, { text: fallback, onClose: () => setFallback(null) }));
  }
  function Root() {
    const ix = (0, import_react.useMemo)(() => buildIndex(window.VGACHA_DB), []);
    const ixRef = (0, import_react.useRef)(ix);
    const progress = useProgress(ixRef);
    return /* @__PURE__ */ React.createElement(Collection, { ix, progress });
  }
  (0, import_client.createRoot)(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(Root, null));
})();
