/*! Homepage Field shaders adapted from asciify-engine 4.32.8.
Source: https://registry.npmjs.org/asciify-engine/-/asciify-engine-4.32.8.tgz
The flow and glyph algorithms are retained; unused scene and print-style branches
are omitted. Fluid shader passes are preserved in home-field-fluid.js.

MIT License

Copyright (c) 2026 ayangabryl

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
// Homepage-only versions of asciify-engine 4.32.8's flow and glyph passes.
// The noise, tone mapping, glyph sampling and fluid response are unchanged.
// Upstream source and MIT license are retained above.
export const flow = (encodedFluid) => `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uFluid;
uniform vec2 uResolution, uCell, uFluidTexel;
uniform float uCount, uBlend, uScale, uTime;
uniform float uContrast, uBrightness, uGamma, uShade;
uniform float uFluidOn, uFluidMode, uRefraction, uGlow, uHighlightAuto;
uniform vec3 uInk, uHighlight;
layout(location=0) out vec4 outInk;
layout(location=1) out vec4 outUnder;
const float BAYER[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
${encodedFluid
  ? "vec4 decodeFluid(vec4 t){return vec4((t.xy*2.-1.)*6.,t.z,t.w);}"
  : "vec4 decodeFluid(vec4 t){return t;}"}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
vec3 generated(vec2 uv,float aspect){
  vec2 p=(uv-.5)*vec2(aspect,1.)*uScale;
  float t=uTime*.08;
  vec2 q=vec2(fbm(p*1.6+t),fbm(p*1.6-t+3.1));
  return vec3(smoothstep(.28,.86,fbm(p*1.8+q*1.6+vec2(t*.6,-t*.4))));
}
void main(){
  vec2 cell=floor(gl_FragCoord.xy);
  vec2 uv=(cell+.5)*uCell/uResolution;
  float aspect=uResolution.x/uResolution.y;
  vec4 fluid=vec4(0.);
  float lift=0.,wake=0.,bend=1.,swirl=0.,speed=0.;
  if(uFluidOn>.5){
    vec4 raw=texture(uFluid,vec2(uv.x,1.-uv.y));
    if(uFluidMode>.5){
      vec2 v=raw.xy*uFluidTexel*vec2(aspect,1.);
      fluid=vec4(v,0.,1.);
      swirl=clamp(dot(v,vec2(.4,.65))*uGlow*.32,-.65,.65);
      speed=clamp(length(v)*uGlow*.055,0.,.38);
      bend=.4;
    }else{
      fluid=decodeFluid(raw);
      wake=clamp(fluid.z*uGlow,0.,1.);
      lift=wake*.55;
    }
  }
  vec2 sampleAt=uv-vec2(fluid.x/aspect,-fluid.y)*uRefraction*bend;
  vec3 rgb=generated(sampleAt,aspect);
  float tone=dot(rgb,vec3(.2126,.7152,.0722));
  tone=clamp(tone,0.,1.);
  tone=clamp((tone-.5)*uContrast+.5+uBrightness,0.,1.);
  tone=pow(tone,1./uGamma);
  if(uFluidMode>.5){
    float grain=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
    lift=mix(abs(swirl)*.5+speed,swirl+speed*.35,smoothstep(.12,.55,tone))*(.65+.7*grain);
    wake=clamp(lift*1.6,0.,1.);
  }
  tone=clamp(tone+lift,0.,1.);
  float level=tone*(uCount-1.),upper=fract(level)>=.5?1.:0.;
  if(uBlend>.5&&tone>.02&&tone<.98){
    ivec2 q=ivec2(mod(gl_FragCoord.xy,4.));
    upper=fract(level)>(BAYER[q.y*4+q.x]+.5)/16.?1.:0.;
  }
  float index=min(uCount-1.,floor(level)+upper);
  vec3 ink=uInk*mix(1.,.3+.7*tone,uShade);
  vec3 lifted=uHighlightAuto>.5?ink/max(max(ink.r,ink.g),max(ink.b,.06)):uHighlight;
  ink=mix(ink,lifted,wake*.7);
  outInk=vec4(ink,index/255.);
  outUnder=vec4(0.);
}`;

export const glyph = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uAtlas, uCells, uUnder;
uniform vec2 uResolution, uCell, uPitch;
uniform float uColumns;
uniform vec4 uFade;
out vec4 outColor;
void main(){
  vec2 frag=vec2(gl_FragCoord.x,uResolution.y-gl_FragCoord.y);
  vec2 cell=floor(frag/uPitch);
  vec4 ink=texelFetch(uCells,ivec2(cell),0),under=texelFetch(uUnder,ivec2(cell),0);
  vec2 local=frag-cell*uPitch;
  vec3 rgb=ink.rgb;
  float strength=1.;
  if(uFade.w>.5){
    float top=max(rgb.r,max(rgb.g,rgb.b));
    strength=clamp(top/max(max(uFade.r,max(uFade.g,uFade.b)),.004),0.,1.);
    rgb=uFade.rgb;
  }
  float index=floor(ink.a*255.+.5);
  ivec2 tile=ivec2(int(mod(index,uColumns)),int(floor(index/uColumns)));
  vec2 texel=floor(local-floor((uPitch-uCell)*.5));
  float coverage=all(greaterThanEqual(texel,vec2(0.)))&&all(lessThan(texel,uCell))?texelFetch(uAtlas,tile*ivec2(uCell)+ivec2(texel),0).a:0.;
  coverage*=strength;
  outColor=vec4(rgb*coverage+under.rgb*(1.-coverage),coverage+under.a*(1.-coverage));
}`;
