/*=== Imports ===*/
const { mat3, vec3 } = glMatrix;

/*=== Color Palette ===*/
const palette = {
  background: "#ffffff",
  primary: "#b4b2ed",
  object: "#1e1e1e",
  vertex: {
    target: "#1971c2",
    control: "#e03131",
  }
};

/*=== Canvas Initialization ===*/
const ctx = document
  .getElementById("canvas")
  .getContext("2d");

const resizeCanvas = () => {
  ctx.canvas.width = window.innerWidth;
  ctx.canvas.height = window.innerHeight;
};

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/*=== Scene Definition ===*/
const scene = {
  dx: 0, dy: 0,
  sx: 1, sy: 1,
  angle: 0,

  _transform: mat3.create(),
  _inverse: mat3.create(),

  update() {
    mat3.fromTranslation(
      this._transform,
      vec3.fromValues(this.dx, this.dy, 0),
    );

    mat3.scale(
      this._transform,
      this._transform,
      vec3.fromValues(this.sx, this.sy, 1),
    );

    mat3.rotate(
      this._transform,
      this._transform,
      this.angle,
    );

    mat3.invert(
      this._inverse,
      this._transform,
    );
  },

  transform(x, y) {
    const v = vec3.fromValues(x, y, 1);
    vec3.transformMat3(v, v, this._transform);
    return [v[0], v[1]];
  },

  revert(x, y) {
    const v = vec3.fromValues(x, y, 1);
    vec3.transformMat3(v, v, this._inverse);
    return [v[0], v[1]];
  },

  showOrigin() {
    const radius = 5;

    ctx.beginPath();
    ctx.arc(scene.dx, scene.dy, radius, 0, 2 * Math.PI);

    ctx.fillStyle = palette.primary;
    ctx.fill();

    ctx.strokeStyle = palette.primary;
    ctx.stroke();
  }
};

/*=== Object Definition ===*/
class Object2D {
  constructor(data) {
    this.aabb = data.aabb;
    this.code = data.code;

    this.w = this.aabb.w;
    this.h = this.aabb.h;
    this.aspectRatio = this.w / this.h;

    this.dx = this.dy = 0;
    this.sx = this.sy = 1;
    this.angle = 0;

    this._transform = mat3.create();
    this._inverse = mat3.create();
  }

  update() {
    // Update scaling coefficients.
    this.sx = this.w / this.aabb.w;
    this.sy = this.h / this.aabb.h;
    this.aspectRatio = this.w / this.h;

    // Place origin at (0, 0) and flip the y-axis.
    mat3.fromTranslation(
      this._transform,
      vec3.fromValues(-this.aabb.xmin, this.aabb.ymax, 0),
    );
    mat3.scale(
      this._transform,
      this._transform,
      vec3.fromValues(1, -1, 1),
    );

    // Apply scaling.
    mat3.mul(this._transform, mat3.fromScaling(
      mat3.create(),
      vec3.fromValues(this.sx, this.sy, 1),
    ), this._transform);

    // Place origin at the object's center.
    mat3.mul(this._transform, mat3.fromTranslation(
      mat3.create(),
      vec3.fromValues(-this.w / 2, -this.h / 2, 0),
    ), this._transform);

    // Apply rotation around the center.
    mat3.mul(this._transform, mat3.fromRotation(
      mat3.create(),
      -this.angle,
    ), this._transform);

    // Restore origin back ot its position.
    mat3.mul(this._transform, mat3.fromTranslation(
      mat3.create(),
      vec3.fromValues(this.w / 2 + this.dx, this.h / 2 + this.dy, 0),
    ), this._transform);

    // Apply global transformations.
    mat3.mul(this._transform, scene._transform, this._transform);

    // Pre-calculate the inverse.
    mat3.invert(this._inverse, this._transform);
  }

  transform(x, y) {
    const v = vec3.fromValues(x, y, 1);
    vec3.transformMat3(v, v, this._transform);
    return [v[0], v[1]];
  }

  revert(x, y) {
    const v = vec3.fromValues(x, y, 1);
    vec3.transformMat3(v, v, this._inverse);
    return [v[0], v[1]];
  }

  contains(x, y) {
    return (
      this.aabb.xmin <= x && x <= this.aabb.xmax &&
      this.aabb.ymin <= y && y <= this.aabb.ymax
    );
  }

  getRotationPoint() {
    const [x, y] = this.transform(
      this.aabb.xmin + this.aabb.w / 2,
      this.aabb.ymax + this.aabb.h * 0.05,
    );

    const signX = Math.sign(this.sx);
    const signY = Math.sign(this.sy);
    const angle = this.angle * signX * signY - scene.angle;

    const distance = 15;
    const dx = Math.sin(angle) * distance;
    const dy = Math.cos(angle) * distance;

    const rx = x - dx * signX * Math.sign(scene.sx);
    const ry = y - dy * signY * Math.sign(scene.sy);
    const radius = 5;

    return [rx, ry, radius];
  }

  show() {
    ctx.save();
    ctx.beginPath();

    this.code.forEach((path) => {
      const points = path.points
        .map((it) => this.transform(...it))
        .flat();

        if (path.type === "moveTo") {
          ctx.moveTo(...points);
        } else if (path.type === "lineTo") {
          ctx.lineTo(...points);
        } else if (path.type === "qCurveTo") {
          ctx.quadraticCurveTo(...points);
        } else if (path.type === "closePath") {
          ctx.closePath();
        }
    });

    ctx.strokeStyle = palette.object;
    ctx.stroke();
    ctx.restore();
  }

  showSelection() {
    this.showBoundingBox();
    this.showRotationPoint();
  }

  showBoundingBox() {
    const { xmin, ymin, xmax, ymax } = this.aabb;
    const px = this.aabb.w * 0.05;
    const py = this.aabb.h * 0.05;

    ctx.save();
    ctx.beginPath();

    ctx.setLineDash([10, 5]);
    ctx.moveTo(...this.transform(xmin - px, ymin - py));
    ctx.lineTo(...this.transform(xmax + px, ymin - py));
    ctx.lineTo(...this.transform(xmax + px, ymax + py));
    ctx.lineTo(...this.transform(xmin - px, ymax + py));
    ctx.closePath();

    ctx.strokeStyle = palette.primary;
    ctx.stroke();
    ctx.restore();
  }

  showRotationPoint() {
    const [rx, ry, r] = this.getRotationPoint();

    ctx.save();
    ctx.beginPath();

    ctx.arc(rx, ry, r, 0, Math.PI * 2);

    ctx.strokeStyle = palette.primary;
    ctx.stroke();
    ctx.restore();
  }

  showVertices() {
    this.code.forEach((path) => {
      const [px, py, cx, cy] = path.points
        .map((it) => this.transform(...it))
        .flat();

      if (path.type === "moveTo") {
        this.showVertex(px, py, palette.vertex.target);
      } else if (path.type === "lineTo") {
        this.showVertex(px, py, palette.vertex.target);
      } else if (path.type === "qCurveTo") {
        this.showVertex(px, py, palette.vertex.target);
        this.showVertex(cx, cy, palette.vertex.control);
      }
    });
  }

  showVertex(x, y, color) {
    const radius = Math.min(Math.abs(Math.min(
      this.w * this.sx * scene.sx,
      this.h * this.sy * scene.sy,
    )) * 0.15, 3);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);

    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.stroke();
  }
}

/*=== Scene Initialization ===*/
const message = "Runge";
const objects = message
  .split("")
  .map((it) => new Object2D(glyphs[it]));

objects.forEach((object) => {
  object.w = object.h / 8 * object.aspectRatio
  object.h = object.h / 8;
});

const canvasCenterX = ctx.canvas.width / 2;
const canvasCenterY = ctx.canvas.height / 2;

scene.dx = canvasCenterX;
scene.dy = canvasCenterY;

const offsetY = objects[0].h / 2
const offsetX = objects
  .map((it) => it.w)
  .reduce((acc, it) => acc + it) / 2;

let currentX = -offsetX;
let currentY = -offsetY;

objects.forEach((object) => {
  object.dx = currentX;
  object.dy = currentY;
  currentX += object.w;
  currentX += 16;
});

/*=== Global Controls ===*/
let hovered = null;
let selected = null;

let showVertices = false;
const toggleVertices = () => {
  showVertices = !showVertices;
};

const panning = { active: false };
const startPanning = () => {
  panning.active = true;
  document.body.style.cursor = "move";
};
const stopPanning = () => {
  panning.active = false;
  document.body.style.cursor = "";
};

let scalingVertically = false;
const startScalingVertically = () => {
  scalingVertically = true;
};
const stopScalingVertically = () => {
  scalingVertically = false;
};

let scalingHorizontally = false;
const startScalingHorizontally = () => {
  scalingHorizontally = true;
};
const stopScalingHorizontally = () => {
  scalingHorizontally = false;
};

document.addEventListener("keydown", ({ key }) => {
  if (key === "v") {
    toggleVertices();
  } else if (key === " ") {
    startPanning();
  } else if (key === "j") {
    startScalingVertically();
  } else if (key === "k") {
    startScalingHorizontally();
  }

  if (!selected) {
    if (key === "q") {
      scene.angle -= 0.08;
    } else if (key === "e") {
      scene.angle += 0.08;
    }
    return;
  }

  if (key === "q") {
    selected.angle += 0.08;
  } else if (key === "e") {
    selected.angle -= 0.08;
  } else if (key === "ArrowLeft") {
    selected.dx -= 2.5;
  } else if (key === "ArrowRight") {
    selected.dx += 2.5;
  } else if (key === "ArrowDown") {
    selected.dy += 2.5;
  } else if (key === "ArrowUp") {
    selected.dy -= 2.5;
  } else if (key === "+" || key === "=") {
    selected.w += 10 * selected.aspectRatio;
    selected.h += 10;
  } else if (key === "-" || key === "_") {
    selected.w -= 10 * selected.aspectRatio;
    selected.h -= 10;
  }
});

document.addEventListener("keyup", ({ key }) => {
  if (key === " ") {
    stopPanning();
  } else if (key === "j") {
    stopScalingVertically();
  } else if (key === "k") {
    stopScalingHorizontally();
  }
});

/*=== Object Controls ===*/
const rotation = {
  active: false,
  hovered: false,
};
const startRotating = () => {
  rotation.active = true;
  document.body.style.cursor = "grabbing";
};
const stopRotating = () => {
  rotation.active = false;
  document.body.style.cursor = "";
};

const dragging = {
  x: 0, y: 0,
  active: false,
};
const startDragging = (clientX, clientY) => {
  dragging.active = true;
  dragging.x = clientX;
  dragging.y = clientY;
};
const stopDragging = () => {
  dragging.x = 0;
  dragging.y = 0;
  dragging.active = false;
};

ctx.canvas.addEventListener("mousedown", ({ clientX, clientY }) => {
  startDragging(clientX, clientY);
  if (panning.active) return;
  if (rotation.hovered) {
    startRotating();
  } else {
    selected = hovered;
  }
});

ctx.canvas.addEventListener("mousemove", ({ clientX, clientY }) => {
  const { left, top } = ctx.canvas.getBoundingClientRect();
  const hx = clientX - left;
  const hy = clientY - top;

  hovered = objects.find((it) => it.contains(...it.revert(hx, hy)));

  if (hovered) {
    document.body.style.cursor = "move";
  } else if (!panning.active) {
    document.body.style.cursor = "";
  }

  if (selected) {
    const { left, top } = ctx.canvas.getBoundingClientRect();
    const cx = clientX - left;
    const cy = clientY - top;

    const [rx, ry, r] = selected.getRotationPoint();
    const dx = (cx - rx)**2;
    const dy = (cy - ry)**2;

    if (dx + dy <= r**2) {
      rotation.hovered = true;
      document.body.style.cursor = "grab";
    } else {
      rotation.hovered = false;
    }
  }

  if (!dragging.active) return;

  const startX = dragging.x;
  const startY = dragging.y;

  dragging.x = clientX;
  dragging.y = clientY;

  if (panning.active) {
    scene.dx += clientX - startX;
    scene.dy += clientY - startY;
    return;
  }

  if (rotation.active) {
    const [cx, cy] = selected.transform(
      selected.aabb.xmin + selected.aabb.w / 2,
      selected.aabb.ymin + selected.aabb.h / 2,
    );

    const [cx1, cy1] = scene.revert(cx, cy);
    const [cx2, cy2] = scene.revert(clientX, clientY);

    const vx = (cx1 - cx2) * Math.sign(selected.sx);
    const vy = (cy1 - cy2) * Math.sign(selected.sy);

    selected.angle = Math.atan2(vx, vy)
      * Math.sign(selected.sx)
      * Math.sign(selected.sy);

    return;
  }

  if (selected) {
    const [cx, cy] = scene.revert(clientX, clientY);
    const [sx, sy] = scene.revert(startX, startY);

    selected.dx += cx - sx;
    selected.dy += cy - sy;
    return;
  }
});

ctx.canvas.addEventListener("mouseup", () => {
  stopRotating();
  stopDragging();
});

ctx.canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = (e.deltaY >= 0 ? 1 : -1) * 10;

  if (!selected) {
    scene.sx += delta * 0.01;
    scene.sy += delta * 0.01;
    return;
  }

  if (scalingHorizontally) {
    selected.w += delta;
  } else if (scalingVertically) {
    selected.h += delta;
  } else {
    selected.w += delta * selected.aspectRatio;
    selected.h += delta;
  }
});

/*=== Main Loop ===*/
function loop() {
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  scene.update();
  scene.showOrigin();

  objects.forEach((it) => it.update());
  objects.forEach((it) => it.show());

  if (showVertices) {
    objects.forEach((it) => it.showVertices());
  }

  selected && selected.showSelection();
  requestAnimationFrame(loop);
}

loop();
