import { matches, QUERIES } from './media.js';

export class FluidEngine {
    constructor(introNode, wrapperNode) {
        this.intro = introNode;
        this.wrapper = wrapperNode;
        this.reduced = matches(QUERIES.reducedMotion);
        
        this.canvas = null;
        this.gl = null;
        this.prog = null;
        
        this.rafId = null;
        this.resizeRafId = null;
        this.isPaused = false;
        this.isContextLost = false;
        
        this.mx = 0.5; this.my = 0.5; this.tmx = 0.5; this.tmy = 0.5;
        this.vx = 0; this.vy = 0;
        this.tx = 0; this.ty = 0; this.cx = 0; this.cy = 0;
        this.hover = 0; this.targetHover = 0;
        
        this.startPerf = performance.now();
        
        this.handleResize = this.handleResize.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleContextLost = this.handleContextLost.bind(this);
        this.handleContextRestored = this.handleContextRestored.bind(this);
        this.loop = this.loop.bind(this);
    }
    
    init() {
        this.intro.style.position = 'relative';
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position:absolute;pointer-events:none;z-index:0;transition:opacity 0.5s ease;opacity:0;';
        this.intro.insertBefore(this.canvas, this.intro.firstChild);
        
        this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
        this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
        
        if (!this.setupWebGL()) {
            this.canvas.remove();
            return false;
        }
        
        window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
        document.addEventListener('mouseleave', this.handleMouseLeave, { passive: true });
        window.addEventListener('resize', this.handleResize, { passive: true });
        
        this.doResize();
        
        requestAnimationFrame(() => {
            if (this.canvas) this.canvas.style.opacity = '1';
        });
        
        return true;
    }
    
    setupWebGL() {
        this.gl = this.canvas.getContext('webgl');
        if (!this.gl) return false;
        this.gl.clearColor(0, 0, 0, 0);
        
        const vert = [
            'attribute vec2 a_pos;',
            'void main(){gl_Position=vec4(a_pos,0,1);}'
        ].join('\n');
        
        const frag = [
            'precision mediump float;',
            'uniform float u_time;',
            'uniform vec2  u_res;',
            'uniform vec2  u_mouse;',
            'uniform vec2  u_vel;',
            'uniform float u_hover;',
            
            'vec2 hash(vec2 p){',
            '  p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));',
            '  return -1.0+2.0*fract(sin(p)*43758.5453);',
            '}',
            'float noise(vec2 p){',
            '  vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);',
            '  return mix(mix(dot(hash(i),f),dot(hash(i+vec2(1,0)),f-vec2(1,0)),u.x),',
            '             mix(dot(hash(i+vec2(0,1)),f-vec2(0,1)),dot(hash(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);',
            '}',
            'float fbm(vec2 p){',
            '  float v=0.0,a=0.5;',
            '  mat2 rot=mat2(0.8,0.6,-0.6,0.8);',
            '  for(int i=0;i<5;i++){v+=a*noise(p);p=rot*p*2.1+vec2(100.0);a*=0.5;}',
            '  return v;',
            '}',
            'void main(){',
            '  vec2 uv=gl_FragCoord.xy/u_res;',
            '  float t=u_time*0.12;',
            '  vec2 p=uv*2.8;',
            '  vec2 md=uv-u_mouse;',
            '  float mdist=length(md);',
            '  float falloff=exp(-mdist*3.5)*u_hover;',
            '  vec2 drag=u_vel*falloff*2.2;',
            '  p+=drag;',
            '  float localT=t+falloff*1.4;',
            '  p+=vec2(fbm(p+vec2(0.0,localT)*0.4)-0.5,fbm(p+vec2(3.1,localT)*0.4)-0.5)*falloff*0.4;',
            '  vec2 q=vec2(fbm(p+vec2(0.0,t)),fbm(p+vec2(5.2,t+1.3)));',
            '  vec2 r=vec2(fbm(p+4.0*q+vec2(1.7,t*0.9)),fbm(p+4.0*q+vec2(9.2,t*0.6)));',
            '  float f=fbm(p+4.0*r);',
            '  float g=0.80+f*0.22;',
            '  g=clamp(g,0.0,1.0);',
            '  float dist=length(uv-vec2(0.5));',
            '  float alpha=(1.0-smoothstep(0.05,0.5,dist))*0.62;',
            '  vec3 color=vec3(g);',
            '  gl_FragColor=vec4(color*alpha,alpha);',
            '}'
        ].join('\n');
        
        const compile = (type, src) => {
            const s = this.gl.createShader(type);
            if (!s) return null;
            this.gl.shaderSource(s, src);
            this.gl.compileShader(s);
            if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
                this.gl.deleteShader(s);
                return null;
            }
            return s;
        };
        
        const vertex = compile(this.gl.VERTEX_SHADER, vert);
        const fragment = compile(this.gl.FRAGMENT_SHADER, frag);
        this.prog = this.gl.createProgram();
        if (!vertex || !fragment || !this.prog) {
            if (vertex) this.gl.deleteShader(vertex);
            if (fragment) this.gl.deleteShader(fragment);
            if (this.prog) this.gl.deleteProgram(this.prog);
            this.prog = null;
            return false;
        }
        this.gl.attachShader(this.prog, vertex);
        this.gl.attachShader(this.prog, fragment);
        this.gl.linkProgram(this.prog);
        this.gl.deleteShader(vertex);
        this.gl.deleteShader(fragment);
        if (!this.gl.getProgramParameter(this.prog, this.gl.LINK_STATUS)) {
            this.gl.deleteProgram(this.prog);
            this.prog = null;
            return false;
        }
        this.gl.useProgram(this.prog);
        
        const buf = this.gl.createBuffer();
        if (!buf) {
            this.gl.deleteProgram(this.prog);
            this.prog = null;
            return false;
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), this.gl.STATIC_DRAW);
        const loc = this.gl.getAttribLocation(this.prog, 'a_pos');
        this.gl.enableVertexAttribArray(loc);
        this.gl.vertexAttribPointer(loc, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        
        this.uTime  = this.gl.getUniformLocation(this.prog, 'u_time');
        this.uRes   = this.gl.getUniformLocation(this.prog, 'u_res');
        this.uMouse = this.gl.getUniformLocation(this.prog, 'u_mouse');
        this.uVel   = this.gl.getUniformLocation(this.prog, 'u_vel');
        this.uHover = this.gl.getUniformLocation(this.prog, 'u_hover');
        return true;
    }
    
    handleContextLost(e) {
        e.preventDefault();
        this.isContextLost = true;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
    
    handleContextRestored() {
        this.isContextLost = false;
        if (!this.setupWebGL()) {
            this.pause();
            this.canvas.style.opacity = '0';
            return;
        }
        this.doResize();
        if (!this.isPaused) {
            this.start();
        }
    }
    
    handleMouseMove(e) {
        if (this.isPaused || this.reduced || this.isContextLost) return;
        const rx = (e.clientX / window.innerWidth  - 0.5) * 2;
        const ry = (e.clientY / window.innerHeight - 0.5) * 2;
        this.tx = -rx * 14; 
        this.ty = -ry * 8;
        
        const r = this.canvas.getBoundingClientRect();
        const relX = (e.clientX - r.left) / r.width;
        const relY = 1.0 - (e.clientY - r.top) / r.height;
        this.tmx = relX; 
        this.tmy = relY;
        this.targetHover = (relX > 0 && relX < 1 && relY > 0 && relY < 1) ? 1 : 0;
    }
    
    handleMouseLeave() {
        this.targetHover = 0;
    }
    
    handleResize() {
        if (this.resizeRafId) return;
        this.resizeRafId = requestAnimationFrame(() => {
            this.resizeRafId = null;
            this.doResize();
        });
    }
    
    doResize() {
        if (!this.gl || this.isContextLost || !this.canvas || !this.wrapper || !this.intro) return;
        const wr = this.wrapper.getBoundingClientRect();
        const ir = this.intro.getBoundingClientRect();
        const cw = wr.width  * 1.55;
        const ch = wr.height * 1.05;
        if (cw < 1 || ch < 1) return;
        
        const cl = (wr.left - ir.left) + (wr.width - cw) / 2;
        const ct = (wr.top  - ir.top)  + (wr.height - ch) / 2;
        
        this.canvas.style.left   = cl + 'px';
        this.canvas.style.top    = ct + 'px';
        this.canvas.style.width  = cw + 'px';
        this.canvas.style.height = ch + 'px';
        const scale = Math.min(devicePixelRatio, 1);
        this.canvas.width  = Math.round(cw * scale);
        this.canvas.height = Math.round(ch * scale);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.reduced && !this.isPaused) {
            this.renderFrame();
        }
    }
    
    start() {
        if (!this.gl || !this.prog || this.isContextLost) return;
        this.isPaused = false;
        
        if (this.reduced) {
            this.renderFrame();
            return;
        }
        
        if (!this.rafId && !this.isContextLost) {
            this.loop();
        }
    }
    
    pause() {
        this.isPaused = true;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
    
    renderFrame() {
        if (!this.gl || !this.prog || this.isContextLost) return;
        
        if (!this.reduced) {
            this.cx += (this.tx - this.cx) * 0.1; 
            this.cy += (this.ty - this.cy) * 0.1;
            this.wrapper.style.transform = `translate(${this.cx.toFixed(2)}px,${this.cy.toFixed(2)}px)`;
        }
        
        const prevMx = this.mx, prevMy = this.my;
        this.mx += (this.tmx - this.mx) * 0.05;
        this.my += (this.tmy - this.my) * 0.05;
        const fvx = (this.mx - prevMx) * 7;
        const fvy = (this.my - prevMy) * 7;
        this.vx += (fvx - this.vx) * 0.25;
        this.vy += (fvy - this.vy) * 0.25;
        this.hover += (this.targetHover - this.hover) * 0.08;
        
        this.gl.uniform1f(this.uTime,  (performance.now() - this.startPerf) / 1000);
        this.gl.uniform2f(this.uRes,   this.canvas.width, this.canvas.height);
        this.gl.uniform2f(this.uMouse, this.mx, this.my);
        this.gl.uniform2f(this.uVel,   this.vx, this.vy);
        this.gl.uniform1f(this.uHover, this.hover);
        
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
    
    loop() {
        if (this.isPaused || this.isContextLost) {
            this.rafId = null;
            return;
        }
        
        this.renderFrame();
        this.rafId = requestAnimationFrame(this.loop);
    }
}
