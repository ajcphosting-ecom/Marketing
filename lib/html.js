// Tiny safe-HTML helper for server-rendered admin/portal pages. Using a
// tagged template means every interpolated value is escaped by default —
// arrays are joined (so you can map+html a list of rows), and anything
// already wrapped in `raw()` is trusted and passed through unescaped.

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

class Raw {
  constructor(value) {
    this.value = value;
  }
}

function raw(value) {
  return new Raw(value);
}

function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Array.isArray(v)) {
      out += v.map((item) => (item instanceof Raw ? item.value : escapeHtml(item))).join("");
    } else if (v instanceof Raw) {
      out += v.value;
    } else {
      out += escapeHtml(v);
    }
    out += strings[i + 1];
  }
  return raw(out);
}

module.exports = { html, raw, escapeHtml };
