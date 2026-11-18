(() => {
  const categories = document.querySelector("[data-category-list]");
  if (!categories) return;

  const choices = Array.from(categories.querySelectorAll('input[type="radio"]'));
  const panels = document.querySelectorAll("[data-preview-panel]");
  const selectCategory = (choice) => {
    choice.checked = true;
    for (const panel of panels) panel.hidden = panel.dataset.previewPanel !== choice.value;
  };

  for (const choice of choices) {
    choice.addEventListener("change", () => selectCategory(choice));
    choice.labels[0].addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") selectCategory(choice);
    });
  }
})();
