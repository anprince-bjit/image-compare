const state = {
  beforeUrl: null,
  afterUrl: null,
  position: 50,
  direction: "horizontal",
  dragging: false,
};

const elements = {
  frame: document.querySelector("#comparisonFrame"),
  emptyCanvas: document.querySelector("#emptyCanvas"),
  canvas: document.querySelector("#comparisonCanvas"),
  clip: document.querySelector("#comparisonClip"),
  divider: document.querySelector("#comparisonDivider"),
  handle: document.querySelector("#dragHandle"),
  beforeImage: document.querySelector("#beforeImage"),
  afterImage: document.querySelector("#afterImage"),
  beforeInput: document.querySelector("#beforeInput"),
  afterInput: document.querySelector("#afterInput"),
  beforeStatus: document.querySelector("#beforeStatus"),
  afterStatus: document.querySelector("#afterStatus"),
};

function updateFileStatus(statusElement, file) {
  statusElement.classList.toggle("has-file", Boolean(file));
  statusElement.lastElementChild.textContent = file ? file.name : "No image selected";
}

function updateCanvas() {
  const ready = Boolean(state.beforeUrl && state.afterUrl);
  elements.emptyCanvas.hidden = ready;
  elements.canvas.hidden = !ready;
  elements.frame.classList.toggle("is-empty", !ready);
  if (!ready) return;

  const value = `${state.position}%`;
  if (state.direction === "horizontal") {
    elements.afterImage.style.clipPath = `inset(0 ${100 - state.position}% 0 0)`;
    elements.divider.style.left = value;
    elements.divider.style.top = "0";
    elements.divider.style.bottom = "0";
  } else {
    elements.afterImage.style.clipPath = `inset(0 0 ${100 - state.position}% 0)`;
    elements.divider.style.top = value;
    elements.divider.style.left = "0";
    elements.divider.style.bottom = "auto";
  }
  elements.canvas.classList.toggle("is-vertical", state.direction === "vertical");
  elements.handle.setAttribute("aria-valuenow", String(state.position));
}

function loadImage(file, side) {
  if (!file || !file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  if (side === "before") {
    if (state.beforeUrl) URL.revokeObjectURL(state.beforeUrl);
    state.beforeUrl = url;
    elements.beforeImage.src = url;
    updateFileStatus(elements.beforeStatus, file);
  } else {
    if (state.afterUrl) URL.revokeObjectURL(state.afterUrl);
    state.afterUrl = url;
    elements.afterImage.src = url;
    updateFileStatus(elements.afterStatus, file);
  }
  updateCanvas();
}

function positionFromPointer(event) {
  const bounds = elements.canvas.getBoundingClientRect();
  const raw = state.direction === "horizontal"
    ? ((event.clientX - bounds.left) / bounds.width) * 100
    : ((event.clientY - bounds.top) / bounds.height) * 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

function moveHandle(event) {
  if (!state.dragging) return;
  state.position = positionFromPointer(event);
  updateCanvas();
}

function setupDropzone(dropzone, input, side) {
  ["dragenter", "dragover"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  }));
  dropzone.addEventListener("drop", (event) => loadImage(event.dataTransfer.files[0], side));
  input.addEventListener("change", () => loadImage(input.files[0], side));
}

setupDropzone(document.querySelector("#beforeDropzone"), elements.beforeInput, "before");
setupDropzone(document.querySelector("#afterDropzone"), elements.afterInput, "after");

elements.handle.addEventListener("pointerdown", (event) => {
  state.dragging = true;
  elements.handle.setPointerCapture(event.pointerId);
});
elements.handle.addEventListener("pointermove", moveHandle);
elements.handle.addEventListener("pointerup", () => { state.dragging = false; });
elements.handle.addEventListener("keydown", (event) => {
  const increments = event.shiftKey ? 10 : 1;
  const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
  if (!direction) return;
  event.preventDefault();
  state.position = Math.min(100, Math.max(0, state.position + direction * increments));
  updateCanvas();
});
elements.canvas.addEventListener("pointerdown", (event) => {
  if (event.target === elements.handle) return;
  state.position = positionFromPointer(event);
  updateCanvas();
});

document.querySelectorAll(".direction-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.direction = button.dataset.direction;
    document.querySelectorAll(".direction-button").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    updateCanvas();
  });
});

document.querySelector("#resetButton").addEventListener("click", () => {
  state.position = 50;
  updateCanvas();
});

document.querySelector("#swapButton").addEventListener("click", () => {
  [state.beforeUrl, state.afterUrl] = [state.afterUrl, state.beforeUrl];
  elements.beforeImage.src = state.beforeUrl || "";
  elements.afterImage.src = state.afterUrl || "";
  const beforeText = elements.beforeStatus.lastElementChild.textContent;
  elements.beforeStatus.lastElementChild.textContent = elements.afterStatus.lastElementChild.textContent;
  elements.afterStatus.lastElementChild.textContent = beforeText;
  elements.beforeStatus.classList.toggle("has-file", Boolean(state.beforeUrl));
  elements.afterStatus.classList.toggle("has-file", Boolean(state.afterUrl));
  updateCanvas();
});

updateCanvas();
