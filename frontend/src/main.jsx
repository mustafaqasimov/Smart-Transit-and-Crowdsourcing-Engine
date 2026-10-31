import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Bus,
  MapPin,
  Bell,
  ArrowUpRight,
  Clock,
  Users,
  Armchair,
  Navigation,
  ShieldCheck,
  Activity,
  ChevronRight,
  CheckCircle,
  LayoutDashboard,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
const client =
  localStorage.transitClient ||
  (localStorage.transitClient = crypto.randomUUID());
function App() {
  const [data, setData] = useState(null),
    [tab, setTab] = useState("passenger"),
    [selected, setSelected] = useState(null),
    [key, setKey] = useState(""),
    [ops, setOps] = useState(null),
    [session, setSession] = useState(null),
    [stop, setStop] = useState(null),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState(""),
    [showEvents, setShowEvents] = useState(false),
    [error, setError] = useState("");
  async function api(path, body) {
    const r = await fetch("/api" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "X-Operator-Key": key },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const e = await r.json();
      throw Error(
        typeof e.detail === "string" ? e.detail : "Məlumatları yoxlayın",
      );
    }
    return r.json();
  }
  async function refresh() {
    try {
      const d = await api("/dashboard");
      setData(d);
      setSelected((s) => s || d.buses[0]?.id);
      setError("");
      if (key && tab === "operator") setOps(await api("/operator"));
      if (session) {
        const r = await api(
          "/stop-status?session_id=" + encodeURIComponent(session.token),
        );
        setStop(r[0]?.status || null);
      }
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [key, tab, session]);
  async function run(f) {
    try {
      await f();
      await refresh();
    } catch (e) {
      setMessage(e.message);
    }
  }
  if (!data)
    return (
      <div className="loading">
        <Bus size={40} />
        <h2>YolBaku hazırlanır…</h2>
        <p>{error || "Nəqliyyat məlumatları yüklənir"}</p>
        <button onClick={refresh}>Yenilə</button>
      </div>
    );
  const bus = data.buses.find((b) => b.id === selected) || data.buses[0],
    a = bus.analysis,
    events = data.events.filter((e) => e.route === bus.route),
    operator = tab === "operator";
  return (
    <>
      <aside>
        <a className="brand" href="#">
          <span className="brand-icon">
            <Bus size={24} />
          </span>
          yol<span>baku</span>
          <small>SMART TRANSIT</small>
        </a>
        <div className="nav-label">ŞƏHƏR SƏNİN ƏLİNDƏ</div>
        <button
          className={!operator ? "nav active" : "nav"}
          onClick={() => setTab("passenger")}
        >
          <Navigation size={19} /> Mənim yolum
        </button>
        <button
          className={operator ? "nav active" : "nav"}
          onClick={() => setTab("operator")}
        >
          <LayoutDashboard size={19} /> Operator mərkəzi
        </button>
        <button className="nav" onClick={() => setShowEvents(!showEvents)}>
          <Bell size={19} /> Bildirişlər <b>{data.events.length}</b>
        </button>
        <div className="aside-bottom">
          <div className="city-art">
            Bakı<span>birlikdə daha rahat.</span>
          </div>
          <p>
            <ShieldCheck size={16} /> Digital Azerbaijan Challenge
          </p>
          <small>2026 · Yarımfinal layihəsi</small>
        </div>
      </aside>
      <div className="shell">
        <header>
          <div>
            <span className="crumb">Nəqliyyat xidmətləri</span>
            <ChevronRight size={14} />
            <strong>{operator ? "Operator mərkəzi" : "Mənim yolum"}</strong>
          </div>
          <div>
            <span className="demo">
              <i /> DEMO MƏLUMATLAR
            </span>
            <button
              className="icon-button"
              aria-label="Bildirişlər"
              onClick={() => setShowEvents(!showEvents)}
            >
              <Bell size={20} />
            </button>
            <span className="avatar">{operator ? "OP" : "SƏ"}</span>
          </div>
        </header>
        <main>
          <div className="intro">
            <div>
              <p className="eyebrow">BAKI • AĞILLI ŞƏHƏR HƏLLƏRİ</p>
              <h1>
                {operator
                  ? "Şəhərin nəbzi, bir ekranda."
                  : "Yolunu bil. Vaxtını qoru."}
              </h1>
              <p>
                {operator
                  ? "Məlumatı qərara çevirin. Marşrutları, tələbi və hadisələri izləyin."
                  : "Avtobusun gəlişini və boş yerləri əvvəlcədən gör, rahat səyahət et."}
              </p>
            </div>
            <span className="live">
              <i /> 5 saniyədən bir yenilənir
            </span>
          </div>
          {error && (
            <div role="alert" className="warning">
              Bağlantı: {error}. Son alınmış məlumat göstərilir.
            </div>
          )}
          <div className="stats">
            <Stat
              icon={<Bus />}
              label="İzlənilən avtobus"
              value={data.buses.length}
              note="3 marşrut üzrə demo"
            />
            <Stat
              icon={<Clock />}
              label="Seçilmiş reysin gəlişi"
              value={`${a.eta} dəq`}
              note="Yol vəziyyəti nəzərə alınıb"
            />
            <Stat
              icon={<Armchair />}
              label="Boş oturacaqlar"
              value={bus.seats - bus.seated}
              note={`${bus.seats} oturacaqdan`}
            />
            <Stat
              icon={<Bell />}
              label="Aktiv hadisələr"
              value={data.events.length}
              note="Marşrutlara təsir edən"
            />
          </div>
          {(showEvents || events.length > 0) && (
            <section className="notifications">
              <div className="section-head">
                <h2>
                  <Bell size={19} /> Yol xəbərdarlıqları
                </h2>
                <span>Mənbə və təsir açıq göstərilir</span>
              </div>
              {(showEvents ? data.events : events).map((e) => (
                <div className="event" key={e.id}>
                  <span className="event-icon">
                    <AlertTriangle size={20} />
                  </span>
                  <div>
                    <b>{e.title}</b>
                    <p>
                      {operator
                        ? `${e.route} xətti · +${e.delay} dəq gecikmə · +${e.demand} sərnişin tələbi`
                        : e.passenger}
                    </p>
                    <small>
                      {e.source} ·{" "}
                      {e.verified ? "Təsdiqlənib" : "Təsdiqlənməyib"} ·{" "}
                      {new Date(e.created_at).toLocaleTimeString("az")}
                    </small>
                  </div>
                  {operator && key && (
                    <button
                      className="secondary"
                      onClick={() =>
                        run(() => api(`/events/${e.id}/close`, {}))
                      }
                    >
                      Bağla
                    </button>
                  )}
                  <span className="route-tag">{e.route}</span>
                </div>
              ))}
            </section>
          )}
          <div className="workspace">
            <section className="routes panel">
              <div className="section-head">
                <h2>Marşrutlar</h2>
                <span>{data.buses.length} aktiv</span>
              </div>
              <input
                aria-label="Marşrut axtar"
                placeholder="Marşrut və ya dayanacaq axtar…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <div className="route-list">
                {data.buses
                  .filter((b) =>
                    (b.route + b.name)
                      .toLowerCase()
                      .includes(filter.toLowerCase()),
                  )
                  .map((b) => (
                    <button
                      key={b.id}
                      className={
                        "route-card " + (b.id === selected ? "selected" : "")
                      }
                      onClick={() => setSelected(b.id)}
                    >
                      <div>
                        <span className="route-number">{b.route}</span>
                        <span className="arrival">
                          {b.analysis.eta}
                          <small> dəq</small>
                        </span>
                      </div>
                      <h3>{b.name}</h3>
                      <p>
                        <span
                          className={
                            "dot " + (b.analysis.occupancy > 75 ? "orange" : "")
                          }
                        />
                        {b.analysis.occupancy > 75
                          ? "Yüksək sıxlıq"
                          : "Rahat / orta sıxlıq"}
                        <ChevronRight size={16} />
                      </p>
                    </button>
                  ))}
              </div>
              <div className="helper">
                <ShieldCheck size={20} />
                <p>
                  Göstəricilər təxminidir.
                  <br />
                  <b>Mənbə: demo telemetriya + bildirişlər.</b>
                </p>
              </div>
            </section>
            <section className="map-panel panel">
              <div className="section-head">
                <h2>Canlı nəqliyyat xəritəsi</h2>
                <span>
                  <i className="dot" /> Bakı
                </span>
              </div>
              <MapContainer
                center={[40.387, 49.845]}
                zoom={13}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline
                  positions={data.buses.map((b) => [b.lat, b.lng])}
                  pathOptions={{
                    color: "#5264db",
                    weight: 4,
                    dashArray: "8 10",
                  }}
                />
                {data.buses.map((b) => (
                  <CircleMarker
                    key={b.id}
                    center={[b.lat, b.lng]}
                    radius={b.id === selected ? 17 : 12}
                    pathOptions={{
                      color: "white",
                      fillColor: b.id === selected ? "#5146d6" : "#16a68a",
                      fillOpacity: 1,
                      weight: 3,
                    }}
                    eventHandlers={{ click: () => setSelected(b.id) }}
                  >
                    <Tooltip permanent direction="top">
                      {b.route} · {b.analysis.eta} dəq
                    </Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
              <div className="map-caption">
                <span>
                  <i className="dot" /> Demo mövqelər
                </span>
                <span>
                  Kəsik xətt sxematikdir • real yol trayektoriyası deyil
                </span>
              </div>
            </section>
          </div>
          <section className="detail panel">
            <div className="section-head">
              <h2>
                <span className="route-number">{bus.route}</span> {bus.name}
              </h2>
              <span>
                {bus.source} ·{" "}
                {new Date(bus.updated_at).toLocaleTimeString("az")}
              </span>
            </div>
            <div className="detail-grid">
              <div>
                <Meter
                  icon={<Armchair size={18} />}
                  title="Oturacaqların doluluğu"
                  value={a.seat_percent}
                  text={`${bus.seated} / ${bus.seats} oturacaq`}
                />
                <Meter
                  icon={<Users size={18} />}
                  title="Ayaqüstə zona"
                  value={a.standing_percent}
                  text={`${bus.standing} / ${bus.standing_capacity} nəfər`}
                />
              </div>
              <div className="insight">
                <span className="eyebrow">MƏLUMATIN BİRLƏŞDİRİLMƏSİ</span>
                <h3>{a.occupancy}% ümumi göstərici</h3>
                <p>
                  Telemetriya 80% + son 10 dəqiqənin bildirişləri 20%.{" "}
                  {a.reports} aktiv bildiriş.
                </p>
                <span className="pill">Etibarlılıq: {a.confidence}</span>
              </div>
              <div className="ride">
                <h3>Siz bu avtobusdasınız?</h3>
                <p>
                  Demo reysə qoşulun və növbəti dayanacaq üçün STOP sorğusu
                  göndərin.
                </p>
                {session?.bus_id !== bus.id ? (
                  <button
                    onClick={() =>
                      run(async () => {
                        const s = await api("/join", {
                          bus_id: bus.id,
                          client_id: client,
                        });
                        setSession(s);
                        setStop(null);
                        setMessage(
                          "Demo reysə qoşuldunuz. Fiziki mövqe yoxlanılmır.",
                        );
                      })
                    }
                  >
                    Reysə qoşul <ArrowUpRight size={16} />
                  </button>
                ) : (
                  <button
                    className="stop"
                    disabled={!!stop}
                    onClick={() =>
                      run(async () => {
                        const r = await api("/stop", {
                          session_id: session.token,
                        });
                        setStop(r.status);
                        setMessage(r.message);
                      })
                    }
                  >
                    {stop === "driver_panel_acknowledged"
                      ? "Sürücü panelində təsdiqləndi"
                      : stop
                        ? "STOP serverə çatdı"
                        : "STOP · Növbəti dayanacaq"}
                  </button>
                )}
                <small>Fiziki STOP sisteminə qoşulmayıb.</small>
              </div>
            </div>
            <div className="report-bar">
              <span>
                <Users size={18} /> Sıxlığı siz də bildirin
              </span>
              {["Boş", "Normal", "Dolu", "Çox dolu"].map((label, level) => (
                <button
                  className="secondary"
                  key={label}
                  onClick={() =>
                    run(async () => {
                      await api("/reports", {
                        bus_id: bus.id,
                        level,
                        client_id: client,
                      });
                      setMessage(
                        "Təşəkkürlər! Bildirişiniz hesablamaya əlavə edildi.",
                      );
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
          {operator && (
            <>
              <section className="panel operator">
                <div className="section-head">
                  <h2>
                    <ShieldCheck size={20} /> Qərar dəstəyi
                  </h2>
                  <span>{a.model}</span>
                </div>
                <h3>{a.recommendation}</h3>
                <p>{a.reason}</p>
                <div className="scenario">
                  <div>
                    <small>Tədbirsiz: qarşılanmayan tələb</small>
                    <b>{a.unmet} nəfər</b>
                  </div>
                  <div>
                    <small>80 yerlik rezerv çatarsa*</small>
                    <b>{Math.max(0, a.unmet - 80)} nəfər</b>
                  </div>
                  <div>
                    <small>Əvvəlki avtobusun keçid vaxtı</small>
                    <b>{bus.previous_travel} dəq</b>
                  </div>
                </div>
                <small>
                  *Sadə tutum ssenarisidir. Rezervin mövcudluğu və çatma vaxtı
                  təsdiqlənməyib; optimal qərar zəmanəti deyil.
                </small>
                <div className="auth">
                  <input
                    type="password"
                    aria-label="Operator açarı"
                    placeholder="Operator açarı (.env)"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                  />
                  <button
                    onClick={() =>
                      run(async () => {
                        setOps(await api("/operator"));
                        setMessage("Operator girişi təsdiqləndi");
                      })
                    }
                  >
                    Daxil ol
                  </button>
                  {ops && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setKey("");
                        setOps(null);
                      }}
                    >
                      <LogOut size={16} />
                    </button>
                  )}
                </div>
                {ops && (
                  <>
                    <div className="actions">
                      {[
                        ["reserve", "Rezerv tələbini qeyd et"],
                        ["monitor", "İzləməyə davam et"],
                      ].map(([action, label]) => (
                        <button
                          key={action}
                          onClick={() =>
                            run(async () => {
                              await api("/actions", { bus_id: bus.id, action });
                              setMessage(
                                "Qərar jurnala yazıldı. Real avtobus göndərilməyib.",
                              );
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <h3>STOP sorğuları</h3>
                    {ops.stops.length === 0 ? (
                      <p>Hələ sorğu yoxdur.</p>
                    ) : (
                      ops.stops.map((s) => (
                        <div className="event" key={s.id}>
                          <Bus size={20} />
                          <div>
                            Avtobus #{s.bus_id}
                            <p>
                              {s.status === "server_received"
                                ? "Sürücü təsdiqi gözlənilir"
                                : "Sürücü panelində təsdiqlənib"}
                            </p>
                          </div>
                          {s.status === "server_received" && (
                            <button
                              onClick={() =>
                                run(() => api(`/stops/${s.id}/ack`, {}))
                              }
                            >
                              Təsdiqlə
                            </button>
                          )}
                        </div>
                      ))
                    )}
                    <EventForm
                      submit={(p) =>
                        run(async () => {
                          await api("/events", p);
                          setMessage("Hadisə yayımlandı");
                        })
                      }
                      route={bus.route}
                    />
                    <h3>Telemetriyanı yenilə · demo</h3>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.target);
                        run(() =>
                          api("/telemetry/" + bus.id, {
                            seated: +f.get("seated"),
                            standing: +f.get("standing"),
                            waiting: +f.get("waiting"),
                            lat: bus.lat,
                            lng: bus.lng,
                          }),
                        );
                      }}
                      key={bus.id}
                      className="form-grid"
                    >
                      <label>
                        Oturan
                        <input
                          name="seated"
                          type="number"
                          min="0"
                          max="30"
                          defaultValue={bus.seated}
                          required
                        />
                      </label>
                      <label>
                        Ayaqüstə
                        <input
                          name="standing"
                          type="number"
                          min="0"
                          max="50"
                          defaultValue={bus.standing}
                          required
                        />
                      </label>
                      <label>
                        Gözləyən
                        <input
                          name="waiting"
                          type="number"
                          min="0"
                          max="500"
                          defaultValue={bus.waiting}
                          required
                        />
                      </label>
                      <button>Yenilə</button>
                    </form>
                    <h3>Qərar jurnalı</h3>
                    {ops.actions.map((x) => (
                      <p key={x.id}>
                        #{x.bus_id} · {x.action} ·{" "}
                        {new Date(x.created_at).toLocaleTimeString("az")}
                      </p>
                    ))}
                  </>
                )}
              </section>
            </>
          )}
          <footer>
            <span>yolbaku · Daha məlumatlı qərarlar, daha rahat yollar.</span>
            <span>Demo prototip · mygov ilə əlaqəli deyil</span>
          </footer>
        </main>
      </div>
      {message && (
        <div className="toast" role="status">
          <CheckCircle size={21} />
          <span>{message}</span>
          <button aria-label="Bağla" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
function Stat({ icon, label, value, note }) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}
function Meter({ icon, title, value, text }) {
  return (
    <div className="meter">
      <div>
        <span>
          {icon}
          {title}
        </span>
        <b>{value}%</b>
      </div>
      <div className="track">
        <div
          style={{
            width: value + "%",
            background: value > 80 ? "#e5a245" : "#6558dc",
          }}
        />
      </div>
      <small>{text}</small>
    </div>
  );
}
function EventForm({ submit, route }) {
  return (
    <>
      <h3>Hadisə yayımla</h3>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          submit({
            title: f.get("title"),
            route: f.get("route"),
            type: f.get("type"),
            delay: +f.get("delay"),
            demand: +f.get("demand"),
            passenger: f.get("passenger"),
          });
        }}
      >
        <label>
          Başlıq
          <input
            name="title"
            required
            minLength="3"
            maxLength="160"
            placeholder="Məsələn: Stadionda tədbir"
          />
        </label>
        <label>
          Marşrut
          <select name="route" defaultValue={route}>
            <option>125</option>
            <option>18</option>
            <option>65</option>
          </select>
        </label>
        <label>
          Növ
          <select name="type">
            <option value="event">Tədbir</option>
            <option value="accident">Qəza</option>
            <option value="road">Yol məhdudiyyəti</option>
          </select>
        </label>
        <label>
          Gecikmə (dəq)
          <input
            name="delay"
            type="number"
            min="0"
            max="120"
            defaultValue="5"
            required
          />
        </label>
        <label>
          Əlavə tələb
          <input
            name="demand"
            type="number"
            min="0"
            max="500"
            defaultValue="20"
            required
          />
        </label>
        <label>
          Sərnişinə tövsiyə
          <input
            name="passenger"
            required
            minLength="3"
            maxLength="300"
            placeholder="Yola daha tez çıxın"
          />
        </label>
        <button>Bildirişi yayımla</button>
      </form>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
