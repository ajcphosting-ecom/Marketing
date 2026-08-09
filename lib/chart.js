const { raw } = require("./html");

/**
 * Renders a small inline SVG line chart from an array of numbers.
 * Server-rendered, no client JS/chart library needed.
 */
function sparklineSvg(values, { width = 640, height = 160, color = "#f0a63c" } = {}) {
  if (!values.length) return raw("");

  const padX = 4;
  const padY = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1 || 1)) * (width - padX * 2);
    const y = padY + (1 - (v - min) / range) * (height - padY * 2);
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${height - padY} L${points[0][0].toFixed(1)},${height - padY} Z`;

  const gridLines = [0, 1, 2, 3]
    .map((g) => {
      const y = padY + (g / 3) * (height - padY * 2);
      return `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#263149" stroke-width="1" />`;
    })
    .join("");

  const [lastX, lastY] = points[points.length - 1];

  return raw(`
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Chart">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.28" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0" />
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPath}" fill="url(#sparkFill)" />
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4" fill="${color}" />
    </svg>
  `);
}

module.exports = { sparklineSvg };
