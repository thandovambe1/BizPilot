"use client";

import { useCallback, useEffect, useState } from "react";

/** Sets .dark on <html> before paint, then keeps it in sync with the stored preference. */
export function ThemeInit() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
        (function () {
          try {
            var s = localStorage.getItem("bp_theme");
            var dark = s ? s === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
            if (dark) document.documentElement.classList.add("dark");
          } catch (e) {}
        })();
        `,
      }}
    />
  );
}

export function useTheme() {
  const [dark, setDarkState] = useState(false);
  useEffect(() => {
    setDarkState(document.documentElement.classList.contains("dark"));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      try {
        if (!localStorage.getItem("bp_theme")) {
          setDarkState(mq.matches);
          document.documentElement.classList.toggle("dark", mq.matches);
        }
      } catch {
        /* ignore */
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const setDark = useCallback((v: boolean) => {
    document.documentElement.classList.toggle("dark", v);
    setDarkState(v);
    try {
      localStorage.setItem("bp_theme", v ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, []);
  return { dark, setDark };
}
