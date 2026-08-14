import { useState, useEffect, useRef } from "react";
import { storage } from "./storage.js";

// ---------- Design tokens (CARE green / red) ----------
const T = {
  navy: "#2E6B45",
  navyDeep: "#1F4A30",
  navySoft: "#438B5C",
  gold: "#E84431",
  goldSoft: "#F9D9D3",
  paper: "#F6F4EF",
  card: "#FFFFFF",
  ink: "#1A2233",
  inkSoft: "#5A6478",
  line: "#E4E0D6",
  amber: "#B07B1E",
  red: "#A83A28",
  green: "#3D7A4E",
};

const LOGO = "/logo.png";

const CATEGORIES = [
  { id: "checkin", label: "Check-in", color: "#3D7A4E" },
  { id: "maintenance", label: "Maintenance", color: "#B07B1E" },
  { id: "call", label: "Call", color: "#2E5FA3" },
  { id: "email", label: "Email", color: "#6B4FA0" },
  { id: "concern", label: "Concern", color: "#A83A28" },
  { id: "admin", label: "Admin", color: "#5A6478" },
];

const TABS = [
  { id: "inbox", label: "Inbox" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "waiting", label: "Waiting" },
  { id: "done", label: "Done" },
];

const STORAGE_KEY = "care-ops-v1";
const HINT_KEY = "care-ops-install-hint-dismissed";
const DAY = 86400000;

const catById = (id) => CATEGORIES.find((c) => c.id === id);
const ageDays = (t) => Math.floor((Date.now() - t.createdAt) / DAY);

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.MSStream;

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches);

export default function CareOpsBoard() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("inbox");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null); // task id
  const [showHelp, setShowHelp] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  // ---------- Load ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) setTasks(JSON.parse(res.value));
      } catch (e) {
        // no data yet — start fresh
      }
      setLoaded(true);
    })();
  }, []);

  // ---------- Install hint (iOS Safari only, once) ----------
  useEffect(() => {
    (async () => {
      if (!isIOS() || isStandalone()) return;
      const res = await storage.get(HINT_KEY);
      if (!res) setShowInstallHint(true);
    })();
  }, []);

  const dismissInstallHint = () => {
    setShowInstallHint(false);
    storage.set(HINT_KEY, "1");
  };

  // ---------- Persist ----------
  const persist = async (next) => {
    setTasks(next);
    try {
      await storage.set(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  // ---------- Actions ----------
  const addTask = () => {
    const title = draft.trim();
    if (!title) return;
    const t = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
      title,
      category: null,
      property: "",
      note: "",
      waitingOn: "",
      status: "inbox",
      createdAt: Date.now(),
      doneAt: null,
    };
    persist([t, ...tasks]);
    setDraft("");
    inputRef.current && inputRef.current.focus();
  };

  const update = (id, patch) =>
    persist(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const remove = (id) => {
    persist(tasks.filter((t) => t.id !== id));
    setEditing(null);
  };

  const markDone = (id) => {
    update(id, { status: "done", doneAt: Date.now() });
    setEditing(null);
  };

  const clearDone = () => persist(tasks.filter((t) => t.status !== "done"));

  // ---------- Backup / restore ----------
  // The board lives on this device only, so a one-tap export is the safety net.
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `care-ops-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importBackup = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("bad file");
        const existing = new Set(tasks.map((t) => t.id));
        const merged = [...tasks, ...data.filter((t) => t && t.id && !existing.has(t.id))];
        persist(merged);
      } catch {
        alert("That doesn't look like a CARE Ops backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ---------- Derived ----------
  const byTab = (id) =>
    tasks
      .filter((t) => t.status === id)
      .sort((a, b) =>
        id === "done" ? (b.doneAt || 0) - (a.doneAt || 0) : a.createdAt - b.createdAt
      );

  const counts = Object.fromEntries(TABS.map((tb) => [tb.id, byTab(tb.id).length]));
  const list = byTab(tab);
  const editTask = tasks.find((t) => t.id === editing);
  const atRisk = tasks.filter(
    (t) => t.status !== "done" && ((t.status === "inbox" && ageDays(t) >= 2) || ageDays(t) >= 5)
  ).length;

  // ---------- Small pieces ----------
  const AgeChip = ({ task }) => {
    const d = ageDays(task);
    if (task.status === "done") return null;
    let bg = "#EEEBE2", fg = T.inkSoft, txt = d === 0 ? "today" : `${d}d`;
    if ((task.status === "inbox" && d >= 4) || d >= 7) {
      bg = "#F6E3DF"; fg = T.red; txt = `${d}d — don't lose this`;
    } else if ((task.status === "inbox" && d >= 2) || d >= 5) {
      bg = "#F3EAD3"; fg = T.amber; txt = `${d}d`;
    }
    return <span style={{ fontSize: 11, fontWeight: 600, background: bg, color: fg, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>{txt}</span>;
  };

  const CatDot = ({ task }) => {
    const c = catById(task.category);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: c ? c.color : T.inkSoft }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: c ? c.color : T.line, display: "inline-block" }} />
        {c ? c.label : "Untagged"}
      </span>
    );
  };

  const MoveBtn = ({ to, label, current, id }) => (
    <button
      onClick={() => { update(id, { status: to }); setEditing(null); }}
      style={{
        flex: 1, padding: "12px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 700,
        border: `1.5px solid ${current === to ? T.navy : T.line}`,
        background: current === to ? T.navy : "#fff",
        color: current === to ? "#fff" : T.ink, cursor: "pointer",
        minHeight: 44,
      }}
    >{label}</button>
  );

  // ---------- Render ----------
  return (
    <div style={{ minHeight: "100dvh", background: T.paper, fontFamily: "'Public Sans', -apple-system, 'Segoe UI', sans-serif", color: T.ink }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; }
        input, textarea, button { font-family: inherit; }
        /* 16px minimum stops iOS Safari zooming in when a field is focused */
        input, textarea { font-size: 16px; }
        input:focus, textarea:focus { outline: 2px solid ${T.gold}; outline-offset: 1px; }
        button:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 2px; }
        ::placeholder { color: #9AA1B0; }
        .care-scroll::-webkit-scrollbar { display: none; }
        .care-scroll { scrollbar-width: none; }
      `}</style>

      <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: "calc(90px + env(safe-area-inset-bottom))" }}>

        {/* Header + capture — the one landing spot */}
        <div style={{ background: "#fff", padding: "calc(14px + env(safe-area-inset-top)) 16px 10px", textAlign: "center", borderBottom: `1px solid ${T.line}` }}>
          {/* Trimmed from the desktop artifact so the capture box sits within thumb reach on a phone */}
          <img src={LOGO} alt="Creative Appeal Real Estate — CARE" width="520" height="215" style={{ width: "62%", maxWidth: 260, height: "auto" }} />
        </div>
        <div style={{ background: T.navy, padding: "16px 16px 18px", borderRadius: "0 0 20px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 17, color: "#fff", letterSpacing: "-0.01em" }}>
              Ops Board
            </div>
            <button onClick={() => setShowHelp(!showHelp)} style={{ background: "none", border: "none", color: "#F3C9C2", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline", padding: "10px 0 10px 12px", margin: "-10px 0" }}>
              {showHelp ? "close" : "how it works"}
            </button>
          </div>
          <div style={{ color: "#D3E6DA", fontSize: 12.5, marginBottom: 14 }}>
            Capture it the second it lands. Sort it later.
          </div>

          {showHelp && (
            <div style={{ background: T.navyDeep, borderRadius: 12, padding: "12px 14px", marginBottom: 14, color: "#E2F0E7", fontSize: 13, lineHeight: 1.55 }}>
              <b style={{ color: "#FFB3A5" }}>1. Capture</b> — anything that pops up goes in the box below. No sorting, no thinking.<br />
              <b style={{ color: "#FFB3A5" }}>2. Triage</b> — when you get a minute, open Inbox, tap each item, tag it and move it to Today / This Week / Waiting.<br />
              <b style={{ color: "#FFB3A5" }}>3. Do</b> — work only from Today.<br />
              <b style={{ color: "#FFB3A5" }}>4. Review</b> — 2 mins at day's end: empty the Inbox, pull tomorrow's Today, chase anything in Waiting. Ageing items turn amber, then red — they refuse to be forgotten.

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 12, paddingTop: 12, fontSize: 12.5, color: "#C6DCCD" }}>
                Your board is stored on this device only — it isn't shared between phones.
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={exportBackup} style={{ flex: 1, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "12px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>
                    Back up
                  </button>
                  <button onClick={() => fileRef.current && fileRef.current.click()} style={{ flex: 1, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "12px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>
                    Restore
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="application/json,.json" onChange={importBackup} style={{ display: "none" }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="e.g. Flat 3 boiler — call landlord"
              enterKeyHint="done"
              autoCapitalize="sentences"
              autoCorrect="on"
              style={{ flex: 1, minWidth: 0, border: "none", borderRadius: 12, padding: "13px 14px", background: "#fff" }}
            />
            <button
              onClick={addTask}
              style={{ background: T.gold, color: "#fff", border: "none", borderRadius: 12, padding: "0 18px", fontWeight: 800, fontSize: 14, cursor: "pointer", minHeight: 48 }}
            >Add</button>
          </div>
        </div>

        {/* Add to Home Screen hint — iOS Safari, first visit only */}
        {showInstallHint && (
          <div style={{ margin: "12px 16px 0", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 13px", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <b style={{ color: T.ink }}>Add this to your Home Screen</b> — tap the Share button, then <b>Add to Home Screen</b>. It then opens like a normal app, full screen and offline.
            </div>
            <button onClick={dismissInstallHint} aria-label="Dismiss" style={{ background: "none", border: "none", color: T.inkSoft, fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "10px 6px", margin: "-10px -6px -10px 0", minWidth: 44, minHeight: 44 }}>×</button>
          </div>
        )}

        {/* At-risk banner */}
        {atRisk > 0 && (
          <div style={{ margin: "12px 16px 0", background: "#F6E3DF", color: T.red, borderRadius: 10, padding: "9px 13px", fontSize: 13, fontWeight: 600 }}>
            {atRisk} item{atRisk > 1 ? "s" : ""} getting old — worth a look before {atRisk > 1 ? "they slip" : "it slips"}.
          </div>
        )}

        {/* Tabs */}
        <div className="care-scroll" style={{ display: "flex", gap: 6, padding: "14px 16px 4px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              style={{
                border: "none", cursor: "pointer", whiteSpace: "nowrap",
                background: tab === tb.id ? T.navy : "#EDEAE1",
                color: tab === tb.id ? "#fff" : T.inkSoft,
                borderRadius: 99, padding: "10px 14px", fontSize: 13, fontWeight: 700,
                minHeight: 40, flexShrink: 0,
              }}
            >
              {tb.label}
              {counts[tb.id] > 0 && (
                <span style={{ marginLeft: 6, background: tab === tb.id ? T.gold : "#fff", color: tab === tb.id ? "#fff" : T.inkSoft, borderRadius: 99, padding: "1px 7px", fontSize: 11.5 }}>
                  {counts[tb.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Nudge on Today if inbox has items */}
        {tab === "today" && counts.inbox > 0 && (
          <div style={{ margin: "8px 16px 0", fontSize: 12.5, color: T.inkSoft }}>
            {counts.inbox} untriaged in Inbox — sort them when you get a minute.
          </div>
        )}

        {/* List */}
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {!loaded && <div style={{ color: T.inkSoft, fontSize: 14, padding: 20, textAlign: "center" }}>Loading your board…</div>}

          {loaded && list.length === 0 && (
            <div style={{ textAlign: "center", padding: "36px 20px", color: T.inkSoft, fontSize: 14, lineHeight: 1.5 }}>
              {tab === "inbox" && "Inbox clear — everything's been sorted. Anything new goes in the box above."}
              {tab === "today" && "Nothing lined up for today. Pull items in from Inbox or This Week."}
              {tab === "week" && "Nothing parked for this week yet."}
              {tab === "waiting" && "Not waiting on anyone right now."}
              {tab === "done" && "Nothing finished yet — it'll show here when you tick things off."}
            </div>
          )}

          {list.map((t) => (
            <div
              key={t.id}
              onClick={() => setEditing(t.id)}
              style={{
                background: T.card, borderRadius: 14, padding: "13px 14px", cursor: "pointer",
                border: `1px solid ${T.line}`, opacity: t.status === "done" ? 0.65 : 1,
              }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, textDecoration: t.status === "done" ? "line-through" : "none", marginBottom: 7, wordBreak: "break-word" }}>
                {t.title}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <CatDot task={t} />
                {t.property && <span style={{ fontSize: 11.5, color: T.inkSoft }}>📍 {t.property}</span>}
                {t.status === "waiting" && t.waitingOn && (
                  <span style={{ fontSize: 11.5, color: T.navySoft, fontWeight: 600 }}>⏳ {t.waitingOn}</span>
                )}
                <span style={{ marginLeft: "auto" }}><AgeChip task={t} /></span>
              </div>
            </div>
          ))}

          {tab === "done" && list.length > 0 && (
            <button onClick={clearDone} style={{ margin: "8px auto 0", background: "none", border: `1px solid ${T.line}`, borderRadius: 99, padding: "10px 16px", fontSize: 12.5, color: T.inkSoft, cursor: "pointer" }}>
              Clear finished items
            </button>
          )}
        </div>
      </div>

      {/* Edit sheet */}
      {editTask && (
        <div
          onClick={() => setEditing(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(19,31,56,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: T.paper, width: "100%", maxWidth: 520, borderRadius: "20px 20px 0 0", padding: "18px 16px calc(26px + env(safe-area-inset-bottom))", maxHeight: "85dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
          >
            <div style={{ width: 38, height: 4, borderRadius: 99, background: T.line, margin: "-6px auto 14px" }} />

            <input
              value={editTask.title}
              onChange={(e) => update(editTask.id, { title: e.target.value })}
              style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 10, padding: "11px 12px", fontWeight: 600, background: "#fff", marginBottom: 14 }}
            />

            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>What is it?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => update(editTask.id, { category: editTask.category === c.id ? null : c.id })}
                  style={{
                    border: `1.5px solid ${editTask.category === c.id ? c.color : T.line}`,
                    background: editTask.category === c.id ? c.color : "#fff",
                    color: editTask.category === c.id ? "#fff" : T.ink,
                    borderRadius: 99, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", minHeight: 40,
                  }}
                >{c.label}</button>
              ))}
            </div>

            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>When?</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <MoveBtn to="today" label="Today" current={editTask.status} id={editTask.id} />
              <MoveBtn to="week" label="This Week" current={editTask.status} id={editTask.id} />
              <MoveBtn to="waiting" label="Waiting" current={editTask.status} id={editTask.id} />
              <MoveBtn to="inbox" label="Inbox" current={editTask.status} id={editTask.id} />
            </div>

            {editTask.status === "waiting" && (
              <input
                value={editTask.waitingOn}
                onChange={(e) => update(editTask.id, { waitingOn: e.target.value })}
                placeholder="Waiting on who? e.g. landlord, council, contractor"
                style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", background: "#fff", marginBottom: 16 }}
              />
            )}

            <input
              value={editTask.property}
              onChange={(e) => update(editTask.id, { property: e.target.value })}
              placeholder="Property / placement (optional)"
              style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", background: "#fff", marginBottom: 10 }}
            />
            <textarea
              value={editTask.note}
              onChange={(e) => update(editTask.id, { note: e.target.value })}
              placeholder="Notes (optional)"
              rows={2}
              style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", background: "#fff", marginBottom: 18, resize: "vertical" }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => markDone(editTask.id)}
                style={{ flex: 1, background: T.green, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}
              >✓ Done</button>
              <button
                onClick={() => remove(editTask.id)}
                style={{ background: "#fff", color: T.red, border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "14px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
