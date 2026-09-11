import React, { useEffect, useRef } from "react";

export function InteractiveShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId;
    let resizeObserver;

    const gl =
      canvas.getContext("webgl", { alpha: false, antialias: true }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) return;

    function syncSize() {
      const w = window.innerWidth || canvas.clientWidth || 1280;
      const h = window.innerHeight || canvas.clientHeight || 720;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayW = Math.floor(w * dpr);
      const displayH = Math.floor(h * dpr);

      if (canvas.width !== displayW || canvas.height !== displayH) {
        canvas.width = displayW;
        canvas.height = displayH;
      }
    }

    syncSize();
    window.addEventListener("resize", syncSize);

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      // Hash helper for procedural bubble distribution
      float hash12(vec2 p) {
          vec3 p3  = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.xx + p3.yz) * p3.zy);
      }

      // Render a single translucent ocean foam bubble
      vec3 drawBubble(vec2 uv, vec2 center, float radius, vec3 bubbleColor, float alpha) {
          vec2 offset = uv - center;
          float d = length(offset);
          if (d > radius * 1.5) return vec3(0.0);

          // 1. Thin luminous glass membrane edge
          float rim = smoothstep(radius * 1.05, radius * 0.96, d) * (1.0 - smoothstep(radius * 0.96, radius * 0.75, d));
          
          // 2. Soft interior caustic refraction
          float inside = smoothstep(radius, 0.0, d) * 0.18;
          
          // 3. Specular highlight on top-left of bubble
          vec2 specPos = center + vec2(-radius * 0.36, radius * 0.36);
          float spec = exp(-length(uv - specPos) * (6.5 / max(radius, 0.01))) * 0.85;

          // 4. Subtle secondary bounce light on bottom-right
          vec2 bouncePos = center + vec2(radius * 0.32, -radius * 0.32);
          float bounce = exp(-length(uv - bouncePos) * (8.0 / max(radius, 0.01))) * 0.35;

          vec3 col = bubbleColor * (rim * 1.3 + inside);
          col += vec3(0.85, 1.0, 0.98) * (spec + bounce * 0.5);
          return col * alpha;
      }

      void main() {
          vec2 st = gl_FragCoord.xy / u_resolution.xy;
          vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
          vec2 uv = (gl_FragCoord.xy / u_resolution.y);
          float t = u_time * 0.4;

          // Mouse position with gentle fluid interaction
          vec2 mouse = u_mouse / u_resolution.xy;
          if (length(u_mouse) < 1.0) {
              mouse = vec2(0.5 + 0.15 * sin(t * 0.8), 0.55 + 0.12 * cos(t * 0.6));
          }
          vec2 mouseP = vec2(mouse.x * aspect.x, mouse.y);

          // 1. Deep Ocean Midnight Canvas
          vec3 oceanDeep = vec3(0.012, 0.027, 0.055); // #03070E
          vec3 oceanMid  = vec3(0.024, 0.063, 0.110); // #06101C
          vec3 col = mix(oceanDeep, oceanMid, st.y * 0.7);

          // Ambient top sea-foam glow
          vec2 topGlow = vec2(0.5 * aspect.x, 1.05);
          float topDist = length(uv - topGlow);
          float seaGlow = exp(-topDist * 1.8) * 0.32;
          vec3 seaTeal  = vec3(0.063, 0.88, 0.68); // Seafoam mint #10E0AD
          vec3 seaAqua  = vec3(0.00, 0.72, 0.92);  // Ocean cyan #00B8EB
          col += mix(seaTeal, seaAqua, 0.4) * seaGlow;

          // 2. Subtle Tech Grid in Deep Water
          float gridSpacing = 0.06;
          vec2 g = abs(fract(uv / gridSpacing - 0.5) - 0.5) * gridSpacing;
          float gridLine = 1.0 - smoothstep(0.0, 0.0012, min(g.x, g.y));
          float gridFade = smoothstep(-0.1, 0.85, st.y) * 0.04;
          col += seaAqua * gridLine * gridFade;

          // 3. Layered Rising Sea Foam Bubbles (Bọt Biển)
          // Layer A: Small Background Micro-Foam (Dense, subtle, rising slowly)
          for (int i = 0; i < 12; i++) {
              float fi = float(i);
              float speed = 0.08 + fract(sin(fi * 78.233) * 43758.5453) * 0.06;
              float xSeed = fract(sin(fi * 12.9898) * 43758.5453) * aspect.x;
              float yPos = mod(fi * 0.15 + t * speed, 1.3) - 0.15;
              float xWobble = sin(t * 1.8 + fi * 2.5) * 0.025;
              vec2 bPos = vec2(xSeed + xWobble, yPos);
              float bRad = 0.014 + fract(sin(fi * 45.13) * 43758.5453) * 0.016;
              
              col += drawBubble(uv, bPos, bRad, seaAqua, 0.45);
          }

          // Layer B: Medium Foreground Sea Foam Bubbles (Crisp, iridescent)
          for (int j = 0; j < 8; j++) {
              float fj = float(j);
              float speed = 0.12 + fract(cos(fj * 34.56) * 23421.12) * 0.08;
              float xSeed = fract(cos(fj * 91.22) * 12345.67) * aspect.x;
              float yPos = mod(fj * 0.22 + t * speed, 1.4) - 0.2;
              float xWobble = cos(t * 1.4 + fj * 3.1) * 0.04;
              vec2 bPos = vec2(xSeed + xWobble, yPos);
              float bRad = 0.032 + fract(sin(fj * 67.89) * 34567.89) * 0.025;
              
              col += drawBubble(uv, bPos, bRad, seaTeal, 0.75);
          }

          // Layer C: Interactive Cursor Bubble (Spawns around mouse / touch)
          vec2 mouseWobble = vec2(sin(t * 2.2) * 0.02, cos(t * 1.8) * 0.015);
          col += drawBubble(uv, mouseP + mouseWobble, 0.065, seaTeal, 0.85);
          
          vec2 mouseDroplet = mouseP + vec2(cos(t * 2.5) * 0.11, sin(t * 2.5) * 0.09);
          col += drawBubble(uv, mouseDroplet, 0.035, seaAqua, 0.7);

          // 4. Subtle Sea-Depth Vignette
          float vignette = smoothstep(1.35, 0.45, length((st - 0.5) * 1.25));
          col *= vignette;

          gl_FragColor = vec4(col, 1.0);
      }
    `;

    function compileShader(type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    const vertexShader = compileShader(gl.VERTEX_SHADER, vs);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fs);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uMouse = gl.getUniformLocation(program, "u_mouse");

    let mousePos = {
      x: canvas.width * 0.5,
      y: canvas.height * 0.5,
      targetX: canvas.width * 0.5,
      targetY: canvas.height * 0.5
    };

    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        mousePos.targetX = nx * canvas.width;
        mousePos.targetY = ny * canvas.height;
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let startTime = performance.now();

    function render() {
      // Smooth lerp mouse for fluid bubble inertia
      mousePos.x += (mousePos.targetX - mousePos.x) * 0.12;
      mousePos.y += (mousePos.targetY - mousePos.y) * 0.12;

      gl.viewport(0, 0, canvas.width, canvas.height);
      const currentTime = performance.now() - startTime;

      if (uTime) gl.uniform1f(uTime, currentTime * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mousePos.x, mousePos.y);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrameId = requestAnimationFrame(render);
    }

    render();

    return () => {
      window.removeEventListener("resize", syncSize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
