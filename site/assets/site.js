// Meridian: theme toggle, read marks, return-to-place, click-to-load video, section bar.
// Progressive: every page works without this file.
(() => {
  "use strict";
  const doc = document.documentElement;
  const body = document.body;
  const READ = "meridian:read";
  const LAST = "meridian:last";
  const THEME = "meridian:theme";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: no memory */ } },
  };
  const readList = () => {
    try {
      const v = JSON.parse(store.get(READ) || "[]");
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch { return []; }
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const darkMq = matchMedia("(prefers-color-scheme: dark)");

  // ---- theme ----
  const PAPER = { light: "#f5f7fa", dark: "#10151d" };
  const theme = () => doc.getAttribute("data-theme") || (darkMq.matches ? "dark" : "light");
  const syncThemeColor = () => {
    const forced = doc.getAttribute("data-theme");
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      if (forced) m.setAttribute("content", PAPER[forced]);
    });
  };
  syncThemeColor();
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    const label = btn.querySelector(".theme-toggle-label");
    const sync = () => {
      const next = theme() === "dark" ? "light" : "dark";
      btn.setAttribute("aria-label", `Switch to ${next} theme`);
      if (label) label.textContent = next === "dark" ? "Dark" : "Light";
    };
    btn.hidden = false;
    sync();
    btn.addEventListener("click", () => {
      const next = theme() === "dark" ? "light" : "dark";
      doc.setAttribute("data-theme", next);
      store.set(THEME, next);
      syncThemeColor();
      sync();
    });
    darkMq.addEventListener("change", sync);
  });

  // ---- this article: remember it, and make "back" return to the exact spot ----
  const here = body.dataset.story;
  if (here) {
    const list = readList().filter((x) => x !== here);
    list.push(here);
    store.set(READ, JSON.stringify(list.slice(-1500)));
    store.set(LAST, here);
    let ref = null;
    try { ref = document.referrer ? new URL(document.referrer) : null; } catch { ref = null; }
    document.querySelectorAll("a[data-back]").forEach((a) => {
      a.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const fronts = (a.getAttribute("data-front") || "").split(" ");
        // Came straight from this edition's front page: go back in history so the browser
        // restores the scroll position. Otherwise the link lands on the story's card.
        if (ref && ref.origin === location.origin && fronts.includes(ref.pathname) && history.length > 1) {
          e.preventDefault();
          history.back();
        }
      });
    });
  }

  // ---- read marks on story cards (front page and "keep reading") ----
  const PIN = '<svg viewBox="0 0 12 14" width="10" height="12" aria-hidden="true" focusable="false"><path d="M6 13.2S1.2 8.6 1.2 5.4a4.8 4.8 0 0 1 9.6 0C10.8 8.6 6 13.2 6 13.2Z" fill="currentColor"/><circle cx="6" cy="5.3" r="1.7" fill="var(--paper)"/></svg>';
  const markCards = () => {
    const read = new Set(readList());
    const last = body.classList.contains("page-front") ? store.get(LAST) : null;
    document.querySelectorAll("article[data-story]").forEach((el) => {
      const key = el.getAttribute("data-story");
      const isRead = read.has(key);
      const isLast = key === last;
      el.classList.toggle("is-read", isRead);
      const meta = el.querySelector(".meta");
      if (!meta) return;
      let badge = meta.querySelector(".state");
      if (!isRead && !isLast) { if (badge) badge.remove(); return; }
      if (!badge) {
        badge = document.createElement("span");
        meta.prepend(badge);
      }
      badge.className = isLast ? "state is-last" : "state";
      badge.innerHTML = isLast ? `${PIN}Last opened` : "Read";
    });
  };
  markCards();

  // ---- picture carries over into the article (cross-document view transition) ----
  const clearHero = () => {
    document.querySelectorAll("article .pic").forEach((p) => {
      if (p.style.viewTransitionName && !p.classList.contains("pic--hero")) p.style.viewTransitionName = "";
    });
  };
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a.stretch") : null;
    if (!a || reduced.matches || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    clearHero();
    const p = a.closest("article")?.querySelector(".pic");
    if (p && !document.querySelector(".pic--hero")) p.style.viewTransitionName = "hero";
  });

  // Returning via the back button restores this page from the cache without re-running
  // scripts, so refresh the marks then.
  addEventListener("pageshow", (e) => {
    if (e.persisted) { clearHero(); markCards(); }
  });

  // ---- click-to-load video ----
  document.querySelectorAll("a[data-yt]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const id = a.getAttribute("data-yt") || "";
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return;
      e.preventDefault();
      const f = document.createElement("iframe");
      f.className = "video-frame";
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      f.title = a.getAttribute("data-title") || "Video";
      f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      f.referrerPolicy = "strict-origin-when-cross-origin";
      a.replaceWith(f);
      f.focus();
    });
  });

  // ---- section bar: show where you are ----
  const track = document.querySelector(".jumpbar-track");
  if (track && "IntersectionObserver" in window) {
    const links = new Map();
    track.querySelectorAll("a[data-jump]").forEach((a) => links.set(a.getAttribute("data-jump"), a));
    let active = "";
    const setActive = (id) => {
      if (id === active) return;
      active = id;
      links.forEach((a, key) => {
        const on = key === id;
        a.classList.toggle("is-active", on);
        if (on) {
          a.setAttribute("aria-current", "location");
          const left = a.offsetLeft - (track.clientWidth - a.offsetWidth) / 2;
          track.scrollTo({ left, behavior: reduced.matches ? "auto" : "smooth" });
        } else a.removeAttribute("aria-current");
      });
    };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); }),
      { rootMargin: "-30% 0px -65% 0px" },
    );
    links.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
})();
