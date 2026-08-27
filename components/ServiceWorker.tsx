"use client";

import { useEffect } from "react";

/* Registers the offline shell. Renders nothing.
 *
 * Deliberately after `load`. A service worker registration competes with the
 * page's own first paint for the network, and precaching five documents while
 * somebody is waiting to see the workspace is the wrong trade — the offline
 * copy is for the NEXT visit, never this one.
 *
 * In development the worker is unregistered instead of installed. A cached
 * shell in front of a dev server is an afternoon lost to "why is my change not
 * showing", and this also cleans up after anyone who ran a production build
 * locally on the same origin.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((rs) => Promise.all(rs.map((r) => r.unregister())))
        .catch(() => {});
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* A blocked worker (private window, disabled storage, an enterprise
         * policy) must never break the app. It only ever removes offline. */
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
