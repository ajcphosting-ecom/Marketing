document.getElementById("year").textContent = new Date().getFullYear();

/**
 * Draws the hero "growth curve" — a noisy-but-rising line representing
 * blended ROAS over a 90-day testing cohort, with a soft fill and a
 * highlighted endpoint. Purely decorative/illustrative of the concept
 * behind the name "Ampcurve"; not live data.
 */
function drawCurve() {
  const canvas = document.getElementById("curve");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 600;
  const cssHeight = canvas.clientHeight || 190;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);

  const w = cssWidth;
  const h = cssHeight;
  const padX = 6;
  const padTop = 16;
  const padBottom = 10;

  // Rising series with realistic noise: index 1.6x -> 3.8x over 90 days.
  const raw = [
    1.6, 1.7, 1.65, 1.8, 1.9, 1.85, 2.0, 2.1, 2.05, 2.2,
    2.15, 2.3, 2.4, 2.35, 2.5, 2.6, 2.55, 2.7, 2.8, 2.75,
    2.9, 3.0, 2.95, 3.1, 3.2, 3.15, 3.3, 3.4, 3.35, 3.5,
    3.45, 3.6, 3.55, 3.7, 3.65, 3.8,
  ];
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const points = raw.map((v, i) => ({
    x: padX + (i / (raw.length - 1)) * (w - padX * 2),
    y: padTop + (1 - (v - min) / (max - min)) * (h - padTop - padBottom),
  }));

  const styles = getComputedStyle(document.documentElement);
  const lineColor = styles.getPropertyValue("--signal").trim() || "#f0a63c";
  const gridColor = styles.getPropertyValue("--line").trim() || "#263149";
  const dimColor = styles.getPropertyValue("--paper-dimmer").trim() || "#5c6882";

  function render(progress) {
    ctx.clearRect(0, 0, w, h);

    // Horizontal grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
      const y = padTop + (g / 3) * (h - padTop - padBottom);
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }

    const count = Math.max(2, Math.round(points.length * progress));
    const visible = points.slice(0, count);

    // Area fill under the curve
    const grad = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
    grad.addColorStop(0, "rgba(240, 166, 60, 0.28)");
    grad.addColorStop(1, "rgba(240, 166, 60, 0)");
    ctx.beginPath();
    ctx.moveTo(visible[0].x, h - padBottom);
    visible.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(visible[visible.length - 1].x, h - padBottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // The line itself
    ctx.beginPath();
    visible.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Endpoint dot
    const last = visible[visible.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(240, 166, 60, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    render(1);
    return;
  }

  const duration = 1100;
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    render(eased);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

drawCurve();
window.addEventListener("resize", () => {
  clearTimeout(window.__curveResizeTimer);
  window.__curveResizeTimer = setTimeout(drawCurve, 150);
});

/**
 * Wires a waitlist <form> up to POST /api/waitlist and render
 * a success/error message in the given status element.
 */
function wireWaitlistForm(formId, msgId, buttonId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const msg = document.getElementById(msgId);
  const button = document.getElementById(buttonId);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = form.querySelector('input[name="email"]').value.trim();
    const priorityField = form.querySelector('select[name="priority"]');
    const priority = priorityField ? priorityField.value : "";
    const honeypot = form.querySelector('input[name="company_website"]').value;

    if (honeypot) {
      // Bot filled the hidden field — silently pretend success.
      msg.textContent = "You're on the list! We'll be in touch.";
      msg.className = "form-msg success";
      form.reset();
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = "Please enter a valid email address.";
      msg.className = "form-msg error";
      return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Joining…";
    msg.textContent = "";
    msg.className = "form-msg";

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          priority,
          source: window.location.pathname,
          utm: window.location.search,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        msg.textContent = data.position
          ? `You're #${data.position} on the waitlist! We'll email you at ${email}.`
          : "You're on the waitlist! We'll be in touch.";
        msg.className = "form-msg success";
        form.reset();
      } else if (res.status === 409) {
        msg.textContent = "You're already on the waitlist — we'll be in touch soon.";
        msg.className = "form-msg success";
      } else {
        msg.textContent = data.error || "Something went wrong. Please try again.";
        msg.className = "form-msg error";
      }
    } catch (err) {
      msg.textContent = "Network error — please try again in a moment.";
      msg.className = "form-msg error";
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
}

wireWaitlistForm("waitlist-form", "form-msg", "submit-btn");
wireWaitlistForm("waitlist-form-2", "form-msg-2", "submit-btn-2");
