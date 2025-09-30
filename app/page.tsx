// /app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ===== helpers ===== */
type Slot = { time: string; available: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const fmtYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function nextAllowedDate(){
  const t0 = startOfDay(new Date());
  const d = new Date(t0); d.setDate(d.getDate()+1);
  while (d.getDay()===0) d.setDate(d.getDate()+1);
  return fmtYMD(d);
}

/* ===== calendar ===== */
function CalendarPicker({
  value, onChange, locale="bg-BG", weekStartsOn=1,
}: { value?: string; onChange:(ymd:string)=>void; locale?:string; weekStartsOn?:0|1; }){
  const today0 = startOfDay(new Date());
  const [cursor, setCursor] = useState(() => new Date(value ? new Date(value) : new Date()));
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale,{month:"long",year:"numeric"}).format(cursor),
    [cursor, locale]
  );
  const dayNames = useMemo(() => {
    const base = new Date(2020,5,7); // неделя
    return Array.from({length:7},(_,i)=>{
      const d = new Date(base); d.setDate(base.getDate()+i+(weekStartsOn===1?1:0));
      return new Intl.DateTimeFormat(locale,{weekday:"short"}).format(d);
    });
  },[locale,weekStartsOn]);

  const cells = useMemo(()=>{
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = ((first.getDay()-weekStartsOn)+7)%7;
    const start = new Date(first); start.setDate(1-offset);
    return Array.from({length:42},(_,i)=>{
      const d = new Date(start); d.setDate(start.getDate()+i);
      const d0 = startOfDay(d);
      const disabled = d0<today0 || d0.getTime()===today0.getTime() || d0.getDay()===0;
      return { date:d0, disabled };
    });
  },[cursor, weekStartsOn]);

  const selected = value ? startOfDay(new Date(value)) : null;

  return (
    <div style={{ width:"min(360px,100%)", border:"1px solid rgba(0,0,0,.15)", borderRadius:12, overflow:"hidden", background:"#fff" }}>
      <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 12px", background:"rgba(0,0,0,.04)" }}>
        <button type="button" aria-label="Предишен" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()-1,1))} style={{border:0,background:"transparent",cursor:"pointer",fontSize:18}}>‹</button>
        <strong style={{ textTransform:"capitalize" }}>{monthLabel}</strong>
        <button type="button" aria-label="Следващ" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+1,1))} style={{border:0,background:"transparent",cursor:"pointer",fontSize:18}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"8px 8px 0",textAlign:"center",fontWeight:700,fontSize:12,opacity:.8}}>
        {dayNames.map((n,i)=><div key={i}>{n}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,padding:8}}>
        {cells.map(({date,disabled},i)=>{
          const ymd = fmtYMD(date);
          const isSel = selected && date.getTime()===selected.getTime();
          return (
            <button key={i} type="button" onClick={()=>!disabled && onChange(ymd)} disabled={disabled}
              style={{
                padding:"10px 0", borderRadius:10,
                border:isSel?"2px solid #0fd0d0":"1px solid rgba(0,0,0,.12)",
                background: disabled ? "#eee" : isSel ? "rgba(15,208,208,.15)" : "#fff",
                color: disabled ? "#999" : "#111",
                cursor: disabled ? "not-allowed" : "pointer",
                fontWeight:700
              }}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===== page ===== */
export default function Home(){
  const [date, setDate] = useState(nextAllowedDate());
  const [duration, setDuration] = useState<"30"|"60">("30");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");

  // управление на показването + анимацията на формата
  const [showForm, setShowForm] = useState(false);
  const formWrapperRef = useRef<HTMLDivElement|null>(null);
  const formInnerRef   = useRef<HTMLDivElement|null>(null);

  // зареждане на свободни часове
  useEffect(()=>{
    fetch(`/api/availability?date=${date}&duration=${duration}`, { cache:"no-store" })
      .then(r=>r.json())
      .then(d=>setSlots(Array.isArray(d?.slots)?d.slots:[]))
      .catch(console.error);
  },[date,duration]);

  // при избор на час: показваме формата + анимация + скрол
  function onSelectTime(t:string){
    setSelectedTime(t);
    setShowForm(true);
  }

  // когато формата трябва да се появи – slide-down и скрол към нея
  useEffect(()=>{
    if (!showForm || !formWrapperRef.current) return;

    // 1) подготви wrapper за анимация
    const wrapper = formWrapperRef.current;
    const innerH  = formInnerRef.current?.offsetHeight ?? 600;

    // стартови стойности
    wrapper.style.maxHeight = "0px";
    wrapper.style.opacity = "0";
    wrapper.style.overflow = "hidden";
    wrapper.style.transition = "max-height 380ms ease, opacity 300ms ease";

    // 2) след малко – отваряме до реалната височина
    requestAnimationFrame(()=>{
      wrapper.style.maxHeight = innerH + "px";
      wrapper.style.opacity = "1";
    });

    // 3) плавен скрол към формата (компенсира фиксирания header чрез scroll-margin-top)
    const header = document.querySelector(".tb-header") as HTMLElement | null;
    const headerH = header ? header.offsetHeight + 8 : 0;
    const y = wrapper.getBoundingClientRect().top + window.scrollY - headerH;
    window.scrollTo({ top: y, behavior: "smooth" });

    // 4) след края на анимацията махаме maxHeight, за да може формата да се разширява нормално
    const timer = setTimeout(()=>{ wrapper.style.maxHeight = "none"; wrapper.style.overflow = "visible"; }, 420);
    return ()=>clearTimeout(timer);
  },[showForm, selectedTime]);

  const hasAvailable = useMemo(()=>slots.some(s=>s.available),[slots]);

  return (
    <main style={{ padding:"24px 16px", maxWidth:1100, margin:"0 auto" }}>
      <header style={{ textAlign:"center", marginBottom:24 }}>
        <h1>Запази час</h1>
        <p>Избери дата, продължителност и свободен час. След избора формата се показва автоматично.</p>
      </header>

      {/* контроли */}
      <section style={{ display:"grid", gap:16, maxWidth:720, margin:"0 auto 16px", justifyItems:"center" }}>
        <CalendarPicker value={date} onChange={setDate} />
        <label style={{ display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontWeight:700 }}>Продължителност:</span>
          <select value={duration} onChange={e=>setDuration(e.target.value as "30"|"60")}
            style={{ padding:"10px 12px", borderRadius:10, border:"1px solid rgba(0,0,0,.15)" }}>
            <option value="30">30 минути</option>
            <option value="60">1 час</option>
          </select>
        </label>
      </section>

      {/* свободни часове */}
      {slots.length>0 && (
        <section style={{ marginTop:12 }}>
          <h3 style={{ textAlign:"center", marginBottom:12 }}>Свободни часове</h3>
          {!hasAvailable ? (
            <p style={{ textAlign:"center" }}>Няма свободни часове за избраната дата.</p>
          ) : (
            <div role="listbox" aria-label="Свободни часове"
              style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:10, maxWidth:720, margin:"0 auto" }}>
              {slots.map(s=>{
                const active = selectedTime===s.time;
                return (
                  <button key={s.time} role="option" aria-selected={active}
                    disabled={!s.available} onClick={()=>s.available && onSelectTime(s.time)}
                    style={{
                      padding:"12px 10px", borderRadius:12,
                      border: active ? "2px solid #0fd0d0" : "1px solid rgba(0,0,0,.12)",
                      background: s.available ? (active ? "rgba(15,208,208,.15)" : "#fff") : "#eee",
                      cursor: s.available ? "pointer" : "not-allowed", fontWeight:700
                    }}>
                    {s.time}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* форма — slide-down контейнер */}
      <div
        ref={formWrapperRef}
        style={{
          // важно: този margin позволява да „се покаже“ под часовете
          marginTop: showForm ? 16 : 0,
          // компенсираме фиксирания topbar когато скролваме към контейнера
          scrollMarginTop: "calc(var(--tb-h, 64px) + 10px)",
        }}
      >
        {showForm && (
          <div ref={formInnerRef}>
            <section style={{ display:"grid", justifyContent:"center" }}>
              <form action="/api/book" method="POST"
                style={{ display:"grid", gap:10, width:"min(560px,100%)", padding:16, border:"1px solid rgba(0,0,0,.12)", borderRadius:12, background:"#fff" }}>
                <h3 style={{ margin:0 }}>
                  Избран час: <strong>{date}</strong> – <strong>{selectedTime}</strong> ({/* duration */} {/**/})
                </h3>

                <input type="hidden" name="date" value={date}/>
                <input type="hidden" name="time" value={selectedTime}/>
                <input type="hidden" name="duration" value={duration}/>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <input name="firstName" placeholder="Име" required />
                  <input name="lastName" placeholder="Фамилия" required />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <input name="email" type="email" placeholder="Имейл" required />
                  <input name="phone" placeholder="Телефон" required />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <input name="procedure" placeholder="Процедура" required />
                  <select name="location" defaultValue="studio" aria-label="Локация">
                    <option value="studio">Студио</option>
                    <option value="online">Онлайн консултация</option>
                  </select>
                </div>
                <textarea name="symptoms" placeholder="Симптоми (по избор)" rows={4} />

                <button type="submit"
                  style={{ background:"#2196f3", color:"#fff", padding:"12px", border:0, borderRadius:12, cursor:"pointer", fontWeight:800 }}>
                  Запази час
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
