"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selectedTime, setSelectedTime] = useState("");

  useEffect(() => {
    if (date) {
      fetch(`/api/availability?date=${date}&duration=30`)
        .then((res) => res.json())
        .then((data) => setSlots(data.slots));
    }
  }, [date]);

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>Запази час</h1>

      <label>
        Избери дата:
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ marginLeft: "1rem" }}
        />
      </label>

      {slots.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Свободни часове:</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {slots.map((s) => (
              <button
                key={s.time}
                disabled={!s.available}
                onClick={() => setSelectedTime(s.time)}
                style={{
                  padding: "10px",
                  background: s.available ? "#4caf50" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: s.available ? "pointer" : "not-allowed",
                }}
              >
                {s.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedTime && (
        <form
          action="/api/book"
          method="POST"
          style={{
            marginTop: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxWidth: "320px",
          }}
        >
          <h3>Избран час: {selectedTime}</h3>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="time" value={selectedTime} />

          <input name="firstName" placeholder="Име" required />
          <input name="lastName" placeholder="Фамилия" required />
          <input name="email" type="email" placeholder="Имейл" required />
          <input name="phone" placeholder="Телефон" required />
          <input name="procedure" placeholder="Процедура" required />
          <textarea name="symptoms" placeholder="Симптоми (незадължително)" />

          <select name="duration" required defaultValue="30">
            <option value="30">30 минути</option>
            <option value="60">1 час</option>
          </select>

          <button
            type="submit"
            style={{
              background: "#2196f3",
              color: "white",
              padding: "10px",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Запази час
          </button>
        </form>
      )}
    </div>
  );
}
