const state = {
  beforeUrl: null,
  afterUrl: null,
  position: 50,
  direction: "horizontal",
  mode: "split",
  alpha: 50,
  hitmapThreshold: 20,
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
  hitmapCanvas: document.querySelector("#hitmapCanvas"),
  alphaRange: document.querySelector("#alphaRange"),
  alphaValue: document.querySelector("#alphaValue"),
  hitmapThreshold: document.querySelector("#hitmapThreshold"),
  hitmapValue: document.querySelector("#hitmapValue"),
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

  elements.canvas.classList.toggle("is-alpha", state.mode === "alpha");
  elements.canvas.classList.toggle("is-hitmap", state.mode === "hitmap");
  elements.afterImage.style.opacity = state.mode === "alpha" ? state.alpha / 100 : "1";
  elements.divider.hidden = state.mode !== "split";
  elements.alphaValue.textContent = `${state.alpha}%`;
  elements.hitmapValue.textContent = String(state.hitmapThreshold);
  if (state.mode === "alpha") {
    elements.afterImage.style.clipPath = "none";
    return;
  }
  if (state.mode === "hitmap") {
    elements.afterImage.style.clipPath = "none";
    renderHitMap();
    return;
  }

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
    elements.beforeImage.onload = updateCanvas;
    updateFileStatus(elements.beforeStatus, file);
  } else {
    if (state.afterUrl) URL.revokeObjectURL(state.afterUrl);
    state.afterUrl = url;
    elements.afterImage.src = url;
    elements.afterImage.onload = updateCanvas;
    updateFileStatus(elements.afterStatus, file);
  }
  updateCanvas();
}

function drawContained(context, image, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }

function renderHitMap() {
    if (!elements.beforeImage.complete || !elements.afterImage.complete) return;
    const bounds = elements.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const canvas = elements.hitmapCanvas;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = width;
    canvas.height = height;

    const beforeCanvas = document.createElement("canvas");
    const afterCanvas = document.createElement("canvas");
    beforeCanvas.width = afterCanvas.width = width;
    beforeCanvas.height = afterCanvas.height = height;
    const beforeContext = beforeCanvas.getContext("2d", { willReadFrequently: true });
    const afterContext = afterCanvas.getContext("2d", { willReadFrequently: true });
    drawContained(beforeContext, elements.beforeImage, width, height);
    drawContained(afterContext, elements.afterImage, width, height);

    const beforePixels = beforeContext.getImageData(0, 0, width, height).data;
    const afterPixels = afterContext.getImageData(0, 0, width, height).data;
    const output = context.createImageData(width, height);
    const threshold = state.hitmapThreshold * 2.55;
    for (let index = 0; index < beforePixels.length; index += 4) {
      const difference = Math.max(
        Math.abs(beforePixels[index] - afterPixels[index]),
        Math.abs(beforePixels[index + 1] - afterPixels[index + 1]),
        Math.abs(beforePixels[index + 2] - afterPixels[index + 2]),
      );
      const outputIndex = index;
      if (beforePixels[index + 3] === 0 || afterPixels[index + 3] === 0) {
        output.data[outputIndex + 3] = 0;
        continue;
      }
      if (difference <= threshold) {
        output.data[outputIndex] = 255;
        output.data[outputIndex + 1] = 255;
        output.data[outputIndex + 2] = 255;
        output.data[outputIndex + 3] = 255;
        continue;
      }
      const intensity = Math.min(255, Math.round(80 + difference * 0.69));
      output.data[outputIndex] = intensity;
      output.data[outputIndex + 1] = Math.max(35, Math.round(105 - difference * 0.2));
      output.data[outputIndex + 2] = 54;
      output.data[outputIndex + 3] = 255;
    }
    context.putImageData(output, 0, 0);
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

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll(".mode-button").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    document.querySelector(".direction-group").classList.toggle("is-disabled", state.mode !== "split");
    document.querySelector(".alpha-control").classList.toggle("is-visible", state.mode === "alpha");
    document.querySelector(".hitmap-control").classList.toggle("is-visible", state.mode === "hitmap");
    elements.afterImage.style.display = state.mode === "hitmap" ? "none" : "block";
    elements.beforeImage.style.display = state.mode === "hitmap" ? "none" : "block";
    updateCanvas();
  });
});

elements.alphaRange.addEventListener("input", () => {
  state.alpha = Number(elements.alphaRange.value);
  updateCanvas();
});

elements.hitmapThreshold.addEventListener("input", () => {
  state.hitmapThreshold = Number(elements.hitmapThreshold.value);
  updateCanvas();
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
