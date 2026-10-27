/*! asciify-engine 4.32.8; background + wordField only.
Source: https://registry.npmjs.org/asciify-engine/-/asciify-engine-4.32.8.tgz
Bundle: esbuild --bundle --tree-shaking=true --format=esm --target=es2020 --minify

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
var Ya={none:3,flow:1,orb:2,drift:4,swell:5,caustics:6,contour:7,aurora:8,ripple:9,halo:10,interference:11,mesh:12,cascade:13,constellation:14},la=e=>e?`
const float VSCALE=6.;
vec4 decodeFluid(vec4 t){return vec4((t.xy*2.-1.)*VSCALE,t.z,t.w);}
vec4 encodeFluid(vec4 v){return vec4(clamp(v.xy/VSCALE*.5+.5,0.,1.),clamp(v.z,0.,1.),1.);}`:`
vec4 decodeFluid(vec4 t){return t;}
vec4 encodeFluid(vec4 v){return vec4(v.xyz,1.);}`,sa=e=>`#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uSource, uFluid;
uniform vec2 uResolution, uCell;
uniform float uCount, uBlend;
const float BAYER[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
uniform vec3 uRamp[6];
uniform float uRampCount;
// The gradient map: the tone run through the ramp's stops, evenly spaced, faintest first.
vec3 rampAt(float t){
  float x=clamp(t,0.,1.)*(uRampCount-1.);
  int i=int(min(floor(x),uRampCount-2.));
  vec3 a=uRamp[0],b=uRamp[1];
  for(int k=1;k<5;k++)if(k==i){a=uRamp[k];b=uRamp[k+1];}
  return mix(a,b,clamp(x-float(i),0.,1.));
}
uniform vec4 uSourceMap;
uniform int uScene;
uniform vec3 uInk, uHighlight;
uniform vec4 uBackground;
uniform float uBrightness, uContrast, uGamma, uInvert, uVignette, uSourceColor;
uniform float uRefraction, uGlow, uTime, uDrift, uFluidOn, uLod, uSaturation, uBackdrop, uShade, uHighlightAuto, uFluidMode;
uniform vec2 uFluidTexel;
uniform int uHoverMode;
uniform vec3 uLight;
uniform vec3 uTrail[12];
uniform float uLightRadius, uLightGain, uClock, uFlicker, uTrailAmount;
uniform sampler2D uTrailMap, uScope;
uniform float uScopeMode;
uniform vec2 uLevels;
uniform int uMark;
uniform float uScale, uClearFeather, uClearShape, uOrder;
// Text order by rows: each word's first glyph index and length, and how many words there are (0 reads the charset as one stream).
uniform vec2 uWords[8];
uniform float uWordCount;
uniform vec4 uClear;
uniform vec4 uPulse[4];
uniform sampler2D uTapMap;
uniform float uTapOn;
uniform sampler2D uClearMap;
uniform float uClearMapOn, uClearBend;
uniform vec2 uClearTexel;
layout(location=0) out vec4 outInk;
layout(location=1) out vec4 outUnder;
${la(e)}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
vec3 generated(vec2 uv,float aspect){
  vec2 p=(uv-.5)*vec2(aspect,1.)*uScale;
  if(uScene==1){
    float t=uTime*.08;
    vec2 q=vec2(fbm(p*1.6+t),fbm(p*1.6-t+3.1));
    return vec3(smoothstep(.28,.86,fbm(p*1.8+q*1.6+vec2(t*.6,-t*.4))));
  }
  if(uScene==2){
    float r=.36,d=length(p),a=uTime*.25;
    vec3 l=normalize(vec3(cos(a)*.8,.55,sin(a)*.6+.6));
    if(d<r){
      vec3 n=normalize(vec3(p.x,-p.y,sqrt(r*r-d*d)));
      float diffuse=max(dot(n,l),0.),rim=pow(1.-n.z,2.5);
      float lon=atan(n.x,n.z)+uTime*.35,lat=asin(clamp(n.y,-1.,1.));
      float bands=.5+.25*sin(lat*14.)+.25*sin(lon*6.);
      return vec3(clamp(diffuse*.85+rim*.5+bands*.12,0.,1.));
    }
    return vec3(exp(-pow((d-r)*9.,2.))*.35);
  }
  if(uScene==4){
    // Drift: a few broad lobes that wander slowly. Built for halftone, where large soft shapes read best.
    float t=uTime*.045;
    vec2 q=p*1.15;
    vec2 w=vec2(fbm(q*.7+vec2(t,-t*.7)),fbm(q*.7+vec2(4.3-t*.8,t+1.7)));
    float n=fbm(q+w*1.3+vec2(t*.4,t*.25));
    return vec3(smoothstep(.36,.74,n));
  }
  if(uScene==5){
    // Swell: three crossing swells, the second bent by the first, so crests roll diagonally instead of pooling.
    float t=uTime;
    float s=sin((dot(p,vec2(.94,.33))/.95-t/9.)*6.2831853);
    float c=sin((dot(p,vec2(.6,-.8))/.58-t/13.)*6.2831853+s*.9);
    float k=sin((dot(p,vec2(-.29,.96))/.36+t/17.)*6.2831853);
    return vec3(smoothstep(.3,.9,.5+.5*(s*.5+c*.35+k*.15)));
  }
  // The kit's background scenes. Each starts a little way in, so a reduced-motion still is already composed.
  float t=uTime+40.,px=uCell.y/uResolution.y*uScale;
  if(uScene==6){
    // Caustics: light focused by a moving water surface. Two layers of warped sine waves drift against each other; each draws
    // smooth filaments along its zero line, about a character wide. Where they cross the light lifts a little, never to a blot.
    float tt=t*.12,a=0.,b=0.;
    for(int l=0;l<2;l++){
      float f=float(l),sc=5.4+f*2.4;
      vec2 q=(l==0?p:mat2(.8,-.6,.6,.8)*p)*sc;
      q+=vec2(sin(q.y*.45+tt*(1.+f*.3)),cos(q.x*.4-tt*(.8+f*.4)))*1.3;
      float v=sin(q.x+1.4*sin(q.y*.7+tt))+sin(q.y*1.1+1.2*sin(q.x*.8-tt*1.3))*.9;
      float wv=max(fwidth(v),1e-4);
      float line=(1.-smoothstep(.2,1.5,abs(v)/wv))*(l==0?.78:.62)+exp(-abs(v)/(wv*5.))*.16;
      if(l==0)a=line;else b=line;
    }
    float pulse=.85+.15*sin(tt*3.+p.x*1.7-p.y*1.1);
    float light=max(a,b)+.3*min(a,b);
    return vec3(clamp(light*light*pulse,0.,.78));
  }
  if(uScene==7){
    // Contour: a slow terrain read as survey lines about a character wide at any size; every fifth is an index line.
    float tt=t*.02;
    vec2 q=p*1.15+vec2(tt,-tt*.6);
    float h=noise(q)*.62+noise(q*2.07+3.1)*.27+noise(q*4.3-tt+7.)*.11;
    h+=.08*sin(tt*2.+p.x*.8);
    float k=h*13.,w=max(fwidth(k),1e-4),d=abs(fract(k+.5)-.5)/w;
    float major=mod(floor(k+.5),5.)<.5?1.:0.;
    return vec3((1.-smoothstep(.35,1.25-major*.25,d))*mix(.55,1.,major));
  }
  if(uScene==8){
    // Aurora: three curtains at different distances hang from the top. Far ones sit higher and dimmer; the nearest is tallest
    // and brightest. Each folds slowly and is brightest along its lower hem, fading upward. The rays are set per character
    // column, so the curtains read as vertical strokes at any stage size, from a small card to a phone.
    float tt=t*.05,a=0.,cw=uCell.x/uResolution.x;
    float col=floor(uv.x/cw+.5);
    for(int n=0;n<3;n++){
      float f=float(n),near=f/2.;
      float x=p.x*(1.3-near*.4)+f*3.7;
      float hem=-.28+near*.3+.16*sin(x*1.3+tt*(.9+f*.25)+f*2.)+.045*sin(x*3.4-tt*1.5+f);
      float d=hem-p.y;
      float body=d>0.?exp(-d/(.14+near*.26))*(.45+.55*exp(-d/.03)):exp(-d*d/.0002);
      float fold=.5+.5*sin(x*2.1+tt*.9+f*1.7+.7*sin(x*.8-tt*.6));
      float ray=mix(hash(vec2(col,f*7.1)),noise(vec2(col*.18+f*9.,tt*.7+f)),.55);
      float layer=clamp(body*(.1+.9*fold*fold)*(.2+.8*ray)*(.4+near*.6)*4.2,0.,1.);
      a=1.-(1.-a)*(1.-layer);
    }
    return vec3(smoothstep(.12,.9,a));
  }
  if(uScene==9){
    // Ripple: still water. Drops land here and there, each a few rings that widen and fade; the pointer drops its own.
    float tone=0.,g=.72;
    vec2 q=p/g,id=floor(q);
    for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
      vec2 c=id+vec2(i,j),h=vec2(hash(c),hash(c+7.3));
      float period=5.+h.x*5.,age=fract(t*.3/period*4.+h.y);
      vec2 at=(c+.2+.6*h)*g;
      float d=length(p-at),r=age*.62;
      float rings=max(0.,cos((d-r)*34.))*exp(-pow((d-r)/.11,2.));
      tone+=rings*pow(1.-age,1.8)*smoothstep(0.,.06,age)*(.7+.3*h.x);
    }
    return vec3(clamp(tone*1.25,0.,1.));
  }
  if(uScene==10){
    // Halo: a slow breathing corona that frames the content, its rays turning. The ring fits the stage: wide on a desktop
    // hero, tall on a phone, so the whole halo stays on screen; the middle stays empty for a headline.
    vec2 r=vec2(min(.46,aspect*.4),min(.34,.36/max(aspect,.01)*.5+.2));
    vec2 e=p/r;
    float d=length(e),a=atan(e.y,e.x),tt=t*.07,k=min(r.x,r.y);
    float breathe=1.+.04*sin(tt*3.1);
    float rays=.5+.5*noise(vec2(a*3.2+tt,tt*.5))*(.6+.4*noise(vec2(a*7.-tt*1.2,3.+tt*.4)));
    float s=(d-breathe)*k;
    float rim=exp(-pow(s/.03,2.));
    float corona=exp(-max(0.,s)/(.1+.08*rays))*smoothstep(-.04,.015,s)*rays*smoothstep(.36,.12,s);
    return vec3(clamp(rim*(.55+.45*rays)+corona*.85,0.,1.));
  }
  if(uScene==11){
    // Interference: two ring grids from slowly orbiting centres. Where they cross, broad moire bands open and close.
    float tt=t*.05;
    vec2 a=vec2(-.3+.12*sin(tt),.07*cos(tt*1.3)),b=vec2(.3+.1*cos(tt*.8),-.06*sin(tt*1.1));
    float f=6.2831853/max(px*4.6,.004);
    float m=cos(length(p-a)*f)+cos(length(p-b)*f);
    return vec3(smoothstep(.7,2.,m));
  }
  if(uScene==12){
    // Mesh: four soft lights on slow Lissajous paths, a gradient mesh written in characters.
    float tt=t*.07,m=0.;
    for(int n=0;n<4;n++){
      float f=float(n)*1.7;
      vec2 c=vec2(.66*sin(tt*(.7+f*.13)+f),.34*cos(tt*(.9-f*.07)+f*1.3));
      float s=.3+.07*sin(tt+f);
      m+=exp(-dot(p-c,p-c)/(s*s))*(.8-float(n)*.1);
    }
    return vec3(smoothstep(.06,1.1,m));
  }
  if(uScene==13){
    // Cascade: streaks fall in three depths. Far ones are frequent, faint, short and slow; near ones rare, long, bright and
    // quick. Each has a bright head and a tail that fades behind it, and a column can carry two streaks at once.
    float tone=0.,cw=uCell.x/uResolution.x,ch=uCell.y/uResolution.y;
    float col=floor(uv.x/cw+.5);
    for(int n=0;n<3;n++){
      float f=float(n);
      for(int k=0;k<2;k++){
        float seed=f*13.1+float(k)*41.7,h=hash(vec2(col,seed));
        if(h<1.-(.5-f*.15))continue;
        float speed=(.045+f*.07)*(.75+.5*hash(vec2(col,seed+2.)));
        float tail=.12+f*.16,y=fract(t*speed+hash(vec2(col,seed+5.)))*(1.+tail*2.)-tail;
        float d=y-uv.y;
        if(d<0.||d>tail)continue;
        float head=d<ch*1.2?1.:0.;
        tone=max(tone,max(head*(.55+f*.22),pow(1.-d/tail,1.7)*(.28+f*.3)));
      }
    }
    return vec3(clamp(tone,0.,1.));
  }
  if(uScene==14){
    // Constellation: points wander in their own cells; neighbours close enough are linked by fine lines. Each point is a
    // bright core in a soft halo, so it reads at card size as well as full width.
    float g=.23,tt=t*.18;
    vec2 q=p/g,id=floor(q);
    vec2 pts[9];
    for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
      vec2 c=id+vec2(i,j);
      float h=hash(c),k=hash(c+3.7);
      pts[(j+1)*3+i+1]=c+.5+.36*vec2(sin(tt*(.6+h)+h*6.28),cos(tt*(.5+k)+k*6.28));
    }
    float line=0.,star=0.,lw=max(px/g,.02);
    for(int n=0;n<9;n++){
      vec2 e=q-pts[n];
      float d2=dot(e,e),tw=.8+.2*sin(tt*3.+float(n)*1.7);
      star=max(star,max(exp(-d2/(lw*lw*1.6)),.38*exp(-d2/(lw*lw*7.)))*tw);
      for(int m=n+1;m<9;m++){
        vec2 a=pts[n],ba=pts[m]-a;
        float len=length(ba);
        if(len>1.35)continue;
        float hh=clamp(dot(q-a,ba)/dot(ba,ba),0.,1.);
        float d=length(q-a-ba*hh);
        line=max(line,(1.-smoothstep(lw*.3,lw*.75,d))*smoothstep(1.35,.6,len)*.72);
      }
    }
    return vec3(clamp(max(line,star),0.,1.));
  }
  return vec3(0.);
}
// Hover scope: 1 where the pointer response may act. The map holds the source's soft subject coverage in alpha.
float hoverScope(vec2 uv){
  if(uScopeMode<.5||uScene!=0)return 1.;
  vec2 s=uv*uSourceMap.xy+uSourceMap.zw;
  float c=(s.x<0.||s.y<0.||s.x>1.||s.y>1.)?0.:texture(uScope,s).a;
  return uScopeMode<1.5?c:1.-c;
}
void main(){
  vec2 cell=floor(gl_FragCoord.xy);
  vec2 uv=(cell+.5)*uCell/uResolution;
  float aspect=uResolution.x/uResolution.y;
  float hs=hoverScope(uv);
  vec4 fluid=vec4(0.);
  // lift: signed tone change. The solver's flow brightens one side of each eddy and opens the other into gaps.
  float lift=0.,wake=0.,bend=1.,swirl=0.,speed=0.;
  if(uFluidOn>.5){
    vec4 raw=texture(uFluid,vec2(uv.x,1.-uv.y));
    if(uFluidMode>.5){
      vec2 v=raw.xy*uFluidTexel*vec2(aspect,1.)*hs;
      fluid=vec4(v,0.,1.);
      swirl=clamp(dot(v,vec2(.4,.65))*uGlow*.32,-.65,.65);
      speed=clamp(length(v)*uGlow*.055,0.,.38);
      bend=.4;
    } else {
      fluid=decodeFluid(raw);
      fluid.xyz*=hs;
      wake=clamp(fluid.z*uGlow,0.,1.);
      lift=wake*.55;
    }
  }
  vec2 drift=uDrift*.006*vec2(sin(uv.y*5.3+uTime*.6),cos(uv.x*4.1-uTime*.5));
  vec2 sampleAt=uv-vec2(fluid.x/aspect,-fluid.y)*uRefraction*bend+drift;
  float keep=0.;
  if(uClearMapOn>0.){
    // Text-shaped clear map: quiet right behind the content, and the field leans away from its edges so it flows round them.
    keep=texture(uClearMap,uv).r;
    vec2 t=uClearTexel*1.5;
    vec2 g=vec2(texture(uClearMap,uv+vec2(t.x,0.)).r-texture(uClearMap,uv-vec2(t.x,0.)).r,texture(uClearMap,uv+vec2(0.,t.y)).r-texture(uClearMap,uv-vec2(0.,t.y)).r);
    sampleAt+=g*vec2(1./aspect,1.)*uClearBend;
  }
  float spot=0.;
  if(uHoverMode==4||uHoverMode==5){
    vec2 d=(uv-uLight.xy)*vec2(aspect,1.);
    float q2=dot(d,d)/(uLightRadius*uLightRadius*2.2);
    // Loupe: flat-topped zoom with a soft rim. Reveal: a soft spot in the source's colours.
    if(uHoverMode==4) sampleAt-=(uv-uLight.xy)*exp(-q2*q2)*.45*uLight.z*min(1.,uLightGain*1.6)*hs;
    else spot=exp(-q2*1.6)*uLight.z*min(1.,uLightGain*1.6)*hs;
  }
  vec3 rgb,glow=vec3(0.);
  if(uScene==0){
    vec2 s=sampleAt*uSourceMap.xy+uSourceMap.zw;
    bool inside=!(s.x<0.||s.y<0.||s.x>1.||s.y>1.);
    rgb=inside?textureLod(uSource,s,uLod).rgb:vec3(0.);
    if(uBackdrop>0.){
      vec2 b=(uv-vec2(fluid.x/aspect,-fluid.y)*uRefraction*bend*.5)*uSourceMap.xy+uSourceMap.zw;
      glow=(b.x<0.||b.y<0.||b.x>1.||b.y>1.)?vec3(0.):textureLod(uSource,b,uLod+3.).rgb*uBackdrop;
    }
  } else rgb=generated(sampleAt,aspect);
  float tone=dot(rgb,vec3(.2126,.7152,.0722));
  tone=clamp((tone-uLevels.x)/max(uLevels.y-uLevels.x,.01),0.,1.);
  tone=clamp((tone-.5)*uContrast+.5+uBrightness,0.,1.);
  tone=pow(tone,1./uGamma);
  if(uInvert>.5)tone=1.-tone;
  float flick=0.,trailFold=0.;
  // Reveal: under the spot the characters take the source's own colour and a little more ink.
  if(spot>0.)lift=spot*.22;
  if(uHoverMode==2){
    // Lantern: a soft light and its fading tail lift the characters they pass. Nothing moves the image.
    vec2 ap=vec2(aspect,1.),d=(uv-uLight.xy)*ap;
    float r2=uLightRadius*uLightRadius,glowL=uLight.z*exp(-dot(d,d)/r2);
    for(int i=0;i<12;i++){vec2 e=(uv-uTrail[i].xy)*ap;glowL+=uTrail[i].z*exp(-dot(e,e)/(r2*.55));}
    glowL=min(glowL,1.)*hs;
    float grain=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
    lift=glowL*uLightGain*(.7+.6*grain);
    wake=glowL*.4;
    // A few letters at the light's rim step up the ramp and back, as if being retyped.
    flick=uFlicker*step(.9,fract(grain*13.7+floor(uClock*7.+grain*5.)*.37))*glowL*(1.-glowL)*4.;
  }
  if(uHoverMode==3){
    // Trail: the studio's ink field, as a 16-bit density. Sparse marks fill in, dense marks open up.
    vec4 ink=texture(uTrailMap,uv);
    float density=(ink.r*65280.+ink.g*255.)/65535.*uTrailAmount;
    float t=clamp(density/.38,0.,1.);
    trailFold=t*t*(3.-2.*t)*hs;
  }
  if(uFluidMode>.5&&uHoverMode==1){
    // Dark ground: any motion lights the characters. Lit ground: the flow lights one side of each eddy and opens the other.
    // A little cell-to-cell grain keeps the lit area a shimmer of letters rather than a solid block.
    float grain=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
    lift=mix(abs(swirl)*.5+speed,swirl+speed*.35,smoothstep(.12,.55,tone))*(.65+.7*grain);
    wake=clamp(lift*1.6,0.,1.);
  }
  tone=clamp(tone+lift,0.,1.);
  tone+=(1.-2.*tone)*trailFold;
  // Pulses: rings sent by the interface (field.pulse()), e.g. on a save or a notification.
  for(int i=0;i<4;i++){
    if(uPulse[i].w<=0.)continue;
    float dist=length((uv-uPulse[i].xy)*vec2(aspect,1.)),front=uPulse[i].z*.95;
    float ring=exp(-pow((dist-front)/.1,2.))*uPulse[i].w*exp(-uPulse[i].z*.85);
    tone=clamp(tone+ring*.85,0.,1.);
  }
  if(uTapOn>0.){
    // A surface tap: a signed lift (16 bits) and a glint, worked out on the CPU over the photo's own medium.
    vec4 tap=texture(uTapMap,uv);
    float lift=(tap.r*65280.+tap.g*255.)/65535.*2.-1.;
    tone=clamp(tone+(lift*1.25+tap.b)*uTapOn,0.,1.);
  }
  tone*=1.-uVignette*smoothstep(.35,1.05,length((uv-.5)*vec2(min(aspect,1.8),1.)*2.));
  if(uClearMapOn>0.)tone*=1.-uClearMapOn*smoothstep(0.,1.,keep);
  if(uClear.z>0.){
    // Clear zone: the field fades out around content so text above it stays readable.
    vec2 half_=uClear.zw*.5*vec2(aspect,1.),q=(uv-uClear.xy-uClear.zw*.5)*vec2(aspect,1.);
    float dz;
    if(uClearShape>.5){vec2 e=abs(q)-half_;dz=length(max(e,0.))+min(max(e.x,e.y),0.);}
    else dz=(length(q/max(half_,vec2(1e-4)))-1.)*min(half_.x,half_.y);
    tone*=smoothstep(0.,uClearFeather,dz);
  }
  // Blend: a shade between two characters takes the upper one in the share of cells a 4x4 Bayer pattern gives it.
  float level=tone*(uCount-1.),upper=fract(level)>=.5?1.:0.;
  if(uBlend>.5&&tone>.02&&tone<.98){
    ivec2 q=ivec2(mod(gl_FragCoord.xy,4.));
    upper=fract(level)>(BAYER[q.y*4+q.x]+.5)/16.?1.:0.;
  }
  float index=min(uCount-1.,floor(level)+upper+(flick>.5&&tone>.02?1.:0.));
  if(uOrder>1.5){
    // Scatter order: each cell keeps one character picked from the charset by a hash of its place, and the tone sets how
    // strongly it shows rather than which character it is, so a field of letters brightens and fades like a lit screen.
    index=tone>.008?1.+min(uCount-2.,floor(hash(cell*.731+vec2(19.17,3.71))*(uCount-1.))):0.;
  } else if(uOrder>.5){
    // Text order: the charset after its blank is read in sequence along each row, each row a few letters on, so words stay
    // legible. Every letter is there; the tone sets how strongly it shows, so the words fade out toward the field's quiet edges.
    float n=max(1.,uCount-1.);
    index=tone>.015?1.+mod(cell.x+cell.y*(floor(n*.38)+1.),n):0.;
    if(uWordCount>.5&&tone>.015){
      // One word a row, repeated with a space between, rows taking the words in turn and each a few letters along.
      int k=int(mod(cell.y,uWordCount));
      vec2 word=uWords[0];
      for(int i=1;i<8;i++)if(i==k)word=uWords[i];
      float at=mod(cell.x+cell.y*3.,word.y+1.);
      index=at<word.y?word.x+at:0.;
    }
  }
  vec3 hue=rgb/max(max(rgb.r,rgb.g),max(rgb.b,.03));
  hue=mix(vec3(dot(hue,vec3(.2126,.7152,.0722))),hue,uSaturation);
  vec3 base=uRampCount>1.5?rampAt(tone):uInk;
  vec3 ink=mix(base*mix(1.,.3+.7*tone,uRampCount>1.5?0.:uShade),clamp(hue*(.38+.62*tone),0.,1.),uSourceColor);
  // Scatter, text and inlay carry the tone in the ink's strength, which the pixel pass reads back as opacity or tile shade.
  if(uOrder>1.5||(uOrder>.5&&uMark==0)||uMark==17)ink=mix(uInk,hue,uSourceColor)*tone;
  vec3 lifted=uHighlightAuto>.5?ink/max(max(ink.r,ink.g),max(ink.b,.06)):uHighlight;
  ink=mix(ink,lifted,wake*.7);
  if(spot>0.)ink=mix(ink,clamp(rgb/max(max(rgb.r,rgb.g),max(rgb.b,.08))*(.45+.55*tone),0.,1.),spot);
  float underAlpha=max(uBackground.a,min(1.,max(glow.r,max(glow.g,glow.b))));
  vec3 under=min(uBackground.rgb*uBackground.a+glow,vec3(underAlpha));
  // Glyphs keep their atlas index, exact in 8 bits; the other marks keep the tone, and empty where the charset is blank.
  outInk=vec4(ink,uMark==0||uMark==17?index/255.:uMark==1?(tone>.003?tone:0.):index>0.?max(tone,1./255.):0.);
  outUnder=vec4(under,underAlpha);
}`,ca=`#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uAtlas, uCells, uUnder;
uniform vec2 uResolution, uCell, uPitch;
uniform float uColumns, uDotScale, uSourceColor;
uniform vec2 uDir;
uniform int uMark;
// Inlay accents: share of tiles, letter shuffle span, a seed that steps a few times a second, charset length.
uniform vec4 uInlay;
// Line marks: pitch in cell heights, weight, the share of cells that sparkle.
uniform vec4 uLine;
uniform vec4 uFade;
out vec4 outColor;
const float BAYER[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
uniform vec3 uRamp[6];
uniform float uRampCount;
// The gradient map: the tone run through the ramp's stops, evenly spaced, faintest first.
vec3 rampAt(float t){
  float x=clamp(t,0.,1.)*(uRampCount-1.);
  int i=int(min(floor(x),uRampCount-2.));
  vec3 a=uRamp[0],b=uRamp[1];
  for(int k=1;k<5;k++)if(k==i){a=uRamp[k];b=uRamp[k+1];}
  return mix(a,b,clamp(x-float(i),0.,1.));
}
// The Studio's print defaults: roughness .35, seed 7, registration .2 and its coral second ink. The screen angle is uDir (-35deg).
const float ROUGH=.35,SEED=7.;
const vec3 SECOND=vec3(.925,.404,.322);
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
// Coverage of a signed distance given in device pixels.
float cover(float d){return clamp(.5-d,0.,1.);}
float box(vec2 p,vec2 lo,vec2 hi){vec2 a=clamp(p-lo,0.,1.)*clamp(hi-p,0.,1.);return a.x*a.y;}
float disc(vec2 p,vec2 c,float r){return r>.05?cover(length(p-c)-r):0.;}
float ellipse(vec2 p,vec2 c,vec2 r,float a){vec2 d=p-c;d=vec2(cos(a)*d.x+sin(a)*d.y,-sin(a)*d.x+cos(a)*d.y);float k=length(d/r);return cover((k-1.)*min(r.x,r.y));}
// World-anchored parallel cuts across direction d: period and width in cell heights, so lines run on from cell to cell.
float cuts(vec2 w,vec2 d,float period,float width,float px){
  if(width<=0.)return 0.;
  float proj=dot(vec2(-d.y,d.x),w);
  return cover((abs(fract(proj/period+.5)-.5)*period-width*.5)*px);
}
// Lays an ink over what is already down, multiplying where they overlap, as transparent inks do on paper.
void lay(inout vec3 rgb,inout float a,vec3 c,float k){
  float next=a+k*(1.-a);
  rgb=next>0.?(rgb*a*(1.-k)+mix(c,rgb*c,a)*k)/next:c;
  a=next;
}
void main(){
  vec2 DIR=uDir;
  vec2 frag=vec2(gl_FragCoord.x,uResolution.y-gl_FragCoord.y);
  // The pitch is the atlas cell, or a fractional one under cellFit 'fill', where each glyph sits centred in its stretched cell.
  vec2 cell=floor(frag/uPitch);
  vec4 ink=texelFetch(uCells,ivec2(cell),0),under=texelFetch(uUnder,ivec2(cell),0);
  vec2 local=frag-cell*uPitch;
  float coverage;
  vec3 rgb=ink.rgb;
  // Scatter and inlay: the cell's strength, read back from its ink, and the ink itself at full strength.
  float strength=1.;
  if(uFade.w>.5){
    float top=max(rgb.r,max(rgb.g,rgb.b));
    strength=uSourceColor>.5?top:clamp(top/max(max(uFade.r,max(uFade.g,uFade.b)),.004),0.,1.);
    rgb=uSourceColor>.5?rgb/max(top,.004):uFade.rgb;
  }
  if(uMark==0||uMark==17){
    float index=floor(ink.a*255.+.5);
    // Inlay shuffle: every tiled cell takes a letter from the upper charset, traded for a neighbour a few times a second, so a
    // tiled body flickers through its letters rather than banding by tone; the tile's shade still carries the tone.
    float hs=hash(cell*.917+uInlay.z*1.37);
    if(uMark==17&&uInlay.y>0.&&index>0.&&(index>=uInlay.w*.62||strength>=.2))index=clamp(max(index,ceil(uInlay.w*.62)+1.)+floor((hs-.5)*(2.*uInlay.y+1.)),ceil(uInlay.w*.62),uInlay.w-1.);
    ivec2 tile=ivec2(int(mod(index,uColumns)),int(floor(index/uColumns)));
    vec2 texel=floor(local-floor((uPitch-uCell)*.5));
    coverage=all(greaterThanEqual(texel,vec2(0.)))&&all(lessThan(texel,uCell))?texelFetch(uAtlas,tile*ivec2(uCell)+ivec2(texel),0).a:0.;
    if(uMark==17){
      // Inlay: a gapped tile in the ink, lighter the denser the cell, with its character set into it in a darker shade. Faint
      // cells keep only the character, so a shape's edge frays into specks; empty cells show a hairline grid.
      vec2 p=local+.5;
      float gap=max(1.,floor(min(uPitch.x,uPitch.y)*.08+.5));
      float plate=index>0.?smoothstep(.2,.32,strength)*box(p,vec2(0.),uPitch-gap):0.;
      // Tile and letter are the ink at two strengths over whatever ground lies below, so the inlay reads on light and dark pages:
      // the tile strengthens with the tone and the letter is cut back toward the ground.
      float face=(.18+.8*smoothstep(.05,.8,strength))*plate;
      // With shuffle on, tiles also vary a little in shade, as worn inlay does.
      if(uInlay.y>0.)face*=.8+.34*hs;
      float speck=coverage*min(1.,strength*6.)*(1.-plate);
      float grid=index>0.?0.:(1.-box(p,vec2(0.),uPitch-1.))*.035;
      float a=mix(face,face*.22,coverage*plate)+speck;
      // Accents: a few lit tiles carry a coloured letter, a tinted tile or a white glint, picked afresh with the seed.
      float ha=hash(cell*1.31+uInlay.z*.71+vec2(7.3,1.9));
      if(plate>0.&&ha<uInlay.x){
        float pick=hash(cell+uInlay.z*2.11+vec2(3.1,8.7));
        vec3 hue=pick<.16?vec3(.86,.27,.27):pick<.3?vec3(.92,.55,.2):pick<.42?vec3(.9,.78,.25):pick<.58?vec3(.35,.72,.38):pick<.72?vec3(.3,.72,.8):pick<.84?vec3(.32,.42,.92):vec3(.66,.42,.86);
        float kind=ha/uInlay.x;
        if(kind<.55){float k=coverage*plate;rgb=mix(rgb,hue,k);a=mix(a,1.,k);}
        else if(kind<.88){rgb=mix(rgb,hue,.55);}
        else{float k=coverage*plate;rgb=mix(rgb,vec3(1.),1.-k);a=mix(max(a,.96),face*.3,k);}
      }
      coverage=a>0.?a:grid;
    } else coverage*=strength;
  } else if(uMark==1){
    // Halftone: dot area follows tone, so midtones read true; edges are antialiased to one device pixel.
    float r=sqrt(ink.a)*min(uPitch.x,uPitch.y)*.5*uDotScale;
    coverage=ink.a>.003?clamp(r-length(local-uPitch*.5)+.5,0.,1.):0.;
  } else if(ink.a<=0.){
    coverage=0.;
  } else {
    float tone=ink.a,side=min(uPitch.x,uPitch.y);
    vec2 q=local/uPitch,c=uPitch*.5,p=local+.5;
    // Tiles fade with the tone in one ink, as the Studio's do; in source colour the colour already carries it.
    float fade=uSourceColor>.5?1.:tone,gap=max(.5,uPitch.x*.06),grain=hash(cell+SEED);
    vec2 w=(cell+q)*uPitch/uPitch.y;
    if(uMark==2)coverage=fade;
    else if(uMark==3)coverage=box(p,vec2(0.),uPitch-gap)*fade;
    else if(uMark==4){
      // Lego: a gapped brick, lit from above, with a raised stud ringed by its shadow.
      coverage=box(p,vec2(0.),uPitch-gap)*fade;
      rgb*=1.06-.14*q.y;
      float r=side*.28,d=length(local-c)-r,lit=clamp(dot(c-local,vec2(.6,.8))/r,-1.,1.);
      rgb=mix(rgb,mix(rgb,vec3(1.),.2+.12*lit),cover(d));
      rgb=mix(rgb,rgb*.72,cover(abs(d)-max(.5,side*.04)));
    } else if(uMark==5){
      // Voxel: an isometric cube; top, left and right faces at full, .72 and .42 strength.
      float h=.5*abs(q.x-.5);
      coverage=cover(-min(q.y-h,1.-h-q.y)*uPitch.y)*cover(-min(q.x,1.-q.x)*uPitch.x);
      coverage*=mix(q.x<.5?.72:.42,1.,cover((q.y-(.5-h))*uPitch.y))*fade;
    } else if(uMark==6){
      // Disco: a gapped mirror tile, its upper facet catching light and its lower in shade.
      coverage=box(p,vec2(0.),uPitch-gap)*fade;
      rgb=q.y<.35?mix(rgb,vec3(1.),.1+grain*.25):q.y>.65?rgb*.75:rgb;
    } else if(uMark==18){
      // Tick: a printed glow. A smooth wash carries the light; over it every cell holds one short upright tick whose strength
      // steps through four levels by a 4x4 ordered threshold, so the mid tones read as a crisp dither of ticks that brightens
      // toward the light and melts into the wash at its core. With a ramp the wash runs through it and the ticks sit a step up.
      ivec2 b=ivec2(mod(cell,4.));
      float th=(BAYER[b.y*4+b.x]+.5)/16.;
      float tw=max(1.,floor(uPitch.x*.28+.5)),tl=max(2.,floor(uPitch.y*.46+.5));
      vec2 lo=floor(c-vec2(tw,tl)*.5);
      float bar=box(p,lo,lo+vec2(tw,tl));
      float lvl=clamp(floor(tone*4.+th)/4.,0.,1.);
      float melt=1.-smoothstep(.7,.96,tone);
      float at=bar*melt*(.42+.58*lvl);
      bool ramped=uRampCount>1.5&&uSourceColor<.5;
      float aw=ramped?pow(smoothstep(.08,.88,tone),1.4):tone*tone*.92;
      vec3 W=ramped?rampAt(tone):rgb,T=ramped?rampAt(min(1.,lvl+.38)):rgb;
      float a=at+aw*(1.-at);
      rgb=a>0.?(T*at+W*aw*(1.-at))/a:W;
      coverage=a;
    } else if(uMark==19){
      // Bayer: one gapped square a cell, on or off by a 4x4 ordered threshold at two strengths, so a picture steps through
      // empty, half and full squares in the brand's tones, as pixel-dithered art does.
      ivec2 b=ivec2(mod(cell,4.));
      float th=(BAYER[b.y*4+b.x]+.5)/16.,g=max(1.,floor(min(uPitch.x,uPitch.y)*(1.-uDotScale)+.5));
      float lvl=tone>.5+th*.5?1.:tone>th*.5?.5:0.;
      // An empty cell keeps a small faint square, so the ground reads as a dot grid that the picture fills.
      vec2 d=floor(c-max(1.,floor(min(uPitch.x,uPitch.y)*.3))*.5);
      coverage=lvl>0.?box(p,vec2(0.),uPitch-g)*lvl:box(p,d,d+max(1.,floor(min(uPitch.x,uPitch.y)*.3)))*.35;
    } else if(uMark==7){
      // Dither: an ordered 4x4 Bayer screen at about five dots a cell, lit where the cell's tone passes the threshold.
      ivec2 b=ivec2(mod(floor(frag/max(1.,floor(side/5.))),4.));
      coverage=tone>(BAYER[b.y*4+b.x]+.5)/16.?1.:0.;
    } else if(uMark==8){
      // Hex: a flat-topped hexagon filling the cell.
      vec2 h=abs((local-c)/(uPitch*.49));
      coverage=cover(max(h.y-.866,h.x*.866+h.y*.5-.866)*side*.49)*fade;
    } else if(uMark==9){
      // LED: a round lamp with a soft halo and a specular glint, separated by an unlit matrix.
      float r=side*.39,d=length(local-c);
      coverage=max(cover(d-r),.3*exp(-pow(max(0.,d-r)/(side*.12),2.)))*fade;
      rgb=mix(rgb,vec3(1.),.35*disc(local,uPitch*vec2(.43,.4),side*.11));
    } else if(uMark==10){
      // CMYK: the cell's hue separated into offset cyan, magenta and yellow dots, each sized by its share of the tone. The
      // key screen carries the neutral share in the ink's own lightness, since a light ink on a dark page has no black.
      float top=max(rgb.r,max(rgb.g,rgb.b)),low=min(rgb.r,min(rgb.g,rgb.b));
      vec3 cmy=(top-rgb)/max(top,.001);
      float a=0.;vec3 col=vec3(1.);
      lay(col,a,vec3(top),disc(local,c,side*.48*sqrt(tone*low/max(top,.001))));
      lay(col,a,vec3(0.,1.,1.),disc(local,uPitch*vec2(.36,.36),side*.48*sqrt(tone*cmy.x)));
      lay(col,a,vec3(1.,0.,1.),disc(local,uPitch*vec2(.64,.36),side*.48*sqrt(tone*cmy.y)));
      lay(col,a,vec3(1.,1.,0.),disc(local,uPitch*vec2(.5,.66),side*.48*sqrt(tone*cmy.z)));
      rgb=col;coverage=a;
    } else if(uMark==11||uMark==16){
      // Stipple and pointillism: four jittered marks a cell, their size following the tone.
      coverage=0.;vec3 col=rgb;
      for(int m=0;m<4;m++){
        vec2 o=vec2(float(m%2),float(m/2));
        float j=hash(cell*2.+o+SEED),jy=hash(cell+o*11.+SEED+1.);
        vec2 at=((o+.5)/2.+(vec2(j,jy)-.5)*ROUGH*.28)*uPitch;
        float r=min(min(min(at.x,uPitch.x-at.x),min(at.y,uPitch.y-at.y)),side*min(.245,.21*sqrt(tone)*(1.-ROUGH*j*.35)));
        float k=uMark==11?disc(local,at,r):ellipse(local,at,vec2(r,r*.64),j*3.14159);
        if(uMark==16&&k>coverage)col=uSourceColor>.5?clamp(rgb+(j-.5)*ROUGH*.25*vec3(1.,-.4,-1.),0.,1.):rgb*(1.+(j-.5)*ROUGH*.5);
        coverage=max(coverage,k);
      }
      rgb=col;
    } else if(uMark==12||uMark==13){
      // Engraving and crosshatch: parallel cuts whose weight follows the tone; crossings join only in the darker tones.
      float cv=tone*(1.-ROUGH*grain*.3),px=uPitch.y,P=uLine.x,W=uLine.y*.72*P;
      coverage=cuts(w,DIR,P,min(.94*P,W*cv),px);
      if(uMark==13){
        coverage=max(coverage,cuts(w,vec2(-DIR.y,DIR.x),P,min(.94*P,W*max(0.,cv*1.5-.3)),px)*step(.2,cv));
        coverage=max(coverage,cuts(w,normalize(DIR+vec2(-DIR.y,DIR.x)),P,min(.94*P,W*max(0.,cv*2.-1.2)),px)*step(.6,cv));
      }
      // Sparkle: now and then a lit cell catches a small bright square, picked afresh a few times a second.
      if(uLine.z>0.&&tone>.2&&hash(cell*1.7+uInlay.z*.53)<uLine.z){float sq=max(1.,floor(side*.3+.5));vec2 lo=floor(c-sq*.5);float k=box(p,lo,lo+sq);coverage=max(coverage,k);rgb=mix(rgb,vec3(1.),k*.6);}
    } else if(uMark==14){
      // Woodblock: broad carved bands in five stepped weights, their edges wavering along the grain.
      float cv=ceil(tone*(1.-ROUGH*grain*.3)*5.)/5.,width=min(.94,.72*cv);
      float proj=dot(vec2(-DIR.y,DIR.x),w),line=floor(proj+.5),along=dot(DIR,w);
      float cut=sin(along*5.3+line*1.9+SEED)*.5+sin(along*13.1+line)*.25;
      coverage=cover((abs(proj-line)-width*.5*(1.+ROUGH*cut*.5))*uPitch.y);
    } else if(uMark==15){
      // Risograph: two offset screens, the main ink and the coral second ink, misregistered along the screen angle.
      float split=uSourceColor>.5?clamp(.5+(rgb.r-rgb.b)*.5,0.,1.):.5,r=side*min(.48,.44*sqrt(tone));
      float a=0.;vec3 col=rgb;
      lay(col,a,rgb,disc(local,c,r*sqrt(.35+(1.-split)*.65)));
      lay(col,a,SECOND,disc(local,c+DIR*.2*.38*side,r*sqrt(.3+split*.7)*(1.-ROUGH*hash(cell+SEED+13.)*.3)));
      rgb=col;coverage=a;
    } else coverage=0.;
  }
  outColor=vec4(rgb*coverage+under.rgb*(1.-coverage),coverage+under.a*(1.-coverage));
}`,Wt=`#version 300 es
precision highp float;
precision highp sampler2D;
uniform vec2 uTexel;
out vec4 outColor;
vec2 here(){return gl_FragCoord.xy*uTexel;}
`,$a=Wt+`
uniform sampler2D uVelocity;
uniform vec2 uFrom, uTo, uForce;
uniform float uAspect, uRadius;
float segment(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.,1.);return length(pa-ba*h);}
void main(){
  vec2 uv=here(),scale=vec2(uAspect,1.);
  float d=segment(uv*scale,uFrom*scale,uTo*scale);
  outColor=vec4(texture(uVelocity,uv).xy+uForce*exp(-d*d/(uRadius*uRadius)),0.,1.);
}`,Ka=Wt+`
uniform sampler2D uVelocity;
void main(){
  vec2 uv=here();
  float l=texture(uVelocity,uv-vec2(uTexel.x,0.)).y,r=texture(uVelocity,uv+vec2(uTexel.x,0.)).y;
  float t=texture(uVelocity,uv+vec2(0.,uTexel.y)).x,b=texture(uVelocity,uv-vec2(0.,uTexel.y)).x;
  outColor=vec4(.5*(r-l-t+b),0.,0.,1.);
}`,Qa=Wt+`
uniform sampler2D uVelocity, uCurl;
uniform float uStrength, uDt;
void main(){
  vec2 uv=here();
  float l=texture(uCurl,uv-vec2(uTexel.x,0.)).x,r=texture(uCurl,uv+vec2(uTexel.x,0.)).x;
  float t=texture(uCurl,uv+vec2(0.,uTexel.y)).x,b=texture(uCurl,uv-vec2(0.,uTexel.y)).x,c=texture(uCurl,uv).x;
  vec2 force=.5*vec2(abs(t)-abs(b),abs(r)-abs(l));
  force=force/(length(force)+1e-4)*uStrength*c;
  force.y=-force.y;
  outColor=vec4(clamp(texture(uVelocity,uv).xy+force*uDt,-1000.,1000.),0.,1.);
}`,Ja=Wt+`
uniform sampler2D uVelocity;
void main(){
  vec2 uv=here(),c=texture(uVelocity,uv).xy;
  float l=texture(uVelocity,uv-vec2(uTexel.x,0.)).x,r=texture(uVelocity,uv+vec2(uTexel.x,0.)).x;
  float t=texture(uVelocity,uv+vec2(0.,uTexel.y)).y,b=texture(uVelocity,uv-vec2(0.,uTexel.y)).y;
  if(uv.x-uTexel.x<0.)l=-c.x;
  if(uv.x+uTexel.x>1.)r=-c.x;
  if(uv.y+uTexel.y>1.)t=-c.y;
  if(uv.y-uTexel.y<0.)b=-c.y;
  outColor=vec4(.5*(r-l+t-b),0.,0.,1.);
}`,Za=Wt+`
uniform sampler2D uSource;
uniform float uAmount;
void main(){outColor=vec4(texture(uSource,here()).x*uAmount,0.,0.,1.);}`,ei=Wt+`
uniform sampler2D uPressure, uDivergence;
void main(){
  vec2 uv=here();
  float l=texture(uPressure,uv-vec2(uTexel.x,0.)).x,r=texture(uPressure,uv+vec2(uTexel.x,0.)).x;
  float t=texture(uPressure,uv+vec2(0.,uTexel.y)).x,b=texture(uPressure,uv-vec2(0.,uTexel.y)).x;
  outColor=vec4((l+r+b+t-texture(uDivergence,uv).x)*.25,0.,0.,1.);
}`,ti=Wt+`
uniform sampler2D uPressure, uVelocity;
void main(){
  vec2 uv=here();
  float l=texture(uPressure,uv-vec2(uTexel.x,0.)).x,r=texture(uPressure,uv+vec2(uTexel.x,0.)).x;
  float t=texture(uPressure,uv+vec2(0.,uTexel.y)).x,b=texture(uPressure,uv-vec2(0.,uTexel.y)).x;
  outColor=vec4(texture(uVelocity,uv).xy-vec2(r-l,t-b),0.,1.);
}`,ni=Wt+`
uniform sampler2D uVelocity;
uniform float uDt, uDissipation;
void main(){
  vec2 uv=here();
  vec2 back=uv-uDt*texture(uVelocity,uv).xy*uTexel;
  outColor=vec4(texture(uVelocity,back).xy/(1.+uDissipation*uDt),0.,1.);
}`,Tn=new Set,Ht=0,$r=0,$o=null,sn=[],kn=0,Wn=1,nr=0,Ko=0;function ri(e){Ht=0,kn&&e>kn&&(sn.push(e-kn),sn.length>120&&sn.shift()),kn=e,$r=performance.now();let r=[...Tn];Tn.clear();for(let o of r)try{o(e)}catch(a){typeof console<"u"&&console.error(a)}_t?.endFrame(e);let t=performance.now()-$r;if(nr=.9*nr+.1*t,e-Ko>500){Ko=e;let o=ua(),a=!!_t?.overloaded;(nr>.5*o||a)&&Wn<3?Wn++:nr<.2*o&&!a&&Wn>1&&Wn--}Tn.size||(kn=0)}var oi=()=>Wn;function fr(e){Tn.add(e),Ht&&$o!==requestAnimationFrame&&(Ht=0),Ht||($o=requestAnimationFrame,Ht=requestAnimationFrame(ri))}function dr(e){Tn.delete(e),!Tn.size&&Ht&&(cancelAnimationFrame(Ht),Ht=0,kn=0)}function ua(){if(sn.length<20)return 1e3/60;let e=[...sn].sort((r,t)=>r-t);return Math.min(1e3/60,Math.max(1e3/360,e[Math.floor(.2*e.length)]))}var Xn=new Set,Jr=new Set,Zr=new Set,eo=new Set,to=new Set,Hr=!1,Qo=null,rr=null,or=null,Nn=null,Jo=e=>{let r=null;for(let t of Xn){if(t.target===window){(!t.near||t.near()||t.inside)&&t.move(e);continue}r??(r=e.composedPath()),r.includes(t.target)?(t.inside=!0,t.move(e)):t.inside&&(t.inside=!1,t.leave())}},ai=()=>{for(let e of Xn)e.inside=!1,e.leave()},ii=()=>{for(let e of[...Jr])e()},li=()=>{for(let e of[...Zr])e()},Zo=()=>{for(let e of[...eo])e()},si=e=>{for(let r of[...to])r(e)};function ea(){let e=Xn.size+Jr.size+Zr.size+eo.size+to.size>0;if(typeof document>"u"||(Qo!==document&&(Hr=!1,Qo=document,rr=or=null,Nn=null),e===Hr))return;Hr=e;let r=e?"addEventListener":"removeEventListener";if(typeof window<"u"&&(window[r]?.("pointermove",Jo,{capture:!0,passive:!0}),window[r]?.("pointerdown",Jo,{capture:!0,passive:!0})),document[r]?.("pointerleave",ai),document[r]?.("visibilitychange",ii),(typeof document>"u"?void 0:document.fonts)?.[r]?.("loadingdone",si),rr??(rr=typeof matchMedia=="function"?matchMedia("(prefers-reduced-motion: reduce)"):null),or??(or=typeof matchMedia=="function"?matchMedia("(prefers-color-scheme: dark)"):null),rr?.[r]?.("change",li),or?.[r]?.("change",Zo),e){Nn??(Nn=typeof MutationObserver=="function"?new MutationObserver(Zo):null);for(let t of[document.documentElement,document.body])t&&Nn?.observe(t,{attributes:!0,attributeFilter:["class","data-theme","data-mode","style"]})}else Nn?.disconnect()}var Rn=(e,r)=>(e.add(r),ea(),()=>{e.delete(r)&&ea()});function ci(e){let r=e.target;if(typeof window>"u"||r===window||typeof document>"u")return Rn(Xn,e);let t=r,o=t.getRootNode?.();if(t.ownerDocument===document&&(!o||o===document))return Rn(Xn,e);let a=e.move,s=()=>e.leave();return t.addEventListener("pointermove",a,{passive:!0}),t.addEventListener("pointerdown",a,{passive:!0}),t.addEventListener("pointerleave",s),()=>{t.removeEventListener("pointermove",a),t.removeEventListener("pointerdown",a),t.removeEventListener("pointerleave",s)}}var ui=e=>Rn(Jr,e),hi=e=>Rn(Zr,e),ha=e=>Rn(eo,e),zn=new Map,bn=null,Wr=new Map,fa=e=>r=>{for(let t of r)for(let o of[...e.get(t.target)??[]])o(t)},da=(e,r,t)=>{let o=e.get(r);return o?(o.add(t),!1):(e.set(r,new Set([t])),!0)},ma=(e,r,t)=>{let o=e.get(r);return!(!o?.delete(t)||o.size)&&(e.delete(r),!0)};function Xr(e,r){return typeof ResizeObserver!="function"?()=>{}:(bn??(bn=new ResizeObserver(fa(zn))),da(zn,e,r)?bn.observe(e):queueMicrotask(()=>{zn.get(e)?.has(r)&&r({target:e})}),()=>{ma(zn,e,r)&&bn?.unobserve(e),zn.size||(bn?.disconnect(),bn=null)})}var fi=268435456,ar=[1,.85,.7,.58,.5],di=class{constructor(){this.lost=!1,this.level=0,this.programs=new Map,this.atlases=new Map,this.vertex=null,this.vao=null,this.clients=new Set,this.parallel=null,this.timer=null,this.queries=[],this.open=null,this.drew=!1,this.gpuMs=[],this.cpuMs=[],this.changedAt=0,this.lostTimer=0,this.renderer="",this.overloaded=!1,this.onLost=e=>{e.preventDefault(),this.lost=!0,this.reset();for(let r of[...this.clients])r.lost();clearTimeout(this.lostTimer),this.lostTimer=setTimeout(()=>{if(this.lost){this.canvas.removeEventListener?.("webglcontextlost",this.onLost),this.canvas.removeEventListener?.("webglcontextrestored",this.onRestored);try{this.create()}catch{return}this.restored()}},1e3)},this.onRestored=()=>{clearTimeout(this.lostTimer),this.lost=!1,this.restored()},this.idleTimer=0,this.create()}create(){let e=null,r=null,t={alpha:!0,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!0,preserveDrawingBuffer:!0,powerPreference:"high-performance"};if(typeof document<"u"&&(e=document.createElement("canvas"),r=e.getContext("webgl2",t)),!r&&typeof OffscreenCanvas=="function")try{e=new OffscreenCanvas(1,1),r=e.getContext("webgl2",t)}catch{r=null}if(!r||!e)throw new Error("WebGL2 is not available for the glyph field.");this.canvas=e,this.gl=r,this.lost=!1,e.width=e.height=1,this.parallel=r.getExtension("KHR_parallel_shader_compile"),this.timer=r.getExtension("EXT_disjoint_timer_query_webgl2");let o=r.getExtension("WEBGL_debug_renderer_info");this.renderer=String(r.getParameter(o?o.UNMASKED_RENDERER_WEBGL:r.RENDERER)??""),e.addEventListener?.("webglcontextlost",this.onLost),e.addEventListener?.("webglcontextrestored",this.onRestored);let a=!r.getExtension("EXT_color_buffer_float")&&!r.getExtension("EXT_color_buffer_half_float");this.program(sa(a)),this.program(ca)}restored(){for(let e of[...this.clients])e.restored()}reset(){this.programs.clear(),this.atlases.clear(),this.vertex=null,this.vao=null,this.queries=[],this.open=null,this.gpuMs=[],this.cpuMs=[]}join(e){this.clients.add(e),clearTimeout(this.idleTimer)}leave(e){this.clients.delete(e),this.clients.size?this.fit():(this.lost||(this.canvas.width=this.canvas.height=1,this.level=0),clearTimeout(this.idleTimer),this.idleTimer=setTimeout(()=>{this.clients.size||this.dispose()},3e3))}dispose(){if(clearTimeout(this.lostTimer),this.canvas.removeEventListener?.("webglcontextlost",this.onLost),this.canvas.removeEventListener?.("webglcontextrestored",this.onRestored),!this.lost)try{this.gl.getExtension("WEBGL_lose_context")?.loseContext()}catch{}this.reset(),_t===this&&(_t=null)}program(e){let r=this.programs.get(e);if(r)return r;let t=this.gl,o=(l,f)=>{let g=t.createShader(l);return t.shaderSource(g,f),t.compileShader(g),g};this.vertex??(this.vertex=o(t.VERTEX_SHADER,`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`));let a=t.createProgram(),s=o(t.FRAGMENT_SHADER,e);t.attachShader(a,this.vertex),t.attachShader(a,s),t.linkProgram(a);let h={program:a,locations:null,fragment:s};return this.programs.set(e,h),h}linked(e,r=!1){if(e.locations)return!0;let t=this.gl;if(!r&&this.parallel&&!t.getProgramParameter(e.program,this.parallel.COMPLETION_STATUS_KHR))return!1;if(!t.getProgramParameter(e.program,t.LINK_STATUS)){if(t.isContextLost())return!1;throw new Error(e.fragment&&t.getShaderInfoLog(e.fragment)||t.getProgramInfoLog(e.program)||"Glyph field program failed to link.")}let o={};for(let a=t.getProgramParameter(e.program,t.ACTIVE_UNIFORMS)-1;a>=0;a--){let s=t.getActiveUniform(e.program,a).name.replace(/\[0\]$/,"");o[s]=t.getUniformLocation(e.program,s)}return e.locations=o,!0}get canCompileInParallel(){return!!this.parallel}vertexArray(){return this.vao??(this.vao=this.gl.createVertexArray())}atlas(e,r,t){let o=this.atlases.get(e);if(o)o.refs||(this.atlases.delete(e),this.atlases.set(e,o));else{let a=this.gl,s=a.createTexture();a.bindTexture(a.TEXTURE_2D,s);for(let[h,l]of[[a.TEXTURE_MIN_FILTER,a.NEAREST],[a.TEXTURE_MAG_FILTER,a.NEAREST],[a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE],[a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE]])a.texParameteri(a.TEXTURE_2D,h,l);o={key:e,texture:s,refs:0,final:!1,users:new Set,bytes:0},this.atlases.set(e,o),this.paintAtlas(o,r)}return o.refs++,o.users.add(t),o}hasAtlas(e){return this.atlases.has(e)}paintAtlas(e,r){let t=this.gl,{image:o,final:a}=r();t.bindTexture(t.TEXTURE_2D,e.texture),t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),t.texImage2D(t.TEXTURE_2D,0,t.RGBA8,t.RGBA,t.UNSIGNED_BYTE,o),e.bytes=o.width*o.height*4,e.final=a;for(let s of[...e.users])s()}releaseAtlas(e,r){e&&e.users.delete(r)&&(--e.refs>0||this.evictAtlases())}evictAtlases(){let e=[...this.atlases.values()].filter(t=>!t.refs),r=e.length-32;for(let t of e){if(r<=0&&!this.overBudget)break;r--,this.atlases.delete(t.key),this.lost||this.gl.deleteTexture(t.texture)}}fit(){if(this.lost)return;let e=1,r=1;for(let a of this.clients){let[s,h]=a.size();e=Math.max(e,s),r=Math.max(r,h)}let t=this.canvas,o=a=>256*Math.ceil(a/256);t.width*t.height>o(e)*o(r)*2&&(t.width=o(e),t.height=o(r))}get bytes(){let e=this.canvas.width*this.canvas.height*4*2;for(let r of this.clients)e+=r.bytes();for(let r of this.atlases.values())e+=r.bytes;return e}get overBudget(){return this.bytes>fi}get roomy(){return this.bytes<2281701376e-1}begin(e,r){let t=this.canvas;if(t.width<e||t.height<r){let o=a=>256*Math.ceil(a/256);t.width=Math.max(t.width,o(e)),t.height=Math.max(t.height,o(r))}if(!this.drew&&(this.drew=!0,this.timer&&!this.open&&this.queries.length<4)){let o=this.gl.createQuery();o&&(this.gl.beginQuery(this.timer.TIME_ELAPSED_EXT,o),this.open=o)}}present(e,r,t){e.globalCompositeOperation="copy",e.imageSmoothingEnabled=!1,e.drawImage(this.canvas,0,this.canvas.height-t,r,t,0,0,r,t)}endFrame(e){if(this.lost)return void(this.drew=!1);let r=this.gl,t=this.timer;if(this.drew&&(this.cpuMs.push(performance.now()-$r),this.cpuMs.length>60&&this.cpuMs.shift(),t&&this.open&&(r.endQuery(t.TIME_ELAPSED_EXT),this.queries.push({query:this.open,frame:e}),this.open=null)),this.drew=!1,t){let o=r.getParameter(t.GPU_DISJOINT_EXT);for(;this.queries.length&&r.getQueryParameter(this.queries[0].query,r.QUERY_RESULT_AVAILABLE);){let{query:a}=this.queries.shift();o||(this.gpuMs.push(r.getQueryParameter(a,r.QUERY_RESULT)/1e6),this.gpuMs.length>60&&this.gpuMs.shift()),r.deleteQuery(a)}}this.adapt(e)}adapt(e){let r=ua(),t=this.gpuMs.length>=5&&Math.min(...this.gpuMs.slice(-5))>1.5*r,o=this.gpuMs.length>=10||t?this.gpuMs:null,a;if(o)a=[...o].sort((h,l)=>h-l)[Math.floor(.75*o.length)]/r;else{if(sn.length<30||this.cpuMs.length<10)return;let h=sn.slice(-30).sort((f,g)=>f-g),l=[...this.cpuMs].sort((f,g)=>f-g)[this.cpuMs.length>>1];a=h[Math.floor(.75*h.length)]/r>1.6&&l<.5*r?1:.5}if(this.overloaded=a>.8&&this.atMinimum,e-this.changedAt<(a>.8?800:4e3))return;let s=this.level;if(a>2?s=ar.length-1:a>.8&&s<ar.length-1?s++:a<.3&&s>0&&s--,s!==this.level){this.level=s,this.changedAt=e,this.gpuMs=[],this.cpuMs=[];for(let h of[...this.clients])h.rescale()}}get scale(){return ar[this.level]}get atMinimum(){return this.level===ar.length-1}},_t=null,ta=!1;function no(){if(_t||ta)return _t;try{_t=new di}catch{ta=!0}return _t}var pa=()=>_t,ga=new WeakSet,va=e=>ga.has(e),mi=/^[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]|^[\u{20000}-\u{3fffd}]/u,xa=e=>mi.test(e),pi=class{constructor(e,r,t){this.previous=null,this.peak=0,this.width=e,this.height=r,this.span=t??Math.min(e,r);let o=e*r;this.pixels=new Uint8Array(4*o),this.signal=new Float32Array(o),this.offsetX=new Float32Array(o),this.offsetY=new Float32Array(o),this.driftX=new Float32Array(o),this.driftY=new Float32Array(o),this.u=new Float32Array(o),this.v=new Float32Array(o),this.ink=new Float32Array(o),this.a=new Float32Array(o),this.b=new Float32Array(o),this.c=new Float32Array(o),this.pressure=new Float32Array(o),this.pressureNext=new Float32Array(o),this.divergence=new Float32Array(o),this.curl=new Float32Array(o)}get active(){return this.peak>2e-4}clear(){for(let e of[this.u,this.v,this.ink,this.a,this.b,this.c,this.pressure,this.pressureNext,this.divergence,this.curl,this.signal,this.pixels,this.offsetX,this.offsetY,this.driftX,this.driftY])e.fill(0);this.previous=null,this.peak=0}leave(){this.previous=null}move(e,r,t,o=performance.now()){if(!Number.isFinite(e+r+t+o))return;e=Math.max(0,Math.min(1,e)),r=Math.max(0,Math.min(1,r)),t=Math.max(.1,Math.min(1,t));let a=this.previous;if(this.previous={x:e,y:r,time:o},!a)return;let s=(e-a.x)*(this.width-1),h=(r-a.y)*(this.height-1),l=Math.hypot(s,h);if(l<.001)return;let f=this.span,g=o>a.time?Math.max(1/240,(o-a.time)/1e3):1/60,d=Math.min(12,l/f/g),y=1-Math.exp(-d/2.2),v=f*(.022+.075*t)*(.65+.95*y),w=Math.min(128,Math.max(1,Math.ceil(l/(.4*v)))),n=l/v*(.32+.22*y)/w,b=s/l,X=h/l,P=-X,q=b,oe=l*(2+18*y)/w;for(let M=0;M<w;M++){let _=(M+.5)/w,$=(a.x+(e-a.x)*_)*(this.width-1),se=(a.y+(r-a.y)*_)*(this.height-1),Fe=Math.max(1,Math.floor($-3*v)),Me=Math.min(this.width-2,Math.ceil($+3*v)),G=Math.max(1,Math.floor(se-3*v)),me=Math.min(this.height-2,Math.ceil(se+3*v));for(let ye=G;ye<=me;ye++)for(let A=Fe;A<=Me;A++){let D=((A-$)*b+(ye-se)*X)/v,B=((A-$)*P+(ye-se)*q)/v,Z=Math.exp(-D*D*.65-B*B*1.7),ae=ye*this.width+A;this.ink[ae]=1-(1-this.ink[ae])*Math.exp(-Z*n);let Be=1-B*B*.55,ge=D*B*.7;this.u[ae]=Math.max(-80,Math.min(80,this.u[ae]+(b*Be+P*ge)*Z*oe)),this.v[ae]=Math.max(-80,Math.min(80,this.v[ae]+(X*Be+q*ge)*Z*oe))}}this.peak=1}read(e,r,t){let o=0|(r=Math.max(.5,Math.min(this.width-1.5,r))),a=0|(t=Math.max(.5,Math.min(this.height-1.5,t))),s=r-o,h=t-a,l=a*this.width+o;return(e[l]*(1-s)+e[l+1]*s)*(1-h)+(e[l+this.width]*(1-s)+e[l+this.width+1]*s)*h}sample(e,r){return this.read(this.signal,e*(this.width-1),r*(this.height-1))}displacement(e,r,t){t[0]=this.read(this.offsetX,e*(this.width-1),r*(this.height-1)),t[1]=this.read(this.offsetY,e*(this.width-1),r*(this.height-1))}step(e){if(!this.active||!Number.isFinite(e))return;let r=Math.max(0,Math.min(.05,e)),t=this.width,o=this.height;for(;r>1e-7;){let a=Math.min(.016666666666666666,r);r-=a;let s=Math.exp(-1.9*a),h=Math.exp(-3.2*a);for(let f=1;f<o-1;f++)for(let g=1;g<t-1;g++){let d=f*t+g,y=Math.max(.5,Math.min(t-1.5,g-this.u[d]*a)),v=Math.max(.5,Math.min(o-1.5,f-this.v[d]*a)),w=0|y,n=0|v,b=y-w,X=v-n,P=n*t+w,q=(1-b)*(1-X),oe=b*(1-X),M=(1-b)*X,_=b*X;this.a[d]=(this.u[P]*q+this.u[P+1]*oe+this.u[P+t]*M+this.u[P+t+1]*_)*s,this.b[d]=(this.v[P]*q+this.v[P+1]*oe+this.v[P+t]*M+this.v[P+t+1]*_)*s,this.c[d]=(this.ink[P]*q+this.ink[P+1]*oe+this.ink[P+t]*M+this.ink[P+t+1]*_)*h}[this.u,this.a]=[this.a,this.u],[this.v,this.b]=[this.b,this.v],[this.ink,this.c]=[this.c,this.ink];for(let f=1;f<o-1;f++)for(let g=1;g<t-1;g++){let d=f*t+g;this.curl[d]=.5*(this.v[d+1]-this.v[d-1]-this.u[d+t]+this.u[d-t])}for(let f=1;f<o-1;f++)for(let g=1;g<t-1;g++){let d=f*t+g,y=Math.abs(this.curl[d+1])-Math.abs(this.curl[d-1]),v=Math.abs(this.curl[d+t])-Math.abs(this.curl[d-t]),w=Math.hypot(y,v)+1e-4,n=this.curl[d]*a*10,b=Math.hypot(this.u[d],this.v[d]);this.u[d]+=v/w*n,this.v[d]-=y/w*n;let X=Math.min(1,b/(Math.hypot(this.u[d],this.v[d])+1e-6));this.u[d]*=X,this.v[d]*=X,this.divergence[d]=-.5*(this.u[d+1]-this.u[d-1]+this.v[d+t]-this.v[d-t])}this.pressure.fill(0);for(let f=0;f<4;f++){for(let g=1;g<o-1;g++)for(let d=1;d<t-1;d++){let y=g*t+d;this.pressureNext[y]=.25*(this.divergence[y]+this.pressure[y-1]+this.pressure[y+1]+this.pressure[y-t]+this.pressure[y+t])}[this.pressure,this.pressureNext]=[this.pressureNext,this.pressure]}let l=0;for(let f=1;f<o-1;f++)for(let g=1;g<t-1;g++){let d=f*t+g;this.u[d]=Math.max(-80,Math.min(80,this.u[d]-.5*(this.pressure[d+1]-this.pressure[d-1]))),this.v[d]=Math.max(-80,Math.min(80,this.v[d]-.5*(this.pressure[d+t]-this.pressure[d-t]))),this.driftX[d]+=(3.6*this.u[d]-58*this.offsetX[d]-12*this.driftX[d])*a,this.driftY[d]+=(3.6*this.v[d]-58*this.offsetY[d]-12*this.driftY[d])*a,this.offsetX[d]=Math.max(-2,Math.min(2,this.offsetX[d]+this.driftX[d]*a)),this.offsetY[d]=Math.max(-2,Math.min(2,this.offsetY[d]+this.driftY[d]*a)),this.signal[d]=1-Math.exp(.06*-Math.hypot(this.u[d],this.v[d])-.16*this.ink[d]),l=Math.max(l,this.signal[d])}this.peak=l}if(this.active)for(let a=0;a<this.ink.length;a++){let s=Math.round(65535*Math.min(1,this.signal[a]));this.pixels[4*a]=s>>>8,this.pixels[4*a+1]=255&s,this.pixels[4*a+2]=Math.round(128+63.5*this.offsetX[a]),this.pixels[4*a+3]=Math.round(128+63.5*this.offsetY[a])}else this.clear()}};function Ue(e,r,t,o,a){if(!(a<1))for(let s=0;s<2;s++){for(let h=0;h<o;h++){let l=0,f=h*t;for(let g=-a;g<=a;g++)l+=e[f+Math.max(0,Math.min(t-1,g))];for(let g=0;g<t;g++)r[f+g]=l/(2*a+1),l+=e[f+Math.min(t-1,g+a+1)]-e[f+Math.max(0,g-a)]}for(let h=0;h<t;h++){let l=0;for(let f=-a;f<=a;f++)l+=r[Math.max(0,Math.min(o-1,f))*t+h];for(let f=0;f<o;f++)e[f*t+h]=l/(2*a+1),l+=r[Math.min(o-1,f+a+1)*t+h]-r[Math.max(0,f-a)*t+h]}}}var Vr=new Float32Array(0);function ya(e,r,t,o,a){let s=r*t,h=a&&a.width===r&&a.height===t?a:{width:r,height:t,subject:new Float32Array(s),depth:new Float32Array(s),key:"none"},{subject:l,depth:f}=h,g=0;for(let n=0;n<s;n++)e[4*n+3]<250&&g++;let d=n=>(.2126*e[4*n]+.7152*e[4*n+1]+.0722*e[4*n+2])/255,y="none",v=0;if(g>.01*s)y="alpha";else if(o)y="mask";else{let n=0,b=0,X=0,P=Math.max(1,Math.round(.03*Math.min(r,t)));for(let q=0;q<t;q++)for(let oe=0;oe<r;oe++){if(oe>=P&&q>=P&&oe<r-P&&q<t-P)continue;let M=d(q*r+oe);n+=M,b+=M*M,X++}v=n/Math.max(1,X),Math.sqrt(Math.max(0,b/Math.max(1,X)-v*v))<.07&&(y="ground")}for(let n=0;n<s;n++){let b=e[4*n+3]/255,X=d(n),P=1;if(y==="alpha")P=b;else if(y==="ground"){let q=Math.max(0,Math.min(1,(Math.abs(X-v)-.035)/.12));P=q*q*(3-2*q)}l[n]=P*(o?Math.max(0,Math.min(1,o[n])):1),f[n]=X*b}h.key=y,Vr.length<s&&(Vr=new Float32Array(s));let w=Vr;return Ue(l,w,r,t,Math.max(1,Math.round(.02*Math.min(r,t)))),Ue(f,w,r,t,Math.max(1,Math.round(.035*Math.min(r,t)))),h}var qn=11,at=e=>Math.max(0,Math.min(1,e)),N=(e,r,t)=>{let o=at((t-e)/(r-e));return o*o*(3-2*o)};function xt(e,r,t=256){let o=0;for(let l=0;l<e.length;l++)e[l]>o&&(o=e[l]);if(o<=0)return 0;let a=new Uint32Array(t);for(let l=0;l<e.length;l++)a[Math.min(t-1,Math.floor(Math.max(0,e[l])/o*t))]++;let s=0,h=e.length*r;for(let l=0;l<t;l++)if(s+=a[l],s>=h)return(l+1)/t*o;return o}var gi=class{constructor(e){this.n=e,this.arrays=[],this.next=0}take(e){this.next===this.arrays.length&&this.arrays.push(new Float32Array(this.n));let r=this.arrays[this.next++];return e?r.set(e):r.fill(0),r}reset(){this.next=0}},ir=null;function ln(e,r,t,o,a){let s=2*a+1;for(let h=0;h<o;h++){let l=h*t,f=0;for(let g=-a;g<=a;g++)f+=e[l+Math.max(0,Math.min(t-1,g))];for(let g=0;g<t;g++)r[l+g]=f/s,f+=e[l+Math.min(t-1,g+a+1)]-e[l+Math.max(0,g-a)]}for(let h=0;h<t;h++){let l=0;for(let f=-a;f<=a;f++)l+=r[Math.max(0,Math.min(o-1,f))*t+h];for(let f=0;f<o;f++)e[f*t+h]=l/s,l+=r[Math.min(o-1,f+a+1)*t+h]-r[Math.max(0,f-a)*t+h]}}function jr(e,r,t,o,a,s,h){let l=t*o,f=h.take(),g=h.take(r),d=h.take(e),y=h.take(),v=h.take();for(let w=0;w<l;w++)y[w]=r[w]*r[w],v[w]=r[w]*e[w];ln(g,f,t,o,a),ln(d,f,t,o,a),ln(y,f,t,o,a),ln(v,f,t,o,a);for(let w=0;w<l;w++){let n=(v[w]-g[w]*d[w])/(y[w]-g[w]*g[w]+s);y[w]=n,v[w]=d[w]-n*g[w]}ln(y,f,t,o,a),ln(v,f,t,o,a);for(let w=0;w<l;w++)e[w]=y[w]*r[w]+v[w]}function Yr(e,r,t,o,a,s=2){for(let h=0;h<s;h++){for(let l=0;l<o;l++)for(let f=0;f<t;f++){let g=l*t+f,d=e[g];f>0&&(d=Math.max(d,Math.min(r[g],e[g-1]*a))),l>0&&(d=Math.max(d,Math.min(r[g],e[g-t]*a),f>0?Math.min(r[g],e[g-t-1]*a):0,f<t-1?Math.min(r[g],e[g-t+1]*a):0)),e[g]=d}for(let l=o-1;l>=0;l--)for(let f=t-1;f>=0;f--){let g=l*t+f,d=e[g];f<t-1&&(d=Math.max(d,Math.min(r[g],e[g+1]*a))),l<o-1&&(d=Math.max(d,Math.min(r[g],e[g+t]*a),f>0?Math.min(r[g],e[g+t-1]*a):0,f<t-1?Math.min(r[g],e[g+t+1]*a):0)),e[g]=d}}}function lr(e,r,t,o,a){for(let s=0;s<o;s++)for(let h=0;h<t;h++){let l=1;for(let f=Math.max(0,h-a);f<=Math.min(t-1,h+a);f++)l=Math.min(l,e[s*t+f]);r[s*t+h]=l}for(let s=0;s<o;s++)for(let h=0;h<t;h++){let l=1;for(let f=Math.max(0,s-a);f<=Math.min(o-1,s+a);f++)l=Math.min(l,r[f*t+h]);e[s*t+h]=l}}function vi(e,r,t,o,a){let s=t*o,h=Math.min(t,o),l=a.take(),f=a.take(),g=a.take(),d=a.take(),y=a.take();for(let c=0;c<s;c++){let C=e[4*c+3]/255;y[c]=C,l[c]=r[4*c]/255*C,f[c]=r[4*c+1]/255*C,g[c]=r[4*c+2]/255*C,d[c]=(.299*e[4*c]+.587*e[4*c+1]+.114*e[4*c+2])/255*C}let v=a.take(),w=(c,C)=>{let E=a.take(c);return Ue(E,v,t,o,C),E},n=Math.max(2,Math.round(.04*h)),b=Math.max(n+2,Math.round(.12*h)),X=Math.max(2,Math.round(.05*h)),P=w(d,1),q=w(d,n),oe=w(d,b),M=a.take(),_=a.take(),$=a.take(),se=a.take(),Fe=a.take();for(let c=0;c<o;c++)for(let C=0;C<t;C++){let E=c*t+C;M[E]=Math.abs(d[E]-P[E]),_[E]=Math.abs(P[E]-q[E]),$[E]=Math.abs(q[E]-oe[E]),se[E]=Math.abs(d[c*t+Math.min(t-1,C+1)]-d[c*t+Math.max(0,C-1)]),Fe[E]=Math.abs(d[Math.min(o-1,c+1)*t+C]-d[Math.max(0,c-1)*t+C])}Ue(M,v,t,o,X),Ue(_,v,t,o,X),Ue($,v,t,o,X),Ue(se,v,t,o,2),Ue(Fe,v,t,o,2);let Me=Math.max(.01,xt(M,.9)+xt(_,.9)),G=w(l,1),me=w(f,1),ye=w(g,1),A=a.take(),D=a.take(),B=a.take(),Z=0;for(let c=0;c<s;c++){let C=G[c],E=me[c],ve=ye[c],ce=Math.max(C,E,ve),pe=ce-Math.min(C,E,ve);B[c]=ce,D[c]=ce>.001?pe/ce:0,Z+=pe;let Ce=0;pe>1e-4&&(Ce=ce===C?((E-ve)/pe+6)%6:ce===E?(ve-C)/pe+2:(C-E)/pe+4),A[c]=60*Ce}let ae=N(.02,.07,Z/s),Be=Math.max(2,Math.round(.06*o)),ge=new Float32Array(o);for(let c=0;c<o;c++){let C=0;for(let E=0;E<t;E++)C+=M[c*t+E]+_[c*t+E];ge[c]=C/t}let Ge=.5,Ne=0;for(let c=Math.max(Be,Math.round(.12*o));c<=Math.min(o-Be,Math.round(.88*o));c++){let C=0,E=0,ve=0,ce=0;for(let Q=0;Q<t;Q++){let ue=0,he=0,ie=0,Ie=0,be=0,Pe=0;for(let ct=1;ct<=Be;ct++){let de=(c-ct)*t+Q,Ve=(c+ct-1)*t+Q;ue+=G[de],he+=me[de],ie+=ye[de],Ie+=G[Ve],be+=me[Ve],Pe+=ye[Ve]}let Ke=(Math.abs(ue-Ie)+Math.abs(he-be)+Math.abs(ie-Pe))/Be;C+=Ke,E+=Ke>.12?1:0}let pe=Math.max(2,Math.round(.15*o)),Ce=Math.max(0,c-pe),Te=Math.min(o,c+pe);for(let Q=Ce;Q<c;Q++)ve+=ge[Q];for(let Q=c;Q<Te;Q++)ce+=ge[Q];ve/=c-Ce,ce/=Te-c;let I=N(-.05,.3,(ce-ve)/(ce+ve+1e-4)),H=N(.08,.35,C/t)*(E/t)*I;H>Ne&&(Ne=H,Ge=c/o)}let Re=N(.15,.45,Ne),We=a.take(),V=a.take(),Ze=a.take();for(let c=0;c<s;c++)We[c]=Math.min(l[c],f[c],g[c]);lr(We,v,t,o,1),Ue(We,v,t,o,n);for(let c=0;c<s;c++)V[c]=_[c]+$[c];let it=0,ht=0,ft=0;for(let c=0;c<s;c++)it+=G[c],ht+=me[c],ft+=ye[c];it/=s,ht/=s,ft/=s;let et=w(G,n),lt=w(me,n),tt=w(ye,n),Cn=w(G,b),un=w(me,b),hn=w(ye,b);for(let c=0;c<s;c++){let C=Math.hypot(et[c]-it,lt[c]-ht,tt[c]-ft),E=Math.hypot(et[c]-Cn[c],lt[c]-un[c],tt[c]-hn[c]);Ze[c]=(C+1.5*E)*(.4+.6*D[c]*ae+.4*(1-ae))}let _e=a.take(),dt=a.take(),Pn=a.take(),De=a.take(),Xt=a.take(),kt=a.take(),ze=a.take(),Ye=a.take(),Vt=a.take(),jt=a.take();for(let c=0;c<o;c++)for(let C=0;C<t;C++)jt[c*t+C]=Math.abs(d[Math.min(o-1,c+1)*t+C]-d[Math.max(0,c-1)*t+C]);Ue(jt,v,t,o,1);for(let c=0;c<o;c++)for(let C=0;C<t;C++){let E=c*t+C,ve=(c+.5)/o,ce=A[E],pe=D[E]*ae,Ce=B[E],Te=M[E]+_[E],I=N(175,200,ce)*(1-N(250,275,ce))*N(.08,.25,pe),H=(1-N(45,65,ce)+N(290,330,ce))*N(.2,.45,pe)*N(.3,.55,Ce),Q=(1-N(.15,.35,pe))*N(.45,.7,Ce)*Re,ue=(1-N(.08,.2,Ce))*Re,he=Re>.3?1-N(Ge,Ge+.1,ve):1-N(.4,.8,ve),ie=1-N(.02,.06,Te),Ie=1-N(.03,.09,Te);dt[E]=Math.max(I*ie,.7*ue*(1-N(.008,.025,Te)),H*Ie*.9)*he,Pn[E]=Math.max(dt[E],Q*ie*he),_e[E]=c===0?dt[E]:0,De[E]=N(150,172,ce)*(1-N(232,250,ce))*N(.25,.45,pe),ze[E]=N(1.3,2.2,(se[E]+.004)/(Fe[E]+.004))*N(.35,.55,P[E])*(1-N(.1,.18,D[E]*ae))*N(.025,.07,Te)*N(.025,.045,jt[E]);let be=1-N(.18,.4,pe),Pe=N(.55,.8,Ce)*N(.05,.12,Te);Xt[E]=Math.max(De[E],.85*be,.8*Pe)}Yr(_e,dt,t,o,.995,1),Yr(_e,Pn,t,o,.8,1);let we=0;for(let c=0;c<s;c++)we+=_e[c];let st=we>.04*s&&Re>.3;if(st)for(let c=0;c<o;c++)for(let C=0;C<t;C++)De[c*t+C]*=N(Ge,Ge+.05,(c+.5)/o);if(st){let c=a.take(),C=a.take(),E=a.take();for(let I=0;I<s;I++)c[I]=.299*et[I]+.587*lt[I]+.114*tt[I];for(let I=0;I<o;I++)for(let H=0;H<t;H++)C[I*t+H]=P[Math.min(o-1,I+1)*t+H]-P[Math.max(0,I-1)*t+H];let ve=new Uint8Array(s);for(let I=1;I<o-1;I++)for(let H=0;H<t;H++){let Q=Math.abs(C[I*t+H]),ue=Q>.03;for(let he=-3;he<=3&&ue;he++)he&&I+he>=0&&I+he<o&&Math.abs(C[(I+he)*t+H])>Q&&(ue=!1);ve[I*t+H]=ue?1:0}let ce=(I,H,Q,ue=!0)=>{let he=et[H]+lt[H]+tt[H]+.05,ie=et[Q]+lt[Q]+tt[Q]+.05,Ie=Math.abs(et[H]/he-et[Q]/ie)+Math.abs(lt[H]/he-lt[Q]/ie)+Math.abs(tt[H]/he-tt[Q]/ie),be=Math.min(Math.abs(A[H]-A[Q]),360-Math.abs(A[H]-A[Q])),Pe=Math.max(1-N(.1,.25,Ie),(1-N(15,35,be))*N(.15,.3,Math.min(D[H],D[Q]))),Ke=Math.max(N(2,3,(Fe[H]+.004)/(se[H]+.004))*N(.015,.04,M[H]+_[H])*N(.4,.55,M[H]/(M[H]+_[H]+1e-4)),1-N(.12,.25,c[H]));return Pe*(ue?Ke:1)*(1-N(.82*c[Q]+.02,1.02*c[Q]+.05,c[H]))},pe=0,Ce=0;for(let I=Math.max(3,Math.round(o*Math.max(.25,Ge)));I<Math.round(.88*o);I++){let H=0;for(let ue=0;ue<t;ue++)(ve[(I-1)*t+ue]||ve[I*t+ue]||ve[(I+1)*t+ue])&&H++;if(H<.5*t)continue;let Q=0;for(let ue=I+1;ue<Math.min(o,2*I);ue++)for(let he=0;he<t;he++)Q+=ce(I,ue*t+he,(2*I-ue)*t+he);Q>Ce&&(Ce=Q,pe=I)}let Te=N(.05,.1,Ce/s);if(Te>0)for(let I=pe+1;I<Math.min(o,2*pe);I++)for(let H=0;H<t;H++){let Q=I*t+H;Ye[Q]=ce(pe,Q,(2*pe-I)*t+H)*Te,Vt[Q]=ce(pe,Q,(2*pe-I)*t+H,!1)*Te,E[Q]=Ye[Q]}Ue(E,v,t,o,1);for(let I=0;I<s;I++)Ye[I]=Math.max(Ye[I],E[I]),De[I]=Math.max(De[I],Ye[I])}let mt=w(De,b);for(let c=0;c<s;c++)De[c]*=N(.15,.35,mt[c]);let fn=w(De,n);for(let c=0;c<s;c++){De[c]*=1-.8*dt[c];let C=Math.min(Math.abs(A[c]-200),360-Math.abs(A[c]-200));kt[c]=N(.28,.45,D[c]*ae)*N(55,80,C)*(1-N(.3,.6,Vt[c]))}let Yt=w(kt,n);for(let c=0;c<s;c++)kt[c]=Math.max(kt[c]*(1-(1-N(.15,.3,Yt[c]))*N(.55,.7,B[c])*N(.5,.65,D[c])),1-y[c]),Xt[c]=Math.min(Math.max(Xt[c],.9*Vt[c]),Math.max(De[c],N(.25,.6,fn[c])))*(1-_e[c])*(1-kt[c]);Yr(De,Xt,t,o,.97);let Tt=a.take(ze),$e=Math.max(2,Math.round(.12*o));for(let c=0;c<t;c++){let C=0;for(let E=-$e;E<=$e;E++)C+=ze[Math.max(0,Math.min(o-1,E))*t+c];for(let E=0;E<o;E++)Tt[E*t+c]=C/(2*$e+1),C+=ze[Math.min(o-1,E+$e+1)*t+c]-ze[Math.max(0,E-$e)*t+c]}Ue(Tt,v,t,o,1);for(let c=0;c<s;c++)ze[c]=N(.2,.45,Tt[c])*N(.2,.5,ze[c]+.5*Tt[c])*(1-_e[c]);jr(_e,d,t,o,Math.max(2,Math.round(.04*h)),.002,a),jr(De,d,t,o,Math.max(2,Math.round(.04*h)),.002,a),jr(ze,d,t,o,Math.max(2,Math.round(.03*h)),.002,a),Ue(kt,v,t,o,1);for(let c=0;c<s;c++)_e[c]=N(.3,.7,_e[c])*y[c],ze[c]=N(.3,.7,ze[c])*y[c]*(1-_e[c]),De[c]=N(.3,.7,De[c])*(1-_e[c])*(1-ze[c])*(1-N(.15,.4,kt[c]));lr(_e,v,t,o,2),lr(De,v,t,o,2),lr(ze,v,t,o,1),Ue(_e,v,t,o,1),Ue(De,v,t,o,1),Ue(ze,v,t,o,1);let yt=1/Math.max(.02,xt(Ze,.97)),Ln=1/Math.max(.01,xt(V,.9)),Bt=xt(We,.97),pt=xt(We,.1),nt=N(.06,.25,Bt-pt),rt=a.take();for(let c=0;c<o;c++)for(let C=0;C<t;C++){let E=c*t+C,ve=(C+.5)/t,ce=(c+.5)/o,pe=Math.max(_e[E],De[E]),Ce=M[E]+_[E]+$[E],Te=.6*at(((M[E]+.6*_[E])/(Ce+.004)-.25)/.55)+.4*at((M[E]+_[E])/Me),I=N(.04,.35,Ce/Me)*(1-pe),H=.55*at((We[E]-pt)/Math.max(.05,Bt-pt))+.25*(1-at(V[E]*Ln))+.2*at(2*(ye[E]-G[E])+.3)*ae,Q=nt*N(.12,.35,q[E])*(.4+.6*Re),ue=Re*(ce<Ge?.45:.45+.55*N(0,1,(ce-Ge)/Math.max(.15,1-Ge)))+(1-Re)*(.5+.4*(ce-.5)),he=M[E]/(M[E]+_[E]+1e-4),ie=N(.2,.7,(M[E]+_[E])/Me)*(.35+.65*Re)*(1-pe),Ie=1-at(1.5*Math.hypot(1.2*(ve-.5),ce-.52)),be=at(Ze[E]*yt)*(.55+.45*Ie),Pe=.3*I,Ke=.25*Q,ct=.12+.45*Re,de=.12*ie,Ve=.35*(1-.4*Re)*(1-pe);rt[E]=(Pe*Te+Ke*(1-H)+ct*ue+de*at(1.6-1.6*he)+Ve*be+.04)/(Pe+Ke+ct+de+Ve+.08)*(1-.85*_e[E])*(1-.45*De[E]*(1-Re))}let dn=ya(e,t,o);if(dn.key!=="none")for(let c=0;c<s;c++)rt[c]=.7*dn.subject[c]+.3*rt[c];return Ue(rt,v,t,o,Math.max(1,Math.round(.03*h))),(function(c,C,E,ve,ce,pe,Ce,Te,I){let H=ce*pe,Q=I.take(),ue=z=>(ln(z,Q,ce,pe,Ce),z),he=(z,St)=>{let Ot=I.take();for(let Xe=0;Xe<H;Xe++)Ot[Xe]=z[Xe]*St[Xe];return ue(Ot)},ie=ue(I.take(C)),Ie=ue(I.take(E)),be=ue(I.take(ve)),Pe=ue(I.take(c)),Ke=he(C,C),ct=he(C,E),de=he(C,ve),Ve=he(E,E),_n=he(E,ve),Mt=he(ve,ve),$t=he(C,c),Rt=he(E,c),Dn=he(ve,c),Kt=I.take(),At=I.take(),Qt=I.take(),mn=I.take();for(let z=0;z<H;z++){let St=$t[z]-ie[z]*Pe[z],Ot=Rt[z]-Ie[z]*Pe[z],Xe=Dn[z]-be[z]*Pe[z],Gt=Ke[z]-ie[z]*ie[z]+Te,Nt=ct[z]-ie[z]*Ie[z],Qe=de[z]-ie[z]*be[z],Ft=Ve[z]-Ie[z]*Ie[z]+Te,zt=_n[z]-Ie[z]*be[z],qt=Mt[z]-be[z]*be[z]+Te,Jt=Ft*qt-zt*zt,Zt=Qe*zt-Nt*qt,ut=Nt*zt-Qe*Ft,In=Gt*qt-Qe*Qe,Un=Nt*Qe-Gt*zt,Bn=Gt*Ft-Nt*Nt,pn=Gt*Jt+Nt*Zt+Qe*ut,gn=Math.abs(pn)>1e-12?1/pn:0;Kt[z]=(Jt*St+Zt*Ot+ut*Xe)*gn,At[z]=(Zt*St+In*Ot+Un*Xe)*gn,Qt[z]=(ut*St+Un*Ot+Bn*Xe)*gn,mn[z]=Pe[z]-Kt[z]*ie[z]-At[z]*Ie[z]-Qt[z]*be[z]}ue(Kt),ue(At),ue(Qt),ue(mn);for(let z=0;z<H;z++)c[z]=Kt[z]*C[z]+At[z]*E[z]+Qt[z]*ve[z]+mn[z]})(rt,G,me,ye,t,o,Math.max(2,Math.round(.07*h)),.004,a),{depth:rt,water:De,sky:_e,falls:ze}}function sr(e,r,t,o,a,s,h){if(r===s&&t===h)return e[a*s+o];let l=Math.max(0,Math.min(r-1,(o+.5)*r/s-.5)),f=Math.max(0,Math.min(t-1,(a+.5)*t/h-.5)),g=Math.min(r-2,Math.floor(l)),d=Math.min(t-2,Math.floor(f)),y=l-g,v=f-d;if(g<0||d<0)return e[Math.round(f)*r+Math.round(l)];let w=d*r+g,n=w+r;return(e[w]*(1-y)+e[w+1]*y)*(1-v)+(e[n]*(1-y)+e[n+1]*y)*v}var En=(e,r,t)=>{let o=Math.max(0,Math.min(1,(t-e)/(r-e)));return o*o*(3-2*o)},xi=class{constructor(e,r){this.base=40,this.mass=0,this.calm=0,this.drift=[0,0],this.fade=3,this.age=0,this.peak=0,this.front=0,this.live=!1,this.bins=new Uint32Array(64),this.spare=new Float32Array(0),this.cols=Math.max(3,0|e),this.rows=Math.max(3,0|r);let t=this.cols*this.rows;this.h=new Float32Array(t),this.p=new Float32Array(t),this.speed=new Float32Array(t).fill(1),this.damp=new Float32Array(t).fill(1),this.wall=new Float32Array(t),this.trace=new Float32Array(t)}clear(){this.h.fill(0),this.p.fill(0),this.trace.fill(0),this.live=!1,this.peak=0}drop(e,r,t=1,o=3){let{cols:a,rows:s,h,p:l}=this,f=Math.max(1,o),g=Math.ceil(3*f);for(let d=Math.max(1,Math.floor(r-g));d<Math.min(s-1,Math.ceil(r+g));d++)for(let y=Math.max(1,Math.floor(e-g));y<Math.min(a-1,Math.ceil(e+g));y++){let v=y-e,w=d-r,n=(v*v+w*w)/(f*f),b=t*(1-n)*Math.exp(-n),X=d*a+y;h[X]+=b,l[X]+=b}this.age=0,this.live=!0,this.peak=Math.max(this.peak,t),this.front=Math.max(this.front,t)}step(e,r=1){if(!(this.live&&e>0))return this.live;e=Math.min(.05,e),this.age+=e;let{cols:t,rows:o,speed:a,damp:s,wall:h,trace:l}=this,f=Math.max(0,this.base*r),g=0;for(let G=0;G<a.length;G++)a[G]>g&&(g=a[G]);let d=Math.max(1,Math.min(8,Math.ceil(f*e*Math.sqrt(g)/.6))),y=this.calm,v=e/d,w=f*v*(f*v),n=this.mass*v*v,b=this.h,X=this.p;for(let G=0;G<d;G++){for(let ye=1;ye<o-1;ye++)for(let A=1,D=ye*t+1;A<t-1;A++,D++){let B=b[D],Z=b[D-1]+b[D+1]+b[D-t]+b[D+t]-4*B,ae=l[D],Be=ae>.02?Math.max(0,1-Math.abs(B)/ae):0,ge=y*Be*Be*v,Ge=1-Math.min(.5,s[D]*v+ge);X[D]=(B+(B-X[D])*Ge+w*a[D]*Z-n*B)*(1-h[D])*(1-Math.min(.5,.5*ge))}let me=b;b=X,X=me}this.h=b,this.p=X;let P=this.drift[0]*e,q=this.drift[1]*e;(P||q)&&(this.carry(b,P,q),this.carry(X,P,q));for(let G=0;G<t;G++)b[G]=.5*b[t+G],b[(o-1)*t+G]=.5*b[(o-2)*t+G];for(let G=0;G<o;G++)b[G*t]=.5*b[G*t+1],b[G*t+t-1]=.5*b[G*t+t-2];let oe=Math.exp(-e*this.fade),M=0;for(let G=0;G<b.length;G++){let me=Math.abs(b[G]);me>M&&(M=me);let ye=l[G]*oe;l[G]=me>=ye?me:ye<1e-4?0:ye}this.peak=M;let _=this.bins.fill(0),$=.05*M,se=0;for(let G=0;G<b.length;G++)b[G]>$&&(_[Math.min(63,b[G]/M*64|0)]++,se++);let Fe=0,Me=63;for(;Me>0&&(Fe+=_[Me],!(Fe>=.08*se));Me--);return this.front=Math.max(.15*M,(Me+1)/64*M),!(M<.004)||(this.clear(),!1)}carry(e,r,t){let{cols:o,rows:a}=this;this.spare.length!==e.length&&(this.spare=new Float32Array(e.length));let s=this.spare;for(let h=0,l=0;h<a;h++){let f=Math.min(a-1.001,Math.max(0,h-t)),g=0|f,d=f-g;for(let y=0;y<o;y++,l++){let v=Math.min(o-1.001,Math.max(0,y-r)),w=0|v,n=v-w,b=g*o+w;s[l]=(e[b]*(1-n)+e[b+1]*n)*(1-d)+(e[b+o]*(1-n)+e[b+o+1]*n)*d}}e.set(s)}slope(e,r){let{h:t,cols:o}=this,a=t.length;return r[0]=.5*(t[Math.min(a-1,e+1)]-t[Math.max(0,e-1)]),r[1]=.5*(t[Math.min(a-1,e+o)]-t[Math.max(0,e-o)]),r}};function na(e,r,t,o){let a=new Float32Array(e.length);for(let s=0;s<2;s++){let h=s?a:e,l=s?e:a;for(let f=0;f<t;f++)for(let g=0;g<r;g++){let d=0,y=0;for(let v=-o;v<=o;v++){let w=s?g:g+v,n=s?f+v:f;w<0||n<0||w>=r||n>=t||(d+=h[n*r+w],y++)}l[f*r+g]=d/y}}}var cr,yi=["none","flow","orb","drift","swell","caustics","contour","aurora","ripple","halo","interference","mesh","cascade","constellation"],mr=["glyph","dot","pixel","mosaic","lego","voxel","disco","dither","hex","led","cmyk","stipple","engraving","crosshatch","woodblock","risograph","pointillism","inlay","tick","bayer"],Mi=[{value:"fluid",label:"Fluid",description:"An ink-in-water wake that bends the image and swirls the characters."},{value:"lantern",label:"Lantern",description:"A soft light follows the pointer and lifts the characters it passes, without distortion."},{value:"trail",label:"Trail",description:"The Asciify Trail: in the wake, sparse characters fill in and dense ones open up, then settle. No distortion."},{value:"loupe",label:"Loupe",description:"A glass loupe glides after the pointer and magnifies the characters it covers."},{value:"reveal",label:"Reveal",description:"Under a soft spotlight the characters take the source image's own colours. Best over a photo or video in one ink."},{value:"none",label:"Off",description:"The field stays still under the pointer."}],wi={radius:.13,strength:.5,trail:.45,follow:12},bi={strength:.55,radius:.45},Lt={radius:.075,force:1,dissipation:1.6,refraction:.03,glow:.55,resolution:128,curl:24},Ei={charset:" .,:-=+*#%@",cellSize:12,cellAspect:1,cellFit:"pixel",font:'ui-monospace, "SF Mono", Menlo, Consolas, monospace',fontWeight:500,glyphScale:.8,mark:"glyph",dotScale:.9,markAngle:-35,accents:0,shuffle:0,sample:"area",linePitch:.5,lineWeight:1,sparkle:0,textRepeat:"flow",glyphOrder:"tone",color:"ink",ink:"#f3ba32",highlight:"auto",background:"transparent",brightness:0,contrast:1,gamma:1,invert:!1,levels:"auto",blend:"auto",saturation:1.1,ramp:[],shade:.5,backdrop:0,fit:"cover",focus:{x:.5,y:.5},vignette:0,drift:0,scene:"flow",scale:1,clear:!1,speed:1,hover:"fluid",fluid:Lt,lantern:wi,trail:bi,scope:"all",tap:"surface",maxPixelRatio:2,respectReducedMotion:!0},ne=(e,r,t,o)=>typeof e=="number"&&Number.isFinite(e)?Math.min(t,Math.max(r,e)):o,hr=(e,r)=>typeof e=="string"&&/^#([\da-f]{3}|[\da-f]{6})$/i.test(e.trim())?e.trim().toLowerCase():r,ra=/^[\u0020-\u007e\u00a0-\u02ff\u0370-\u0482\u048a-\u052f\u2010-\u20cf\u2100-\u2bff]*$/;function Dt(e){if(!ra.test(e)&&cr===void 0){let r=Intl.Segmenter;cr=r?new r(void 0,{granularity:"grapheme"}):null}return(cr&&!ra.test(e)?Array.from(cr.segment(e),r=>r.segment):Array.from(e)).filter(r=>r!==`
`&&r!=="\r"&&r!=="	").slice(0,256)}function ki(e){let r=Dt(e).filter(t=>t.trim());return r.length>0&&2*r.filter(xa).length>r.length}var Ti=(e,r,t)=>{let o=mr.includes(e)?e:r;return(o==="glyph"||o==="inlay")&&ki(t)},Ri=(e,r)=>{if(!Array.isArray(e))return r;let t=e.map(o=>hr(o,"")).filter(Boolean).slice(0,6);return t.length>=2?t:[]};function Kr(e={},r=Ei){let t=typeof e.charset=="string"&&Dt(e.charset).length>=2?e.charset:r.charset,o=r.fluid||Lt,a=e.fluid===void 0?r.fluid:e.fluid,s=a!==!1&&(()=>{let y=a!==!0&&a?{...o,...a}:o;return{radius:ne(y.radius,.005,.5,Lt.radius),force:ne(y.force,0,8,Lt.force),dissipation:ne(y.dissipation,.05,20,Lt.dissipation),refraction:ne(y.refraction,0,.5,Lt.refraction),glow:ne(y.glow,0,2,Lt.glow),resolution:Math.round(ne(y.resolution,16,512,Lt.resolution)),curl:ne(y.curl,0,80,Lt.curl)}})(),h=yi.includes(e.scene)?e.scene:r.scene,l=!!e.clear&&typeof e.clear=="object"&&("element"in e.clear||"nodeType"in e.clear||"rects"in e.clear),f=e.clear===void 0||l?r.clear:e.clear,g=!!f&&{x:ne(f.x,-.5,1.5,.25),y:ne(f.y,-.5,1.5,.3),width:ne(f.width,0,2,.5),height:ne(f.height,0,2,.4),feather:ne(f.feather,.005,1,.12),shape:f.shape==="rect"?"rect":"ellipse"};return{charset:t,cellSize:ne(e.cellSize,1,96,r.cellSize),cellAspect:Ti(e.mark,r.mark,t)?Math.max(1,ne(e.cellAspect,.3,2,r.cellAspect)):ne(e.cellAspect,.3,2,r.cellAspect),cellFit:e.cellFit==="fill"||e.cellFit==="pixel"?e.cellFit:r.cellFit,font:typeof e.font=="string"&&e.font.trim()?e.font:r.font,fontWeight:Math.round(ne(e.fontWeight,100,900,r.fontWeight)),glyphScale:ne(e.glyphScale,.3,1.6,r.glyphScale),mark:mr.includes(e.mark)?e.mark:r.mark,dotScale:ne(e.dotScale,.1,1.4,r.dotScale),markAngle:ne(e.markAngle,-360,360,r.markAngle),accents:ne(e.accents,0,.3,r.accents),shuffle:ne(e.shuffle,0,4,r.shuffle),sample:e.sample==="point"||e.sample==="area"?e.sample:r.sample,linePitch:ne(e.linePitch,.2,4,r.linePitch),lineWeight:ne(e.lineWeight,.2,3,r.lineWeight),sparkle:ne(e.sparkle,0,.05,r.sparkle),textRepeat:e.textRepeat==="row"||e.textRepeat==="flow"?e.textRepeat:r.textRepeat,glyphOrder:e.glyphOrder==="text"||e.glyphOrder==="tone"||e.glyphOrder==="scatter"?e.glyphOrder:r.glyphOrder,color:e.color==="source"||e.color==="ink"?e.color:r.color,ink:hr(e.ink,r.ink),highlight:e.highlight==="auto"?"auto":hr(e.highlight,r.highlight),ramp:Ri(e.ramp,r.ramp),background:e.background==="transparent"?"transparent":hr(e.background,r.background),brightness:ne(e.brightness,-1,1,r.brightness),contrast:ne(e.contrast,0,4,r.contrast),gamma:ne(e.gamma,.2,5,r.gamma),invert:typeof e.invert=="boolean"?e.invert:r.invert,levels:e.levels==="none"||e.levels==="auto"?e.levels:r.levels,blend:e.blend==="auto"||e.blend==="coarse"||e.blend==="on"||e.blend==="off"?e.blend:r.blend,saturation:ne(e.saturation,0,3,r.saturation),shade:ne(e.shade,0,1,r.shade),backdrop:ne(e.backdrop,0,1,r.backdrop),fit:e.fit==="contain"||e.fit==="cover"?e.fit:r.fit,focus:{x:ne(e.focus?.x,0,1,r.focus.x),y:ne(e.focus?.y,0,1,r.focus.y)},vignette:ne(e.vignette,0,1,r.vignette),drift:ne(e.drift,0,2,r.drift),scene:h,scale:ne(e.scale,.2,6,r.scale),clear:g,speed:ne(e.speed,0,5,r.speed),hover:Mi.some(y=>y.value===e.hover)?e.hover:r.hover,fluid:s,lantern:{radius:ne(e.lantern?.radius,.02,.6,r.lantern.radius),strength:ne(e.lantern?.strength,0,1.5,r.lantern.strength),trail:ne(e.lantern?.trail,0,3,r.lantern.trail),follow:ne(e.lantern?.follow,1,60,r.lantern.follow)},trail:{strength:ne(e.trail?.strength,0,1,r.trail.strength),radius:ne(e.trail?.radius,.1,1,r.trail.radius)},scope:e.scope===void 0?r.scope:(d=e.scope,d==="subject"||d==="outside"?d:"all"),tap:e.tap==="ring"||e.tap==="none"||e.tap==="surface"?e.tap:r.tap,maxPixelRatio:ne(e.maxPixelRatio,.5,4,r.maxPixelRatio),respectReducedMotion:typeof e.respectReducedMotion=="boolean"?e.respectReducedMotion:r.respectReducedMotion};var d}function oa(e,r,t,o,a,s={x:.5,y:.5}){if(!(e>0&&r>0&&t>0&&o>0))return{scale:[1,1],offset:[0,0]};let h=e/r,l=t/o,f=l>h,g=a==="cover"?f?[h/l,1]:[1,l/h]:f?[1,l/h]:[h/l,1];return{scale:g,offset:a==="cover"?[(1-g[0])*s.x,(1-g[1])*s.y]:[.5*(1-g[0]),.5*(1-g[1])]}}function Qr(e,r,t,o){let a=Math.max(2,Math.round(e*t)),s=Math.max(2,Math.round(a*r)),h=Math.min(16,Math.max(1,o)),l=Math.ceil(o/h);return{width:s,height:a,columns:h,rows:l,atlasWidth:h*s,atlasHeight:l*a}}function ur(e){let r=e.replace("#",""),t=r.length===3?r.split("").map(a=>a+a).join(""):r,o=Number.parseInt(t,16);return Number.isFinite(o)&&t.length===6?[(o>>16&255)/255,(o>>8&255)/255,(255&o)/255]:[0,0,0]}function Ai(e){let r=new Uint32Array(256),t=0;for(let h=0;h+3<e.length;h+=4)e[h+3]<8||(r[Math.round(.2126*e[h]+.7152*e[h+1]+.0722*e[h+2])]++,t++);if(!t)return[0,1];let o=h=>{let l=0;for(let f=0;f<256;f++)if(l+=r[f],l>=t*h)return f/255;return 1},a=o(.02),s=o(.98);return s-a<.08?[0,1]:[a,s]}var Hn=e=>e.hover!=="fluid"||e.fluid?e.hover:"none";function Si(e,r,t=24,o=.12,a="ellipse"){return e.width>0&&e.height>0&&{x:(r.left-t-e.left)/e.width,y:(r.top-t-e.top)/e.height,width:(r.width+2*t)/e.width,height:(r.height+2*t)/e.height,feather:o,shape:a}}var an,Fi=/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i,aa=/swiftshader|llvmpipe|softpipe|software|basic render/i;function Ci(){if(an)return an;if(typeof document>"u"||globalThis.WebGL2RenderingContext===void 0)return an="none";try{let e=no();if(e)return an=aa.test(e.renderer)?"software":"gpu";let r=document.createElement("canvas").getContext("webgl2");if(!r)return an="none";let t=r.getExtension("WEBGL_debug_renderer_info"),o=String(r.getParameter(t?t.UNMASKED_RENDERER_WEBGL:r.RENDERER)??"");return r.getExtension("WEBGL_lose_context")?.loseContext(),an=aa.test(o)?"software":"gpu"}catch{return an="none"}}var ro=(e,r)=>`${e.fontWeight} ${Math.max(1,r.height*e.glyphScale)}px ${e.font}`,Ma=(e,r)=>`${Dt(e.charset).join("")}\0${ro(e,r)}\0${r.width}x${r.height}x${r.columns}`;function wa(e,r,t,o){let a=Math.min(globalThis.devicePixelRatio||1,e.maxPixelRatio,Math.sqrt(8294400/Math.max(1,r*t)));return o<1&&a>1?Math.max(1,a*o):a}function ba(e,r,t){let o=Dt(e.charset),a=document.createElement("canvas");a.width=r.atlasWidth,a.height=r.atlasHeight;let s=a.getContext("2d");s.fillStyle="#fff",s.textAlign="center",s.textBaseline="alphabetic";let h=ro(e,r),l=Math.max(1,r.height*e.glyphScale),f=`${e.fontWeight} ${l}px "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", YuGothic, "Noto Sans JP", "Noto Sans CJK JP", Meiryo, sans-serif, ${e.font}`;s.font=h;let g=s.measureText("M"),d=g.actualBoundingBoxAscent||r.height*e.glyphScale*.7,y=g.actualBoundingBoxDescent||0,v=(r.height+d-y)/2;o.forEach((b,X)=>{let P=X%r.columns*r.width+r.width/2,q=Math.floor(X/r.columns)*r.height+v,oe=xa(b);if(s.save(),s.beginPath(),s.rect(P-r.width/2,q-v,r.width,r.height),s.clip(),oe){s.font=f;let M=s.measureText(b),_=Math.max(M.width,(M.actualBoundingBoxLeft||0)+(M.actualBoundingBoxRight||0)),$=(M.actualBoundingBoxAscent||.88*l)+(M.actualBoundingBoxDescent||.12*l),se=Math.min(1,.94*r.width/Math.max(1,_),.94*r.height/Math.max(1,$));s.translate(P,Math.floor(X/r.columns)*r.height+r.height/2),s.scale(se,se),s.translate(((M.actualBoundingBoxLeft||0)-(M.actualBoundingBoxRight||0))/2,((M.actualBoundingBoxAscent||.88*l)-(M.actualBoundingBoxDescent||.12*l))/2),s.fillText(b,0,0),s.font=h}else{let M=s.measureText(b).width;s.translate(P,q),M>.96*r.width&&s.scale(.96*r.width/M,1),s.fillText(b,0,0)}s.restore()});let w=!0,n=document.fonts;try{w=!n?.check||n.check(h,o.join(""))}catch{}return t&&queueMicrotask(()=>{a.width=a.height=1}),{image:a,final:w}}var ia=()=>{};function Ea(e,r={}){if(typeof document>"u"||e.ownerDocument!==document)return!1;let t=e.clientWidth,o=e.clientHeight;if(!t||!o)return!1;let a=no();if(!a||a.lost)return!1;let{clear:s,source:h,interactionTarget:l,onError:f,label:g,...d}=r,y=Kr(d),v=Qr(y.cellSize,y.cellAspect,wa(y,t,o,a.scale),Dt(y.charset).length),w=Ma(y,v);if(a.hasAtlas(w))return!1;try{a.releaseAtlas(a.atlas(w,()=>ba(y,v,!0),ia),ia)}catch{return!1}return!0}function ka(e={}){let r=Ci();return r==="gpu"||r==="software"&&!!e.allowSoftware}function Ta(e,r={}){let t=i=>typeof HTMLElement<"u"&&i instanceof HTMLElement,o=i=>{let m=i.clear;return a(m)?{element:null,rest:{...i,clear:!1}}:t(m)?{element:{element:m},rest:{...i,clear:void 0}}:m&&typeof m=="object"&&t(m.element)?{element:m,rest:{...i,clear:void 0}}:{element:null,rest:i}},a=i=>!!i&&typeof i=="object"&&"rects"in i,s=o(r).element,h=a(r.clear)?r.clear:null,l=Kr(o(r).rest),f=r.onError,g=e.ownerDocument,d=g&&typeof document<"u"&&g!==document?null:no(),y=d?e.getContext("2d",{alpha:!0}):null,v=!(!d||!y),w=v?d.gl:e.getContext("webgl2",{alpha:!0,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!0,powerPreference:"high-performance"});if(!w)throw new Error("WebGL2 is not available for the glyph field.");let n=w;v&&(i=>{ga.add(i)})(e),e.setAttribute("role","img"),e.setAttribute("aria-label",r.label??"ASCII artwork"),e.dataset.renderer="glyph-field";let b=!1,X=v?null:n.getExtension("KHR_parallel_shader_compile"),P,q,oe=null,M=null,_=null,$=null,se=null,Fe=[],Me=[],G=null,me=!1,ye=null,A=null,D=[],B=0,Z=0,ae=1,Be=0,ge=Qr(l.cellSize,l.cellAspect,1,2),Ge=2,Ne=0,Re=0,We=0,V=null,Ze=!1,it=null,ht=0,ft=0,et=0,lt=null,tt=0,Cn=0,un=0,hn=!0,_e=0,dt=[0,1],Pn=-1/0,De=-1/0,Xt=!1,kt=(()=>{let i=typeof navigator>"u"?void 0:navigator;return 1e3/(i&&(i.hardwareConcurrency>0&&i.hardwareConcurrency<=2||i.deviceMemory&&i.deviceMemory<=2||i.connection?.saveData)?30:60)-2})(),ze=new Float32Array(16),Ye=!1,Vt=0,jt=0,we=!0,st=!1,mt=!1,fn=!1,Yt=!1,Tt=!0,$e=null,yt=null,Ln=1/60,Bt=0,pt=0,nt=[],rt=new Float32Array(16),dn=()=>{if(!s)return;let{element:i,padding:m=32,feather:p=.16,shape:u="rect"}=s,k=Si(e.getBoundingClientRect(),i.getBoundingClientRect(),m,p,u),T=l.clear;JSON.stringify(T)!==JSON.stringify(k)&&(l={...l,clear:k},we=!0)},c=null,C=new Uint8Array(0),E=0,ve=0,ce=!1,pe=null,Ce=new Float64Array(0),Te=!0,I=()=>{if(!h)return void(ce&&(ce=!1,we=!0));let i=h.rects,m=typeof i=="function"?i():i;if(m===pe&&!Te)return;pe=m;let p=e.getBoundingClientRect(),[u,k]=(function(x,S,L=256){let j=Math.min(.16666666666666666,L/Math.max(1,x,S));return[Math.max(2,Math.round(x*j)),Math.max(2,Math.round(S*j))]})(p.width,p.height),T=new Float64Array(4*m.length+6);T[0]=p.left,T[1]=p.top,T[2]=p.width,T[3]=p.height,T[4]=h.padding??8,T[5]=h.softness??28,m.forEach((x,S)=>{T[6+4*S]=x.left,T[7+4*S]=x.top,T[8+4*S]=x.width,T[9+4*S]=x.height});let O=!Te&&T.length===Ce.length&&T.every((x,S)=>x===Ce[S]);Te=!1,O&&ce||(Ce=T,C=(function(x,S,L,j,R=8,W=28,re=new Uint8Array(L*j)){let Y=L*j;if(re.length!==Y&&(re=new Uint8Array(Y)),re.fill(0),!(S.width>0&&S.height>0&&x.length))return re;let J=L/S.width,K=j/S.height,le=Math.max(0,Math.round(W/2.56*J)),U=R+.5*W;for(let te of x){if(!(te.width>0&&te.height>0))continue;let Le=Math.max(0,Math.round((te.left-U-S.left)*J)),Oe=Math.min(L,Math.round((te.left+te.width+U-S.left)*J)),Se=Math.max(0,Math.round((te.top-U-S.top)*K)),ke=Math.min(j,Math.round((te.top+te.height+U-S.top)*K));for(let qe=Se;qe<ke;qe++)re.fill(255,(j-1-qe)*L+Le,(j-1-qe)*L+Math.max(Le,Oe))}if(!le)return re;let fe=new Float32Array(Math.max(L,j)),F=new Float32Array(Math.max(L,j)+1),Ee=(te,Le,Oe)=>{for(let Se=0;Se<3;Se++){for(let ke=0;ke<te;ke++)fe[ke]=re[Oe+ke*Le];F[0]=0;for(let ke=0;ke<te;ke++)F[ke+1]=F[ke]+fe[ke];for(let ke=0;ke<te;ke++){let qe=Math.max(0,ke-le),gt=Math.min(te,ke+le+1);re[Oe+ke*Le]=Math.round((F[gt]-F[qe])/(gt-qe))}}};for(let te=0;te<j;te++)Ee(L,1,te*L);for(let te=0;te<L;te++)Ee(j,L,te);return re})(m,p,u,k,T[4],T[5],C),mt||(c??(c=ut(n.LINEAR)),n.bindTexture(n.TEXTURE_2D,c),n.pixelStorei(n.UNPACK_ALIGNMENT,1),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),u!==E||k!==ve?n.texImage2D(n.TEXTURE_2D,0,n.R8,u,k,0,n.RED,n.UNSIGNED_BYTE,C):n.texSubImage2D(n.TEXTURE_2D,0,0,0,u,k,n.RED,n.UNSIGNED_BYTE,C),n.pixelStorei(n.UNPACK_ALIGNMENT,4),E=u,ve=k,ce=!0,we=!0))},H=()=>{we=!0,Ae()},Q=!1,ue=()=>{let i=!!h&&typeof h.rects=="function"&&typeof window<"u"&&typeof window.addEventListener=="function";i!==Q&&(Q=i,i?window.addEventListener("scroll",H,{passive:!0,capture:!0}):window.removeEventListener("scroll",H,{capture:!0}))},he=i=>i==="lantern"||i==="loupe"||i==="reveal",ie={target:null,at:null,strength:0,trail:[]},Ie=new Float32Array(36),be=null,Pe=null,Ke=!1,ct=()=>{if(!B||!Z)return null;let i=B/Z,m=Math.round(i>=1?128:128*i),p=Math.round(i>=1?128/i:128);return be&&be.width===m&&be.height===p||(be=new pi(m,p),Pe||(Pe=ut(n.LINEAR)),n.bindTexture(n.TEXTURE_2D,Pe),n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,m,p,0,n.RGBA,n.UNSIGNED_BYTE,be.pixels),Ke=!0),be},de=null,Ve=null,_n=new Uint8Array(0),Mt=!1,$t=null,Rt=null,Dn=-1,Kt=[-.5,-.8],At=[0,0],Qt=()=>{if(de&&V)try{if(Rt??(Rt=document.createElement("canvas").getContext("2d",{willReadFrequently:!0})),!Rt)return;let i=V instanceof HTMLVideoElement,m=i?de.cols>>1:de.cols,p=i?de.rows>>1:de.rows,u=Rt.canvas;u.width!==m||u.height!==p?(u.width=m,u.height=p):Rt.clearRect(0,0,m,p);let k=ht||1,T=ft||1;Rt.drawImage(V,wt.offset[0]*k,wt.offset[1]*T,wt.scale[0]*k,wt.scale[1]*T,0,0,m,p),$t=(function(O,x,S,L,j=O){let R=x*S,W=L?.length===R*qn?L:new Float32Array(R*qn);if(!R)return W;let re=Math.min(x,S),Y=new Float32Array(R),J=new Float32Array(R),K=new Float32Array(R),le=new Float32Array(R),U=new Float32Array(R),fe=new Float32Array(R);for(let ee=0;ee<R;ee++){let xe=O[4*ee+3]/255;Y[ee]=(.299*O[4*ee]+.587*O[4*ee+1]+.114*O[4*ee+2])/255*xe}J.set(Y),Ue(J,fe,x,S,Math.max(1,Math.round(.012*re))),K.set(Y),Ue(K,fe,x,S,Math.max(1,Math.round(.03*re)));for(let ee=0;ee<R;ee++){le[ee]=Math.abs(Y[ee]-J[ee]);let xe=Math.max(0,Y[ee]-.55)/.45;U[ee]=xe*xe}Ue(le,fe,x,S,Math.max(1,Math.round(.02*re)));let F=1/Math.max(.02,xt(le,.95));Ue(U,fe,x,S,Math.max(1,Math.round(.05*re)));let Ee=1/Math.max(.03,xt(U,.98)),te=Math.max(1,Math.ceil(Math.sqrt(R/12e3))),Le=Math.max(1,Math.floor(x/te)),Oe=Math.max(1,Math.floor(S/te)),Se=Le*Oe,ke=O,qe=j;if(te>1){let ee=new Uint8ClampedArray(4*Se),xe=j===O?ee:new Uint8ClampedArray(4*Se);for(let Je=0;Je<Oe;Je++)for(let He=0;He<Le;He++){let vt=[0,0,0,0,0,0,0];for(let ot=Je*te;ot<(Je+1)*te;ot++)for(let qr=He*te;qr<(He+1)*te;qr++){let Yo=4*(ot*x+qr);for(let Pt=0;Pt<4;Pt++)vt[Pt]+=O[Yo+Pt];if(xe!==ee)for(let Pt=0;Pt<3;Pt++)vt[4+Pt]+=j[Yo+Pt]}let Et=4*(Je*Le+He),jo=te*te;for(let ot=0;ot<4;ot++)ee[Et+ot]=vt[ot]/jo;if(xe!==ee){for(let ot=0;ot<3;ot++)xe[Et+ot]=vt[4+ot]/jo;xe[Et+3]=ee[Et+3]}}ke=ee,qe=xe}ir?.n!==Se&&(ir=new gi(Se)),ir.reset();let{depth:gt,water:bt,sky:rn,falls:on}=vi(ke,qe,Le,Oe,ir),xn=xt(gt,.03),yn=xt(gt,.97),zr=Math.max(.05,yn-xn),Mn=0,wn=0,Ct=0,tr=new Float32Array(R);for(let ee=0;ee<S;ee++)for(let xe=0;xe<x;xe++){let Je=ee*x+xe,He=Je*qn,vt=at((sr(gt,Le,Oe,xe,ee,x,S)-xn)/zr);W[He+1]=vt,W[He+8]=at(sr(bt,Le,Oe,xe,ee,x,S)),W[He+9]=at(sr(rn,Le,Oe,xe,ee,x,S)),W[He+10]=at(sr(on,Le,Oe,xe,ee,x,S));let Et=vt*vt*vt*(.25+Y[Je]);Mn+=(xe+.5)/x*Et,wn+=(ee+.5)/S*Et,Ct+=Et,tr[Je]=Math.hypot(K[ee*x+Math.min(x-1,xe+1)]-K[ee*x+Math.max(0,xe-1)],K[Math.min(S-1,ee+1)*x+xe]-K[Math.max(0,ee-1)*x+xe])}Mn=Ct>0?Math.max(.3,Math.min(.7,Mn/Ct)):.5,wn=Ct>0?Math.max(.3,Math.min(.7,wn/Ct)):.5;let Gn=1/Math.max(.004,xt(tr,.97));for(let ee=0;ee<S;ee++)for(let xe=0;xe<x;xe++){let Je=ee*x+xe,He=Je*qn,vt=(K[ee*x+Math.min(x-1,xe+1)]-K[ee*x+Math.max(0,xe-1)])*Gn,Et=(K[Math.min(S-1,ee+1)*x+xe]-K[Math.max(0,ee-1)*x+xe])*Gn;W[He]=K[Je],W[He+2]=Math.min(1,U[Je]*Ee),W[He+3]=Math.min(1,le[Je]*F),W[He+4]=Math.max(-1,Math.min(1,-vt)),W[He+5]=Math.max(-1,Math.min(1,-Et)),W[He+6]=Mn,W[He+7]=wn}return W})(Rt.getImageData(0,0,m,p).data,m,p,$t),At[0]=m,At[1]=p,(function(O,x,S=[-.5,-.8],L=O.cols,j=O.rows){let{cols:R,rows:W,speed:re,damp:Y,wall:J}=O,K=qn;if(x.length!==L*j*K)return S;let le=0,U=0,fe=0;for(let F=0,Ee=0;F<W;F++){let te=Math.min(j-1,F*j/W|0);for(let Le=0;Le<R;Le++,Ee++){let Oe=Math.min(L-1,Le*L/R|0),Se=(te*L+Oe)*K,ke=x[Se+3],qe=x[Se+8],gt=x[Se+9],bt=x[Se+2],rn=x[Se+1],on=Oe<L-1?K:0,xn=Oe>0?-K:0,yn=te<j-1?L*K:0,zr=te>0?-L*K:0,Mn=Math.hypot(x[Se+1+on]-x[Se+1+xn],x[Se+1+yn]-x[Se+1+zr]),wn=Math.hypot(x[Se+4],x[Se+5]),Ct=Math.max(qe,.9*gt),tr=1-En(.2,.8,ke),Gn=Math.max(.12,Math.max(Ct,.2+.65*tr)*(1-.45*En(.55,.95,rn)*(1-qe)));re[Ee]=Gn*Gn;let ee=Math.max(0,1-Ct);Y[Ee]=.9*qe+1.6*gt*(1-qe)+ee*(1.4+6.5*En(.25,.9,ke)),J[Ee]=Math.min(.4,.35*En(.12,.35,Mn)*(1-.6*qe)+.1*En(.6,1,wn)*(1-Ct)),le+=(Le/(R-1)-.5)*bt,U+=(F/(W-1)-.5)*bt,fe+=bt}}if(na(re,R,W,2),na(Y,R,W,1),fe>.5){let F=Math.hypot(le,U);F/fe>.02&&(S[0]=le/F,S[1]=U/F)}})(de,$t,Kt,m,p)}catch{}},mn=(i,m,p)=>{if(!B||!Z)return;let u=B/Z,k=Math.round(u>=1?128:128*u),T=Math.round(u>=1?128/u:128);de&&de.cols===k&&de.rows===T||(de=new xi(k,T),$t=null,_n=new Uint8Array(k*T*4),Ve??(Ve=ut(n.LINEAR)),n.bindTexture(n.TEXTURE_2D,Ve),n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,k,T,0,n.RGBA,n.UNSIGNED_BYTE,null)),de.base=1.1*Math.min(k,T),de.mass=0,de.calm=7,de.fade=1.6,Qt(),Dn=un,de.drop(i*(k-1),m*(T-1),p,2.2),Ae()},z=i=>{if(!de?.live||!Ve)return!!Mt&&(Mt=!1,!0);V instanceof HTMLVideoElement&&Dn!==un&&(Qt(),Dn=un),de.step(i,.45+.55*Math.exp(-de.age/.7));let m=Math.min(1,Math.exp(-(de.age-.9)/.5));return m<.02?(de.clear(),Mt=!1,!0):((function(p,u,k,T,O=1,x=p.cols,S=p.rows){let{cols:L,rows:j,h:R,trace:W}=p,re=O/Math.max(.01,p.front),Y=k[0],J=k[1],K=u.length===x*S*11;for(let le=0,U=0;le<j;le++){let fe=Math.min(S-1,le*S/j|0);for(let F=0;F<L;F++,U++){let Ee=R[U]*re,te=11*(fe*x+Math.min(x-1,F*x/L|0)),Le=K?u[te+9]:0,Oe=K?Math.max(u[te+8],.75*(1-En(.1,.45,u[te+3]))*(1-Le)):0,Se=Math.max(0,1-Math.max(Oe,Le)),ke=.5*(R[F<L-1?U+1:U]-R[F>0?U-1:U])*re,qe=.5*(R[le<j-1?U+L:U]-R[le>0?U-L:U])*re,gt=(6*-ke+(K?.35*u[te+4]:0))*Y+(6*-qe+(K?.35*u[te+5]:0))*J,bt=Math.max(-1,Math.min(1,gt)),rn=Ee>0?Ee:.45*Ee,on=Oe*(.8*rn+.4*bt*Math.min(1,4*Math.abs(Ee)))+Le*(.3*Math.min(1,W[U]*re)+.15*rn)+Se*(.55*rn+.25*bt*Math.min(1,4*Math.abs(Ee))),xn=Oe*Math.max(0,bt)**3*Math.min(1,3*Math.max(0,Ee))*.9+Se*Math.max(0,bt)**4*Math.min(1,3*Math.max(0,Ee))*.25;on=Math.max(-1,Math.min(1,on));let yn=Math.round(32767*on+32768);T[4*U]=yn>>>8,T[4*U+1]=255&yn,T[4*U+2]=Math.round(255*Math.min(1,xn)),T[4*U+3]=255}}})(de,$t??new Float32Array(0),Kt,_n,m,At[0],At[1]),n.bindTexture(n.TEXTURE_2D,Ve),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.texSubImage2D(n.TEXTURE_2D,0,0,0,de.cols,de.rows,n.RGBA,n.UNSIGNED_BYTE,_n),Mt=!0,!0)},St=0,Ot=typeof matchMedia=="function"?matchMedia("(prefers-reduced-motion: reduce)"):null,Xe=()=>l.respectReducedMotion&&!!Ot?.matches,Gt,Nt=new Promise(i=>{Gt=i}),Qe=!0,Ft=i=>f?.(i instanceof Error?i:new Error(String(i))),zt=(i,m)=>{let p=n.createShader(i);return D.push(p),n.shaderSource(p,m),n.compileShader(p),p},qt=i=>{if(v)return d.program(i);A??(A=zt(n.VERTEX_SHADER,`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`));let m=n.createProgram(),p=zt(n.FRAGMENT_SHADER,i);return n.attachShader(m,A),n.attachShader(m,p),n.linkProgram(m),{program:m,locations:null,fragment:p}},Jt=(i,m=!1)=>{if(i.locations)return!0;if(v)return d.linked(i,m);let{program:p,fragment:u}=i;if(!m&&X&&!n.getProgramParameter(p,X.COMPLETION_STATUS_KHR))return!1;if(!n.getProgramParameter(p,n.LINK_STATUS)){if(n.isContextLost())return!1;throw new Error(n.getShaderInfoLog(u)||n.getProgramInfoLog(p)||"Glyph field program failed to link.")}let k={};for(let T=n.getProgramParameter(p,n.ACTIVE_UNIFORMS)-1;T>=0;T--){let O=n.getActiveUniform(p,T).name.replace(/\[0\]$/,"");k[O]=n.getUniformLocation(p,O)}return i.locations=k,!0},Zt=(i=!1)=>!!oe&&!!M&&Jt(oe,i)&&Jt(M,i),ut=i=>{let m=n.createTexture();return n.bindTexture(n.TEXTURE_2D,m),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,i),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,i===n.LINEAR_MIPMAP_LINEAR?n.LINEAR:i),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),m},In=()=>{se&&(n.deleteTexture(se.ink),n.deleteTexture(se.under),n.deleteFramebuffer(se.buffer),se=null)},Un=()=>(function(i,m,p,u,k,T,O){if(i!=="fill"||!(k>0&&T>0))return[O.width,O.height];let x=m*u,S=x*p;return[k/Math.max(1,Math.floor(k/S+1e-6)),T/Math.max(1,Math.floor(T/x+1e-6))]})(l.cellFit,l.cellSize,l.cellAspect,ae,B,Z,ge),Bn=()=>!!l.fluid&&Hn(l)==="fluid",pn=()=>{G?.release(),me=!1,Fe.forEach(i=>n.deleteTexture(i)),Me.forEach(i=>n.deleteFramebuffer(i)),Fe=[],Me=[]};function gn(){_&&!v&&n.deleteProgram(_.program),_=qt((i=>`#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPrevious;
uniform vec2 uSize;
uniform float uAspect, uDt, uDecay, uEnergyDecay, uRadius, uSplat;
uniform vec2 uFrom, uTo, uForce;
out vec4 outColor;
${la(i)}
float segment(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.,1.);return length(pa-ba*h);}
void main(){
  vec2 uv=gl_FragCoord.xy/uSize;
  vec4 here=decodeFluid(texture(uPrevious,uv));
  vec4 state=decodeFluid(texture(uPrevious,uv-uDt*here.xy*vec2(1./uAspect,1.)));
  state.xy*=exp(-uDt*uDecay);
  state.z*=exp(-uDt*uEnergyDecay);
  if(uSplat>.5){
    vec2 scale=vec2(uAspect,1.);
    float d=segment(uv*scale,uFrom*scale,uTo*scale);
    float g=exp(-d*d/(uRadius*uRadius));
    state.xy+=uForce*g;
    state.z=min(1.,state.z+g*min(1.,length(uForce)*.5+.08));
  }
  float speed=length(state.xy);
  if(speed>5.)state.xy*=5./speed;
  outColor=encodeFluid(state);
}`)(b)),v?G?.release():G?.dispose(),G=b?null:(function(i,m,p){let u={splat:m($a),curl:m(Ka),vorticity:m(Qa),divergence:m(Ja),fade:m(Za),pressure:m(ei),gradient:m(ti),advect:m(ni)},k=Object.values(u),T=0,O=0,x=[],S=[],L=null,j=null,R=U=>{let fe=i.createTexture();i.bindTexture(i.TEXTURE_2D,fe),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,U),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,U),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),i.texImage2D(i.TEXTURE_2D,0,i.RGBA16F,T,O,0,i.RGBA,i.HALF_FLOAT,null);let F=i.createFramebuffer();return i.bindFramebuffer(i.FRAMEBUFFER,F),i.framebufferTexture2D(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,fe,0),i.checkFramebufferStatus(i.FRAMEBUFFER)!==i.FRAMEBUFFER_COMPLETE?(i.deleteFramebuffer(F),i.deleteTexture(fe),null):(i.viewport(0,0,T,O),i.clearColor(0,0,0,1),i.clear(i.COLOR_BUFFER_BIT),{texture:fe,buffer:F})},W=U=>{U&&(i.deleteTexture(U.texture),i.deleteFramebuffer(U.buffer))},re=()=>{[...x,...S,L,j].forEach(W),x=[],S=[],L=j=null},Y=(U,fe)=>{let F=U.locations;return i.useProgram(U.program),i.bindFramebuffer(i.FRAMEBUFFER,fe.buffer),i.uniform2f(F.uTexel,1/T,1/O),F},J=(U,fe,F,Ee)=>{i.activeTexture(i.TEXTURE0+F),i.bindTexture(i.TEXTURE_2D,Ee),i.uniform1i(U[fe],F)},K=()=>i.drawArrays(i.TRIANGLES,0,3),le=U=>{let fe=U[0];U[0]=U[1],U[1]=fe};return{resize(U,fe){re(),T=U,O=fe;let F=[R(i.LINEAR),R(i.LINEAR),R(i.NEAREST),R(i.NEAREST),R(i.NEAREST),R(i.NEAREST)];return i.bindFramebuffer(i.FRAMEBUFFER,null),F.some(Ee=>!Ee)?(F.forEach(W),!1):(x=[F[0],F[1]],S=[F[2],F[3]],L=F[4],j=F[5],!0)},ready:()=>k.every(p),step(U,fe){if(!x.length||!L||!j)return;let F;i.viewport(0,0,T,O),U&&(F=Y(u.splat,x[1]),J(F,"uVelocity",0,x[0].texture),i.uniform2f(F.uFrom,U.from[0],U.from[1]),i.uniform2f(F.uTo,U.to[0],U.to[1]),i.uniform2f(F.uForce,U.force[0],U.force[1]),i.uniform1f(F.uAspect,fe.aspect),i.uniform1f(F.uRadius,fe.radius),K(),le(x)),fe.curl>0&&(F=Y(u.curl,j),J(F,"uVelocity",0,x[0].texture),K(),F=Y(u.vorticity,x[1]),J(F,"uVelocity",0,x[0].texture),J(F,"uCurl",1,j.texture),i.uniform1f(F.uStrength,fe.curl),i.uniform1f(F.uDt,fe.dt),K(),le(x)),F=Y(u.divergence,L),J(F,"uVelocity",0,x[0].texture),K(),F=Y(u.fade,S[1]),J(F,"uSource",0,S[0].texture),i.uniform1f(F.uAmount,.8),K(),le(S);for(let Ee=0;Ee<20;Ee++)F=Y(u.pressure,S[1]),J(F,"uPressure",0,S[0].texture),J(F,"uDivergence",1,L.texture),K(),le(S);F=Y(u.gradient,x[1]),J(F,"uPressure",0,S[0].texture),J(F,"uVelocity",1,x[0].texture),K(),le(x),F=Y(u.advect,x[1]),J(F,"uVelocity",0,x[0].texture),i.uniform1f(F.uDt,fe.dt),i.uniform1f(F.uDissipation,fe.dissipation),K(),le(x),i.bindFramebuffer(i.FRAMEBUFFER,null)},get velocity(){return x[0]?.texture??null},get size(){return[T,O]},release:re,dispose(){re(),k.forEach(({program:U})=>i.deleteProgram(U))}}})(n,qt,i=>Jt(i))}let bo=()=>{pn();let i=l.fluid;if(!(i&&Bn()&&B&&Z))return;_||gn();let m=i.resolution,p=B/Z;if(Ne=p>=1?m:Math.max(8,Math.round(m*p)),Re=p>=1?Math.max(8,Math.round(m/p)):m,me=!!G&&G.resize(Ne,Re),me)return void(We=0);let u=()=>{pn();for(let k=0;k<2;k++){let T=ut(n.LINEAR);n.texImage2D(n.TEXTURE_2D,0,b?n.RGBA8:n.RGBA16F,Ne,Re,0,n.RGBA,b?n.UNSIGNED_BYTE:n.HALF_FLOAT,null);let O=n.createFramebuffer();n.bindFramebuffer(n.FRAMEBUFFER,O),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,T,0),Fe.push(T),Me.push(O)}return n.checkFramebufferStatus(n.FRAMEBUFFER)===n.FRAMEBUFFER_COMPLETE};if(!u()){if(b)throw new Error("The glyph field could not allocate its fluid buffers.");b=!0,Eo(),gn(),u()}for(let k of Me)n.bindFramebuffer(n.FRAMEBUFFER,k),n.viewport(0,0,Ne,Re),n.clearColor(b?.5:0,b?.5:0,0,1),n.clear(n.COLOR_BUFFER_BIT);n.bindFramebuffer(n.FRAMEBUFFER,null),We=0};function Eo(){oe&&!v&&n.deleteProgram(oe.program),M&&!v&&n.deleteProgram(M.program),In(),oe=qt(sa(b)),M=qt(ca),(v?d.canCompileInParallel:X)||Zt(!0)}let ko=()=>ro(l,ge),Tr=()=>{we=!0,Ae()},To=()=>Ma(l,ge),Rr=()=>{if(Ge=Dt(l.charset).length,ge=Qr(l.cellSize,l.cellAspect,ae,Ge),Be=ae,v){let p=To();if($?.key!==p){let u=$;$=d.atlas(p,Ar,Tr),d.releaseAtlas(u,Tr),P=$.texture}return void(we=!0)}let{image:m}=Ar();n.bindTexture(n.TEXTURE_2D,P),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,n.RGBA,n.UNSIGNED_BYTE,m),m.width=m.height=1,we=!0};function Ar(){return ba(l,ge,v)}let Ro=typeof document>"u"?void 0:document.fonts,Sr=()=>{if(!Ro?.load)return;let i=ko();Ro.load(i,Dt(l.charset).join("")).then(()=>{if(!st&&!mt&&ko()===i)return v?void($&&!$.final&&$.key===To()&&d.paintAtlas($,Ar)):(Rr(),void Ae())},()=>{})},Ao=i=>i.trim().replace(/^["']|["']$/g,"").toLowerCase(),So=()=>{if(dt=[0,1],V&&l.levels!=="none")try{let i=document.createElement("canvas");i.width=i.height=64;let m=i.getContext("2d",{willReadFrequently:!0});V===lt&&(m.imageSmoothingQuality="medium"),m.drawImage(V,0,0,64,64),dt=Ai(m.getImageData(0,0,64,64).data)}catch{dt=[0,1]}},en=null,Kn=null,Qn=!1,Fr=-1/0,Jn=new Uint8Array(0),tn=null,Fo=()=>{if(Qn=!1,!V||l.scope==="all")return;let i=ht||1,m=ft||1,p=Math.max(8,Math.round(i>=m?96:96*i/m)),u=Math.max(8,Math.round(m>=i?96:96*m/i));try{if(tn??(tn=document.createElement("canvas").getContext("2d",{willReadFrequently:!0})),!tn)return;let k=tn.canvas;k.width!==p||k.height!==u?(k.width=p,k.height=u):tn.clearRect(0,0,p,u),tn.drawImage(V,0,0,p,u),Kn=ya(tn.getImageData(0,0,p,u).data,p,u,null,Kn)}catch{return}if(Kn.key!=="none"){Jn.length!==p*u*4&&(Jn=new Uint8Array(p*u*4));for(let k=0;k<p*u;k++)Jn[4*k+3]=Math.round(255*Kn.subject[k]);en??(en=ut(n.LINEAR)),n.bindTexture(n.TEXTURE_2D,en),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,p,u,0,n.RGBA,n.UNSIGNED_BYTE,Jn),Qn=!0}},Cr=()=>{if(!V)return;let i=performance.now();V instanceof HTMLVideoElement&&!(i-Pn>1500)||(So(),Pn=i),V instanceof HTMLVideoElement&&!(i-Fr>160)||(Fo(),Fr=i),n.bindTexture(n.TEXTURE_2D,q),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1);try{n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,n.RGBA,n.UNSIGNED_BYTE,V),n.generateMipmap(n.TEXTURE_2D);let m=V;Cn=(m.videoWidth||m.naturalWidth||m.width)*(m.videoHeight||m.naturalHeight||m.height)*4*4/3}catch(m){Ft(m)}},Co=()=>{b=!n.getExtension("EXT_color_buffer_float")&&!n.getExtension("EXT_color_buffer_half_float"),Eo(),ye=v?d.vertexArray():n.createVertexArray(),v||(P=ut(n.NEAREST)),q=ut(n.LINEAR_MIPMAP_LINEAR),n.bindTexture(n.TEXTURE_2D,q),n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,1,1,0,n.RGBA,n.UNSIGNED_BYTE,new Uint8Array([0,0,0,255])),n.generateMipmap(n.TEXTURE_2D),B=Z=0,Be=0,vn(),Sr(),V&&Cr()};function vn(){let i=e.clientWidth||e.clientHeight?{width:e.clientWidth,height:e.clientHeight}:e.getBoundingClientRect();Xt=!i.width||!i.height;let m=wa(l,i.width,i.height,v?d.scale:1),p=Math.max(1,Math.round(i.width*m)),u=Math.max(1,Math.round(i.height*m));if(p===B&&u===Z&&m===ae)return!1;let k=!B||Math.abs(p/u-B/Z)>.01;return ae=m,B=p,Z=u,e.width=B,e.height=Z,Be!==ae&&Rr(),(k||Bn()&&!Fe.length&&!me)&&bo(),we=!0,!0}let Po=null,Zn=new Float32Array(18),On=[0,0,0],Lo=[1,1,1],_o=[0,0,0,0],wt=oa(1,1,1,1,"cover"),Do=null,Io=0,Uo=0,Bo=0,Oo=0,Go=()=>{Po!==l&&(Po=l,On=ur(l.ink),Lo=ur(l.highlight==="auto"?"#ffffff":l.highlight),_o=l.background==="transparent"?[0,0,0,0]:[...ur(l.background),1],Zn.fill(0),l.ramp.forEach((Y,J)=>Zn.set(ur(Y),3*J))),Do===l&&Io===B&&Uo===Z&&Bo===ht&&Oo===ft||(Do=l,Io=B,Uo=Z,Bo=ht,Oo=ft,wt=oa(B,Z,ht||1,ft||1,l.fit,l.focus)),v&&d.begin(B,Z);let i=l.fluid,m=V&&tt?ge.height/Z*tt*wt.scale[1]:1,p=(()=>{let[Y,J]=Un(),K=Math.ceil(B/Y-1e-4),le=Math.ceil(Z/J-1e-4);if(se&&se.columns===K&&se.rows===le)return se;In();let U=()=>{let te=ut(n.NEAREST);return n.texStorage2D(n.TEXTURE_2D,1,b?n.RGBA8:n.RGBA16F,K,le),te},fe=U(),F=U(),Ee=n.createFramebuffer();return n.bindFramebuffer(n.FRAMEBUFFER,Ee),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,fe,0),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT1,n.TEXTURE_2D,F,0),n.drawBuffers([n.COLOR_ATTACHMENT0,n.COLOR_ATTACHMENT1]),se={ink:fe,under:F,buffer:Ee,columns:K,rows:le}})(),u=oe.locations,k=M.locations,T=Hn(l),O=!Xe();n.bindFramebuffer(n.FRAMEBUFFER,p.buffer),n.viewport(0,0,p.columns,p.rows),n.useProgram(oe.program),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,q),n.uniform1i(u.uSource,0),n.activeTexture(n.TEXTURE2),n.bindTexture(n.TEXTURE_2D,(me?G?.velocity:Fe[We])??q),n.uniform1i(u.uFluid,2),n.activeTexture(n.TEXTURE3),n.bindTexture(n.TEXTURE_2D,Pe??q),n.uniform1i(u.uTrailMap,3),n.activeTexture(n.TEXTURE6),n.bindTexture(n.TEXTURE_2D,en??q),n.uniform1i(u.uScope,6),n.activeTexture(n.TEXTURE7),n.bindTexture(n.TEXTURE_2D,Ve??q),n.uniform1i(u.uTapMap,7),n.uniform1f(u.uTapOn,Mt&&V&&Ze?1:0),n.uniform1f(u.uScopeMode,Qn&&l.scope!=="all"?l.scope==="subject"?1:2:0),n.uniform1f(u.uFluidMode,me?1:0),n.uniform1i(u.uHoverMode,T==="fluid"?1:T==="lantern"?2:T==="trail"&&Ke?3:T==="loupe"?4:T==="reveal"?5:0),n.uniform1f(u.uTrailAmount,l.trail.strength),n.uniform3f(u.uLight,ie.at?.[0]??-1,ie.at?.[1]??-1,he(T)?ie.strength:0),n.uniform3fv(u.uTrail,Ie),n.uniform1f(u.uLightRadius,l.lantern.radius),n.uniform1f(u.uLightGain,l.lantern.strength),n.uniform1f(u.uClock,performance.now()/1e3),n.uniform1f(u.uFlicker,O?1:0),n.uniform2f(u.uFluidTexel,1/Math.max(1,Ne),1/Math.max(1,Re)),n.uniform2f(u.uResolution,B,Z);let[x,S]=Un();var L;n.uniform2f(u.uCell,x,S),n.uniform1f(u.uCount,Ge),n.uniform1f(u.uBlend,l.blend==="on"||Ge<=9&&(l.blend==="coarse"||l.blend==="auto"&&Ze)?1:0),n.uniform4f(u.uSourceMap,wt.scale[0],wt.scale[1],wt.offset[0],wt.offset[1]),n.uniform1i(u.uScene,V?0:(L=l.scene,Ya[L]??3)),n.uniform1i(u.uMark,mr.indexOf(l.mark)),n.uniform1f(u.uOrder,l.glyphOrder==="text"?1:l.glyphOrder==="scatter"&&l.mark==="glyph"?2:0);let j=l.glyphOrder==="text"&&l.textRepeat==="row"?(function(Y){let J=Dt(Y),K=[];for(let le=0;le<J.length&&K.length<16;){if(!J[le].trim()){le++;continue}let U=le;for(;le<J.length&&J[le].trim();)le++;K.push(U,le-U)}return K})(l.charset):[];ze.fill(0),ze.set(j),n.uniform2fv(u.uWords,ze),n.uniform1f(u.uWordCount,j.length/2),n.uniform1f(u.uScale,l.scale);let R=l.clear;n.uniform4f(u.uClear,R?R.x:0,R?R.y:0,R?R.width:0,R?R.height:0),n.uniform1f(u.uClearFeather,R?R.feather:.1),n.uniform1f(u.uClearShape,R&&R.shape==="rect"?1:0),n.activeTexture(n.TEXTURE8),n.bindTexture(n.TEXTURE_2D,c??q),n.uniform1i(u.uClearMap,8);let W=ce&&!!h&&!!c;n.uniform1f(u.uClearMapOn,W?Math.min(1,Math.max(0,h.strength??.85)):0),n.uniform1f(u.uClearBend,W?.035*Math.min(1,Math.max(0,h.bend??.5)):0),n.uniform2f(u.uClearTexel,1/Math.max(1,E),1/Math.max(1,ve));let re=performance.now();rt.fill(0);for(let Y=0;Y<nt.length;Y++){let J=nt[Y],K=4*Y;rt[K]=J.x,rt[K+1]=J.y,rt[K+2]=(re-J.born)/1e3,rt[K+3]=J.strength}n.uniform4fv(u.uPulse,rt),n.uniform3fv(u.uInk,On),n.uniform3fv(u.uRamp,Zn),n.uniform1f(u.uRampCount,l.color==="source"?0:l.ramp.length),n.uniform3fv(u.uHighlight,Lo),n.uniform1f(u.uHighlightAuto,l.highlight==="auto"?1:0),n.uniform4fv(u.uBackground,_o),n.uniform1f(u.uBrightness,l.brightness),n.uniform1f(u.uContrast,l.contrast),n.uniform1f(u.uGamma,l.gamma),n.uniform1f(u.uInvert,l.invert?1:0),n.uniform1f(u.uVignette,l.vignette),n.uniform1f(u.uSourceColor,l.color==="source"?1:0),n.uniform1f(u.uRefraction,i?i.refraction*(O?1:.25):0),n.uniform1f(u.uGlow,i?i.glow:0),n.uniform1f(u.uTime,jt),n.uniform1f(u.uDrift,O?l.drift:0),n.uniform1f(u.uFluidOn,i&&T==="fluid"&&(Fe.length||me)?1:0),n.uniform1f(u.uLod,l.sample==="point"?0:Math.max(0,Math.log2(Math.max(1,m))-.5)),n.uniform1f(u.uSaturation,l.saturation),n.uniform1f(u.uShade,l.shade),n.uniform1f(u.uBackdrop,V?l.backdrop:0),n.uniform2f(u.uLevels,V&&l.levels==="auto"?dt[0]:0,V&&l.levels==="auto"?dt[1]:1),n.bindVertexArray(ye),n.drawArrays(n.TRIANGLES,0,3),n.bindFramebuffer(n.FRAMEBUFFER,null),n.viewport(0,0,B,Z),n.useProgram(M.program),n.activeTexture(n.TEXTURE1),n.bindTexture(n.TEXTURE_2D,P),n.uniform1i(k.uAtlas,1),n.activeTexture(n.TEXTURE4),n.bindTexture(n.TEXTURE_2D,p.ink),n.uniform1i(k.uCells,4),n.activeTexture(n.TEXTURE5),n.bindTexture(n.TEXTURE_2D,p.under),n.uniform1i(k.uUnder,5),n.uniform2f(k.uResolution,B,Z),n.uniform2f(k.uCell,ge.width,ge.height),n.uniform2f(k.uPitch,x,S),n.uniform1f(k.uColumns,ge.columns),n.uniform1f(k.uDotScale,l.dotScale),n.uniform2f(k.uDir,Math.cos(l.markAngle*Math.PI/180),Math.sin(l.markAngle*Math.PI/180)),n.uniform1i(k.uMark,mr.indexOf(l.mark)),n.uniform4f(k.uLine,l.linePitch,l.lineWeight,l.sparkle,0),n.uniform4f(k.uInlay,l.accents,l.shuffle,Math.floor(7*jt),Dt(l.charset).length),n.uniform1f(k.uSourceColor,l.color==="source"?1:0),n.uniform3fv(k.uRamp,Zn),n.uniform1f(k.uRampCount,l.color==="source"?0:l.ramp.length),n.uniform4f(k.uFade,On[0],On[1],On[2],l.mark==="inlay"||l.glyphOrder!=="tone"&&l.mark==="glyph"?1:0),n.drawArrays(n.TRIANGLES,0,3),v&&d.present(y,B,Z)},No=()=>!st&&!mt&&!fn&&!Xt&&(Tt||Qe)&&!(typeof document<"u"&&document.hidden),er=i=>{if(Ye=!1,!No())return;let m=(i-Vt)/1e3,p=Math.min(1/30,Math.max(1/480,m));Vt=i,Ln=.9*Ln+.1*Math.min(m,.25),Bt=Ln>1/24?Bt+1:0;try{v&&d.overloaded&&pt<2&&Bt>10&&(pt=2),Bt>45&&pt<2&&(!v||d.atMinimum)&&(Bt=0,pt++,pt===1&&ae>1?(l={...l,maxPixelRatio:1},vn()):pt=2);let u=Zt(),k=!(Yt||pt>=2&&!(V instanceof HTMLVideoElement)||(!(V instanceof HTMLVideoElement)||V.paused||V.ended)&&(Xe()||!(!V&&l.scene!=="none"||l.drift>0)));k&&(jt+=p*l.speed),V instanceof HTMLVideoElement&&V.readyState>=2&&hn&&(hn=!("requestVideoFrameCallback"in V),Cr(),un++,we=!0);let T=Hn(l),O=T==="fluid"&&(yt!==null||i<St);if(O?((x,S)=>{let L=l.fluid;if(!L||!Me.length&&!me||(me?!G?.ready():!_||!Jt(_)))return;let j=B/Z,R=yt;if(yt=null,me&&G){let J=5200*L.force*(Xe()?.35:1);return R&&(St=S+1e3*Math.min(9,6/Math.max(.3,L.dissipation))),void G.step(R?{from:R.from,to:R.to,force:[(R.to[0]-R.from[0])*J,(R.to[1]-R.from[1])*J]}:null,{dt:Math.min(x,1/60),radius:1.1*L.radius,curl:L.curl,dissipation:L.dissipation,aspect:j})}let W=0,re=0;if(R){let J=(Xe()?1:3)*L.force;W=(R.to[0]-R.from[0])*j*J*4,re=(R.to[1]-R.from[1])*J*4,St=S+7/Math.min(L.dissipation,1.1*L.dissipation)*1e3}let Y=_.locations;n.bindFramebuffer(n.FRAMEBUFFER,Me[1-We]),n.viewport(0,0,Ne,Re),n.useProgram(_.program),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,Fe[We]),n.uniform1i(Y.uPrevious,0),n.uniform2f(Y.uSize,Ne,Re),n.uniform1f(Y.uAspect,j),n.uniform1f(Y.uDt,x),n.uniform1f(Y.uDecay,L.dissipation),n.uniform1f(Y.uEnergyDecay,1.1*L.dissipation),n.uniform1f(Y.uRadius,L.radius),n.uniform1f(Y.uSplat,R?1:0),n.uniform2f(Y.uFrom,R?.from[0]??0,R?.from[1]??0),n.uniform2f(Y.uTo,R?.to[0]??0,R?.to[1]??0),n.uniform2f(Y.uForce,W,re),n.drawArrays(n.TRIANGLES,0,3),We=1-We})(p,i):yt=null,he(T)&&(O=((x,S)=>{let L=l.lantern,j=ie.target;if(j){let W=ie.at;if(W)if(Xe())W[0]=j[0],W[1]=j[1];else{let J=1-Math.exp(-L.follow*x);W[0]+=(j[0]-W[0])*J,W[1]+=(j[1]-W[1])*J}else ie.at=[j[0],j[1]];let re=ie.at,Y=ie.trail[ie.trail.length-1];L.trail>0&&(!Y||S-Y.born>28&&Math.hypot(re[0]-Y.x,re[1]-Y.y)>.004)&&(ie.trail.push({x:re[0],y:re[1],born:S}),ie.trail.length>12&&ie.trail.shift())}ie.strength+=((j?1:0)-ie.strength)*(1-Math.exp(-x*(j?9:5)));let R=ie.trail;for(let W=R.length-1;W>=0;W--)L.trail>0&&S-R[W].born<4e3*L.trail||R.splice(W,1);Ie.fill(0);for(let W=0;W<R.length;W++){let re=R[W];Ie[3*W]=re.x,Ie[3*W+1]=re.y,Ie[3*W+2]=.55*Math.exp(-(S-re.born)/1e3/Math.max(.01,L.trail))}return ie.strength>.003||R.length>0})(p,i)||O),T==="trail"){let x=!!be?.active;O=(S=>{let L=ct();return!(!L||!L.active||(L.step(S),n.bindTexture(n.TEXTURE_2D,Pe),n.texSubImage2D(n.TEXTURE_2D,0,0,0,L.width,L.height,n.RGBA,n.UNSIGNED_BYTE,L.pixels),Ke=!0,0))})(p)||O,x&&!be?.active&&(we=!0)}if((de?.live||Mt)&&(O=z(p)||O,Mt||(we=!0)),nt.length){for(let x=nt.length-1;x>=0;x--)i-nt[x].born>=2400&&nt.splice(x,1);O=!0,nt.length||(we=!0)}h&&I(),u&&(O||we||k&&i-De>=kt*oi())&&(Go(),De=i,we=!1,!Qe||et&&!V||(Qe=!1,Gt())),(k||O||yt||!u)&&(Ye=!0,fr(er))}catch(u){fn=!0,Ft(u)}};function Ae(){!Ye&&No()&&(Vt=performance.now(),Ye=!0,fr(er))}let Pr=(i,m)=>{let p=e.getBoundingClientRect();if(!p.width||!p.height)return null;let u=(i-p.left)/p.width,k=(m-p.top)/p.height;return u<-.05||u>1.05||k<-.05||k>1.05?null:[u,1-k]},Lr=i=>{let m=Hn(l);if(m==="none"||Yt)return $e=null,void(ie.target=null);if(he(m))return ie.target=i?[i[0],1-i[1]]:null,$e=null,void Ae();if(m==="trail"){let p=ct();return p?(i?p.move(i[0],1-i[1],l.trail.radius,performance.now()):p.leave(),$e=null,void Ae()):void 0}i?($e&&(yt=yt?{from:yt.from,to:i}:{from:$e,to:i}),$e=i,Ae()):$e=null},zo=r.interactionTarget??window,qo={target:zo,move:i=>{i.type==="pointerdown"&&(function(p){if(l.tap==="none"||!V||!Ze||Yt||st||Xe()||p.button!==0||typeof Element<"u"&&p.target instanceof Element&&p.target.closest("button, a, input, select, summary, textarea, label"))return;let u=Pr(p.clientX,p.clientY);!u||u[0]<0||u[0]>1||u[1]<0||u[1]>1||(l.tap==="surface"?mn(u[0],1-u[1],1):(nt=[...nt,{x:u[0],y:1-u[1],born:performance.now(),strength:1}].slice(-4),Ae()))})(i);let m=Pr(i.clientX,i.clientY);zo===window&&(qo.inside=!!m),Lr(m)},leave:()=>{$e=null,be?.leave(),ie.target&&(ie.target=null,Ae())},near:()=>Tt},nn=[ci(qo)],_r=()=>{let i=vn();dn(),h&&(Te=!0,we=!0),(i||we)&&Ae()},Dr=s?Xr(s.element,_r):()=>{};nn.push(Xr(e,_r),()=>Dr()),nn.push((function(i,m,p){if(typeof IntersectionObserver!="function")return()=>{};let u=Wr.get(m);if(!u){let O=new Map;u={observer:new IntersectionObserver(fa(O),{rootMargin:m}),watch:O},Wr.set(m,u)}let{observer:k,watch:T}=u;return da(T,i,p)||k.unobserve(i),k.observe(i),()=>{ma(T,i,p)&&k.unobserve(i),T.size||(k.disconnect(),Wr.delete(m))}})(e,"25% 0px",i=>{Tt=i.isIntersecting,Tt&&(we=!0,Ae())})),nn.push(ui(()=>{document.hidden||(we=!0,Ae())})),nn.push(hi(()=>{we=!0,Ae()})),nn.push(Rn(to,i=>{let m=i.fontfaces??[],p=l.font.split(",").map(Ao);m.some(u=>p.includes(Ao(u.family)))&&Sr()})),ue(),nn.push(()=>{h=null,ue()});let Ir=i=>{i?.preventDefault(),mt=!0,Ye&&dr(er),Ye=!1},Ur=()=>{mt=!1,v&&(n=d.gl),D.length=0,A=null,$=null,oe=M=_=null,se=null,Fe=[],Me=[],G=null,me=!1,Pe=null,be=null,Ke=!1,en=null,Qn=!1,Ve=null,de=null,Mt=!1,c=null,ce=!1,E=ve=0,Te=!0;try{Co(),we=!0,Ae()}catch(i){Ft(i)}},Ho={lost:()=>Ir(),restored:Ur,rescale:()=>{vn()&&Ae()},size:()=>[B,Z],bytes:()=>{let i=b?4:8;return B*Z*4+Cn+(se?se.columns*se.rows*i*2:0)+Ne*Re*i*(me?6:Fe.length)+(be?be.width*be.height*4:0)}};v?d.join(Ho):(e.addEventListener("webglcontextlost",Ir),e.addEventListener("webglcontextrestored",Ur));let Br=()=>{it&&(it.pause(),it.removeAttribute("src"),it.load(),it=null),_e&&V instanceof HTMLVideoElement&&"cancelVideoFrameCallback"in V&&V.cancelVideoFrameCallback(_e),_e=0},Or=()=>{lt?.close(),lt=null},ja=async i=>{let m=await createImageBitmap(i,{premultiplyAlpha:"none"}),p=[m.width,m.height],u=(function(k,T,O,x,S,L,j=8){if(!(O>=16&&x>=16&&k>0&&T>0&&S>0))return 1;let R=j/S/(L==="cover"?Math.min(k/O,T/x):Math.max(k/O,T/x));return R>.5?1:2**-Math.floor(Math.log2(1/R))})(m.width,m.height,B,Z,ge.height,l.fit);if(u===1)return{element:m,owned:!0,natural:p};try{return{element:await createImageBitmap(m,{resizeWidth:Math.max(1,Math.round(m.width*u)),resizeHeight:Math.max(1,Math.round(m.height*u)),resizeQuality:"medium",premultiplyAlpha:"none"}),owned:!0,natural:p}}finally{m.close()}},Gr=i=>new Promise((m,p)=>{let u=new Image;u.crossOrigin="anonymous",u.decoding="async",u.onload=()=>m({element:u,owned:!1}),u.onerror=()=>p(new Error("The glyph field could not load this image.")),u.src=i}),Wo=(i,m,p)=>{let{element:u,owned:k}=i;if(st||p!==et)return void(k&&u instanceof HTMLVideoElement?(u.pause(),u.removeAttribute("src"),u.load()):k&&u.close());u!==V&&(Br(),Or()),it=k&&u instanceof HTMLVideoElement?u:null,!k||u instanceof HTMLVideoElement||(lt=u);let T=u!==V;V=u,Ze=typeof m=="string"||m instanceof HTMLImageElement||m instanceof HTMLVideoElement,tt=u instanceof HTMLVideoElement?u.videoHeight:u instanceof HTMLImageElement?u.naturalHeight:u.height,ht=i.natural?.[0]??(u instanceof HTMLVideoElement?u.videoWidth:u instanceof HTMLImageElement?u.naturalWidth:u.width),ft=i.natural?.[1]??tt,hn=!0,u instanceof HTMLVideoElement&&T&&(O=>{let x=O;if(!x.requestVideoFrameCallback)return;let S=()=>{st||V!==O||(hn=!0,Ae(),_e=x.requestVideoFrameCallback(S))};_e=x.requestVideoFrameCallback(S)})(u),mt||Cr(),we=!0,Ae()},Xo=(i,m)=>{Qe&&i===et&&(Qe=!1,Gt()),Ft(m)},Nr=i=>{let m=++et;if(!i)return Br(),Or(),V=null,ht=ft=tt=Cn=0,Ze=!1,we=!0,Ae(),Promise.resolve();if((p=>!(typeof p=="string"||p instanceof HTMLImageElement&&!p.complete||p instanceof HTMLVideoElement&&p.readyState<2))(i)){try{Wo({element:i,owned:!1},i,m)}catch(p){Xo(m,p)}return Promise.resolve()}return(async p=>{if(typeof p!="string")return p instanceof HTMLImageElement&&!p.complete?p.decode().then(()=>({element:p,owned:!1})):p instanceof HTMLVideoElement&&p.readyState<2?new Promise((T,O)=>{p.addEventListener("loadeddata",()=>T({element:p,owned:!1}),{once:!0}),p.addEventListener("error",()=>O(new Error("The glyph field could not load this video.")),{once:!0})}):{element:p,owned:!1};if(Fi.test(p))return new Promise((T,O)=>{let x=document.createElement("video");x.crossOrigin="anonymous",x.muted=!0,x.loop=!0,x.playsInline=!0,x.preload="auto",x.addEventListener("loadeddata",()=>{x.play().catch(()=>{}),T({element:x,owned:!0})},{once:!0}),x.addEventListener("error",()=>O(new Error("The glyph field could not load this video.")),{once:!0}),x.src=p});if(typeof createImageBitmap!="function"||typeof fetch!="function")return Gr(p);let u;try{u=await(await fetch(p).then(T=>{if(!T.ok)throw new Error("The glyph field could not load this image.");return T})).blob()}catch(T){if(T instanceof Error&&T.message.startsWith("The glyph field"))throw T;return Gr(p)}if(!/svg/i.test(u.type))try{return await ja(u)}catch{}let k=URL.createObjectURL(u);try{return await Gr(k)}finally{URL.revokeObjectURL(k)}})(i).then(p=>Wo(p,i,m),p=>Xo(m,p))};Co(),dn();let Vo=r.source??null;return Vo?(et=1,Nr(Vo)):Ae(),{canvas:e,ready:Nt,get settings(){return l},update(i){let m=l,{element:p,rest:u}=o(i);if("clear"in i&&s?.element!==p?.element?(Dr(),s=p,Dr=p?Xr(p.element,_r):()=>{}):"clear"in i&&(s=p),"clear"in i){let k=a(i.clear)?i.clear:null;k!==h&&(h=k,Te=!0,we=!0,ue(),Ae())}l=Kr(p?{...u,clear:l.clear}:u,l),dn(),i.label&&e.setAttribute("aria-label",i.label),l.maxPixelRatio!==m.maxPixelRatio&&vn(),l.charset===m.charset&&l.cellSize===m.cellSize&&l.cellAspect===m.cellAspect&&l.font===m.font&&l.fontWeight===m.fontWeight&&l.glyphScale===m.glyphScale||(Rr(),Sr()),l.levels!==m.levels&&So(),l.scope===m.scope||mt||(Fo(),Fr=performance.now()),((!!m.fluid&&Hn(m)==="fluid")!==Bn()||l.fluid&&m.fluid&&l.fluid.resolution!==m.fluid.resolution)&&bo(),"source"in i&&Nr(i.source??null),we=!0,Ae()},setSource:Nr,pointer(i,m=0){if(i===null)return void Lr(null);let p=e.getBoundingClientRect();Lr(Pr(p.left+i,p.top+m))},redraw(){if(!(st||mt||fn)&&B)try{Zt(!(Qe&&(v?d.canCompileInParallel:X)))&&(Go(),Qe||(we=!1))}catch(i){fn=!0,Ft(i)}},pulse(i={}){if(st||Xe())return;let m=e.getBoundingClientRect();if(!m.width||!m.height)return;let p=i.x??m.width/2,u=i.y??m.height/2;if(i.element){let T=i.element.getBoundingClientRect();p=T.left+T.width/2-m.left,u=T.top+T.height/2-m.top}let k=Math.max(0,Math.min(2,i.strength??1));l.tap==="surface"&&V&&Ze?mn(p/m.width,u/m.height,k):(nt=[...nt,{x:p/m.width,y:u/m.height,born:performance.now(),strength:k}].slice(-4),Ae())},play(){Yt=!1,V instanceof HTMLVideoElement&&V.play().catch(()=>{}),we=!0,Ae()},pause(){Yt=!0,V instanceof HTMLVideoElement&&V.pause()},resize(){vn()&&Ae()},destroy(){if(!st){if(st=!0,Ye&&dr(er),Ye=!1,nn.forEach(i=>i()),v?d.leave(Ho):(e.removeEventListener("webglcontextlost",Ir),e.removeEventListener("webglcontextrestored",Ur)),Br(),Or(),V=null,!mt)if(pn(),In(),n.deleteTexture(q),Pe&&n.deleteTexture(Pe),en&&n.deleteTexture(en),c&&n.deleteTexture(c),v)d.releaseAtlas($,Tr),G?.release();else{n.deleteTexture(P);for(let i of[oe,M,_])i&&n.deleteProgram(i.program);G?.dispose(),D.forEach(i=>n.deleteShader(i)),ye&&n.deleteVertexArray(ye)}$=null}}}}var lo={standard:{label:"Classic ASCII",chars:" .:-=+*#%@"},asciify:{label:"Asciify",chars:" .:-=+YCIFSA#@"},minimal:{label:"Minimal",chars:" .:+"},detailed:{label:"Detailed",chars:" .,:;-~=+*xX#%@"},letters:{label:"Letters",chars:" .liLTYCFSAWM"},technical:{label:"Technical",chars:" ._:;+/>=][{}*$#@"},blocks:{label:"Tonal blocks",chars:" \u2591\u2592\u2593\u2588"},braille:{label:"Braille",chars:" \u2801\u2803\u2807\u2847\u28C7\u28E7\u28F7\u28FF"},fish:{label:"Fish",chars:" .'-,:;txoSX%#8@"},kanji:{label:"Kanji (Japanese)",chars:" \u4E00\u4E8C\u4EBA\u5C0F\u5927\u4E2D\u65E5\u672C\u76EE\u7530\u9577\u9593\u8A9E\u66F8\u66DC\u9A5A\u9727"}};function uo(e){if(e)return Object.prototype.hasOwnProperty.call(lo,e)?lo[e].chars:e.startsWith(" ")?e:" "+e}var Pi={ascii:{mark:"glyph",charset:" .:-=+*#%@"},blocks:{mark:"glyph",charset:" \u2591\u2592\u2593\u2588"},braille:{mark:"glyph",charset:" \u2801\u2803\u2807\u2847\u28C7\u28E7\u28F7\u28FF"},dots:{mark:"dot"},lines:{mark:"glyph",charset:" -\u2550\u256A\u256C"},cross:{mark:"glyph",charset:" \xB7+xX#"},diagonal:{mark:"glyph",charset:" /\u2571\u2573"},diamond:{mark:"glyph",charset:" \xB7\u25C7\u25C8\u25C6"},mixed:{mark:"glyph",charset:" .:+/\u25C7#@"},pixel:{mark:"pixel"},mosaic:{mark:"mosaic"},lego:{mark:"lego"},voxel:{mark:"voxel"},disco:{mark:"disco"},dither:{mark:"dither"},hex:{mark:"hex"},led:{mark:"led"},cmyk:{mark:"cmyk"},stipple:{mark:"stipple"},engraving:{mark:"engraving"},crosshatch:{mark:"crosshatch"},woodblock:{mark:"woodblock"},risograph:{mark:"risograph"},pointillism:{mark:"pointillism"}};var Li=/\p{L}/u,_i=new Set(Object.values(lo).map(e=>e.chars));var Di=new Set(["glyph","inlay"]),Vn=e=>Di.has(e??"glyph"),Ii=e=>({cellSize:Math.max(7,e.cellSize??8),cellAspect:.62,glyphScale:.9}),La=new WeakSet,_a=e=>{La.add(e)},ho=e=>e&&!La.has(e)?e.current.charset:void 0;function fo(e,r){let t=uo(r);if(!t)return e;if(Vn(e.mark))return{...e,charset:t,...co(t,e)};let o={...e,...Ii(e)};return{...o,mark:"glyph",charset:t,...co(t,o)}}var pr=null;var Ra=new Set;var Aa=12,je=new Set,It=null,Yn=null,vr=0,jn=-1e9,xr=0,yr=0,oo=!1,ao=!1,Ui=()=>{let e=Yn?.timeline?.currentTime;return typeof e=="number"?e:null};var io=()=>typeof performance<"u"?performance.now():Date.now(),mo=()=>typeof innerHeight=="number"?innerHeight:0;function wr(e,r=e.getBoundingClientRect()){if(e.isConnected===!1||typeof e.getClientRects=="function"&&e.getClientRects().length===0)return 1/0;let t=r.bottom<0?-r.bottom:r.top-mo();return t>0?t:0}function Bi(){try{let e=Yn?.querySelectorAll?.("dialog:modal");return e?.length?e[e.length-1]:null}catch{return null}}var Oi=1e8;function Da(e,r){if(e.eager)return void(e.wanted=!0);let t=mo(),o=wr(e.host,r);!t||o<=2*t?e.wanted=!0:o>3*t&&(e.wanted=!1)}function Gi(e){let r=!1;for(let t of e)if(t?.target)for(let o of je)o.host===t.target&&(Da(o,t.boundingClientRect??void 0),r=!0);r&&Fn()}var Sa=()=>Fn(),br=0,Mr=0,Fa=()=>{let e=typeof scrollY=="number"?scrollY:0;e!==Mr&&(br=e>Mr?1:-1),Mr=e};function Ni(e,r){return!r||!br||e.getBoundingClientRect().top>0==br>0?r:2*r}var gr=null,Ia=e=>{gr!==e&&(gr?.removeEventListener?.("close",Sa,!0),gr?.removeEventListener?.("scroll",Fa,!0),e?.addEventListener?.("close",Sa,!0),e?.addEventListener?.("scroll",Fa,{capture:!0,passive:!0}),gr=e)},so=new WeakSet,An=0;function po(){An||typeof requestIdleCallback!="function"||(An=requestIdleCallback(zi,{timeout:2e3}))}function zi(e){An=0;let r=[...je].filter(t=>!t.live&&t.prewarm&&!so.has(t)).sort((t,o)=>wr(t.host)-wr(o.host));for(let t of r){if(e.timeRemaining()<2&&!e.didTimeout)return void po();so.add(t);try{t.prewarm()}catch{}}}function qi(e){Yn!==e.doc&&(Yn=e.doc,je.clear(),vr=xr=yr=br=0,jn=-1e9,Mr=typeof scrollY=="number"?scrollY:0),Ia(Yn),je.add(e);let r=(function(){let t=typeof IntersectionObserver=="function"?IntersectionObserver:null;if(!t)return null;if(It?.ctor!==t){It?.list.forEach(o=>o.disconnect()),It={ctor:t,list:["200% 0px","300% 0px","0px"].map(o=>new t(Gi,{rootMargin:o}))};for(let o of je)It.list.forEach(a=>a.observe(o.host))}return It.list})();r?.forEach(t=>t.observe(e.host)),r?Da(e):e.wanted=!0,Fn(),e.live||po()}function Fn(e=!1){if(oo)ao=!0;else{oo=!0;try{do{ao=!1;let r=io(),t=Ui();(e||(t===null?r-jn>16||r<jn:t!==jn))&&(jn=t??r,xr=yr=0);for(let n of je)n.host.isConnected===!1&&(n.wanted=!1);for(let n of je)n.live&&!n.wanted&&n.release();let o=[...je].filter(n=>n.live&&!n.shared),a=Bi(),s=n=>!!a&&!a.contains(n.host),h=n=>wr(n.host)+(s(n)?Oi:0),l=n=>n.eager&&!s(n),f=()=>o.filter(n=>n.live&&!n.shared).map(n=>[n,h(n)+(l(n)?0:1e9)]).sort((n,b)=>b[1]-n[1]);for(let n=o.length-Aa,b=n>0?f():[];n>0;n--)b.shift()?.[0].release();let g=pa(),d=1*mo(),y=()=>[...je].filter(n=>n.live&&n.shared&&h(n)>d).sort((n,b)=>h(b)-h(n));if(g?.overBudget)for(let n of y()){if(!g.overBudget)break;n.release()}let v=[...je].filter(n=>n.wanted&&!n.live).map(n=>[n,n.eager?-1:h(n)]).map(([n,b])=>[n,b,b>0?Ni(n.host,b):b]).sort((n,b)=>n[2]-b[2]),w=0;for(let[n,b]of v){if(!je.has(n)||n.live)continue;if(g&&!g.roomy){let P=y()[0];if(!P||h(P)<=h(n)||(P.release(),!g.roomy))break}if(!n.eager&&(xr>=4||yr>=2)&&(!e||w)){vr||(vr=requestAnimationFrame(()=>{vr=0,Fn(!0)}));break}if(o.filter(P=>P.live&&!P.shared).length>=Aa){let P=f()[0]?.[0];if(!P||(l(P)?!n.eager||h(P)<=h(n):!n.eager&&h(P)<=b))break;P.release()}let X=io();n.mount(),xr+=io()-X,w++,n.eager||yr++,n.live&&!n.shared&&o.push(n)}}while(ao)}finally{oo=!1}}}var Ua='ui-monospace, "SF Mono", Menlo, Consolas, monospace',Ca=new Map,Hi=".:-=+*#%@";function Wi(e,r=Ua){let t=`${r}\0${e}`,o=Ca.get(t);if(o)return o;let a={max:1,mean:1};try{let s=typeof document>"u"?null:Object.assign(document.createElement("canvas"),{width:48,height:48}).getContext("2d",{willReadFrequently:!0});if(s&&typeof s.getImageData=="function"){s.font=`500 36px ${r}`,s.textAlign="center",s.textBaseline="middle";let h=v=>{s.clearRect(0,0,48,48),s.fillStyle="#000",s.fillText(v,24,25);let w=s.getImageData(0,0,48,48).data,n=0;for(let b=3;b<w.length;b+=4)n+=w[b];return n/255},l=v=>[...v].filter(w=>w.trim()).map(h),f=v=>v.reduce((w,n)=>w+n,0)/Math.max(1,v.length),g=l(e),d=l(Hi),y=h("@");g.length&&y>0&&f(d)>0&&(a={max:Math.max(...g)/y,mean:f(g)/f(d)})}}catch{}return Ca.set(t,a),a}function co(e,r){let{max:t,mean:o}=Wi(e,r.font??Ua),a=r.glyphScale??.8,s=r.gamma??1,h=r.fontWeight??500;return t>1.15?{glyphScale:Math.max(.3,a*Math.max(.62,t**-.36)),gamma:s,fontWeight:h}:o>1.5?{glyphScale:Math.max(.3,a*o**-.25),gamma:s,fontWeight:h}:t<.85?{glyphScale:Math.min(1.6,a*Math.min(1.3,t**-.3)),gamma:s,fontWeight:t<.6?Math.max(h,700):h}:{glyphScale:a,gamma:s,fontWeight:h}}var Sn=new WeakMap;function go(e,r){for(let t of Sn.get(e)?.keys()??[])t.getAttribute("src")!==r&&(t.src=r)}function vo(e){let r=Sn.get(e);Sn.delete(e),r?.forEach(t=>t())}function xo(e,r,t,o,a){let s=document.createElement("img");s.alt="",s.decoding="async",s.setAttribute("aria-hidden","true"),s.setAttribute("style",`${t};object-fit:cover`),s.style.opacity="1",s.dataset.asciiPoster="",s.src=r;let h=e.style.getPropertyValue("position"),l=typeof getComputedStyle=="function"&&getComputedStyle(e).position==="static";l&&e.style.setProperty("position","relative");let f=e.style.getPropertyValue("isolation"),g=/z-index:\s*-1/.test(t)&&typeof getComputedStyle=="function"&&getComputedStyle(e).isolation==="auto";g&&e.style.setProperty("isolation","isolate"),a?.parentElement===e?e.insertBefore(s,a):e.appendChild(s);let d=!1,y=()=>{d||(d=!0,s.remove(),Sn.get(o)?.delete(s),l&&(h?e.style.setProperty("position",h):e.style.removeProperty("position")),g&&(f?e.style.setProperty("isolation",f):e.style.removeProperty("isolation")))},v=Sn.get(o)??new Map;return v.set(s,y),Sn.set(o,v),{show(w){s.style.opacity=w?"1":"0"},remove:y}}function Pa(e){let r=document.createElement("canvas");for(let t of e.getAttributeNames?.()??[])t!=="width"&&t!=="height"&&r.setAttribute(t,e.getAttribute(t));return r.style.cssText=e.style.cssText,Object.assign(r.dataset,e.dataset),e.replaceWith?e.replaceWith(r):e.parentElement&&(e.parentElement.insertBefore(r,e),e.remove()),r}function Ba(e){let{host:r,kit:t}=e,o,a=e.canvas,s=null,h=!1,l=!1,f=!1,g=!1,d={},y={},v=e.source,w=!1,n={},b=null,X=null,P=!1,q=null,oe=()=>{},M=!e.ownPoster&&t?.current.poster?xo(r,t.current.poster,e.place,t,a):null,_=()=>{if(!pr||t?.current.globalLook===!1||t?.current.charset||!Vn(y.mark)&&!e.glyphs||y.glyphOrder!=="scatter"&&!_i.has(y.charset??"")&&Li.test(y.charset??""))return;let A=pr.style?Pi[pr.style]:void 0,D=A?.mark??(Vn(y.mark)?y.mark??"glyph":"glyph"),B=Vn(D)?pr.charset||(A&&"charset"in A?A.charset:void 0):void 0;return A||B?{mark:D,charset:B}:void 0},$=()=>({...e.glyphs?Object.fromEntries(Object.keys(e.glyphs()).map(A=>[A,y[A]]).filter(([,A])=>A!==void 0)):{},mark:y.mark??"glyph",charset:y.charset??" .,:-=+*#%@",glyphScale:y.glyphScale??.8,gamma:y.gamma??1,fontWeight:y.fontWeight??500}),se=A=>{if(!A.charset)return{...$(),mark:A.mark};let D=e.glyphs&&!Vn(y.mark)?e.glyphs():{};return{...D,mark:A.mark,charset:A.charset,...co(A.charset,{...y,...D})}},Fe=()=>{let A=_(),D=A&&`${A.mark}\0${A.charset??""}`;return D===o?null:(o=D,A?se(A):$())},Me={host:r,doc:document,eager:t?.current.lazy===!1,wanted:!1,live:!1,poster:!!M||!!e.ownPoster,mount(){if(l||s)return;h&&(a=e.canvas=Pa(a)),h=!0,y={...e.options(),...d},o=void 0;let A=Fe(),D;try{D=Ta(a,{...y,...A,...v===void 0?{}:{source:v},onError:()=>{s===D&&G()}})}catch{return void G()}s=D,Me.live=!0,Me.shared=va(a);let B=a;if(Me.shared)oe=()=>{};else{let Z=0,ae=()=>{s===D&&(M?.show(!0),clearTimeout(Z),Z=setTimeout(()=>{s===D&&a===B&&(Me.release(),Fn())},1e3))},Be=()=>{clearTimeout(Z),requestAnimationFrame(()=>requestAnimationFrame(()=>{s===D&&M?.show(!1)}))};B.addEventListener?.("webglcontextlost",ae),B.addEventListener?.("webglcontextrestored",Be),oe=()=>{clearTimeout(Z),B.removeEventListener?.("webglcontextlost",ae),B.removeEventListener?.("webglcontextrestored",Be)}}w&&D.pause(),D.ready.then(()=>{s===D&&(P=!0,M?.show(!1),b?.(),b=X=null)},()=>{}),e.onMount?.(D,a)},release(){if(!s)return;let A=s;s=null,Me.live=!1,P=!1,oe(),q?.clear(),q=null,n=A.settings,A.destroy(),Me.shared?l||(a.width=a.width,h=!1):((D=>{try{let B=D.getContext("webgl2");B&&!B.isContextLost?.()&&B.getExtension("WEBGL_lose_context")?.loseContext()}catch{}})(a),l||(a=e.canvas=Pa(a),h=!1)),M?.show(!0),e.onRelease?.()},prewarm(){if(l||s)return;y={...e.options(),...d};let A=_();Ea(a,{...y,...A?se(A):{}})}};function G(){f||(f=!0,me(),g||e.onFail())}function me(){l||(l=!0,Me.release(),(function(A){je.delete(A)&&([...je].some(D=>D.host===A.host)||It?.list.forEach(D=>D.unobserve(A.host)),!je.size&&It&&(It.list.forEach(D=>D.disconnect()),It=null),je.size||(Ia(null),An&&typeof cancelIdleCallback=="function"&&cancelIdleCallback(An),An=0),Fn())})(Me),Ra.delete(ye),a.remove(),f?M?.show(!0):M?.remove())}let ye={relook(){s||(ae=>{so.delete(ae),je.has(ae)&&po()})(Me);let A=Fe();if(!A||!s)return;let D=s,B=P&&!(t?.current.reducedMotion??(typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches));q?.clear(),q=null,B&&(D.redraw(),q=(function(ae,Be){if(!ae.width||!ae.height||typeof document>"u")return null;let ge=document.createElement("canvas");ge.width=ae.width,ge.height=ae.height;let Ge=ge.getContext("2d");if(!Ge||typeof ge.animate!="function")return null;try{Ge.drawImage(ae,0,0)}catch{return null}ge.setAttribute("aria-hidden","true"),ge.dataset.asciiSweep="",ge.setAttribute("style",Be);let Ne=document.createElement("span"),Re,We;Ne.setAttribute("aria-hidden","true"),Ne.dataset.asciiSweep="",Ne.setAttribute("style",`${Be};right:auto;width:2px;margin-left:-1px;opacity:0;background:var(--ascii-sweep, #f3ba32);box-shadow:0 0 10px 1px color-mix(in srgb, var(--ascii-sweep, #f3ba32) 40%, transparent)`),ae.after(ge,Ne);let V=()=>{Re?.cancel(),We?.cancel(),ge.remove(),Ne.remove()};return{clear:V,reveal(){if(!ge.isConnected)return;let Ze={duration:200,delay:40,easing:"cubic-bezier(.23,1,.32,1)",fill:"both"};Re=ge.animate([{clipPath:"inset(0% 0% 0% 0%)"},{clipPath:"inset(0% 0% 0% 100%)"}],Ze);let it=ae.clientWidth||ae.getBoundingClientRect().width;We=Ne.animate([{transform:"translateX(0px)",opacity:.35},{opacity:.35,offset:.7},{transform:`translateX(${it}px)`,opacity:0}],Ze),Re.onfinish=V}}})(a,e.place)),D.update(A);let Z=q;Z&&requestAnimationFrame(()=>requestAnimationFrame(()=>{q===Z&&s===D?Z.reveal():Z.clear()}))}};return{field:{get canvas(){return a},get ready(){return s?s.ready:X??(X=new Promise(A=>{b=A}))},get settings(){return s?.settings??n},update(A){if(d={...d,...A},y={...y,...A},!s)return;let D=Fe(),B=_();s.update(B?{...A,...se(B)}:D?{...A,...D}:A)},setSource:A=>(v=A,s?s.setSource(A):Promise.resolve()),pointer(A,D){s?.pointer(A,D)},redraw(){s?.redraw()},pulse(A){s?.pulse(A)},play(){w=!1,s?.play()},pause(){w=!0,s?.pause()},resize(){s?.resize()},destroy(){me()}},get canvas(){return a},get live(){return!!s},get failed(){return f},start(){Ra.add(ye),g=!0;try{qi(Me)}finally{g=!1}},destroy:me}}var Xi=(e,r=0,t=1)=>Math.min(t,Math.max(r,e));var Ut,Er=()=>typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;var yo={scene:"none",background:"transparent",color:"ink",levels:"none",fit:"cover",focus:{x:.5,y:.5},vignette:0,drift:0,hover:"none",shade:0,contrast:1,brightness:0,gamma:1,maxPixelRatio:2,clear:!1};function $n(e,r,t){let o=(e??"").trim(),a=/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(o);if(a?o=Oa(r,a[1])||(a[2]??"").trim():o.startsWith("--")&&(o=Oa(r,o)),!o)return t?$n(t,r):null;if(/^#[\da-f]{6}$/i.test(o))return o.toLowerCase();if(/^#[\da-f]{3}$/i.test(o))return`#${[...o.slice(1)].map(g=>g+g).join("")}`.toLowerCase();let s=/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(o);if(s)return Ga([+s[1],+s[2],+s[3]]);if(Ut===void 0)try{Ut=typeof document>"u"?null:Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{willReadFrequently:!0})}catch{Ut=null}if(!Ut)return t?$n(t,r):null;Ut.clearRect(0,0,1,1),Ut.fillStyle="#000",Ut.fillStyle=o,Ut.fillRect(0,0,1,1);let[h,l,f]=Ut.getImageData(0,0,1,1).data;return Ga([h,l,f])}var Oa=(e,r)=>typeof getComputedStyle=="function"?getComputedStyle(e).getPropertyValue(r).trim():"",Ga=e=>`#${e.map(r=>Math.round(Xi(r,0,255)).toString(16).padStart(2,"0")).join("")}`,Vi=e=>{let r=parseInt(e.slice(1,7),16);return[r>>16&255,r>>8&255,255&r]};function Mo(e){let r=typeof getComputedStyle=="function"?getComputedStyle(e):null,t=/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/i.exec(r?.backgroundColor??"");if(t&&(t[4]===void 0?1:t[4].endsWith("%")?parseFloat(t[4])/100:parseFloat(t[4]))>=.5)return .2126*+t[1]+.7152*+t[2]+.0722*+t[3]<128;let o=$n(r?.color??"",e);if(!o)return typeof matchMedia=="function"&&matchMedia("(prefers-color-scheme: dark)").matches;let[a,s,h]=Vi(o);return .2126*a+.7152*s+.0722*h>140}function Na(){let e=[];return{set(r,t,o){e.some(([a,s])=>a===r&&s===t)||e.push([r,t,r.style.getPropertyValue(t)]),r.style.setProperty(t,o)},restore(){for(let[r,t,o]of e.reverse())o?r.style.setProperty(t,o):r.style.removeProperty(t);e.length=0}}}function wo(e,r){let t={...e,...r},o=e.look,a=r.look;return a&&(t.look=Object.fromEntries(Object.entries({...o,...a}).filter(([,s])=>s!==void 0))),t}var cn=(e,r,t,o)=>typeof e=="number"&&Number.isFinite(e)?Math.min(o,Math.max(t,e)):r;function za(e){return e==="dots"?" \xB7\u2219\u2022\u25CF":uo(e)}function qa(e,r){if(!r||!r.preset||typeof r.preset.mount!="function")throw new TypeError("background() needs a preset, such as `aurora` imported from asciify-engine/kit.");let t=r.preset,o=r.poster,a=M=>({...M,poster:M.preset===t?o:void 0}),s={current:a({...r})};_a(s);let h=null,l=!1,f=!1,g=new Set,d=()=>{let M=s.current,_=M.preset;return{speed:cn(M.speed,_.speed,0,5),cellSize:cn(M.cellSize,_.cellSize,3,96),charset:za(M.charset),cursor:M.look?.hover!=="none"&&(M.cursor??_.cursor),tap:M.tap==="ring"||M.tap==="surface"?M.tap:void 0,mark:M.mark==="glyph"||M.mark==="dot"?M.mark:void 0,clear:M.clear??!1,clearMap:{padding:cn(M.clearPadding,8,0,400),softness:cn(M.clearSoftness,28,0,600),strength:cn(M.clearStrength,.85,0,1)},dither:cn(M.dither,0,0,1),accent:M.accent,text:M.text?.trim()||"ASCIIFY",look:M.look}},y=M=>{let _=s.current,$=_.palette;return(typeof $=="string"?$:$?.[M?"dark":"light"])??_.color??_.ink},v=()=>String(cn(s.current.opacity,s.current.preset.opacity??1,0,1)),w=()=>!!(s.current.reducedMotion??Er()),n=M=>{let _=null;if(_=s.current.preset.mount({host:e,kit:s,settings:d,ink:y,reducedMotion:()=>s.current.reducedMotion,onFail:()=>{h===_&&(h=null)}}),!_)return null;let $=_.canvas.style;return M&&($.opacity="0",$.transition="opacity 320ms cubic-bezier(.16, 1, .3, 1)",_.canvas.offsetWidth),$.opacity=v(),l&&_.pause(),_},b={position:e.style.getPropertyValue("position"),isolation:e.style.getPropertyValue("isolation")},X=(M,_)=>{_?e.style.setProperty(M,_):e.style.removeProperty(M)},P=!1,q=M=>{P=!0,M.destroy(),h&&!f&&(typeof getComputedStyle=="function"&&getComputedStyle(e).position==="static"&&e.style.setProperty("position","relative"),e.style.setProperty("isolation","isolate"))},oe=M=>{if(f||!M||typeof M.mount!="function"||M===s.current.preset)return;s.current=a({...s.current,preset:M});let _=h;h=n(!!_&&!w()),_&&($=>{if(w())return void q($);$.canvas.style.transition="opacity 320ms cubic-bezier(.16, 1, .3, 1)",$.canvas.style.opacity="0";let se={run:$,timer:setTimeout(()=>{g.delete(se),q($)},340)};g.add(se)})(_)};return h=n(!1),{get supported(){return!!h&&!f},get field(){return f?null:h?.field??null},get preset(){return s.current.preset},update(M){if(f||!M)return;let{preset:_,...$}=M;"poster"in $&&(o=$.poster),s.current=a(wo(s.current,$)),$.poster&&s.current.poster&&go(s,$.poster),_&&_!==s.current.preset?oe(_):h&&(h.canvas.style.opacity=v(),h.refresh())},play(){!f&&l&&(l=!1,h?.play())},pause(){f||(l=!0,h?.pause())},setPreset:oe,destroy(){if(!f){f=!0;for(let M of g)clearTimeout(M.timer),M.run.destroy(),P=!0;g.clear(),h?.destroy(),h=null,P&&(X("position",b.position),X("isolation",b.isolation)),vo(s)}}}}function Ha(e){let{host:r,layer:t="under",kit:o}=e;if(typeof document>"u")return null;let a=`position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit;z-index:${t==="under"?-1:"auto"}`;if(!ka())return o?.current.poster&&!e.ownPoster&&xo(r,o.current.poster,a,o),null;let s=Na(),h=document.createElement("canvas");getComputedStyle(r).position==="static"&&s.set(r,"position","relative"),t==="under"&&s.set(r,"isolation","isolate"),h.dataset.asciiKit="",h.setAttribute("style",a),r.appendChild(h);let l=Mo(r),f=!1,g=()=>{let q=e.reducedMotion();return q===!0?{speed:0,drift:0,respectReducedMotion:!0}:{respectReducedMotion:q!==!1}},d=()=>$n(e.ink(l),r,l?"#d8d6cf":"#1d1d1b")??"#888888",y=Ba({host:r,canvas:h,kit:o,place:a,ownPoster:e.ownPoster,glyphs:e.glyphs,source:e.source??null,options:()=>({...fo({...yo,...e.look(l)},ho(o)),...g(),ink:d(),interactionTarget:r,label:e.label??""}),onMount:(q,oe)=>{e.label||(oe.removeAttribute("role"),oe.removeAttribute("aria-label"),oe.setAttribute("aria-hidden","true")),e.onMount?.()},onRelease:e.onRelease,onFail:()=>{P(),e.onFail?.()}}),v=y.field,w=!1,n=()=>{f||(l=Mo(r),v.update({...fo({...yo,...e.look(l)},ho(o)),...g(),ink:d()}))},b=()=>{w=!1,n()},X=ha(()=>{w||f||(w=!0,fr(b))});function P(){f||(f=!0,w&&dr(b),X(),y.destroy(),s.restore())}return y.start(),y.failed?(P(),null):{field:v,get canvas(){return y.canvas},get live(){return y.live},dark:()=>l,still:()=>!!(e.reducedMotion()??Er()),refresh:n,destroy:P}}var Wa=(e,r)=>e.cursor===!1?"none":typeof e.cursor=="string"?e.cursor:r;function Xa(e,r,t,o){let a=null;if(a=Ha({host:e.host,kit:e.kit,layer:"under",glyphs:o&&(()=>o(e.settings())),look:h=>{let l=e.settings();return{...r(l,h),...l.look}},ink:h=>e.ink(h)??(h?t.dark:t.light),reducedMotion:e.reducedMotion,onFail:()=>{a=null,e.onFail()}}),!a)return null;let s=a.canvas;return{get field(){return a?.field??null},get canvas(){return a?.canvas??s},refresh(){a?.refresh()},play(){a?.field.play()},pause(){a?.field.pause()},destroy(){a?.destroy(),a=null}}}var kr=()=>typeof innerWidth=="number"&&innerWidth<760;var Va={id:"field",name:"Field",description:"A word becomes the background, drawn by the GPU with a soft wake.",cellSize:13,speed:1,cursor:!0,mount:e=>Xa(e,(r,t)=>({scene:"flow",levels:"auto",charset:r.charset??" .,:-+"+r.text.replace(/\s+/g,"").toUpperCase(),font:'"Geist", Arial, sans-serif',fontWeight:500,cellSize:r.cellSize,cellAspect:.8,glyphScale:.76,color:"ink",shade:t?kr()?.1:.4:0,background:"transparent",contrast:1.1,scale:kr()?1.6:1,brightness:kr()&&t?.08:0,vignette:0,speed:r.speed,maxPixelRatio:2,hover:Wa(r,"trail"),fluid:{radius:.09,refraction:.04,glow:.7,dissipation:1.3},lantern:{radius:.13,strength:.6,trail:.5,follow:11},trail:{strength:.9,radius:.4}}),{light:"#9a9891",dark:"#7d7b75"})};export{qa as background,Va as wordField};
