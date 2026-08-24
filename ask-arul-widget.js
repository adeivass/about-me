(() => {
  const answers = [
    { terms: ["ai", "artificial intelligence", "rag", "agent"], text: "Arul explores practical AI for engineering: RAG, enterprise knowledge systems, agentic workflows, and AI-assisted delivery. <a href=\"#ai-lab\">Explore the AI Lab →</a>" },
    { terms: ["sdlc", "aignition", "software development lifecycle", "agentic"], text: "The Agentic SDLC concept connects assistance across requirements, design, implementation, testing, review, and delivery—with human approval and quality checks. <a href=\"ai-sdlc.html\">Read the AI SDLC article →</a>" },
    { terms: ["cloud", "gcp", "google", "kubernetes", "openshift", "argo", "devops"], text: "Arul works across cloud modernization, GCP, Kubernetes, OpenShift, Argo CD, CI/CD, and developer enablement. <a href=\"case-studies.html\">See the cloud case study →</a>" },
    { terms: ["architecture", "microservice", "system", "api", "integration"], text: "His architecture approach emphasizes clear boundaries, intentional integrations, operational awareness, and explicit trade-offs. <a href=\"#architecture\">Explore Architecture Lab →</a>" },
    { terms: ["leadership", "lead", "mentor", "team", "experience"], text: "Arul is a hands-on technical leader who guides architecture, cloud and AI adoption, and team enablement. <a href=\"#experience\">Read the experience overview →</a>" }
  ];

  const style = document.createElement("style");
  style.textContent = `
    .ask-arul-widget { position: fixed; right: 24px; bottom: 24px; z-index: 50; font-family: Inter, "Segoe UI", Arial, sans-serif; }
    .ask-arul-launcher { display: flex; align-items: center; gap: 10px; padding: 12px 16px 12px 12px; border: 1px solid rgba(142,240,199,.55); border-radius: 999px; color: #ebf2ff; background: #102637; box-shadow: 0 16px 35px rgba(0,0,0,.34); cursor: pointer; font: inherit; font-weight: 800; }
    .ask-arul-launcher:hover { background: #163248; }.ask-arul-orb { display: grid; width: 35px; height: 35px; place-items: center; border-radius: 50%; color: #052330; background: linear-gradient(135deg,#77d7ff,#8ef0c7); animation: ask-arul-float 2.8s ease-in-out infinite; }
    .ask-arul-widget.open .ask-arul-orb { animation: none; }.ask-arul-panel { position: absolute; right: 0; bottom: 63px; display: none; width: min(370px, calc(100vw - 32px)); overflow: hidden; border: 1px solid rgba(145,175,203,.28); border-radius: 19px; color: #ebf2ff; background: #0d1d2e; box-shadow: 0 24px 55px rgba(0,0,0,.45); }.ask-arul-widget.open .ask-arul-panel { display: block; animation: ask-arul-rise .2s ease-out; }
    .ask-arul-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px; border-bottom: 1px solid rgba(145,175,203,.2); }.ask-arul-title strong { display: block; }.ask-arul-title span { color: #afc2d9; font-size: .75rem; }.ask-arul-close { border: 0; color: #afc2d9; background: transparent; cursor: pointer; font-size: 1.35rem; line-height: 1; }.ask-arul-close:hover { color: #fff; }
    .ask-arul-messages { display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; padding: 14px; }.ask-arul-message { max-width: 90%; padding: 10px 12px; border-radius: 12px; font-size: .86rem; line-height: 1.5; }.ask-arul-message.assistant { align-self: flex-start; color: #c5d6ea; background: rgba(255,255,255,.055); }.ask-arul-message.user { align-self: flex-end; color: #fff; background: #1f6da1; }.ask-arul-message a { color: #77d7ff; font-weight: 700; }
    .ask-arul-suggestions { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 12px; }.ask-arul-suggestions button { border: 1px solid rgba(145,175,203,.25); border-radius: 999px; padding: 6px 9px; color: #afc2d9; background: transparent; cursor: pointer; font: inherit; font-size: .72rem; }.ask-arul-suggestions button:hover { border-color: #77d7ff; color: #ebf2ff; }
    .ask-arul-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(145,175,203,.2); }.ask-arul-form input { min-width: 0; flex: 1; padding: 9px 10px; border: 1px solid rgba(145,175,203,.25); border-radius: 8px; outline: none; color: #ebf2ff; background: rgba(0,0,0,.15); font: inherit; font-size: .85rem; }.ask-arul-form input:focus { border-color: #77d7ff; }.ask-arul-form button { border: 0; border-radius: 8px; padding: 9px 11px; color: #052330; background: linear-gradient(135deg,#77d7ff,#8ef0c7); cursor: pointer; font-weight: 800; }.ask-arul-full { display: block; padding: 0 14px 13px; color: #77d7ff; font-size: .78rem; font-weight: 700; text-decoration: none; }
    @keyframes ask-arul-float { 50% { transform: translateY(-5px); box-shadow: 0 7px 14px rgba(119,215,255,.26); } } @keyframes ask-arul-rise { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } } @media (max-width: 600px) { .ask-arul-widget { right: 14px; bottom: 14px; }.ask-arul-launcher { padding-right: 13px; }.ask-arul-launcher span { display: none; } }
  `;
  document.head.appendChild(style);

  const widget = document.createElement("aside");
  widget.className = "ask-arul-widget";
  widget.setAttribute("aria-label", "Ask Arul assistant");
  widget.innerHTML = `
    <div class="ask-arul-panel" role="dialog" aria-label="Ask Arul chat">
      <div class="ask-arul-title"><div><strong>Ask Arul</strong><span>Curated public profile guide</span></div><button class="ask-arul-close" type="button" aria-label="Close assistant">×</button></div>
      <div class="ask-arul-messages" aria-live="polite"><div class="ask-arul-message assistant">Ask about AI, cloud, architecture, or technical leadership.</div></div>
      <div class="ask-arul-suggestions"><button type="button">AI experience</button><button type="button">Agentic SDLC</button><button type="button">Cloud work</button></div>
      <form class="ask-arul-form"><input type="text" aria-label="Ask a question" placeholder="Ask a question…" autocomplete="off"><button type="submit">Ask</button></form>
      <a class="ask-arul-full" href="ask-arul.html">Open the full Ask Arul guide →</a>
      <a class="ask-arul-full" href="https://www.linkedin.com/in/adeivass" target="_blank" rel="noopener">Additional questions? Message Arul on LinkedIn ↗</a>
    </div>
    <button class="ask-arul-launcher" type="button" aria-expanded="false" aria-label="Open Ask Arul assistant"><span class="ask-arul-orb">A</span><span>Ask Arul</span></button>
  `;
  document.body.appendChild(widget);

  const launcher = widget.querySelector(".ask-arul-launcher");
  const close = widget.querySelector(".ask-arul-close");
  const form = widget.querySelector("form");
  const input = widget.querySelector("input");
  const messages = widget.querySelector(".ask-arul-messages");
  function toggle(force) { const open = force ?? !widget.classList.contains("open"); widget.classList.toggle("open", open); launcher.setAttribute("aria-expanded", String(open)); if (open) input.focus(); }
  function addMessage(kind, content, html = false) { const message = document.createElement("div"); message.className = "ask-arul-message " + kind; if (html) message.innerHTML = content; else message.textContent = content; messages.appendChild(message); messages.scrollTop = messages.scrollHeight; }
  function getReply(question) { const value = question.toLowerCase(); const answer = answers.find(item => item.terms.some(term => value.includes(term))); return answer ? answer.text : "I can help with AI, Agentic SDLC, cloud, architecture, technical leadership, and public case studies. <a href=\"ask-arul.html\">Open the full guide →</a>"; }
  function ask(question) { const clean = question.trim(); if (!clean) return; addMessage("user", clean); addMessage("assistant", getReply(clean), true); input.value = ""; }
  launcher.addEventListener("click", () => toggle()); close.addEventListener("click", () => toggle(false)); form.addEventListener("submit", event => { event.preventDefault(); ask(input.value); }); widget.querySelectorAll(".ask-arul-suggestions button").forEach(button => button.addEventListener("click", () => ask(button.textContent)));
  document.addEventListener("keydown", event => { if (event.key === "Escape") toggle(false); });
})();
