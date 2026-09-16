const APP_STORE_URL = "";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const calculator = document.querySelector("[data-calculator]");
if (calculator) {
  const fields = {
    attendees: calculator.querySelector("#attendees"),
    length: calculator.querySelector("#length"),
    frequency: calculator.querySelector("#frequency"),
    compensation: calculator.querySelector("#compensation"),
  };
  const outputs = {
    attendees: calculator.querySelector("[data-out=attendees]"),
    length: calculator.querySelector("[data-out=length]"),
    compensation: calculator.querySelector("[data-out=compensation]"),
    meeting: calculator.querySelector("[data-result=meeting]"),
    annual: calculator.querySelector("[data-result=annual]"),
    hours: calculator.querySelector("[data-result=hours]"),
    recurring: calculator.querySelector("[data-recurring]"),
  };

  const occurrences = { once: 1, weekly: 52, twice: 104, monthly: 12 };
  const update = () => {
    const people = Number(fields.attendees.value);
    const minutes = Number(fields.length.value);
    const annualComp = Number(fields.compensation.value) * 1000;
    const count = occurrences[fields.frequency.value];
    // Matches MeetingWorth's default "real employee cost" setting:
    // salary × 1.43, spread over 2,080 work hours.
    const hourly = annualComp * 1.43 / 2080;
    const meeting = hourly * people * minutes / 60;
    const annual = meeting * count;
    const teamHours = people * minutes / 60 * count;

    outputs.attendees.textContent = people;
    outputs.length.textContent = `${minutes} min`;
    outputs.compensation.textContent = `${money.format(annualComp)} / yr`;
    outputs.meeting.textContent = money.format(meeting);
    outputs.annual.textContent = `${money.format(annual)} / year`;
    outputs.hours.textContent = `${Math.round(teamHours).toLocaleString()} team-hours`;
    outputs.recurring.hidden = count === 1;
  };
  Object.values(fields).forEach((field) => field.addEventListener("input", update));
  update();
}

document.querySelectorAll("[data-app-store]").forEach((link) => {
  if (APP_STORE_URL) {
    link.href = APP_STORE_URL;
    link.textContent = "Download on the App Store";
    link.classList.remove("disabled");
  } else {
    link.removeAttribute("href");
    link.textContent = "Coming to the App Store";
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
  }
});

const menuButton = document.querySelector("[data-menu-toggle]");
const menu = document.querySelector("[data-menu]");
if (menuButton && menu) {
  const closeMenu = () => {
    menu.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  };
  menuButton.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("open")) {
      closeMenu();
      menuButton.focus();
    }
  });
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const reveals = document.querySelectorAll(".reveal");
if (reduceMotion || !("IntersectionObserver" in window)) {
  reveals.forEach((item) => item.classList.add("visible"));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach((item) => observer.observe(item));
}

document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = new Date().getFullYear();
});
