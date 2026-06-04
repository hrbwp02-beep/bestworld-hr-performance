// screens-exec.jsx — Executive drill-down dashboard + Risk alerts
const { useState: useX, useMemo: useXM } = React;

function ExecDashboard({ ctx }) {
  // drill level: company | dept | team
  const [dept, setDept] = useX(ctx.execDept || null);
  const [team, setTeam] = useX(null);

  React.useEffect(() => { if (ctx.execDept) { setDept(ctx.execDept); setTeam(null); } }, [ctx.execDept]);

  const depts = KPI_DEPTS.map((id) => DEPARTMENTS.find((d) => d.id === id)).filter(Boolean)
    .map((d) => ({ ...d, ach: deptAchievement(d.id) }));
  const scoredD = depts.filter((d) => d.ach != null);
  const companyAch = scoredD.length ? Math.round(scoredD.reduce((a, d) => a + d.ach, 0) / scoredD.length * 10) / 10 : null;
  const risks = kpiRisks();

  const crumb = (
    <div className="row wrap" style={{ gap: 7, fontSize: 13.5 }}>
      <button className="crumb" onClick={() => { setDept(null); setTeam(null); }} style={crumbStyle(!dept)}>ทั้งบริษัท</button>
      {dept && <><Icon name="chevRight" size={14} color="var(--text-3)" /><button className="crumb" onClick={() => setTeam(null)} style={crumbStyle(dept && !team)}>{deptName(dept)}</button></>}
      {team && <><Icon name="chevRight" size={14} color="var(--text-3)" /><span style={crumbStyle(true)}>{TEAMS.find((t) => t.id === team)?.name}</span></>}
    </div>
  );

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>มุมมองผู้บริหาร</h1><p>เจาะลึก KPI จากระดับบริษัท → หน่วยงาน → ทีม → รายบุคคล</p></div>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="seg">{(() => { const y = +(window.CYCLE_YEAR || 2569); return <Seg options={[{ value: String(y), label: "ปี " + y }, { value: String(y - 1), label: "ปี " + (y - 1) }]} value={ctx.year} onChange={ctx.setYear} />; })()}</div>
          <button className="btn btn-pri" onClick={() => { downloadCSV("executive_kpi.csv", ["หน่วยงาน", "Achievement%", "สถานะ"], KPI_DEPTS.map((id) => { const a = deptAchievement(id); return [deptName(id), a, trafficOf(a).l]; })); toast("ส่งออกรายงานผู้บริหารแล้ว", "download"); }}><Icon name="download" size={16} />รายงานผู้บริหาร</button>
        </div>
      </div>

      <Card className="card-pad" style={{ padding: "14px 20px" }}>{crumb}</Card>

      {/* ===== COMPANY LEVEL ===== */}
      {!dept && (
        <div className="grid fade-up">
          <div className="grid" style={{ gridTemplateColumns: "320px 1fr" }}>
            <Card className="card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <div className="muted" style={{ fontWeight: 600, fontSize: 13.5 }}>KPI Achievement ทั้งบริษัท</div>
              <Ring value={Math.min(companyAch == null ? 0 : companyAch, 100)} size={172} color={trafficOf(companyAch).c} sub={<div className="num" style={{ fontSize: 14, fontWeight: 700, color: trafficOf(companyAch).c, marginTop: 2 }}>{companyAch == null ? "รอผล" : companyAch + "%"}</div>} />
              <Badge cls={companyAch == null ? "b-gray" : companyAch >= 100 ? "b-green" : companyAch >= 95 ? "b-amber" : "b-red"} dot>{trafficOf(companyAch).l}</Badge>
              <div className="row" style={{ gap: 22, marginTop: 4 }}>
                <div style={{ textAlign: "center" }}><div className="num" style={{ fontWeight: 700, fontSize: 20, color: "#16a34a" }}>{depts.filter((d) => d.ach >= 100).length}</div><div className="muted" style={{ fontSize: 11.5 }}>บรรลุเป้า</div></div>
                <div style={{ width: 1, background: "var(--border)" }} />
                <div style={{ textAlign: "center" }}><div className="num" style={{ fontWeight: 700, fontSize: 20, color: "#e11d48" }}>{depts.filter((d) => d.ach < 95).length}</div><div className="muted" style={{ fontSize: 11.5 }}>ต่ำกว่าเป้า</div></div>
              </div>
            </Card>
            <Card>
              <CardHead title="KPI Achievement ตามหน่วยงาน" sub="คลิกแท่งเพื่อเจาะลึก · เส้นประแดง = เป้า 100%" />
              <div className="card-pad"><BarChart data={depts.map((d) => ({ ...d, score: d.ach == null ? 0 : d.ach, color: trafficOf(d.ach).c }))} max={130} baseline={100} /></div>
            </Card>
          </div>

          <RiskCard risks={risks} ctx={ctx} />

          <Card>
            <CardHead title="เจาะลึกรายหน่วยงาน" sub="คลิกเพื่อดูทีมและตัวชี้วัด" right={<TrafficLegend />} />
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>หน่วยงาน</th><th>จำนวน KPI</th><th>พนักงาน</th><th>Achievement</th><th>สถานะ</th><th>แนวโน้ม</th><th></th></tr></thead>
                <tbody>
                  {depts.map((d) => {
                    const t = trafficOf(d.ach);
                    return (
                      <tr key={d.id} style={{ cursor: "pointer" }} onClick={() => { setDept(d.id); setTeam(null); }}>
                        <td><div className="row" style={{ gap: 10 }}><span className="tag-dot" style={{ background: d.color, width: 11, height: 11 }} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{d.name}</span></div></td>
                        <td className="num">{kpisOf(d.id).length}</td>
                        <td className="num">{d.head}</td>
                        <td><div className="row" style={{ gap: 10 }}><div style={{ flex: 1, maxWidth: 120 }}><ScoreBar value={Math.min(d.ach, 100)} color={t.c} /></div><span className="num" style={{ fontWeight: 700, color: t.c, minWidth: 44 }}>{d.ach}%</span></div></td>
                        <td><span className="row" style={{ gap: 7 }}><TrafficDot score={d.ach} /><span style={{ fontSize: 12.5, color: t.c, fontWeight: 600 }}>{t.l}</span></span></td>
                        <td><span className={"delta " + (d.trend >= 0 ? "up" : "down")}><Icon name={d.trend >= 0 ? "arrowUp" : "arrowDown"} size={13} stroke={2.6} />{Math.abs(d.trend)}</span></td>
                        <td><Icon name="chevRight" size={16} color="var(--text-3)" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ===== DEPARTMENT LEVEL ===== */}
      {dept && !team && (() => {
        const d = DEPARTMENTS.find((x) => x.id === dept);
        const ach = deptAchievement(dept);
        const t = trafficOf(ach);
        const teams = teamsOf(dept);
        const kpis = kpisOf(dept).map((k) => ({ ...k, score: kpiScore(k) }));
        const members = EMPLOYEES.filter((e) => e.dept === dept);
        return (
          <div className="grid fade-up">
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))" }}>
              <Stat icon="target" label="Achievement หน่วยงาน" value={ach == null ? "—" : ach} unit={ach == null ? "" : "%"} tone={t.c} soft={t.soft} sub={t.l} />
              <Stat icon="deptkpi" label="ตัวชี้วัด" value={kpis.length} unit="KPI" tone="#2563eb" soft="#e8effb" sub={`${kpis.filter((k) => k.score >= 100).length} บรรลุเป้า`} />
              <Stat icon="users" label="พนักงาน" value={d.head} unit="คน" tone="#0d9488" soft="#e2f4f2" sub={`${teams.length} ทีม`} />
              <Stat icon="trend" label="แนวโน้ม YoY" value={(d.trend >= 0 ? "+" : "") + d.trend} tone={d.trend >= 0 ? "#16a34a" : "#e11d48"} soft={d.trend >= 0 ? "#e7f6ec" : "#fbe7ec"} sub="เทียบปีก่อน" />
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
              <Card>
                <CardHead title={`ตัวชี้วัดของ ${d.name}`} sub="Achievement รายตัวชี้วัด" right={<TrafficLegend />} />
                <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  {kpis.map((k) => {
                    const kt = trafficOf(k.score);
                    return (
                      <div key={k.id} className="row" style={{ gap: 12 }}>
                        <TrafficDot score={k.score} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="between" style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>{k.name}</span>
                            <span className="muted" style={{ fontSize: 11.5 }}>เป้า {k.target.y}{k.unit} · จริง {k.actual == null ? "—" : k.actual + (k.unit || "")}</span>
                          </div>
                          <div className="row" style={{ gap: 10 }}><div style={{ flex: 1 }}><ScoreBar value={Math.min(k.score == null ? 0 : k.score, 100)} color={kt.c} height={7} /></div><span className="num" style={{ fontWeight: 700, color: kt.c, minWidth: 44 }}>{k.score == null ? "รอผล" : k.score + "%"}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
              <Card>
                <CardHead title="แนวโน้มหน่วยงาน" sub="Achievement รายเดือน" />
                <div className="card-pad"><LineChart data={deptKpiTrend(dept)} height={230} min={85} max={105} /></div>
              </Card>
            </div>

            <Card>
              <CardHead title="ทีมงานในหน่วยงาน" sub="คลิกเพื่อเจาะลึกระดับทีม" right={<Badge cls="b-blue" dot>{teams.length} ทีม</Badge>} />
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", padding: 18 }}>
                {teams.map((tm) => {
                  const lead = EMPLOYEES.find((e) => e.id === tm.lead);
                  const tt = trafficOf(tm.ach);
                  const tmMembers = members.filter((m) => m.dept === dept).slice(0, 4);
                  return (
                    <button key={tm.id} onClick={() => setTeam(tm.id)} className="card" style={{ textAlign: "left", cursor: "pointer", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div className="between"><b style={{ fontSize: 14 }}>{tm.name}</b><TrafficDot score={tm.ach} size={11} /></div>
                      <div className="row" style={{ alignItems: "baseline", gap: 5 }}><span className="num" style={{ fontWeight: 700, fontSize: 23, color: tt.c }}>{tm.ach}</span><span className="muted" style={{ fontSize: 12 }}>% achievement</span></div>
                      <div className="between" style={{ borderTop: "1px solid var(--border-2)", paddingTop: 11 }}>
                        <div className="av-stack">{tmMembers.map((m) => <Avatar key={m.id} name={m.name} initials={m.initials} color={m.color} size={28} fontSize={11} />)}</div>
                        <span className="muted row" style={{ fontSize: 12, gap: 4 }}>ดูทีม <Icon name="chevRight" size={13} /></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* ===== TEAM LEVEL ===== */}
      {dept && team && (() => {
        const tm = TEAMS.find((x) => x.id === team);
        const tt = trafficOf(tm.ach);
        const members = EMPLOYEES.filter((e) => e.dept === dept);
        const lead = EMPLOYEES.find((e) => e.id === tm.lead);
        return (
          <div className="grid fade-up">
            <div className="grid" style={{ gridTemplateColumns: "320px 1fr" }}>
              <Card className="card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <div className="muted" style={{ fontWeight: 600, fontSize: 13.5 }}>{tm.name}</div>
                <Ring value={Math.min(tm.ach, 100)} size={150} color={tt.c} sub={<div className="num" style={{ fontSize: 13, fontWeight: 700, color: tt.c, marginTop: 2 }}>{tm.ach}%</div>} />
                {lead && <div className="row" style={{ gap: 9, marginTop: 4 }}><Avatar name={lead.name} initials={lead.initials} color={lead.color} size={32} /><div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{lead.name}</div><div className="muted" style={{ fontSize: 11 }}>หัวหน้าทีม</div></div></div>}
              </Card>
              <Card>
                <CardHead title="สมาชิกทีม · คะแนนรายบุคคล" sub="คลิกเพื่อดูโปรไฟล์" right={<Badge cls="b-blue" dot>{members.length} คน</Badge>} />
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>KPI</th><th>คะแนนรวม</th><th>เกรด</th><th></th></tr></thead>
                    <tbody>
                      {members.map((e) => (
                        <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => ctx.openEmp(e.id)}>
                          <td><div className="row" style={{ gap: 10 }}><Avatar name={e.name} initials={e.initials} color={e.color} size={34} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</span></div></td>
                          <td className="muted" style={{ fontSize: 13 }}>{e.position}</td>
                          <td><div className="row" style={{ gap: 8 }}><TrafficDot score={e.kpi} /><span className="num" style={{ fontWeight: 600 }}>{e.kpi}</span></div></td>
                          <td><span className="num" style={{ fontWeight: 700, color: e.band.color }}>{e.overall}</span></td>
                          <td><span className={"badge " + e.band.cls}>{e.band.key}</span></td>
                          <td><Icon name="chevRight" size={16} color="var(--text-3)" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function crumbStyle(active) {
  return { background: "none", border: "none", cursor: active ? "default" : "pointer", padding: 0, fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? "var(--text)" : "var(--accent)", fontFamily: "inherit", whiteSpace: "nowrap" };
}

function RiskCard({ risks, ctx }) {
  return (
    <Card style={{ border: "1px solid #f3c9b0" }}>
      <div className="card-head" style={{ background: "var(--amber-soft)55", borderBottom: "1px solid #f3d9c0" }}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "#fbe7ec", color: "#e11d48", display: "grid", placeItems: "center" }}><Icon name="alert" size={19} /></span>
          <div><h3>การแจ้งเตือนความเสี่ยง (Risk Alert)</h3><p>KPI ที่ต่ำกว่าเป้าหรือมีแนวโน้มลดลง ต้องเฝ้าระวัง</p></div>
        </div>
        <div className="spacer" />
        <Badge cls="b-red" dot>{risks.length} รายการ</Badge>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", padding: 16 }}>
        {risks.map((k) => {
          const t = trafficOf(k.score);
          return (
            <button key={k.id} onClick={() => ctx.goExec(k.dept)} className="row" style={{ gap: 12, border: `1px solid ${t.c}33`, background: t.soft + "44", borderRadius: 12, padding: "13px 15px", cursor: "pointer", textAlign: "left" }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: "#fff", display: "grid", placeItems: "center", flex: "0 0 38px", boxShadow: "var(--shadow-xs)" }}>
                <TrafficDot score={k.score} size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.name}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{deptName(k.dept)} · เป้า {k.target.y}{k.unit} / จริง {k.actual}{k.unit}{k.trendDown && <span style={{ color: "#e11d48", fontWeight: 600 }}> · ▼ แนวโน้มลด</span>}</div>
              </div>
              <span className="num" style={{ fontWeight: 700, color: t.c, fontSize: 15 }}>{k.score}%</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

Object.assign(window, { ExecDashboard });
