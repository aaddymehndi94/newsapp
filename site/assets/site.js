// Measured Edition: theme toggle, read ticks, return-to-place, click-to-load video, your city,
// section tabs.
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
  const PAPER = { light: "#ffffff", dark: "#111111" };
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
      if (label) label.textContent = `Switch to ${next} theme`;
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

  // ---- read ticks on story cards (front page and "keep reading"); cards are never dimmed ----
  const TICK = '<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="7" fill="currentColor"/><path d="m3.9 7.2 2.1 2.1 4.1-4.4" fill="none" stroke="var(--bg)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PIN = '<svg viewBox="0 0 12 14" width="11" height="13" aria-hidden="true" focusable="false"><path d="M6 13.2S1.2 8.6 1.2 5.4a4.8 4.8 0 0 1 9.6 0C10.8 8.6 6 13.2 6 13.2Z" fill="currentColor"/><circle cx="6" cy="5.3" r="1.7" fill="var(--bg)"/></svg>';
  const markCards = () => {
    const read = new Set(readList());
    const last = body.classList.contains("page-front") ? store.get(LAST) : null;
    document.querySelectorAll("article[data-story]").forEach((el) => {
      const key = el.getAttribute("data-story");
      const isRead = read.has(key);
      const isLast = key === last;
      const meta = el.querySelector(".meta");
      if (!meta) return;
      let badge = meta.querySelector(".state");
      meta.querySelectorAll(".state").forEach((b) => b.remove());
      // A read story always shows the tick; the last one opened also says so, in quiet ink.
      if (isLast) {
        const last = document.createElement("span");
        last.className = "state is-last";
        last.innerHTML = `${PIN}Last opened`;
        meta.prepend(last);
      }
      if (isRead || isLast) {
        badge = document.createElement("span");
        badge.className = "state";
        badge.innerHTML = `${TICK}Read`;
        meta.prepend(badge);
      }
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

  // ---- click-to-load video: in place for story videos, in a dialog for trailers ----
  const ytFrame = (id, title) => {
    const f = document.createElement("iframe");
    f.className = "video-frame";
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    f.title = title || "Video";
    f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    f.referrerPolicy = "strict-origin-when-cross-origin";
    return f;
  };
  let ytDialog = null;
  const openYtDialog = (id, title) => {
    if (!ytDialog) {
      ytDialog = document.createElement("dialog");
      ytDialog.className = "yt-dialog";
      ytDialog.innerHTML =
        '<div class="yt-box"><button type="button" class="yt-close"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span class="visually-hidden">Close video</span></button><div class="yt-slot"></div></div>';
      document.body.append(ytDialog);
      ytDialog.querySelector(".yt-close").addEventListener("click", () => ytDialog.close());
      // A click on the dimmed backdrop lands on the dialog itself.
      ytDialog.addEventListener("click", (ev) => { if (ev.target === ytDialog) ytDialog.close(); });
      // Stop playback when it closes.
      ytDialog.addEventListener("close", () => ytDialog.querySelector(".yt-slot").replaceChildren());
    }
    ytDialog.setAttribute("aria-label", title || "Video");
    ytDialog.querySelector(".yt-slot").replaceChildren(ytFrame(id, title));
    ytDialog.showModal();
  };
  document.querySelectorAll("a[data-yt]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const id = a.getAttribute("data-yt") || "";
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return;
      e.preventDefault();
      const title = a.getAttribute("data-title") || "Video";
      if (a.hasAttribute("data-yt-modal") && typeof HTMLDialogElement === "function") {
        openYtDialog(id, title);
        return;
      }
      const f = ytFrame(id, title);
      a.replaceWith(f);
      f.focus();
    });
  });


  // ---- your city: the city section shows one city, remembered; weather lists it first ----
  const CITY = "meridian:city";
  const picks = document.querySelectorAll("button[data-pick]");
  const wxList = document.querySelector(".wx-list");
  const wxRows = wxList ? [...wxList.children] : [];
  const applyCity = (c) => {
    if (c) doc.setAttribute("data-city", c); else doc.removeAttribute("data-city");
    picks.forEach((b) => b.setAttribute("aria-pressed", String((b.getAttribute("data-pick") || "") === c)));
    document.querySelectorAll(".city-group.is-open").forEach((g) => g.classList.remove("is-open"));
    if (wxList) {
      const mine = wxRows.find((r) => r.getAttribute("data-wx") === c);
      wxList.replaceChildren(...(mine ? [mine, ...wxRows.filter((r) => r !== mine)] : wxRows));
    }
  };
  applyCity(doc.getAttribute("data-city") || "");
  picks.forEach((b) => {
    b.addEventListener("click", () => {
      const c = b.getAttribute("data-pick") || "";
      store.set(CITY, c);
      applyCity(c);
    });
  });
  // A link to a story from another city (say, "back" from a shared article) still lands on it.
  const openLinkedCity = () => {
    let target = null;
    try { target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null; } catch { target = null; }
    const group = target ? target.closest(".city-group") : null;
    if (group && group.getAttribute("data-city") !== doc.getAttribute("data-city") && doc.hasAttribute("data-city")) {
      group.classList.add("is-open");
      target.scrollIntoView();
    }
  };
  openLinkedCity();
  addEventListener("hashchange", openLinkedCity);

  // ---- section tabs: edge fades/arrows when there's more, and the tab for where you are ----
  const tabs = document.querySelector(".tabs");
  const track = document.querySelector(".tabs-track");
  if (tabs && track) {
    const edges = () => {
      const max = track.scrollWidth - track.clientWidth;
      tabs.classList.toggle("at-start", track.scrollLeft <= 2);
      tabs.classList.toggle("at-end", track.scrollLeft >= max - 2);
    };
    tabs.querySelectorAll("[data-scroll]").forEach((b) => {
      b.hidden = false;
      b.addEventListener("click", () => {
        const dir = Number(b.getAttribute("data-scroll")) || 1;
        track.scrollBy({ left: dir * track.clientWidth * 0.7, behavior: reduced.matches ? "auto" : "smooth" });
      });
    });
    track.addEventListener("scroll", edges, { passive: true });
    addEventListener("resize", edges);
    edges();
  }
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
