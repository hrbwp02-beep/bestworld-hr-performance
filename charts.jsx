// charts.jsx — bespoke SVG charts (responsive, animated, hover)
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

function useMounted(delay = 80) {
  const [on, setOn] = useStateC(false);
  useEffectC(() => { const t = setTimeout(() => setOn(true), delay); return () => clearTimeout(t); }, []);
  return on;
}

// ---------- Vertical bar chart (KPI by department) ----------
function BarChart({ data, height = 260, max = 100, valueKey = "score", labelKey = "short", unit = "", baseline }) {
  const on = useMounted();
  const [hi, setHi] = useStateC(-1);
  const W = 760, padL = 36, padB = 34, padT = 14;
  const innerW = W - padL - 12, innerH = height - padB - padT;
  const bw = innerW / data.length;
  const grid = [0, 25, 50, 75, 100].map((g) => g * (max / 100));
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        {grid.map((g, i) => {
          const y = padT + innerH * (1 - g / max);
          return (<g key={i}>
            <line x1={padL} y1={y} x2={W - 12} y2={y} stroke="#eef1f7" strokeWidth="1" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#93a1b8" fontFamily="var(--mono)">{Math.round(g)}</text>
          </g>);
        })}
        {baseline != null && (() => { const y = padT + innerH * (1 - baseline / max);
          return <line x1={padL} y1={y} x2={W - 12} y2={y} stroke="#e11d48" strokeWidth="1.5" strokeDasharray="5 4" />; })()}
        {data.map((d, i) => {
          const v = d[valueKey];
          const h = on ? innerH * (v / max) : 0;
          const x = padL + i * bw + bw * 0.22;
          const w = bw * 0.56;
          const y = padT + innerH - h;
          const c = d.color || "#2563eb";
          return (
            <g key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)} style={{ cursor: "pointer" }}>
              <rect x={padL + i * bw} y={padT} width={bw} height={innerH} fill={hi === i ? "rgba(37,99,235,.05)" : "transparent"} />
              <rect x={x} y={y} width={w} height={h} rx="5" fill={c} opacity={hi === -1 || hi === i ? 1 : .45}
                style={{ transition: "height .7s cubic-bezier(.22,1,.36,1), y .7s cubic-bezier(.22,1,.36,1), opacity .2s" }} />
              <text x={x + w / 2} y={y - 7} textAnchor="middle" fontSize="12" fontWeight="600" fill="#16223a"
                opacity={on ? 1 : 0} style={{ transition: "opacity .5s .4s", fontFamily: "var(--mono)" }}>{v}</text>
              <text x={padL + i * bw + bw / 2} y={height - 12} textAnchor="middle" fontSize="11.5" fill="#5b6b86">{d[labelKey]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- Line chart (trend, two series) ----------
function LineChart({ data, prev, height = 260, max = 100, min = 70 }) {
  const on = useMounted();
  const [hi, setHi] = useStateC(-1);
  const W = 760, padL = 36, padB = 30, padT = 16, padR = 14;
  const innerW = W - padL - padR, innerH = height - padB - padT;
  const xOf = (i) => padL + (innerW * i) / (data.length - 1);
  const yOf = (v) => padT + innerH * (1 - (v - min) / (max - min));
  const path = (arr) => arr.map((d, i) => (i ? "L" : "M") + xOf(i) + " " + yOf(d.v)).join(" ");
  const area = path(data) + ` L${xOf(data.length - 1)} ${padT + innerH} L${padL} ${padT + innerH} Z`;
  const grid = [min, (min + max) / 2, max];
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHi(-1)}>
        <defs>
          <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity=".18" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((g, i) => { const y = yOf(g); return (<g key={i}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eef1f7" />
          <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#93a1b8" fontFamily="var(--mono)">{Math.round(g)}</text>
        </g>); })}
        {prev && <path d={path(prev)} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5 4"
          opacity={on ? 1 : 0} style={{ transition: "opacity 1s .4s ease" }} />}
        <path d={area} fill="url(#areaG)" opacity={on ? 1 : 0} style={{ transition: "opacity .8s .3s" }} />
        <path d={path(data)} fill="none" stroke="#2563eb" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 1600, strokeDashoffset: on ? 0 : 1600, transition: "stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1)" }} />
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setHi(i)}>
            <rect x={xOf(i) - innerW / data.length / 2} y={padT} width={innerW / data.length} height={innerH} fill="transparent" style={{ cursor: "pointer" }} />
            <circle cx={xOf(i)} cy={yOf(d.v)} r={hi === i ? 6 : 4} fill="#fff" stroke="#2563eb" strokeWidth="2.4"
              opacity={on ? 1 : 0} style={{ transition: "opacity .4s .6s, r .15s" }} />
            <text x={xOf(i)} y={height - 10} textAnchor="middle" fontSize="11" fill="#5b6b86">{d.m}</text>
            {hi === i && (
              <g>
                <rect x={xOf(i) - 26} y={yOf(d.v) - 34} width="52" height="22" rx="6" fill="#16223a" />
                <text x={xOf(i)} y={yOf(d.v) - 19} textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff" fontFamily="var(--mono)">{d.v}</text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ---------- Donut chart ----------
function Donut({ data, size = 190, thickness = 30, centerLabel, centerValue }) {
  const on = useMounted();
  const [hi, setHi] = useStateC(-1);
  const total = data.reduce((a, d) => a + d.v, 0);
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="row" style={{ gap: 22, flexWrap: "wrap", justifyContent: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f4fa" strokeWidth={thickness} />
          {data.map((d, i) => {
            const frac = d.v / total;
            const len = circ * frac * (on ? 1 : 0);
            const dash = `${len} ${circ}`;
            const off = -circ * (acc / total);
            acc += d.v;
            return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={hi === i ? thickness + 5 : thickness}
              strokeDasharray={dash} strokeDashoffset={off} strokeLinecap="butt"
              onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)}
              style={{ transition: "stroke-dasharray 1s cubic-bezier(.22,1,.36,1), stroke-width .15s", cursor: "pointer" }} />;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: size * 0.2, fontWeight: 700, fontFamily: "var(--mono)", lineHeight: 1 }}>{hi >= 0 ? data[hi].v : (centerValue ?? total)}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{hi >= 0 ? data[hi].label : (centerLabel || "ทั้งหมด")}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {data.map((d, i) => (
          <div key={i} className="row" style={{ gap: 9, cursor: "pointer", opacity: hi === -1 || hi === i ? 1 : .5 }}
            onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)}>
            <span className="tag-dot" style={{ background: d.color }} />
            <span style={{ fontSize: 13, flex: 1 }}>{d.label}</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{d.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Radar chart (competency) ----------
function Radar({ data, size = 250, max = 100 }) {
  const on = useMounted();
  const cx = size / 2, cy = size / 2, r = size / 2 - 36;
  const n = data.length;
  const ptOf = (i, val) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = r * (val / max) * (on ? 1 : 0);
    return [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)];
  };
  const axisPt = (i, f = 1) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * f * Math.cos(ang), cy + r * f * Math.sin(ang)];
  };
  const poly = data.map((d, i) => ptOf(i, d.v).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: "block", margin: "0 auto", overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <polygon key={i} points={data.map((_, j) => axisPt(j, f).join(",")).join(" ")} fill="none" stroke="#eef1f7" strokeWidth="1" />
      ))}
      {data.map((_, i) => { const [x, y] = axisPt(i); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#eef1f7" />; })}
      <polygon points={poly} fill="rgba(37,99,235,.16)" stroke="#2563eb" strokeWidth="2.4"
        style={{ transition: "all 1s cubic-bezier(.22,1,.36,1)" }} />
      {data.map((d, i) => { const [x, y] = ptOf(i, d.v); return <circle key={i} cx={x} cy={y} r="3.5" fill="#2563eb" />; })}
      {data.map((d, i) => {
        const [x, y] = axisPt(i, 1.18);
        return (<g key={i}>
          <text x={x} y={y} textAnchor="middle" fontSize="11.5" fill="#5b6b86" dominantBaseline="middle">{d.name}</text>
          <text x={x} y={y + 14} textAnchor="middle" fontSize="11" fontWeight="600" fill="#16223a" fontFamily="var(--mono)" dominantBaseline="middle">{d.v}</text>
        </g>);
      })}
    </svg>
  );
}

// ---------- Horizontal bar (ranking) ----------
function HBar({ data, max = 100, valueKey = "score", labelKey = "name", color }) {
  const on = useMounted();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {data.map((d, i) => {
        const v = d[valueKey];
        const b = window.bandOf(v);
        return (
          <div key={i} className="row" style={{ gap: 12 }}>
            <div style={{ width: 22, textAlign: "center", fontWeight: 700, color: i < 3 ? "#16223a" : "var(--text-3)", fontFamily: "var(--mono)", fontSize: 14 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="between" style={{ marginBottom: 5 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d[labelKey]}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: b.color }}>{v}</span>
              </div>
              <div className="pbar" style={{ height: 7 }}>
                <span style={{ width: (on ? (v / max) * 100 : 0) + "%", background: color || d.color || b.color, transitionDelay: i * 60 + "ms" }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Heatmap ----------
function Heatmap({ rows, cols, values, min = 60, max = 95 }) {
  const colFor = (v) => {
    const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
    // red -> amber -> green
    const stops = [[225,29,72],[224,138,0],[22,163,74]];
    const seg = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], (t - 0.5) * 2];
    const [a, b, f] = seg;
    const mix = a.map((c, i) => Math.round(c + (b[i] - c) * f));
    return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
  };
  return (
    <div className="tbl-wrap">
      <table style={{ borderCollapse: "separate", borderSpacing: 4, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ background: "transparent" }} />
            {cols.map((c) => <th key={c} style={{ background: "transparent", textTransform: "none", letterSpacing: 0, padding: "4px 6px", fontSize: 11.5, color: "var(--text-2)", fontWeight: 600 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <td style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", padding: "4px 10px 4px 0", textAlign: "right", color: "var(--text-2)", borderBottom: "none" }}>{r}</td>
              {cols.map((c, ci) => {
                const v = values[ri][ci];
                return <td key={ci} title={`${r} · ${c}: ${v}`} style={{ background: v == null ? "#f1f4fa" : colFor(v), color: "#fff", textAlign: "center", fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600, padding: "11px 6px", borderRadius: 7, borderBottom: "none", cursor: "default" }}>{v == null ? "–" : v}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, { BarChart, LineChart, Donut, Radar, HBar, Heatmap });
