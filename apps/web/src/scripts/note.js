(() => {
  // Review fields are plain text. Only paired backticks introduce markup here.
  for (const field of document.querySelectorAll("[data-inline-code]")) {
    const parts = field.textContent.split(/(`+)/);
    if (parts.length === 1) continue;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < parts.length; i++) {
      const close = i % 2 === 1 ? parts.indexOf(parts[i], i + 1) : -1;
      if (close === -1) {
        fragment.append(parts[i]);
        continue;
      }
      const code = document.createElement("code");
      const text = parts.slice(i + 1, close).join("").replace(/\r?\n/g, " ");
      code.textContent = /^ .+ $/u.test(text) && text.trim() ? text.slice(1, -1) : text;
      fragment.append(code);
      i = close;
    }
    field.replaceChildren(fragment);
  }

  const outline = document.querySelector(".note-outline");
  if (!outline) return;
  const headings = Array.from(document.querySelectorAll(".note-body :is(h2, h3), .learning-review > h2"))
    .filter((heading) => heading.textContent.trim() && !heading.closest("blockquote, details, pre"));
  if (!headings.length) return;

  const list = outline.querySelector("ul");
  const links = headings.map((heading, index) => {
    if (!heading.id || document.getElementById(heading.id) !== heading) {
      let id = `note-section-${index + 1}`;
      while (document.getElementById(id)) id += "-";
      heading.id = id;
    }
    const link = document.createElement("a");
    link.href = "#" + encodeURIComponent(heading.id);
    link.textContent = heading.textContent.trim();
    const item = document.createElement("li");
    if (heading.tagName === "H3") item.className = "outline-subheading";
    item.append(link);
    list.append(item);
    return link;
  });

  const wide = matchMedia("(min-width: 60rem)");
  const setLayout = () => { outline.open = wide.matches; };
  setLayout();
  wide.addEventListener("change", setLayout);
  outline.hidden = false;

  list.addEventListener("click", (event) => {
    if (!wide.matches && event.target.closest("a")) outline.open = false;
  });

  let current;
  let queued = false;
  const update = () => {
    queued = false;
    let index = 0;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top > 32) break;
      index = i;
    }
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      index = headings.length - 1;
    }
    if (links[index] === current) return;
    current?.removeAttribute("aria-current");
    current = links[index];
    current.setAttribute("aria-current", "location");
  };
  const scheduleUpdate = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("load", scheduleUpdate);
  update();
})();
