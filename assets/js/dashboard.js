document.addEventListener('DOMContentLoaded', () => {
  const H = JSON.parse(document.getElementById("dashboard-history").textContent);
  const timelineColors = {
    good: 'var(--dash-good)',
    mid: 'var(--dash-accent-2)',
    warn: 'var(--dash-warn)',
    bad: 'var(--dash-bad)',
    accent: 'var(--dash-accent)'
  };

  function colorForValue(value, min, max, metric) {
    if (metric === 'pages') {
      return timelineColors.accent;
    }
    const span = max - min || 1;
    const t = (value - min) / span;
    if (t >= 0.72) return timelineColors.bad;
    if (t >= 0.5) return timelineColors.warn;
    if (t >= 0.28) return timelineColors.mid;
    return timelineColors.good;
  }

  const sparkData = H.slice(-12).map(d => d.buildMs);
  (function drawSparkline() {
    const svg = document.getElementById('sparkline-build');
    if (!svg) return;
    const W = 130, H2 = 42, pad = 2;
    const min = Math.min(...sparkData), max = Math.max(...sparkData);
    const span = max - min || 1;
    if (!sparkData.length) return;
    const stepX = (W - pad * 2) / Math.max(1, sparkData.length - 1);
    const pts = sparkData.map((v, i) => [
      pad + i * stepX,
      pad + (1 - (v - min) / span) * (H2 - pad * 2),
    ]);
    const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${pts[pts.length-1][0]} ${H2-pad} L${pts[0][0]} ${H2-pad} Z`;
    const lastPt = pts[pts.length - 1];
    svg.innerHTML = `
      <defs>
        <linearGradient id="sparkline-line-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="var(--dash-good)" />
          <stop offset="58%" stop-color="var(--dash-accent-2)" />
          <stop offset="80%" stop-color="var(--dash-warn)" />
          <stop offset="100%" stop-color="var(--dash-bad)" />
        </linearGradient>
        <linearGradient id="sparkline-area-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="var(--dash-good)" stop-opacity="0.01" />
          <stop offset="58%" stop-color="var(--dash-accent-2)" stop-opacity="0.05" />
          <stop offset="80%" stop-color="var(--dash-warn)" stop-opacity="0.08" />
          <stop offset="100%" stop-color="var(--dash-bad)" stop-opacity="0.18" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#sparkline-area-grad)" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="url(#sparkline-line-grad)" stroke-width="1.3" stroke-linecap="square" stroke-linejoin="miter"/>
      <circle cx="${lastPt[0].toFixed(1)}" cy="${lastPt[1].toFixed(1)}" r="1.8" fill="url(#sparkline-line-grad)"/>
    `;
    const allMs = H.map(d => d.buildMs);
    const mean30 = Math.round(allMs.reduce((a, b) => a + b, 0) / allMs.length);
    const current = allMs[allMs.length - 1];
    const delta = current - mean30;
    const el = document.getElementById('spark-delta');
    if (el) {
      const sign = delta >= 0 ? '+' : '';
      const color = delta > 0 ? 'var(--tag-poetry)' : 'var(--tag-drama)';
      el.innerHTML = `<span style="color:${color};font-family:var(--font-mono)">${sign}${delta}ms</span> vs ${H.length}-measurement mean`;
    }
  })();

  (function drawBars() {
    const container = document.getElementById('bars-chart');
    if (!container) return;
    const vols = H.map(d => (d.zhPages || 0) + (d.enPages || 0));
    const min = Math.min(...vols), max = Math.max(...vols);
    const span = max - min || 1;
    container.innerHTML = vols.map((v, i) => {
      const h = 12 + ((v - min) / span) * 88;
      const isLast = i === vols.length - 1;
      return `<div class="bar${isLast ? ' last' : ''}" style="height:${h}%"></div>`;
    }).join('');
    const delta = vols[vols.length - 1] - vols[0];
    const el = document.getElementById('vol-delta');
    if (el && vols.length) el.textContent = `${delta > 0 ? '+' : ''}${delta} pages over ${H.length} measurements`;
  })();

  function getData(metric) {
    return H.map(d => metric === 'build' ? d.buildMs : (d.zhPages || 0) + (d.enPages || 0));
  }

  function updateStats(data, unit) {
    const sorted = [...data].sort((a, b) => a - b);
    const mean = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
    const p95 = sorted[Math.floor(data.length * 0.95)];
    const min = sorted[0], max = sorted[sorted.length - 1];
    document.getElementById('ts-min').innerHTML = `${min}<span class="small">${unit}</span>`;
    document.getElementById('ts-mean').innerHTML = `${mean}<span class="small">${unit}</span>`;
    document.getElementById('ts-max').innerHTML = `${max}<span class="small">${unit}</span>`;
    document.getElementById('ts-p95').innerHTML = `${p95}<span class="small">${unit}</span>`;
    document.getElementById('trend-range').textContent = `min ${min}${unit} / max ${max}${unit}`.toUpperCase();
  }

  let chartInteractionCleanup = null;

  function drawChart(metric) {
    const svg = document.getElementById('trend-chart');
    if (!svg) return;
    if (chartInteractionCleanup) {
      chartInteractionCleanup();
      chartInteractionCleanup = null;
    }
    const data = getData(metric);
    if (!data.length) return;
    const unit = metric === 'build' ? 'ms' : '';
    updateStats(data, unit);

    const W = 1080, H2 = 280;
    const padL = 56, padR = 24, padT = 24, padB = 36;
    const innerW = W - padL - padR, innerH = H2 - padT - padB;
    const min = Math.min(...data), max = Math.max(...data);
    const span = max - min || 1;
    const lo = Math.floor(min - span * 0.1);
    const hi = Math.ceil(max + span * 0.1);
    const yspan = hi - lo;

    const x = (i) => padL + (i / Math.max(1, data.length - 1)) * innerW;
    const y = (v) => padT + (1 - (v - lo) / yspan) * innerH;

    const linePath = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${x(data.length-1)} ${H2-padB} L${padL} ${H2-padB} Z`;
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => lo + t * yspan);
    const tickIdx = [...new Set(Array.from({ length: Math.min(7, data.length) }, (_, i) => Math.round(i * (data.length - 1) / Math.max(1, Math.min(7, data.length) - 1))))];
    const labels = H.map(d => d.label || d.stamp || '');

    let html = `
      <defs>
        <!-- Build Duration Gradient -->
        <linearGradient id="trend-line-grad-build" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="var(--dash-good)" />
          <stop offset="54%" stop-color="var(--dash-accent-2)" />
          <stop offset="80%" stop-color="var(--dash-warn)" />
          <stop offset="100%" stop-color="var(--dash-bad)" />
        </linearGradient>
        <linearGradient id="trend-area-grad-build" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="var(--dash-good)" stop-opacity="0.01" />
          <stop offset="54%" stop-color="var(--dash-accent-2)" stop-opacity="0.05" />
          <stop offset="80%" stop-color="var(--dash-warn)" stop-opacity="0.08" />
          <stop offset="100%" stop-color="var(--dash-bad)" stop-opacity="0.2" />
        </linearGradient>

        <!-- Page Volume Gradient -->
        <linearGradient id="trend-line-grad-pages" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="var(--dash-accent)" />
          <stop offset="100%" stop-color="var(--dash-accent)" />
        </linearGradient>
        <linearGradient id="trend-area-grad-pages" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="var(--dash-accent)" stop-opacity="0.01" />
          <stop offset="100%" stop-color="var(--dash-accent)" stop-opacity="0.12" />
        </linearGradient>
      </defs>
    `;

    yTicks.forEach(v => {
      html += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
      html += `<text class="axis-text" x="${padL - 10}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${Math.round(v)}${unit}</text>`;
    });

    html += `<path class="chart-area" d="${areaPath}" fill="url(#trend-area-grad-${metric})" stroke="none"/>`;
    html += `<path class="chart-line" d="${linePath}" fill="none" stroke="url(#trend-line-grad-${metric})" stroke-width="1.5" stroke-linejoin="miter"/>`;

    data.forEach((v, i) => {
      const pointColor = colorForValue(v, min, max, metric);
      html += `<circle class="chart-pt" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.4" stroke="${pointColor}" fill="var(--bg-color)" stroke-width="1.4"/>`;
    });

    html += `<g id="chart-cursor">
      <line class="cursor-line" id="cursor-line" x1="0" x2="0" y1="${padT}" y2="${H2 - padB}"/>
      <circle class="chart-pt-cursor" id="cursor-dot" cx="0" cy="0" r="3.6" fill="var(--bg-color)" stroke="url(#trend-line-grad-${metric})" stroke-width="1.8"/>
      <rect id="cursor-rect" x="0" y="0" width="80" height="22" rx="6" fill="var(--color-heading)"/>
      <text id="cursor-text" x="0" y="0" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="var(--bg-color)" letter-spacing=".04em"></text>
    </g>`;

    tickIdx.forEach(i => {
      if (i < labels.length) {
        html += `<text class="axis-text" x="${x(i).toFixed(1)}" y="${(H2 - padB + 18).toFixed(1)}" text-anchor="middle">${labels[i]}</text>`;
      }
    });

    svg.innerHTML = html;

    let activeIdx = -1;
    let animFrameId = null;
    let curX = null, curY = null;
    let curTx = null, curTy = null;
    let curVal = null;
    let firstMove = true;

    function updateCursorPositions(cx, cy, tx, ty, val) {
      const cursor = document.getElementById('chart-cursor');
      const line = document.getElementById('cursor-line');
      const dot = document.getElementById('cursor-dot');
      const crect = document.getElementById('cursor-rect');
      const ctext = document.getElementById('cursor-text');
      if (!cursor) return;
      cursor.classList.add('active');
      line.setAttribute('x1', cx.toFixed(1)); line.setAttribute('x2', cx.toFixed(1));
      dot.setAttribute('cx', cx.toFixed(1)); dot.setAttribute('cy', cy.toFixed(1));
      const pointColor = colorForValue(val, min, max, metric);
      dot.setAttribute('stroke', pointColor);
      crect.setAttribute('x', tx.toFixed(1)); crect.setAttribute('y', ty.toFixed(1));
      ctext.setAttribute('x', (tx + 40).toFixed(1)); ctext.setAttribute('y', (ty + 14).toFixed(1));
      ctext.textContent = `${Math.round(val)}${unit}`;
    }

    function animateCursor() {
      if (activeIdx === -1) {
        animFrameId = null;
        return;
      }

      const targetX = x(activeIdx);
      const targetY = y(data[activeIdx]);
      const targetTx = Math.min(W - padR - 80, Math.max(padL + 4, targetX - 40));
      const targetTy = Math.max(padT + 4, targetY - 32);
      const targetVal = data[activeIdx];

      curX += (targetX - curX) * 0.18;
      curY += (targetY - curY) * 0.18;
      curTx += (targetTx - curTx) * 0.18;
      curTy += (targetTy - curTy) * 0.18;
      curVal += (targetVal - curVal) * 0.18;

      updateCursorPositions(curX, curY, curTx, curTy, curVal);

      const dist = Math.abs(targetX - curX) + Math.abs(targetY - curY);
      if (dist < 0.05) {
        updateCursorPositions(targetX, targetY, targetTx, targetTy, targetVal);
        animFrameId = null;
      } else {
        animFrameId = requestAnimationFrame(animateCursor);
      }
    }

    const onMouseMove = function(e) {
      const rect = svg.getBoundingClientRect();
      const vbScale = W / rect.width;
      const px = (e.clientX - rect.left) * vbScale;
      const i = Math.round(((px - padL) / innerW) * (data.length - 1));
      if (i < 0 || i >= data.length) return;

      activeIdx = i;

      if (firstMove) {
        const cx = x(i), cy = y(data[i]);
        curX = cx;
        curY = cy;
        curTx = Math.min(W - padR - 80, Math.max(padL + 4, cx - 40));
        curTy = Math.max(padT + 4, cy - 32);
        curVal = data[i];
        firstMove = false;
        updateCursorPositions(curX, curY, curTx, curTy, curVal);
      }

      if (animFrameId === null) {
        animFrameId = requestAnimationFrame(animateCursor);
      }
    };

    const onMouseLeave = function() {
      activeIdx = -1;
      firstMove = true;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      const cursor = document.getElementById('chart-cursor');
      if (cursor) cursor.classList.remove('active');
    };

    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseleave', onMouseLeave);
    chartInteractionCleanup = function() {
      svg.removeEventListener('mousemove', onMouseMove);
      svg.removeEventListener('mouseleave', onMouseLeave);
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    };
  }

  function switchTab(metric) {
    ['build', 'pages'].forEach(m => {
      const btn = document.getElementById('tab-' + m);
      if (btn) {
        const active = m === metric;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      }
    });
    drawChart(metric);
  }

  document.querySelectorAll('[data-dashboard-metric]').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.dashboardMetric));
  });

  drawChart('build');
});
