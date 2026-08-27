// hrcore-ui.jsx — คอมโพเนนต์ที่ใช้ร่วมใน HR Core (DataTable, Drawer, สถานะต่าง ๆ)
const { useState: useH, useMemo: useHM, useEffect: useHE } = React;

/* ---------- Breadcrumb ---------- */
function Crumb({ items }) {
  return (
    <nav className="row wrap" style={{ gap: 6, fontSize: 12.5, color: "var(--text-3)", marginBottom: 4 }} aria-label="เส้นทางหน้า">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icon name="chevRight" size={13} color="var(--text-3)" />}
          {it.onClick
            ? <button onClick={it.onClick} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent)", fontSize: 12.5 }}>{it.label}</button>
            : <span style={{ color: i === items.length - 1 ? "var(--text-2)" : undefined }}>{it.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

/* ---------- สถานะว่าง / กำลังโหลด / ผิดพลาด ---------- */
function EmptyState({ icon, title, sub, action }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 20px" }}>
      <span style={{ color: "var(--text-3)" }}><Icon name={icon || "search"} size={40} /></span>
      <div style={{ fontWeight: 600, marginTop: 12, fontSize: 15 }}>{title}</div>
      {sub && <div className="muted" style={{ fontSize: 13, marginTop: 5, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>{sub}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
function LoadingState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 20px" }}>
      <div className="boot-spin" style={{ margin: "0 auto 14px" }} />
      <div className="muted" style={{ fontSize: 13.5 }}>{text || "กำลังโหลดข้อมูล…"}</div>
    </div>
  );
}
function ErrorState({ text, onRetry }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <span style={{ color: "var(--red)" }}><Icon name="alert" size={38} /></span>
      <div style={{ fontWeight: 600, marginTop: 12 }}>เกิดข้อผิดพลาด</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>{text}</div>
      {onRetry && <button className="btn btn-soft btn-sm" style={{ marginTop: 14 }} onClick={onRetry}><Icon name="refresh" size={14} />ลองใหม่</button>}
    </div>
  );
}

/* ---------- กล่องยืนยัน ---------- */
function Confirm({ title, message, danger, confirmLabel, onConfirm, onClose }) {
  const [busy, setBusy] = useH(false);
  const run = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } };
  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" style={danger ? { background: "var(--red)" } : null} onClick={run} disabled={busy}>
          <Icon name="check" size={15} />{busy ? "กำลังดำเนินการ…" : (confirmLabel || "ยืนยัน")}
        </button>
      </>}>
      <div style={{ fontSize: 14, lineHeight: 1.8 }}>{message}</div>
    </Modal>
  );
}

/* ---------- Drawer (แผงเลื่อนด้านขวา) ---------- */
function HRCDrawer({ title, sub, onClose, children, footer, width }) {
  useHE(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "แผงข้อมูล"}
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: width || 520, maxWidth: "100vw", zIndex: 60,
                 background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-lg)",
                 display: "flex", flexDirection: "column" }}>
        <div className="between" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5 }}>{title}</div>
            {sub && <div className="muted" style={{ fontSize: 12.5 }}>{sub}</div>}
          </div>
          <button className="icon-btn" aria-label="ปิด" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>{children}</div>
        {footer && <div style={{ borderTop: "1px solid var(--border)", padding: "13px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>{footer}</div>}
      </aside>
    </>
  );
}

/* ---------- DataTable : ค้นหา + เรียง + กรอง + แบ่งหน้า + ส่งออก ---------- */
function DataTable({ rows, columns, rowKey, onRowClick, searchFields, filters, toolbar, exportName, pageSize, emptyTitle, emptySub, emptyAction }) {
  const [q, setQ] = useH("");
  const [sort, setSort] = useH({ key: null, dir: 1 });
  const [page, setPage] = useH(1);
  const [fv, setFv] = useH({});
  const per = pageSize || 25;

  const filtered = useHM(() => {
    let r = rows || [];
    (filters || []).forEach((f) => {
      const v = fv[f.key];
      if (v && v !== "all") r = r.filter((x) => f.test(x, v));
    });
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter((x) => (searchFields || []).some((k) => {
        const val = typeof k === "function" ? k(x) : x[k];
        return String(val == null ? "" : val).toLowerCase().includes(s);
      }));
    }
    if (sort.key) {
      const col = columns.find((c) => c.key === sort.key);
      const val = (x) => {
        const v = col && col.sortValue ? col.sortValue(x) : x[sort.key];
        return v == null ? "" : v;
      };
      r = [...r].sort((a, b) => {
        const A = val(a), B = val(b);
        if (typeof A === "number" && typeof B === "number") return (A - B) * sort.dir;
        return String(A).localeCompare(String(B), "th") * sort.dir;
      });
    }
    return r;
  }, [rows, q, sort, fv, filters, columns]);

  useHE(() => { setPage(1); }, [q, fv]);
  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const curPage = Math.min(page, pages);
  const view = filtered.slice((curPage - 1) * per, curPage * per);

  const doSort = (k) => setSort((p) => ({ key: k, dir: p.key === k ? -p.dir : 1 }));
  const doExport = () => {
    const cols = columns.filter((c) => c.export !== false);
    window.downloadCSV((exportName || "export") + ".csv", cols.map((c) => c.label),
      filtered.map((r) => cols.map((c) => {
        const v = c.exportValue ? c.exportValue(r) : (c.sortValue ? c.sortValue(r) : r[c.key]);
        return v == null ? "" : String(v);
      })));
    toast("ส่งออก " + filtered.length + " รายการแล้ว", "download");
  };

  return (
    <div>
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 11, paddingBottom: 6 }}>
        <div className="row wrap" style={{ gap: 9 }}>
          <input className="input" style={{ flex: "1 1 220px", minWidth: 170 }} aria-label="ค้นหา"
            placeholder="ค้นหา…" value={q} onChange={(e) => setQ(e.target.value)} />
          {(filters || []).map((f) => (
            <select key={f.key} className="select" style={{ flex: "0 1 " + (f.width || 180) + "px" }} aria-label={f.label}
              value={fv[f.key] || "all"} onChange={(e) => setFv((p) => ({ ...p, [f.key]: e.target.value }))}>
              <option value="all">{f.label} : ทั้งหมด</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          <div className="spacer" style={{ flex: 1 }} />
          {toolbar}
          {exportName && <button className="btn btn-ghost btn-sm" onClick={doExport}><Icon name="download" size={14} />ส่งออก</button>}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          พบ {filtered.length} รายการ{filtered.length !== (rows || []).length ? " (จากทั้งหมด " + (rows || []).length + ")" : ""}
        </div>
      </div>

      <div className="card-pad" style={{ paddingTop: 0, overflowX: "auto" }}>
        {view.length === 0 ? <EmptyState icon="search" title={emptyTitle || "ไม่พบข้อมูล"} sub={emptySub} action={emptyAction} /> : (
          <table className="tbl" style={{ minWidth: 640, fontSize: 13 }}>
            <thead><tr>
              {columns.map((c) => (
                <th key={c.key} scope="col"
                  style={{ textAlign: c.align || "left", whiteSpace: "nowrap", cursor: c.sortable === false ? "default" : "pointer", width: c.width }}
                  onClick={c.sortable === false ? undefined : () => doSort(c.key)}>
                  {c.label}
                  {sort.key === c.key && <span style={{ marginLeft: 4, color: "var(--accent)" }}>{sort.dir > 0 ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {view.map((r) => (
                <tr key={rowKey ? rowKey(r) : r.id} onClick={onRowClick ? () => onRowClick(r) : undefined}
                  style={onRowClick ? { cursor: "pointer" } : undefined}>
                  {columns.map((c) => <td key={c.key} style={{ textAlign: c.align || "left" }}>{c.render ? c.render(r) : (r[c.key] == null ? "—" : String(r[c.key]))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="between card-pad" style={{ paddingTop: 0, gap: 10 }}>
          <span className="muted" style={{ fontSize: 12.5 }}>หน้า {curPage} จาก {pages}</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}><Icon name="chevLeft" size={14} />ก่อนหน้า</button>
            <button className="btn btn-ghost btn-sm" disabled={curPage >= pages} onClick={() => setPage(curPage + 1)}>ถัดไป<Icon name="chevRight" size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function HRCToggle({ on, onChange }) {
  return (
    <button role="switch" aria-checked={!!on} onClick={() => onChange(!on)}
      style={{ width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer", padding: 2,
               background: on ? "var(--accent)" : "var(--surface-3)", display: "flex",
               justifyContent: on ? "flex-end" : "flex-start", transition: "background .15s" }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "#fff", display: "block" }} />
    </button>
  );
}

Object.assign(window, { Crumb, EmptyState, LoadingState, ErrorState, Confirm, HRCDrawer, DataTable, HRCToggle });
