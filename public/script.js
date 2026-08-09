document.getElementById("year").textContent = new Date().getFullYear();

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
