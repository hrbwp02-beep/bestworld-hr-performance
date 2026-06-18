// ui.jsx — shared UI components
const { useState, useEffect, useRef } = React;

function Avatar({ name, initials, src, size = 40, color, female, fontSize }) {
  const fg = color || "#2563eb";
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: fontSize || size * 0.38,
      background: src ? "none" : `linear-gradient(135deg, ${fg}, ${fg}bb)` }} title={name}>
      {src ? <img src={src} alt={name} /> : (initials || (name || "?").slice(0, 1))}
    </div>
  );
}

function Badge({ children, cls = "b-gray", dot }) {
  return <span className={"badge " + cls}>{dot && <span className="bdot" />}{children}</span>;
}

function ScoreBadge({ score }) {
  const b = window.bandOf(score);
  return <span className={"badge " + b.cls}><span className="bdot" />{b.key} · {b.label}</span>;
}

function Card({ children, className = "", style, pad }) {
  return <div className={"card " + className} style={style}>{pad ? <div className="card-pad">{children}</div> : children}</div>;
}

function CardHead({ title, sub, right }) {
  return (
    <div className="card-head">
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
      </div>
      {right && <div style={{ flex: "0 0 auto", marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

function Stat({ icon, label, value, unit, delta, deltaDir, tone = "#2563eb", soft = "#e8effb", sub }) {
  return (
    <div className="stat fade-up">
      <div className="between">
        <div className="ico" style={{ background: soft, color: tone }}><Icon name={icon} size={21} /></div>
        {delta != null && (
          <span className={"delta " + (deltaDir || (delta >= 0 ? "up" : "down"))}>
            <Icon name={delta >= 0 ? "arrowUp" : "arrowDown"} size={13} stroke={2.6} />
            {Math.abs(delta)}{typeof delta === "number" && Number.isInteger(delta) === false ? "" : ""}%
          </span>
        )}
      </div>
      <div>
        <div className="lab">{label}</div>
        <div className="val" style={{ marginTop: 6 }}>{value}{unit && <small> {unit}</small>}</div>
      </div>
      {sub && <div className="muted" style={{ fontSize: 12.5, marginTop: -2 }}>{sub}</div>}
    </div>
  );
}

function ScoreBar({ value, max = 100, color, height = 8, showVal }) {
  const b = window.bandOf(value);
  const c = color || b.color;
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW((value / max) * 100), 60); return () => clearTimeout(t); }, [value, max]);
  return (
    <div className="row" style={{ gap: 10 }}>
      <div className="pbar" style={{ flex: 1, height }}>
        <span style={{ width: w + "%", background: c }} />
      </div>
      {showVal && <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: c, minWidth: 34, textAlign: "right" }}>{value}</span>}
    </div>
  );
}

function Ring({ value, size = 132, stroke = 12, color, label, sub, track = "#eef1f7" }) {
  const b = window.bandOf(value);
  const c = color || b.color;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [off, setOff] = useState(circ);
  useEffect(() => { const t = setTimeout(() => setOff(circ * (1 - value / 100)), 80); return () => clearTimeout(t); }, [value, circ]);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: size * 0.27, fontWeight: 700, lineHeight: 1, fontFamily: "var(--mono)", color: "var(--text)" }}>{value}</div>
          {label && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{label}</div>}
          {sub}
        </div>
      </div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={active === t.id ? "on" : ""} onClick={() => onChange(t.id)}>
          {t.label}{t.count != null && <span className="muted-3" style={{ marginLeft: 6, fontSize: 12 }}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lab = typeof o === "string" ? o : o.label;
        return <button key={val} className={value === val ? "on" : ""} onClick={() => onChange(val)}>{lab}</button>;
      })}
    </div>
  );
}

function Drawer({ title, sub, onClose, children, footer, width }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" style={width ? { width } : null}>
        <div className="card-head" style={{ flex: "0 0 auto" }}>
          <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>{children}</div>
        {footer && <div style={{ flex: "0 0 auto", borderTop: "1px solid var(--border)", padding: "14px 22px", display: "flex", gap: 10, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </>
  );
}

function Modal({ title, onClose, children, footer }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const node = ref.current;
    const first = node && node.querySelector(sel);
    if (first) first.focus();
    const h = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && node) {
        const f = [...node.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="card-head"><div><h3>{title}</h3></div><div className="spacer" /><button className="icon-btn" aria-label="ปิด" onClick={onClose}><Icon name="x" size={18} /></button></div>
        <div style={{ padding: "20px 22px", maxHeight: "70vh", overflowY: "auto" }}>{children}</div>
        {footer && <div style={{ borderTop: "1px solid var(--border)", padding: "14px 22px", display: "flex", gap: 10, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </>
  );
}

// toast system
let _toastFn = null;
function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    _toastFn = (msg, icon = "checkCircle") => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, msg, icon }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 2800);
    };
  }, []);
  return (
    <div className="toast-wrap">
      {items.map((i) => (
        <div className="toast" key={i.id}><Icon name={i.icon} size={18} color="#5b8def" />{i.msg}</div>
      ))}
    </div>
  );
}
function toast(msg, icon) { _toastFn && _toastFn(msg, icon); }

// star rating input (1-5)
function Stars({ value, onChange, size = 22, readOnly }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="row" style={{ gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (hover || value) >= n;
        return (
          <button key={n} disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(n)} onMouseLeave={() => !readOnly && setHover(0)}
            onClick={() => !readOnly && onChange(n)}
            style={{ background: "none", border: "none", cursor: readOnly ? "default" : "pointer", padding: 0, lineHeight: 0 }}>
            <Icon name="star" size={size} color={on ? "#f0a500" : "#d6deea"} fill={on ? "#f0a500" : "none"} stroke={1.8} />
          </button>
        );
      })}
    </div>
  );
}

function EmptyImg({ label, height = 160, style }) {
  return <div className="placeholder-img" style={{ height, ...style }}>{label}</div>;
}

Object.assign(window, {
  Avatar, Badge, ScoreBadge, Card, CardHead, Stat, ScoreBar, Ring,
  Tabs, Seg, Drawer, Modal, ToastHost, toast, Stars, EmptyImg,
});
