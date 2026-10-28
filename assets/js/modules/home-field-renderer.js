import { flow, glyph } from "./home-field-shaders.js";
import { fluidShaders } from "./home-field-fluid.js";

const vertex = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;

export function createFieldRenderer(canvas, initial, report) {
  const gl = canvas.getContext("webgl2", {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: true, powerPreference: "high-performance",
  });
  if (!gl) {
    initial.atlas.close();
    report({ type: "unsupported" });
    return null;
  }

  // All GPU synchronization stays in this renderer, normally inside a Worker.
  const floating = !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
  const shaders = [];
  const programs = [];
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    shaders.push(shader);
    return shader;
  }
  const v = compile(gl.VERTEX_SHADER, vertex);
  function program(source) {
    const p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, source));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const uniforms = {};
    for (let i = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) - 1; i >= 0; i--) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
      uniforms[name] = gl.getUniformLocation(p, name);
    }
    const result = { p, uniforms };
    programs.push(result);
    return result;
  }
  const tone = program(flow(!floating));
  const composite = program(glyph);
  let fluid = null, encoded = null, fluidReady = false;
  const encodedSource = `#version 300 es
precision highp float;
uniform sampler2D uPrevious;
uniform vec2 uSize,uFrom,uTo,uForce;
uniform float uAspect,uDt,uDecay,uEnergyDecay,uRadius,uSplat;
out vec4 outColor;
vec4 decode(vec4 t){return vec4((t.xy*2.-1.)*6.,t.z,t.w);}
float segment(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.,1.);return length(pa-ba*h);}
void main(){vec2 uv=gl_FragCoord.xy/uSize;vec4 here=decode(texture(uPrevious,uv));
vec4 state=decode(texture(uPrevious,uv-uDt*here.xy*vec2(1./uAspect,1.)));
state.xy*=exp(-uDt*uDecay);state.z*=exp(-uDt*uEnergyDecay);
if(uSplat>.5){vec2 scale=vec2(uAspect,1.);float d=segment(uv*scale,uFrom*scale,uTo*scale);
float g=exp(-d*d/(uRadius*uRadius));state.xy+=uForce*g;state.z=min(1.,state.z+g*min(1.,length(uForce)*.5+.08));}
float speed=length(state.xy);if(speed>5.)state.xy*=5./speed;
outColor=vec4(clamp(state.xy/6.*.5+.5,0.,1.),clamp(state.z,0.,1.),1.);}`;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  let settings = initial;
  let targets = [];
  let cells, velocity, pressure, divergence, curl, atlas;
  let fluidWidth, fluidHeight;
  let frame = 0, last = 0, time = 0, wakeUntil = 0;
  let pointer = null, splat = null;
  let ready = false, lost = false, destroyed = false, dirty = true;
  let fence = null, fenceTimer = 0, fluidTimer = 0;
  const requestFrame = globalThis.requestAnimationFrame?.bind(globalThis) || ((fn) => setTimeout(() => fn(performance.now()), 16));
  const cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis) || clearTimeout;

  function texture(width, height, filter = gl.NEAREST, rgba8 = !floating) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texStorage2D(gl.TEXTURE_2D, 1, rgba8 ? gl.RGBA8 : gl.RGBA16F, width, height);
    return t;
  }
  function target(width, height, filter) {
    const t = texture(width, height, filter);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("Field framebuffer is incomplete");
    gl.clearColor(floating ? 0 : 0.5, floating ? 0 : 0.5, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const value = { t, f };
    targets.push(value);
    return value;
  }
  function releaseTargets() {
    for (const t of targets) { gl.deleteTexture(t.t); gl.deleteFramebuffer(t.f); }
    targets = [];
  }
  function resize(next) {
    settings = { ...settings, ...next };
    if (!next.atlas) return;
    releaseTargets();
    if (atlas) gl.deleteTexture(atlas);
    canvas.width = settings.width;
    canvas.height = settings.height;
    atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, next.atlas);
    next.atlas.close();
    settings.atlas = null;
    const columns = Math.ceil(settings.width / settings.cellWidth - 1e-4);
    const rows = Math.ceil(settings.height / settings.cellHeight - 1e-4);
    cells = target(columns, rows, gl.NEAREST);
    const under = texture(columns, rows);
    targets.push({ t: under, f: null });
    cells.under = under;
    cells.columns = columns;
    cells.rows = rows;
    gl.bindFramebuffer(gl.FRAMEBUFFER, cells.f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, under, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    const aspect = settings.width / settings.height;
    fluidWidth = aspect >= 1 ? 128 : Math.max(8, Math.round(128 * aspect));
    fluidHeight = aspect >= 1 ? Math.max(8, Math.round(128 / aspect)) : 128;
    if (fluidReady) allocateFluid();
    pointer = splat = null;
    wakeUntil = 0;
  }
  function allocateFluid() {
    velocity = [target(fluidWidth, fluidHeight, gl.LINEAR), target(fluidWidth, fluidHeight, gl.LINEAR)];
    if (floating) {
      pressure = [target(fluidWidth, fluidHeight), target(fluidWidth, fluidHeight)];
      divergence = target(fluidWidth, fluidHeight);
      curl = target(fluidWidth, fluidHeight);
    }
  }
  function prepareFluid() {
    if (destroyed || lost || fluidReady || settings.reduced || !settings.visible) return;
    if (floating) fluid = Object.fromEntries(Object.entries(fluidShaders).map(([key, source]) => [key, program(source)]));
    else encoded = program(encodedSource);
    allocateFluid();
    fluidReady = true;
    dirty = true;
    schedule();
  }
  function use(p, target, width, height) {
    gl.useProgram(p.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.f || null);
    gl.viewport(0, 0, width, height);
    return p.uniforms;
  }
  function bind(u, name, unit, t) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(u[name], unit);
  }
  const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);
  const swap = (pair) => pair.reverse();
  function step(dt, now) {
    if (!fluidReady || settings.reduced || (!splat && now >= wakeUntil)) return;
    const aspect = settings.width / settings.height;
    if (splat) wakeUntil = now + 1000 * (floating ? Math.min(9, 6 / 1.3) : 7 / 1.3);
    if (!floating) {
      const u = use(encoded, velocity[1], fluidWidth, fluidHeight);
      bind(u, "uPrevious", 0, velocity[0].t);
      gl.uniform2f(u.uSize, fluidWidth, fluidHeight);
      gl.uniform1f(u.uAspect, aspect);
      gl.uniform1f(u.uDt, dt);
      gl.uniform1f(u.uDecay, 1.3);
      gl.uniform1f(u.uEnergyDecay, 1.43);
      gl.uniform1f(u.uRadius, 0.09);
      gl.uniform1f(u.uSplat, splat ? 1 : 0);
      gl.uniform2f(u.uFrom, ...(splat?.from || [0, 0]));
      gl.uniform2f(u.uTo, ...(splat?.to || [0, 0]));
      gl.uniform2f(u.uForce, splat ? (splat.to[0] - splat.from[0]) * aspect * 12 : 0, splat ? (splat.to[1] - splat.from[1]) * 12 : 0);
      draw(); swap(velocity); splat = null; return;
    }
    const pass = (p, output, inputs, configure) => {
      const u = use(p, output, fluidWidth, fluidHeight);
      gl.uniform2f(u.uTexel, 1 / fluidWidth, 1 / fluidHeight);
      inputs.forEach(([name, t], i) => bind(u, name, i, t));
      configure?.(u); draw();
    };
    if (splat) pass(fluid.splat, velocity[1], [["uVelocity", velocity[0].t]], (u) => {
      gl.uniform2f(u.uFrom, ...splat.from); gl.uniform2f(u.uTo, ...splat.to);
      gl.uniform2f(u.uForce, (splat.to[0] - splat.from[0]) * 5200, (splat.to[1] - splat.from[1]) * 5200);
      gl.uniform1f(u.uAspect, aspect); gl.uniform1f(u.uRadius, 0.099);
    });
    if (splat) swap(velocity);
    splat = null;
    pass(fluid.curl, curl, [["uVelocity", velocity[0].t]]);
    pass(fluid.vorticity, velocity[1], [["uVelocity", velocity[0].t], ["uCurl", curl.t]], (u) => {
      gl.uniform1f(u.uStrength, 24); gl.uniform1f(u.uDt, Math.min(dt, 1 / 60));
    }); swap(velocity);
    pass(fluid.divergence, divergence, [["uVelocity", velocity[0].t]]);
    pass(fluid.fade, pressure[1], [["uSource", pressure[0].t]], (u) => gl.uniform1f(u.uAmount, 0.8)); swap(pressure);
    for (let i = 0; i < 20; i++) {
      pass(fluid.pressure, pressure[1], [["uPressure", pressure[0].t], ["uDivergence", divergence.t]]); swap(pressure);
    }
    pass(fluid.gradient, velocity[1], [["uPressure", pressure[0].t], ["uVelocity", velocity[0].t]]); swap(velocity);
    pass(fluid.advect, velocity[1], [["uVelocity", velocity[0].t]], (u) => {
      gl.uniform1f(u.uDt, Math.min(dt, 1 / 60)); gl.uniform1f(u.uDissipation, 1.3);
    }); swap(velocity);
  }
  function render() {
    const s = settings;
    const ink = s.dark ? [129 / 255, 147 / 255, 143 / 255] : [115 / 255, 124 / 255, 121 / 255];
    let u = use(tone, cells, cells.columns, cells.rows);
    bind(u, "uFluid", 0, fluidReady ? velocity[0].t : neutral);
    gl.uniform2f(u.uResolution, s.width, s.height);
    gl.uniform2f(u.uCell, s.cellWidth, s.cellHeight);
    gl.uniform2f(u.uFluidTexel, 1 / fluidWidth, 1 / fluidHeight);
    gl.uniform1f(u.uCount, s.characters);
    gl.uniform1f(u.uBlend, 0);
    gl.uniform1f(u.uScale, s.mobile ? 1.6 : 1);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uContrast, 1.1);
    gl.uniform1f(u.uBrightness, s.mobile && s.dark ? 0.08 : 0);
    gl.uniform1f(u.uGamma, 1);
    gl.uniform1f(u.uShade, s.dark ? (s.mobile ? 0.1 : 0.4) : 0);
    gl.uniform1f(u.uFluidOn, s.reduced || !fluidReady ? 0 : 1);
    gl.uniform1f(u.uFluidMode, floating && fluidReady ? 1 : 0);
    gl.uniform1f(u.uRefraction, s.reduced ? 0 : 0.04);
    gl.uniform1f(u.uGlow, 0.7);
    gl.uniform1f(u.uHighlightAuto, 0);
    gl.uniform3fv(u.uInk, ink);
    gl.uniform3f(u.uHighlight, 66 / 255, 151 / 255, 157 / 255);
    draw();
    u = use(composite, null, s.width, s.height);
    bind(u, "uAtlas", 0, atlas); bind(u, "uCells", 1, cells.t); bind(u, "uUnder", 2, cells.under);
    gl.uniform2f(u.uResolution, s.width, s.height);
    gl.uniform2f(u.uCell, s.cellWidth, s.cellHeight);
    gl.uniform2f(u.uPitch, s.cellWidth, s.cellHeight);
    gl.uniform1f(u.uColumns, s.columns);
    gl.uniform4f(u.uFade, ...ink, 0);
    draw();
  }
  function confirmFrame() {
    if (destroyed || lost) return;
    const status = gl.clientWaitSync(fence, 0, 0);
    if (status === gl.TIMEOUT_EXPIRED) { fenceTimer = setTimeout(confirmFrame, 8); return; }
    gl.deleteSync(fence); fence = null;
    if (status === gl.WAIT_FAILED) {
      if (gl.isContextLost()) return;
      throw new Error("Field frame did not complete");
    }
    if (!ready) {
      ready = true;
      report({ type: "ready" });
      // Present the field before warming the interaction-only programs.
      fluidTimer = setTimeout(prepareFluid, 32);
    }
    if (!settings.reduced || dirty) schedule();
  }
  function tick(now) {
    frame = 0;
    if (destroyed || lost || !settings.visible) return;
    // The slowly evolving field needs fewer updates while idle. Fluid input
    // retains its full render budget; CSS fades remain compositor-driven.
    const lowPower = navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 2 || navigator.connection?.saveData;
    if (last && !dirty && !splat && now >= wakeUntil && now - last < 1000 / (lowPower ? 15 : 20) - 2) {
      schedule(); return;
    }
    const elapsed = last ? (now - last) / 1000 : 1 / 60;
    const dt = Math.min(1 / 30, Math.max(1 / 480, elapsed));
    last = now;
    if (!settings.reduced) time += Math.min(elapsed, 0.25) * 0.8;
    dirty = false;
    step(dt, now); render();
    // Keep at most one GPU frame in flight. A fast Worker must not build a
    // command backlog that starves the page compositor or survives navigation.
    fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    confirmFrame();
  }
  function schedule() { if (!frame && !fence && !lost && settings.visible) frame = requestFrame(tick); }
  function onLost(event) { event.preventDefault(); lost = true; if (frame) cancelFrame(frame); frame = 0; clearTimeout(fenceTimer); }
  function onRestored() { report({ type: "restore" }); }
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  const neutral = texture(1, 1, gl.NEAREST, true);
  resize(initial); schedule();
  return {
    update(next) {
      resize(next);
      dirty = true;
      if (next.visible === false && frame) { cancelFrame(frame); frame = 0; }
      last = 0;
      if (settings.reduced) pointer = splat = null;
      else if (ready && !fluidReady) fluidTimer = setTimeout(prepareFluid, 0);
      schedule();
    },
    pointer(point) {
      if (settings.reduced) return;
      if (point && pointer) splat = { from: splat?.from || pointer, to: point };
      pointer = point;
      schedule();
    },
    destroy() {
      destroyed = true; if (frame) cancelFrame(frame); clearTimeout(fenceTimer); clearTimeout(fluidTimer);
      canvas.removeEventListener("webglcontextlost", onLost); canvas.removeEventListener("webglcontextrestored", onRestored);
      if (fence) gl.deleteSync(fence);
      releaseTargets(); gl.deleteTexture(atlas); gl.deleteTexture(neutral); gl.deleteVertexArray(vao);
      programs.forEach(({ p }) => gl.deleteProgram(p)); shaders.forEach((shader) => gl.deleteShader(shader));
    },
  };
}
