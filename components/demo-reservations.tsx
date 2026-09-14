"use client";
import { createContext, useContext, useState } from "react";
type DemoContext = {
  signedIn: boolean;
  reserved: string[];
  toggle: (id: string) => void;
};
const Context = createContext<DemoContext | null>(null);

// UI demonstration only: no database writes and no persistent reservations.
export function DemoReservationsProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const [reserved, setReserved] = useState<string[]>([]);
  function toggle(id: string) {
    if (!signedIn) return;
    setReserved((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  return (
    <Context.Provider value={{ signedIn, reserved, toggle }}>
      {children}
    </Context.Provider>
  );
}
export function useDemoReservations() {
  const context = useContext(Context);
  if (!context) throw new Error("Demonstracijos kontekstas nepasiekiamas.");
  return context;
}
