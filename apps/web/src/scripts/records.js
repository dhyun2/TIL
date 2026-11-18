(() => {
  const form = document.querySelector("[data-record-filters]");
  if (!form) return;

  const search = form.elements.namedItem("q");
  const category = form.elements.namedItem("category");
  const results = document.querySelector("[data-filter-status]");
  const empty = document.querySelector("[data-filter-empty]");
  const noRecords = document.querySelector("[data-records-empty]");
  const normalize = (text) => text.normalize("NFKC").toLocaleLowerCase("ko").trim();
  const months = Array.from(document.querySelectorAll("[data-record-month]"), (month) => ({
    month,
    count: month.querySelector("[data-month-count]"),
    records: Array.from(month.querySelectorAll("[data-record]"), (entry) => ({
      entry,
      categories: entry.dataset.categories.split(/\s+/),
      text: normalize(`${entry.textContent} ${entry.dataset.topics}`).replace(/\s+/g, " "),
    })),
  }));

  const applyFilters = () => {
    const query = normalize(search.value);
    const terms = query ? query.split(/\s+/) : [];
    const selected = category.value;
    let visible = 0;
    for (const group of months) {
      let inMonth = 0;
      for (const record of group.records) {
        const matches = (!selected || record.categories.includes(selected))
          && terms.every((term) => record.text.includes(term));
        record.entry.hidden = !matches;
        if (matches) inMonth += 1;
      }
      group.month.hidden = inMonth === 0;
      group.count.textContent = inMonth;
      visible += inMonth;
    }
    const active = Boolean(selected || query);
    results.textContent = `${visible}편`;
    empty.hidden = visible > 0 || (!active && Boolean(noRecords));
    if (noRecords) noRecords.hidden = active;
  };

  const readUrl = () => {
    const params = new URLSearchParams(location.search);
    search.value = params.get("q") || "";
    const requested = params.get("category");
    category.value = Array.from(category.options).some((option) => option.value === requested) ? requested : "";
    applyFilters();
  };

  const update = () => {
    const url = new URL(location.href);
    for (const field of [search, category]) {
      const value = field.value.trim();
      if (value) url.searchParams.set(field.name, value);
      else url.searchParams.delete(field.name);
    }
    if (url.href !== location.href) history.replaceState(history.state, "", url);
    applyFilters();
  };

  form.addEventListener("submit", (event) => { event.preventDefault(); update(); });
  search.addEventListener("input", update);
  category.addEventListener("change", update);
  addEventListener("popstate", readUrl);
  addEventListener("pageshow", (event) => { if (event.persisted) readUrl(); });
  readUrl();
})();
