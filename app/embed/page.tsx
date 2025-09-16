"use client";
import { useEffect } from "react";
import BookingApp from "@/app/book/BookingApp";

export default function Embed() {
  // авто-оразмеряване на iframe в родителя
  useEffect(() => {
    const send = () => {
      const h = document.documentElement.scrollHeight;
      window.parent?.postMessage({ source: "booking-widget", height: h }, "*");
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.documentElement);
    window.addEventListener("load", send);
    return () => { ro.disconnect(); window.removeEventListener("load", send); };
  }, []);
  return <BookingApp />;
}
