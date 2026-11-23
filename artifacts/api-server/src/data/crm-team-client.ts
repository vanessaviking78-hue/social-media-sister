// The sales team layer for /crmpage and the team page. One bit of browser code that draws the Leads tab and the Scripts tab.
// It is used in two places: added to the CRM page when it is served (Vanessa), and inside the team page at /api/crm-team (Dean, Isabella, Leah).
// Written with plain quotes and no template strings, because it travels inside a String.raw block.
export const CRM_TEAM_UI_JS: string = String.raw`
(function () {
  var CT = (window.CT = {});
  var STATUSES = ["New", "Messaged", "Replied", "Call booked", "Signed", "Not relevant"];
  CT.cfg = { api: "", headers: function () { return {}; }, myName: "", ref: "", signupBase: "https://www.thecybersuite.com/signup?ref=" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function req(method, path, body) {
    var h = CT.cfg.headers();
    h["Content-Type"] = "application/json";
    return fetch(CT.cfg.api + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 401 ? "Please log in again." : "Something went wrong. Please try again.");
      return r.json();
    });
  }
  function toast(msg) {
    if (typeof showToast === "function") { showToast(msg); return; }
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2000);
  }
  function copy(btn, text) {
    function done() { var o = btn.getAttribute("data-label") || btn.textContent; btn.setAttribute("data-label", o); btn.textContent = "Copied"; setTimeout(function () { btn.textContent = o; }, 1400); }
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("Press copy on your keyboard"); }
      document.body.removeChild(ta);
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fallback); return; } } catch (e) {}
    fallback();
  }
  function firstName() { return String(CT.cfg.myName || "").trim().split(/\s+/)[0] || "Vanessa's team"; }
  function myLink() { return CT.cfg.signupBase + (CT.cfg.ref || ""); }

  /* ====================== LEADS ====================== */
  var L = { source: "all", status: "New", q: "", page: 0, data: null, err: "", busy: false };

  CT.leads = function (root) {
    L.root = root;
    root.innerHTML =
      '<div class="card"><h2>Leads</h2>' +
      '<p class="hint">Instagram and TikTok followers to work through. Open the DM, send your message from the Scripts tab, then change the status so nobody doubles up. Everyone on the team sees the same list.</p>' +
      '<div id="ctl-counts" class="ct-counts"></div>' +
      '<div class="list-toolbar">' +
      '<select id="ctl-source"><option value="all">Instagram and TikTok</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select>' +
      '<select id="ctl-status"></select>' +
      '<input type="text" id="ctl-q" placeholder="Search a username...">' +
      '</div>' +
      '<div id="ctl-msg" class="empty-note"></div>' +
      '<table><thead><tr><th>Username</th><th>Status</th><th>Note</th><th>Open</th></tr></thead><tbody id="ctl-body"></tbody></table>' +
      '<div class="pager"><button class="btn-ghost" id="ctl-prev">Prev</button><span id="ctl-info"></span><button class="btn-ghost" id="ctl-next">Next</button></div>' +
      '</div>';
    var st = root.querySelector("#ctl-status");
    st.innerHTML = '<option value="all">Every status</option>' + STATUSES.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join("");
    st.value = L.status;
    root.querySelector("#ctl-source").value = L.source;
    root.querySelector("#ctl-q").value = L.q;
    root.querySelector("#ctl-source").onchange = function () { L.source = this.value; L.page = 0; loadLeads(); };
    st.onchange = function () { L.status = this.value; L.page = 0; loadLeads(); };
    var timer = null;
    root.querySelector("#ctl-q").oninput = function () {
      var v = this.value; clearTimeout(timer);
      timer = setTimeout(function () { L.q = v; L.page = 0; loadLeads(); }, 300);
    };
    root.querySelector("#ctl-prev").onclick = function () { if (L.page > 0) { L.page--; loadLeads(); } };
    root.querySelector("#ctl-next").onclick = function () { L.page++; loadLeads(); };
    root.querySelector("#ctl-body").addEventListener("change", onRowChange);
    loadLeads();
  };

  function loadLeads() {
    if (!L.root) return;
    var msg = L.root.querySelector("#ctl-msg");
    msg.textContent = "Loading...";
    var qs = "?source=" + encodeURIComponent(L.source) + "&status=" + encodeURIComponent(L.status) + "&q=" + encodeURIComponent(L.q) + "&page=" + L.page;
    req("GET", "/crm-team/leads" + qs).then(function (d) {
      L.data = d; msg.textContent = d.rows.length ? "" : "Nothing here yet.";
      drawLeads();
    }, function (e) { msg.textContent = e.message; });
  }

  function drawLeads() {
    var d = L.data, root = L.root;
    var counts = d.counts || {};
    root.querySelector("#ctl-counts").innerHTML = STATUSES.map(function (s) {
      return '<span class="ct-pill"><b>' + (counts[s] || 0) + "</b> " + esc(s) + "</span>";
    }).join("");
    root.querySelector("#ctl-body").innerHTML = d.rows.map(function (r) {
      var key = esc(r.source + "|" + r.handle);
      var url = r.source === "instagram" ? "https://www.instagram.com/" + encodeURIComponent(r.handle) + "/" : "https://www.tiktok.com/@" + encodeURIComponent(r.handle);
      var dm = r.source === "instagram" ? "https://ig.me/m/" + encodeURIComponent(r.handle) : url;
      var who = r.owner ? '<div class="ct-by">' + esc(r.owner) + (r.updated ? ", " + esc(String(r.updated).slice(0, 10)) : "") + "</div>" : "";
      return '<tr><td><a class="profile-link" href="' + url + '" target="_blank" rel="noopener">@' + esc(r.handle) + '</a><div class="ct-by">' + (r.source === "instagram" ? "Instagram" : "TikTok") + "</div></td>" +
        '<td><select data-k="' + key + '" data-f="status">' + STATUSES.map(function (s) { return '<option' + (s === r.status ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select>" + who + "</td>" +
        '<td><input type="text" data-k="' + key + '" data-f="note" value="' + esc(r.note) + '" placeholder="Add a note"></td>' +
        '<td><a class="btn-copy ct-open" href="' + dm + '" target="_blank" rel="noopener">' + (r.source === "instagram" ? "Open DM" : "Open profile") + "</a></td></tr>";
    }).join("");
    var pages = Math.max(1, Math.ceil(d.total / d.perPage));
    root.querySelector("#ctl-info").textContent = "Page " + (d.page + 1) + " of " + pages + " (" + d.total + " people)";
    root.querySelector("#ctl-prev").disabled = d.page <= 0;
    root.querySelector("#ctl-next").disabled = d.page + 1 >= pages;
  }

  function onRowChange(ev) {
    var el = ev.target, k = el.getAttribute("data-k");
    if (!k) return;
    var parts = k.split("|"), body = {};
    body[el.getAttribute("data-f")] = el.value;
    req("PUT", "/crm-team/leads/" + encodeURIComponent(parts[0]) + "/" + encodeURIComponent(parts[1]), body).then(function () {
      toast("Saved");
      if (el.getAttribute("data-f") === "status") loadLeads();
    }, function (e) { toast(e.message); });
  }

  /* ====================== SCRIPTS ====================== */
  var SCRIPTS = [
    {
      id: "hello", title: "First hello", when: "A follower you have not spoken to yet.",
      msg: "Hi [name], it's [my name] here. I work with Vanessa at Social Media Sister. She looks after social media for aesthetic clinics and I had a lovely look through your page. Who looks after your posting at the moment, you or somebody else?",
      voice: "Hi [name], it's [my name] from Social Media Sister. I'm just popping a quick hello. I was looking through your page and I really liked what I saw. I'd love to know who looks after your social media at the moment. Send me a voicenote back or a quick message, whichever is easier for you. Speak soon.",
      call: [
        "Opener: Hi [name], it's [my name] from Social Media Sister. Have you got two minutes? I'll be quick.",
        "Ask: Who looks after your social media at the moment?",
        "Ask: How much of your week does it take up?",
        "Listen, then say it back to them so they know you heard.",
        "Bridge: Vanessa has spent seven years looking after social media for aesthetic clinics, so this is her whole world.",
        "Offer: Can I send you a few free posts made for your page, so you can see what she would do?",
        "Close: Lovely. I'll send them over today. What is the best number or Instagram to send them to?"
      ]
    },
    {
      id: "freebies", title: "Freebies sent, no reply yet", when: "They had the free posts and have gone quiet.",
      msg: "Hi [name], it's [my name] again. I was thinking about you this morning. Did the posts we made for you give you any ideas? I have a few spaces coming up and I'd love one of them to be yours. Shall I send you the details?",
      voice: "Hi [name], it's [my name] from Social Media Sister. I just wanted to check in. Did you get a chance to look at the posts we sent you? I'd love to hear what you thought. If you liked them, I can tell you how we can do that every week for your page. Give me a shout back whenever suits.",
      call: [
        "Opener: Hi [name], it's [my name] from Social Media Sister. I sent you some posts last week and wanted to hear what you thought.",
        "Ask: Which one did you like best?",
        "Ask: What would you change?",
        "Listen. Use their words when you talk about the next step.",
        "Offer: Vanessa can do that for you every week, so your page keeps going while you get on with your clients.",
        "Close: Shall I send you the link so you can pick a start date?"
      ]
    },
    {
      id: "blackfriday", title: "Black Friday offer", when: "Any warm lead. The offer runs until Black Friday, 27 November.",
      msg: "Hi [name], quick one before Black Friday is over on 27 November. Social Media Sister has two offers on: 6 months for the price of 4, or 12 months for the price of 6. That is Vanessa looking after your social media while you get on with your clients. Have a look here and see what you think: [link]",
      voice: "Hi [name], it's [my name] from Social Media Sister. I wanted you to hear about this before Black Friday ends on the 27th. We have 6 months for the price of 4, or 12 months for the price of 6. It means Vanessa looks after your social media and you get your time back. I'll pop the link in a message so you can have a look. Have a lovely day.",
      call: [
        "Opener: Hi [name], it's [my name] from Social Media Sister. I'm ringing because our Black Friday offer finishes on the 27th and I didn't want you to miss it.",
        "Say it plainly: 6 months for the price of 4, or 12 months for the price of 6.",
        "Ask: Would having your social media taken off your plate be useful right now?",
        "Listen. If they say yes, go to the close. If they hesitate, ask what is holding them back.",
        "Close: I'll text you the link now. It takes two minutes to fill in and then we book a call to get you started."
      ]
    },
    {
      id: "price", title: "It is too expensive", when: "They like it but the price worries them.",
      msg: "I completely understand, [name]. Lots of clinics say the same at the start. One new client from your posts covers a good chunk of the month, so I always look at it as an investment in your diary. If the monthly price is the sticking point, tell me what would feel comfortable and I'll see what I can do.",
      voice: "I completely understand, [name]. Lots of clinics feel that way at the start. Have a think about what one new client is worth to you, because your posts are there to bring those clients in. If the monthly price is the sticking point, tell me what feels comfortable and I'll see what I can do. No pressure at all.",
      call: [
        "Acknowledge: That is fair, [name]. Thank you for being honest with me.",
        "Ask: What number would feel comfortable for you each month?",
        "Reframe: What is one new client worth to your clinic? Your posts are there to bring those in.",
        "Your room to move: the usual price is 500 a month and you can go down to 350 to win the deal. Black Friday packages are 6 for 4 and 12 for 6.",
        "Close: If I can get it to a place that works, would you be ready to start this week?"
      ]
    },
    {
      id: "close", title: "Ready to start", when: "They have said yes or asked how to begin.",
      msg: "Brilliant, [name], I'm so pleased. Here is your link to get started: [link]. Pop your details in and we'll book a call to get you set up. Anything you want to ask me first, I'm here.",
      voice: "That's brilliant news, [name], I'm so pleased. I'm sending you a link in a message now. Pop your details in and we'll book a call to get you set up. If you have any questions in the meantime, send me a voicenote and I'll come straight back to you.",
      call: [
        "Congratulate them: That's brilliant, [name], I'm so pleased.",
        "Say what happens next: I'll send you a link, you pop your details in, and we book a call to get you set up.",
        "Check: What is the best email or number for the link?",
        "Send the link straight away while you are still on the phone.",
        "End warmly: Thank you for trusting us with your page."
      ]
    },
    {
      id: "nudge", title: "Last gentle nudge", when: "They have gone quiet after a couple of chases.",
      msg: "Hi [name], I promise I'll stop popping up after this one. If now is not the right time, no problem at all. If you'd still like to see what Vanessa could do for your page, here is the link: [link]. Either way, I hope your week is going well.",
      voice: "Hi [name], it's [my name] from Social Media Sister. This is my last little nudge, I promise. If now is not the right time, that is absolutely fine. If you'd still like to see what Vanessa can do for your page, I'll leave a link in a message. Either way, I hope your week is going brilliantly.",
      call: [
        "Opener: Hi [name], it's [my name] from Social Media Sister. I'll be really quick.",
        "Say: I wanted to check in one last time. Is this still something you'd like help with?",
        "If yes: Lovely, I'll send you the link now.",
        "If no: That is completely fine. Thank you for your time and I wish you a lovely rest of the week."
      ]
    }
  ];

  var S = { name: "", mode: {}, rec: null };

  function fill(text) {
    var nm = (S.name || "").trim() || "there";
    return String(text).replace(/\[name\]/g, nm).replace(/\[my name\]/g, firstName()).replace(/\[link\]/g, myLink());
  }

  CT.scripts = function (root) {
    S.root = root;
    root.innerHTML =
      '<div class="card"><h2>Scripts</h2>' +
      '<p class="hint">Pick a script, type the first name of the person you are talking to, then copy the message, record a voicenote or use the phone call prompts. Your name and your own sign up link fill in by themselves.</p>' +
      '<div class="form-row"><label class="field">Their first name<input type="text" id="cts-name" placeholder="For example Sarah"></label></div>' +
      '<div class="ct-numbers"><b>Your numbers.</b> The usual price is 500 a month and you can go down to 350 to win the deal. Black Friday packages are 6 months for the price of 4 and 12 months for the price of 6. Your sign up link: <span id="cts-link"></span> <button class="btn-copy" id="cts-copylink">Copy my link</button></div>' +
      '<div id="cts-list"></div></div>';
    root.querySelector("#cts-name").value = S.name;
    root.querySelector("#cts-name").oninput = function () { S.name = this.value; drawScripts(); };
    root.querySelector("#cts-copylink").onclick = function () { copy(this, myLink()); };
    drawScripts();
  };

  function drawScripts() {
    var root = S.root; if (!root) return;
    root.querySelector("#cts-link").textContent = myLink();
    var host = root.querySelector("#cts-list");
    host.innerHTML = SCRIPTS.map(function (s) {
      var mode = S.mode[s.id] || "msg";
      var body;
      if (mode === "msg") {
        body = '<div class="dm-body">' + esc(fill(s.msg)) + '</div><button class="btn-copy" data-copy="' + s.id + '">Copy message</button> <span class="ct-by">Paste it into Instagram, TikTok or WhatsApp.</span>';
      } else if (mode === "voice") {
        body = '<div class="dm-body">' + esc(fill(s.voice)) + '</div>' +
          '<div class="ct-rec"><button class="btn-primary" data-rec="' + s.id + '">' + (S.rec && S.rec.id === s.id ? "Stop recording" : "Record a voicenote") + '</button>' +
          '<span id="ct-rec-' + s.id + '"></span></div>' +
          '<div class="ct-by">Read it out in your own words. Recording works in the team page. In the CRM you can also use the voicenote button inside Instagram or WhatsApp.</div>';
      } else {
        body = '<ol class="ct-call">' + s.call.map(function (c) { return "<li>" + esc(fill(c)) + "</li>"; }).join("") + '</ol>' +
          '<div class="form-row"><label class="field">Their phone number<input type="tel" data-phone="' + s.id + '" placeholder="07..."></label>' +
          '<a class="btn-primary ct-open" data-call="' + s.id + '" href="#" style="text-decoration:none;">Call</a></div>';
      }
      return '<div class="dm-card"><div class="dm-title">' + esc(s.title) + '</div><div class="ct-by" style="margin-bottom:8px;">' + esc(s.when) + '</div>' +
        '<div class="ct-modes">' + [["msg", "Message"], ["voice", "Voicenote"], ["call", "Phone call"]].map(function (m) {
          return '<button class="ct-mode' + (m[0] === mode ? " on" : "") + '" data-mode="' + s.id + '|' + m[0] + '">' + m[1] + "</button>";
        }).join("") + "</div>" + body + "</div>";
    }).join("");
  }

  function startRec(id) {
    var out = document.getElementById("ct-rec-" + id);
    if (!navigator.mediaDevices || !window.MediaRecorder) { if (out) out.textContent = " Recording is not available on this device. Use the voicenote button in your messaging app."; return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], rec = new MediaRecorder(stream);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        var url = URL.createObjectURL(blob);
        S.rec = null; drawScripts();
        var o = document.getElementById("ct-rec-" + id);
        if (o) o.innerHTML = ' <audio controls src="' + url + '"></audio> <a class="btn-copy ct-open" download="voicenote-' + id + '.webm" href="' + url + '" style="text-decoration:none;">Download</a>';
      };
      S.rec = { id: id, rec: rec }; rec.start(); drawScripts();
    }, function () { if (out) out.textContent = " The microphone is blocked. Allow it in your browser, or use the voicenote button in your messaging app."; });
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var m = t.getAttribute("data-mode");
    if (m) { var p = m.split("|"); S.mode[p[0]] = p[1]; drawScripts(); return; }
    var c = t.getAttribute("data-copy");
    if (c) { var s = SCRIPTS.filter(function (x) { return x.id === c; })[0]; if (s) copy(t, fill(s.msg)); return; }
    var r = t.getAttribute("data-rec");
    if (r) { if (S.rec && S.rec.id === r) { S.rec.rec.stop(); } else { startRec(r); } return; }
    var cl = t.getAttribute("data-call");
    if (cl) {
      var inp = document.querySelector('[data-phone="' + cl + '"]');
      var num = inp ? inp.value.replace(/[^0-9+]/g, "") : "";
      if (!num) { ev.preventDefault(); toast("Add their phone number first"); return; }
      t.setAttribute("href", "tel:" + num);
    }
  });

  /* ====================== SALES TEAM (Vanessa only) ====================== */
  CT.team = function (root) {
    root.innerHTML = '<div class="card"><h2>Sales team</h2><p class="hint">Each person has their own link to the team CRM (Leads and Scripts only) and their own sign up link that tracks their leads.</p><div id="ctt-body" class="empty-note">Loading...</div></div>';
    req("GET", "/crm-team/summary").then(function (d) {
      var origin = d.origin || "";
      var rows = d.team.map(function (m) {
        var teamLink = origin + "/api/crm-team?who=" + m.slug, su = d.signupBase + m.slug;
        return "<tr><td><b>" + esc(m.name) + "</b></td>" +
          '<td><a class="profile-link" href="' + esc(teamLink) + '" target="_blank" rel="noopener">Team CRM link</a> <button class="btn-copy" data-cp="' + esc(teamLink) + '">Copy</button></td>' +
          '<td><button class="btn-copy" data-cp="' + esc(su) + '">Copy sign up link</button></td>' +
          "<td>" + m.messaged + "</td><td>" + m.replied + "</td><td>" + m.booked + "</td><td>" + m.signed + "</td></tr>";
      }).join("");
      root.querySelector("#ctt-body").innerHTML = '<table><thead><tr><th>Who</th><th>Their CRM link</th><th>Sign up link</th><th>Messaged</th><th>Replied</th><th>Call booked</th><th>Signed</th></tr></thead><tbody>' + rows + "</tbody></table>" +
        '<p class="hint" style="margin-top:12px;">They log in with their name and the team password. Signed is only counted once you have confirmed the sign up on the sales dashboard.</p>';
      root.querySelector("#ctt-body").className = "";
      root.querySelectorAll("[data-cp]").forEach(function (b) { b.onclick = function () { copy(b, b.getAttribute("data-cp")); }; });
    }, function (e) { root.querySelector("#ctt-body").textContent = e.message; });
  };

  CT.css =
    ".ct-counts{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}" +
    ".ct-pill{background:#000;color:#e6007e;border-radius:99px;padding:5px 12px;font-size:13px;font-weight:800}.ct-pill b{color:#fff}" +
    ".ct-by{font-size:12px;color:#6b6b6b;font-weight:600}" +
    ".ct-open{display:inline-block;padding:8px 12px;border-radius:10px;color:#000;font-weight:800;font-size:13px}" +
    ".ct-modes{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}" +
    ".ct-mode{background:#fff;color:#000;border:2px solid #000;padding:6px 12px;font-size:13px}.ct-mode.on{background:#000;color:#e6007e}" +
    ".ct-numbers{background:#fbd9ec;border-radius:12px;padding:12px 14px;font-size:14px;margin-bottom:14px;line-height:1.5}" +
    ".ct-call{margin:0 0 10px;padding-left:20px;font-size:14px;line-height:1.6}" +
    ".ct-rec{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}";

  /* ====================== ADD THE TABS TO /crmpage (Vanessa) ====================== */
  function addCrmTabs() {
    if (typeof TABS === "undefined" || document.getElementById("navbtn-ctleads")) return;
    var origin = "";
    try { origin = window.parent.location.origin; } catch (e) { origin = window.location.origin; }
    CT.cfg.api = origin + "/api";
    CT.cfg.headers = function () { var pw = ""; try { pw = localStorage.getItem("cybersuite-pw") || ""; } catch (e) {} return { "x-app-password": pw }; };
    CT.cfg.myName = "Vanessa";
    CT.cfg.ref = "vanessa";
    var st = document.createElement("style"); st.textContent = CT.css; document.head.appendChild(st);
    var nav = document.getElementById("tabNav"), sections = document.getElementById("sections");
    [["ctleads", "Leads"], ["ctscripts", "Scripts"], ["ctteam", "Sales Team"]].forEach(function (t) {
      TABS.push({ id: t[0], label: t[1] });
      var b = document.createElement("button"); b.textContent = t[1]; b.id = "navbtn-" + t[0];
      (function (id) { b.onclick = function () { window.switchTab(id); }; })(t[0]);
      nav.appendChild(b);
      var sec = document.createElement("div"); sec.className = "tab-section"; sec.id = "section-" + t[0]; sections.appendChild(sec);
    });
    var orig = window.switchTab;
    window.switchTab = function (id) {
      orig(id);
      if (id === "ctleads") CT.leads(document.getElementById("section-ctleads"));
      if (id === "ctscripts") CT.scripts(document.getElementById("section-ctscripts"));
      if (id === "ctteam") CT.team(document.getElementById("section-ctteam"));
    };
    var saved = ""; try { saved = localStorage.getItem("cs_active_tab") || ""; } catch (e) {}
    if (/^ct(leads|scripts|team)$/.test(saved)) window.switchTab(saved);
  }
  CT.addCrmTabs = addCrmTabs;
})();
`;
