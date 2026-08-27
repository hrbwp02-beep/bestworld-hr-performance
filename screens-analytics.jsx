// screens-analytics.jsx — โมดูลสถิติหน่วยงาน (HR Analytics)
// คำนวณสดจากข้อมูลพนักงาน/ประเมินที่โหลดแล้ว (เคารพขอบเขต window.SCOPE) — ไม่แตะ schema เดิม
const { useState: useS5 } = React;

function HRAnalytics({ ctx }) {
  const R = window.scopeEmployees(window.EMPLOYEES || []);
  const DEPTS = (window.DEPARTMENTS || []).filter((d) => window.inScope(d.id) && R.some((e) => e.dept === d.id));
  const total = R.length;
  const nowY = new Date().getFullYear();

  const tenYears = (e) => { if (e.tenure_years != null) return e.tenure_years; if (!e.hire_date) return null; const d = new Date(e.hire_date); return isNaN(d) ? null : (Date.now() - d) / (365.25 * 86400 * 1000); };
  const avg = (arr, f) => { const v = arr.map(f).filter((x) => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const r1 = (x) => Math.round(x * 10) / 10;
  const isNew = (e) => !!e.hire_date && new Date(e.hire_date).getFullYear() === nowY;

  const doneAll = R.filter((e) => e.status === "done");
  const scoredAll = R.filter((e) => e.overall > 0);
  const hiresY = R.filter(isNew).length;

  const rows = DEPTS.map((d) => {
    const es = R.filter((e) => e.dept === d.id);
    const done = es.filter((e) => e.status === "done");
    const scored = es.filter((e) => e.overall > 0);
    const sups = new Set(es.map((e) => e.supervisor_id).filter(Boolean));
    return {
      id: d.id, name: d.name, short: d.short || d.name, color: d.color || "#64748b",
      n: es.length, pct: total ? Math.round(es.length / total * 100) : 0,
      newN: es.filter(isNew).length,
      avgTen: r1(avg(es, tenYears)), avgAge: r1(avg(es, (e) => e.age)),
      span: sups.size ? r1(es.length / sups.size) : 0,
      donePct: es.length ? Math.round(done.length / es.length * 100) : 0,
      avgScore: scored.length ? r1(avg(scored, (e) => e.overall)) : 0,
    };
  }).sort((a, b) => b.n - a.n);
  const maxN = Math.max(1, ...rows.map((x) => x.n));

  // การกระจาย Generation (ตามขอบเขต)
  const GEN_ORDER = ["Baby Boomer", "Gen X", "Gen Y / Millennials", "Gen Z"];
  const PB = ["#2563eb", "#0d9488", "#7c3aed", "#e08a00", "#db2777", "#0891b2"];
  const genCount = {};
  R.forEach((e) => { const g = e.generation || "(ไม่ระบุ)"; genCount[g] = (genCount[g] || 0) + 1; });
  const _gidx = (l) => { const i = GEN_ORDER.indexOf(l); return i === -1 ? 99 : i; };
  const genPie = Object.entries(genCount).sort((a, b) => _gidx(a[0]) - _gidx(b[0]))
    .map(([label, v], i) => ({ label, v, color: PB[i % PB.length] }));

  const scopeLabel = window.SCOPE && window.SCOPE.all ? "ทั้งองค์กร" : (DEPTS.map((d) => d.short || d.name).join(", ") || "หน่วยงานของคุณ");

  const exportCSV = () => {
    window.downloadCSV("hr_analytics_departments.csv",
      ["หน่วยงาน", "จำนวน", "สัดส่วน%", "เข้าใหม่ปีนี้", "อายุงานเฉลี่ย", "อายุเฉลี่ย", "ช่วงบังคับบัญชา", "ประเมินแล้ว%", "คะแนนเฉลี่ย"],
      rows.map((x) => [x.name, x.n, x.pct, x.newN, x.avgTen, x.avgAge, x.span, x.donePct, x.avgScore]));
    toast("ส่งออกสถิติหน่วยงานแล้ว", "download");
  };

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>สถิติหน่วยงาน (HR Analytics)</h1><p>เปรียบเทียบกำลังคนและผลงานรายหน่วยงาน · {scopeLabel}</p></div>
        <button className="btn btn-pri" onClick={exportCSV}><Icon name="download" size={16} />Export Excel</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))" }}>
        <Stat icon="users" label="พนักงาน (ในขอบเขต)" value={total} unit="คน" tone="#2563eb" soft="#e8effb" sub={DEPTS.length + " หน่วยงาน"} />
        <Stat icon="briefcase" label="อายุงานเฉลี่ย" value={r1(avg(R, tenYears))} unit="ปี" tone="#0d9488" soft="#e2f4f2" />
        <Stat icon="calendar" label="อายุเฉลี่ย" value={r1(avg(R, (e) => e.age))} unit="ปี" tone="#7c3aed" soft="#f1ebfd" />
        <Stat icon="employee" label={"เข้าใหม่ปี " + nowY} value={hiresY} unit="คน" tone="#e08a00" soft="#fdf1dc" />
        <Stat icon="checkCircle" label="ประเมินแล้ว" value={total ? Math.round(doneAll.length / total * 100) : 0} unit="%" tone="#16a34a" soft="#e7f6ec" sub={doneAll.length + "/" + total + " คน"} />
      </div>

      <Card>
        <CardHead title="เปรียบเทียบรายหน่วยงาน" sub="เรียงตามจำนวนพนักงาน · ช่วงบังคับบัญชา = พนักงานต่อหัวหน้า 1 คน" />
        <div className="card-pad" style={{ overflowX: "auto" }}>
          {rows.length === 0 ? <div className="muted" style={{ textAlign: "center", padding: "24px 0", fontSize: 13 }}>ยังไม่มีข้อมูลในขอบเขตของคุณ</div> : (
            <table className="tbl" style={{ minWidth: 720, fontSize: 13 }}>
              <thead><tr>
                <th scope="col">หน่วยงาน</th>
                <th scope="col">จำนวน</th>
                <th scope="col" style={{ textAlign: "center" }}>เข้าใหม่</th>
                <th scope="col" style={{ textAlign: "center" }}>อายุงาน</th>
                <th scope="col" style={{ textAlign: "center" }}>อายุ</th>
                <th scope="col" style={{ textAlign: "center" }}>ช่วงบังคับบัญชา</th>
                <th scope="col" style={{ textAlign: "center" }}>ประเมินแล้ว</th>
                <th scope="col" style={{ textAlign: "center" }}>คะแนนเฉลี่ย</th>
              </tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td style={{ minWidth: 150 }}><div className="row" style={{ gap: 9 }}><span className="tag-dot" style={{ background: x.color, width: 10, height: 10, flex: "0 0 10px" }} /><span style={{ fontWeight: 600 }}>{x.name}</span></div></td>
                    <td style={{ minWidth: 150 }}>
                      <div className="row" style={{ gap: 9 }}>
                        <div style={{ flex: 1, height: 8, borderRadius: 5, background: "var(--surface-3)", overflow: "hidden", minWidth: 60 }}>
                          <div style={{ width: (x.n / maxN * 100) + "%", height: "100%", background: x.color }} />
                        </div>
                        <span className="mono" style={{ fontWeight: 600, minWidth: 46, textAlign: "right" }}>{x.n} · {x.pct}%</span>
                      </div>
                    </td>
                    <td className="mono" style={{ textAlign: "center", color: x.newN ? "#16a34a" : "var(--text-3)", fontWeight: x.newN ? 600 : 400 }}>{x.newN || "–"}</td>
                    <td className="mono" style={{ textAlign: "center" }}>{x.avgTen} ปี</td>
                    <td className="mono" style={{ textAlign: "center" }}>{x.avgAge || "–"}</td>
                    <td className="mono" style={{ textAlign: "center" }}>{x.span ? "1 : " + x.span : "–"}</td>
                    <td style={{ textAlign: "center" }}><span className="badge" style={{ background: x.donePct >= 100 ? "var(--green-soft,#e7f6ec)" : "var(--surface-2)", color: x.donePct >= 100 ? "#16a34a" : "var(--text-2)", fontWeight: 600 }}>{x.donePct}%</span></td>
                    <td className="mono" style={{ textAlign: "center", fontWeight: 600 }}>{x.avgScore || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))" }}>
        <Card>
          <CardHead title="คะแนนเฉลี่ยตามหน่วยงาน" sub="เฉพาะหน่วยงานที่มีผลประเมิน" />
          <div className="card-pad">
            {rows.some((x) => x.avgScore > 0) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {rows.filter((x) => x.avgScore > 0).sort((a, b) => b.avgScore - a.avgScore).map((x) => (
                  <div key={x.id} className="row" style={{ gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, minWidth: 96, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.short}</span>
                    <div style={{ flex: 1, height: 20, borderRadius: 6, background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{ width: Math.min(100, x.avgScore) + "%", height: "100%", background: x.color, borderRadius: 6 }} />
                    </div>
                    <span className="mono" style={{ fontWeight: 700, minWidth: 40, textAlign: "right", fontSize: 13 }}>{x.avgScore}</span>
                  </div>
                ))}
              </div>
            ) : <div className="muted" style={{ textAlign: "center", padding: "24px 0", fontSize: 13 }}>ยังไม่มีผลการประเมินในรอบนี้</div>}
          </div>
        </Card>
        <Card>
          <CardHead title="การกระจายช่วงวัย (Generation)" sub="ตามขอบเขตที่เห็น" />
          <div className="card-pad" style={{ display: "grid", placeItems: "center" }}>
            <Donut data={genPie} centerLabel="พนักงาน" centerValue={total} />
          </div>
        </Card>
      </div>

      <div className="note-card" style={{ background: "var(--accent-soft)", color: "var(--accent-700)", borderRadius: 12, padding: "12px 16px", fontSize: 13, lineHeight: 1.7 }}>
        <b>อัตราหมุนเวียน (Turnover) ขาออก</b> ยังไม่แสดง เพราะระบบยังไม่มีข้อมูลการลาออก — เพิ่มได้ในเฟสถัดไป (ฟิลด์ <span style={{ fontFamily: "var(--mono)" }}>resign_date + สถานะการจ้าง</span>) แล้วสถิติเข้า–ออกจะคำนวณอัตโนมัติ
      </div>
    </div>
  );
}

Object.assign(window, { HRAnalytics });
