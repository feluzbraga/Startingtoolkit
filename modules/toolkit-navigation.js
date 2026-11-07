
(function () {
  if (document.getElementById("starting-toolkit-nav")) return;

  const lang = localStorage.getItem("startingToolkitLanguage") || "en";

  const labels = {
    en: {
      dashboard: "Dashboard",
      welcome: "Welcome",
      glossary: "Glossary",
      final: "Final Plan"
    },
    pt: {
      dashboard: "Painel",
      welcome: "Boas-vindas",
      glossary: "Glossário",
      final: "Plano Final"
    },
    es: {
      dashboard: "Panel",
      welcome: "Bienvenida",
      glossary: "Glosario",
      final: "Plan Final"
    }
  };

  const t = labels[labels[lang] ? lang : "en"];

  const links = [
    { href: "dashboard.html", icon: "▦", label: t.dashboard },
    { href: "welcome.html", icon: "⌂", label: t.welcome },
    { href: "business-glossary.html", icon: "Aa", label: t.glossary },
    { href: "your-final-plan.html", icon: "▤", label: t.final }
  ];

  const currentFile = location.pathname.split("/").pop() || "";

  const nav = document.createElement("nav");
  nav.id = "starting-toolkit-nav";
  nav.setAttribute("aria-label", "Starting Toolkit navigation");

  const style = document.createElement("style");
  style.textContent = `
    body { padding-bottom: 88px !important; }

    #starting-toolkit-nav {
      position: fixed;
      z-index: 9999;
      left: 0;
      right: 0;
      bottom: 0;
      background: #172d3b;
      color: white;
      display: flex;
      justify-content: center;
      align-items: stretch;
      gap: 8px;
      padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
      box-shadow: 0 -3px 15px rgba(0,0,0,.12);
      font-family: Arial, Helvetica, sans-serif;
    }

    #starting-toolkit-nav a {
      color: #dce5e9;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      min-width: 90px;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 11px;
      line-height: 1.3;
      transition: background .2s;
    }

    #starting-toolkit-nav a:hover {
      background: rgba(255,255,255,.1);
    }

    #starting-toolkit-nav a.active {
      background: rgba(198,166,107,.18);
      color: #e4c68f;
    }

    #starting-toolkit-nav .nav-icon {
      font-size: 19px;
      font-weight: 700;
    }

    @media(max-width:480px) {
      #starting-toolkit-nav {
        gap: 2px;
        padding-left: 4px;
        padding-right: 4px;
      }
      #starting-toolkit-nav a {
        min-width: 0;
        flex: 1;
        padding: 6px 3px;
        font-size: 10px;
      }
    }
  `;

  links.forEach(item => {
    const a = document.createElement("a");
    a.href = item.href;

    if (currentFile === item.href) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }

    const icon = document.createElement("span");
    icon.className = "nav-icon";
    icon.textContent = item.icon;

    const label = document.createElement("span");
    label.textContent = item.label;

    a.append(icon, label);
    nav.appendChild(a);
  });

  document.head.appendChild(style);
  document.body.appendChild(nav);

  // On the Welcome page, the main CTA leads to the Dashboard.
  if (currentFile === "welcome.html") {
    const startButton = document.querySelector(".primary-btn");
    if (startButton) {
      startButton.href = "dashboard.html";
    }
  }
})();
