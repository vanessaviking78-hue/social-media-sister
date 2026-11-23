// The sales team layer for /crmpage and the team page. One bit of browser code used in two places:
//  1. added to the CRM page when it is served (Vanessa): All leads, Scripts and Sales Team tabs
//  2. inside the team page at /api/crm-team (Dean, Isabella, Leah, Kelly, Rachel): the daily portal
// Written with plain quotes and no template strings, because it travels inside a String.raw block.
export const CRM_TEAM_UI_JS: string = String.raw`
(function () {
  var CT = (window.CT = {});
  var STATUSES = ["New", "Messaged", "Followed up", "Replied", "Call booked", "Signed", "Not relevant"];
  var LIST_NAMES = { sms: "Social Media Sister", hammered: "Hammered", freehold: "Freehold" };
  CT.cfg = { api: "", headers: function () { return {}; }, myName: "", ref: "", lists: ["sms", "hammered", "freehold"], links: null, base: "https://www.thecybersuite.com" };

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
    var t = document.getElementById("toast");
    if (!t) { if (typeof showToast === "function") showToast(msg); return; }
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
  function linkFor(list) {
    var ref = CT.cfg.ref || "";
    if (CT.cfg.links && CT.cfg.links[list]) return CT.cfg.links[list];
    var b = CT.cfg.base;
    if (list === "hammered") return b + "/hammeredfreebies?ref=" + ref;
    if (list === "freehold") return b + "/freeholdfreebies?ref=" + ref;
    return b + "/signup?ref=" + ref;
  }
  function profileUrl(r) { return r.source === "instagram" ? "https://www.instagram.com/" + encodeURIComponent(r.handle) + "/" : "https://www.tiktok.com/@" + encodeURIComponent(r.handle); }
  function dmUrl(r) { return r.source === "instagram" ? "https://ig.me/m/" + encodeURIComponent(r.handle) : profileUrl(r); }
  function addWorkingDays(iso, n) {
    var d = new Date(iso + "T12:00:00Z"), left = n;
    while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); var w = d.getUTCDay(); if (w !== 0 && w !== 6) left--; }
    return d.toISOString().slice(0, 10);
  }

  /* ====================== ALL LEADS (Vanessa) ====================== */
  var L = { source: "all", list: "all", status: "New", q: "", page: 0, data: null, root: null };

  CT.leads = function (root) {
    L.root = root;
    root.innerHTML =
      '<div class="card"><h2>All leads</h2>' +
      '<p class="hint">Every lead the team can be given. Each person is handed 50 new ones a day from their own business lists. Change a status here if you need to step in.</p>' +
      '<div id="ctl-counts" class="ct-counts"></div>' +
      '<div class="list-toolbar">' +
      '<select id="ctl-list"><option value="all">Every business</option><option value="sms">Social Media Sister</option><option value="hammered">Hammered</option><option value="freehold">Freehold</option></select>' +
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
    root.querySelector("#ctl-list").value = L.list;
    root.querySelector("#ctl-q").value = L.q;
    root.querySelector("#ctl-source").onchange = function () { L.source = this.value; L.page = 0; loadLeads(); };
    root.querySelector("#ctl-list").onchange = function () { L.list = this.value; L.page = 0; loadLeads(); };
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
    var qs = "?source=" + encodeURIComponent(L.source) + "&list=" + encodeURIComponent(L.list) + "&status=" + encodeURIComponent(L.status) + "&q=" + encodeURIComponent(L.q) + "&page=" + L.page;
    req("GET", "/crm-team/leads" + qs).then(function (d) {
      L.data = d; msg.textContent = d.rows.length ? "" : "Nothing here yet.";
      drawLeads();
    }, function (e) { msg.textContent = e.message; });
  }

  function drawLeads() {
    var d = L.data, root = L.root, counts = d.counts || {};
    root.querySelector("#ctl-counts").innerHTML = STATUSES.map(function (s) {
      return '<span class="ct-pill"><b>' + (counts[s] || 0) + "</b> " + esc(s) + "</span>";
    }).join("");
    root.querySelector("#ctl-body").innerHTML = d.rows.map(function (r) {
      var key = esc(r.source + "|" + r.handle);
      var who = r.assignedTo ? '<div class="ct-by">With ' + esc(r.assignedTo) + (r.owner ? ", last changed by " + esc(r.owner) : "") + "</div>" : "";
      return '<tr><td><a class="profile-link" href="' + profileUrl(r) + '" target="_blank" rel="noopener">@' + esc(r.handle) + '</a><div class="ct-by">' + esc(LIST_NAMES[r.list] || r.list) + ", " + (r.source === "instagram" ? "Instagram" : "TikTok") + "</div></td>" +
        '<td><select data-k="' + key + '" data-f="status">' + STATUSES.map(function (s) { return '<option' + (s === r.status ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select>" + who + "</td>" +
        '<td><input type="text" data-k="' + key + '" data-f="note" value="' + esc(r.note) + '" placeholder="Add a note"></td>' +
        '<td><a class="btn-copy ct-open" href="' + dmUrl(r) + '" target="_blank" rel="noopener">' + (r.source === "instagram" ? "Open DM" : "Open profile") + "</a></td></tr>";
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
  var SCRIPTS = {
    sms: [
      {
        id: "hello", title: "First hello", when: "Someone you have not spoken to yet.",
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
        id: "chase", title: "Follow up (the one chase)", when: "They have not replied. You only get to send this once, so make it a good one.",
        msg: "Hi [name], it's [my name] again. I was thinking about you this morning. Did you get a chance to see my last message? I have a few spaces coming up and I'd love one of them to be yours. Shall I send you the details?",
        voice: "Hi [name], it's [my name] from Social Media Sister. I just wanted to check in. I sent you a message the other day and I'd love to hear what you think. If it sounds useful, I can tell you how we can look after your page every week. Give me a shout back whenever suits.",
        call: [
          "Opener: Hi [name], it's [my name] from Social Media Sister. I messaged you the other day and wanted to say hello properly.",
          "Ask: Is looking after your social media something you would like off your plate?",
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
      }
    ],
    hammered: [
      {
        id: "hhello", title: "First hello", when: "A builder or tradesperson you have not spoken to yet.",
        msg: "Hi [name], it's [my name] from Hammered. We help builders and tradespeople get more work from their social media without it taking over their evenings. I had a look at your page and your work looks great. Who looks after your posting at the moment, you or somebody else?",
        voice: "Hi [name], it's [my name] from Hammered. Just a quick hello. I had a look at your page and your work looks brilliant. I'd love to know who looks after your social media at the moment. Send me a message or a voicenote back, whichever is easiest when you're on the tools. Speak soon.",
        call: [
          "Opener: Hi [name], it's [my name] from Hammered. Have you got two minutes? I'll be quick, I know you're busy.",
          "Ask: Who looks after your social media at the moment?",
          "Ask: Does it bring you any work, or does it just sit there?",
          "Listen, then say it back to them so they know you heard.",
          "Bridge: Hammered is social media made for the building trade. Vanessa has worked on a building site herself and has worked with over 500 businesses.",
          "Offer: Can I send you a little bundle of free stuff to try, so you can see how it works?",
          "Close: Lovely. What is the best number or Instagram to send it to?"
        ]
      },
      {
        id: "hchase", title: "Follow up (the one chase)", when: "They have not replied. You only get to send this once.",
        msg: "Hi [name], it's [my name] again from Hammered. I know you're flat out so I'll keep it short. Did you see my last message? I have a little bundle of freebies for you to try, no strings: [link]",
        voice: "Hi [name], it's [my name] from Hammered. I'll keep this short because I know you're busy. I sent you a message the other day about your social media. I've got a little bundle of freebies for you to try. I'll drop the link in a message. Give me a shout back if you've got any questions.",
        call: [
          "Opener: Hi [name], it's [my name] from Hammered. I messaged you the other day and thought I'd say hello properly.",
          "Say: I've got a little bundle of freebies for tradespeople to try.",
          "Ask: Would that be useful for your page?",
          "Close: I'll send the link now. Have a look when you've got a minute and tell me what you think."
        ]
      },
      {
        id: "hclose", title: "Ready to start", when: "They have said yes or asked how to begin.",
        msg: "Brilliant, [name], that's great news. Here is your link to get started: [link]. Pop your details in and we'll get you set up. Anything you want to ask me first, I'm here.",
        voice: "That's great news, [name]. I'm sending you the link in a message now. Pop your details in and we'll get you set up. If you have any questions, send me a voicenote and I'll come straight back to you.",
        call: [
          "Congratulate them: That's great news, [name].",
          "Say what happens next: I'll send you a link, you pop your details in, and we get you set up.",
          "Your numbers: the usual price is 300 a month and you can go down to 250 to win the deal.",
          "Send the link straight away while you are still on the phone.",
          "End warmly: Thank you, we'll look after you."
        ]
      }
    ],
    freehold: [
      {
        id: "fhello", title: "First hello", when: "A pub or bar you have not spoken to yet.",
        msg: "Hi [name], it's [my name] from Freehold Socials. We make social media content for pubs and bars, so there is always something good to post for your regulars. I had a look at your page. Who looks after your posting at the moment, you or somebody on the team?",
        voice: "Hi [name], it's [my name] from Freehold Socials. Just a quick hello. We make social media content for pubs and bars so you always have something to post. I had a look at your page and I'd love to know who looks after it at the moment. Send me a message or a voicenote back whenever you get a minute. Cheers.",
        call: [
          "Opener: Hi [name], it's [my name] from Freehold Socials. Have you got two minutes? I'll be quick, I know it gets busy.",
          "Ask: Who looks after your social media at the moment?",
          "Ask: How often do you post, and does it bring people through the door?",
          "Listen, then say it back to them so they know you heard.",
          "Bridge: Freehold Socials gives pubs and bars content ready to post, so it stops being another job.",
          "Offer: Can I send you a few free posts so you can see what it looks like for your pub?",
          "Close: Lovely. What is the best number or Instagram to send them to?"
        ]
      },
      {
        id: "fchase", title: "Follow up (the one chase)", when: "They have not replied. You only get to send this once.",
        msg: "Hi [name], it's [my name] again from Freehold Socials. I'll keep it short. Did you see my last message? I'd love you to try our free pub posts and see what you think: [link]",
        voice: "Hi [name], it's [my name] from Freehold Socials. I sent you a message the other day about your pub's social media. I'd love you to try some free posts and see what you think. I'll drop the link in a message. Cheers, and have a good service.",
        call: [
          "Opener: Hi [name], it's [my name] from Freehold Socials. I messaged you the other day and thought I'd say hello properly.",
          "Say: I've got some free pub posts for you to try.",
          "Ask: Would that save you a job?",
          "Close: I'll send the link now. Have a look when it's quiet and tell me what you think."
        ]
      },
      {
        id: "fclose", title: "Ready to start", when: "They have said yes or asked how to begin.",
        msg: "Brilliant, [name], that's great news. Here is your link to get started: [link]. Pop your details in and we'll get you set up. Anything you want to ask first, I'm here.",
        voice: "That's great news, [name]. I'm sending you the link in a message now. Pop your details in and we'll get you set up. If you have any questions, send me a voicenote and I'll come straight back to you.",
        call: [
          "Congratulate them: That's great news, [name].",
          "Say what happens next: I'll send you a link, you pop your details in, and we get you set up.",
          "Your numbers: Freehold Socials is 49 a month.",
          "Send the link straight away while you are still on the phone.",
          "End warmly: Thank you, we'll look after you."
        ]
      }
    ]
  };
  var NUMBERS = {
    sms: "The usual price is 500 a month and you can go down to 350 to win the deal. Black Friday packages are 6 months for the price of 4 and 12 months for the price of 6. You earn 25% of anything you bring in, at the time of sign up.",
    hammered: "The usual price is 300 a month and you can go down to 250 to win the deal. You earn 20% of the first 3 months' fee, at the time of sign up.",
    freehold: "Freehold Socials is 49 a month."
  };

  var COMMENTS = {
    sms: [
    "Best post I have seen all day.",
    "Great to see you getting your face out there. It really works.",
    "This made me smile. Thank you for sharing it.",
    "Love this so much. Saving it for later.",
    "Your page is gorgeous. Everything looks so welcoming.",
    "I needed to see this today. Thank you.",
    "Such a lovely way to put it. Well said.",
    "The photos here are stunning. Who took them?",
    "Brilliant idea. I am stealing this one.",
    "You always show up so consistently. It really shows.",
    "This is exactly the sort of thing I love seeing on my feed.",
    "Honestly, one of the best pages I have come across this month.",
    "Congratulations, this is well deserved.",
    "Your clients are so lucky to have you.",
    "Love the honesty in this. So refreshing.",
    "What a transformation. Brilliant work.",
    "This deserves so many more likes. Sharing it.",
    "I love your style. Everything on your page feels like you.",
    "Great tip. I did not know that. Thank you.",
    "Happy Monday to you. Your posts always brighten my feed."
    ],
    hammered: [
      "Cracking job. The finish on that is spot on.",
      "That is some proper craftsmanship. Well done.",
      "Best before and after I have seen all day.",
      "Great to see you getting your face out there. Customers love seeing who is behind the work.",
      "Neat as anything. Your attention to detail really shows.",
      "Love a tidy site. That says a lot about you.",
      "Now that is how it is done. Brilliant work.",
      "The transformation is unreal. What a difference.",
      "Nice to see a proper tradesperson showing the work. Keep them coming.",
      "Your customers are going to be made up with that.",
      "Stunning finish. Where was this one?",
      "Great page. Everything looks so professional.",
      "Class work. Saving this for ideas.",
      "This is why I rate local trades. Brilliant job.",
      "Cracking team photo. Looks like a great crew.",
      "Another one ticked off. Congratulations on the finished job.",
      "I love seeing the process as well as the result. Great post.",
      "That took some skill. Proper impressed.",
      "Good on you for sharing this. More builders should.",
      "Looks like the sun came out for you. Great shot of the job."
    ],
    freehold: [
      "Looks like the perfect pub. I want a pint right now.",
      "Best looking pint I have seen all day.",
      "Great to see the team getting out there on your page. It makes the place feel so welcoming.",
      "What a cracking atmosphere. Looks like a brilliant night.",
      "That menu sounds amazing. Adding it to my list.",
      "Love the interior. So cosy.",
      "This is the pub I want on my street.",
      "Brilliant event idea. Wish I could be there.",
      "Your Sunday roast looks unreal. Saving this for the weekend.",
      "Great photo. You can almost smell the food.",
      "Love that you support local. That is what makes a proper pub.",
      "Looks like the best quiz night in town.",
      "The garden looks lovely. Perfect for a sunny afternoon.",
      "Cheers for sharing. Your page is a joy to scroll.",
      "That cocktail looks incredible. What is in it?",
      "Congratulations on the award. Well deserved.",
      "The staff here are always so friendly. Great team.",
      "Now that is a proper beer garden.",
      "Live music sounds fantastic. See you there.",
      "Your pub always looks so inviting. Brilliant page."
    ]
  };
  var E = { list: "" };
  var S = { name: "", list: "", mode: {}, rec: null, root: null };

  function myLists() { return CT.cfg.lists && CT.cfg.lists.length ? CT.cfg.lists : ["sms"]; }
  function fill(text) {
    var nm = (S.name || "").trim() || "there";
    return String(text).replace(/\[name\]/g, nm).replace(/\[my name\]/g, firstName()).replace(/\[link\]/g, linkFor(S.list));
  }

  CT.scripts = function (root) {
    S.root = root;
    var lists = myLists();
    if (!S.list || lists.indexOf(S.list) < 0) S.list = lists[0];
    root.innerHTML =
      '<div class="card"><h2>Scripts</h2>' +
      '<p class="hint">Pick a script, type the first name of the person you are talking to, then copy the message, record a voicenote or use the phone call prompts. Your name and your own link fill in by themselves.</p>' +
      '<div class="ct-modes" id="cts-lists"></div>' +
      '<div class="form-row"><label class="field">Their first name<input type="text" id="cts-name" placeholder="For example Sarah"></label></div>' +
      '<div class="ct-numbers"><b>Your numbers.</b> <span id="cts-numbers"></span><br>Your link for this business: <span id="cts-link"></span> <button class="btn-copy" id="cts-copylink">Copy my link</button></div>' +
      '<div id="cts-list"></div></div>';
    root.querySelector("#cts-name").value = S.name;
    root.querySelector("#cts-name").oninput = function () { S.name = this.value; drawScripts(); };
    root.querySelector("#cts-copylink").onclick = function () { copy(this, linkFor(S.list)); };
    drawScripts();
  };

  function drawScripts() {
    var root = S.root; if (!root) return;
    var lists = myLists();
    root.querySelector("#cts-lists").innerHTML = lists.length > 1 ? lists.map(function (l) {
      return '<button class="ct-mode' + (l === S.list ? " on" : "") + '" data-list="' + l + '">' + esc(LIST_NAMES[l]) + "</button>";
    }).join("") : "";
    root.querySelector("#cts-numbers").textContent = NUMBERS[S.list] || "";
    root.querySelector("#cts-link").textContent = linkFor(S.list);
    var host = root.querySelector("#cts-list");
    host.innerHTML = (SCRIPTS[S.list] || []).map(function (s) {
      var mode = S.mode[s.id] || "msg", body;
      if (mode === "msg") {
        body = '<div class="dm-body">' + esc(fill(s.msg)) + '</div><button class="btn-copy" data-copy="' + s.id + '">Copy message</button> <span class="ct-by">Paste it into Instagram, TikTok or WhatsApp.</span>';
      } else if (mode === "voice") {
        body = '<div class="dm-body">' + esc(fill(s.voice)) + '</div>' +
          '<div class="ct-rec"><button class="btn-primary" data-rec="' + s.id + '">' + (S.rec && S.rec.id === s.id ? "Stop recording" : "Record a voicenote") + '</button>' +
          '<span id="ct-rec-' + s.id + '"></span></div>' +
          '<div class="ct-by">Read it out in your own words. You can also just use the voicenote button inside Instagram or WhatsApp.</div>';
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

  function findScript(id) {
    var all = (SCRIPTS[S.list] || []);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
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

  /* ====================== THE DAILY PORTAL (team) ====================== */
  var P = { root: null, d: null, tab: "today" };

  CT.portal = function (root) {
    P.root = root;
    root.innerHTML = '<div class="empty-note">Loading your day...</div>';
    req("GET", "/crm-team/day").then(function (d) {
      P.d = d;
      CT.cfg.lists = d.me.lists; CT.cfg.links = d.me.links; CT.cfg.myName = d.me.name; CT.cfg.ref = d.me.slug;
      drawPortal();
    }, function (e) { root.innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
  };

  function view() {
    var d = P.d, t = d.today;
    var rows = d.rows;
    return {
      today: rows.filter(function (r) { return r.status === "New"; }),
      due: rows.filter(function (r) { return r.status === "Messaged" && r.followupDue && r.followupDue <= t; }),
      waiting: rows.filter(function (r) { return r.status === "Messaged" && !(r.followupDue && r.followupDue <= t); }),
      replied: rows.filter(function (r) { return r.status === "Replied"; }),
      booked: rows.filter(function (r) { return r.status === "Call booked"; }),
      signed: rows.filter(function (r) { return r.status === "Signed"; })
    };
  }

  function drawPortal() {
    var d = P.d, v = view(), root = P.root;
    var bookedCount = v.replied.length + v.booked.length + (d.linkBookings || []).length;
    var tabs = [
      ["today", "Today", v.today.length],
      ["followup", "Follow up", v.due.length],
      ["booked", "Call booked", bookedCount],
      ["engage", "Engage", null],
      ["scripts", "Scripts", null],
      ["start", "Start here", null]
    ];
    var nav = '<nav class="tabs">' + tabs.map(function (t) {
      return '<button data-ptab="' + t[0] + '" class="' + (P.tab === t[0] ? "active" : "") + '">' + t[1] + (t[2] != null ? " (" + t[2] + ")" : "") + "</button>";
    }).join("") + "</nav>";
    root.innerHTML = nav + '<div id="ptab-body"></div>';
    var body = root.querySelector("#ptab-body");
    if (P.tab === "today") body.innerHTML = todayHtml(v);
    else if (P.tab === "followup") body.innerHTML = followupHtml(v);
    else if (P.tab === "booked") body.innerHTML = bookedHtml(v);
    else if (P.tab === "engage") body.innerHTML = engageHtml();
    else if (P.tab === "scripts") { var h = document.createElement("div"); body.appendChild(h); CT.scripts(h); }
    else body.innerHTML = startHtml();
  }

  function rowHtml(r, buttons, extra) {
    return '<div class="ct-row"><div class="ct-who"><a class="profile-link" href="' + profileUrl(r) + '" target="_blank" rel="noopener">@' + esc(r.handle) + '</a>' +
      '<span class="ct-tag">' + esc(LIST_NAMES[r.list] || r.list) + "</span>" + (r.source === "tiktok" ? '<span class="ct-tag">TikTok</span>' : "") + "</div>" +
      '<div class="ct-acts"><a class="btn-copy ct-open" href="' + dmUrl(r) + '" target="_blank" rel="noopener">' + (r.source === "instagram" ? "Open DM" : "Open profile") + "</a>" + buttons + "</div>" + (extra || "") + "</div>";
  }
  function actBtn(r, status, label, cls) {
    return '<button class="ct-act ' + (cls || "") + '" data-act="' + esc(status) + '" data-k="' + esc(r.source + "|" + r.handle) + '">' + esc(label) + "</button>";
  }
  function emptyListsNote() {
    var e = P.d.emptyLists || [];
    if (!e.length) return "";
    return '<div class="ct-numbers">Your ' + e.map(function (l) { return esc(LIST_NAMES[l]); }).join(" and ") + " leads are on their way. Vanessa is loading them. Until then you will see the other leads.</div>";
  }

  function todayHtml(v) {
    var d = P.d, quota = d.quota, done = d.messagedToday;
    var pct = Math.min(100, Math.round((done / quota) * 100));
    var h = '<div class="card"><h2>Today</h2>' +
      '<div class="ct-prog"><b>' + done + " of " + quota + "</b> messaged today<div class=\"ct-bar\"><div style=\"width:" + pct + '%"></div></div></div>' +
      (v.due.length ? '<div class="ct-alert">You have ' + v.due.length + ' follow up' + (v.due.length === 1 ? "" : "s") + ' due. <button class="ct-link" data-ptab="followup">Do those first</button></div>' : "") +
      emptyListsNote() +
      '<p class="hint">Open the DM, send your message from the Scripts tab, then tick Messaged. Tick every one, even if you do not hear back. Skip anyone who is not a good fit.</p>';
    if (!v.today.length) h += '<div class="empty-note">' + (done ? "All done for today. Brilliant work. New leads arrive tomorrow." : "No leads yet. Check back soon.") + "</div>";
    h += v.today.map(function (r) { return rowHtml(r, actBtn(r, "Messaged", "Messaged", "go") + actBtn(r, "Not relevant", "Skip", "quiet")); }).join("");
    return h + "</div>";
  }

  function followupHtml(v) {
    var h = '<div class="card"><h2>Follow up</h2><p class="hint">Each person shows up here once, 3 working days after you messaged them. Send one friendly follow up from the Scripts tab, then tick Followed up. After that they never come back, so you are never chasing.</p>';
    if (!v.due.length) h += '<div class="empty-note">Nothing due right now.' + (v.waiting.length ? " " + v.waiting.length + " more will appear on their day." : "") + "</div>";
    h += v.due.map(function (r) {
      return rowHtml(r, actBtn(r, "Followed up", "Followed up", "go") + actBtn(r, "Replied", "They replied", "") + actBtn(r, "Not relevant", "Skip", "quiet"));
    }).join("");
    if (v.due.length && v.waiting.length) h += '<div class="ct-by" style="margin-top:10px;">' + v.waiting.length + " more waiting for their day.</div>";
    return h + "</div>";
  }

  function bookedHtml(v) {
    var d = P.d;
    var h = '<div class="card"><h2>Replies and calls</h2><p class="hint">When someone replies, tick They replied. Once a call is in the diary, tick Call booked. Anyone who books through your own link appears here by themselves.</p>';
    h += '<h3 class="ct-h3">Replied, ready to book (' + v.replied.length + ")</h3>";
    h += v.replied.length ? v.replied.map(function (r) { return rowHtml(r, actBtn(r, "Call booked", "Call booked", "go") + actBtn(r, "Not relevant", "Skip", "quiet")); }).join("") : '<div class="empty-note">Nobody waiting.</div>';
    h += '<h3 class="ct-h3">Call booked (' + v.booked.length + ")</h3>";
    h += v.booked.length ? v.booked.map(function (r) {
      return rowHtml(r, "", '<input type="text" class="ct-note" data-note="' + esc(r.source + "|" + r.handle) + '" value="' + esc(r.note) + '" placeholder="When is the call? Any notes">');
    }).join("") : '<div class="empty-note">No calls booked yet.</div>';
    var lb = d.linkBookings || [];
    h += '<h3 class="ct-h3">Booked through your link (' + lb.length + ")</h3>";
    h += lb.length ? lb.map(function (b) {
      return '<div class="ct-row"><div class="ct-who"><b>' + esc(b.lead) + "</b> " + esc(b.clinic) + '</div><div class="ct-by">' + esc(b.contact) + ", " + esc(b.stage) + ", " + esc(String(b.created).slice(0, 10)) + "</div></div>";
    }).join("") : '<div class="empty-note">Nobody yet. Put your own link in your messages.</div>';
    return h + "</div>";
  }

  function engageHtml() {
    var lists = P.d.me.lists;
    if (!E.list || lists.indexOf(E.list) < 0) E.list = lists[0];
    var arr = COMMENTS[E.list];
    var h = '<div class="card"><h2>Engage</h2><p class="hint">Warm people up before you message them. Like and comment on 3 of their recent posts first, so your name is already familiar when your DM lands. Tap a comment to copy it, then paste it on their post. Change a word or two each time so it never looks copied.</p>' +
      '<div class="ct-numbers"><b>Daily habit.</b> Comment on 10 posts before you start your 50 messages. Pick the business at the top so the comments suit who you are talking to. Always comment as a person, never mention selling.</div>';
    if (lists.length > 1) h += '<div class="ct-modes">' + lists.map(function (l) { return '<button class="ct-mode' + (l === E.list ? " on" : "") + '" data-elist="' + l + '">' + esc(LIST_NAMES[l]) + "</button>"; }).join("") + "</div>";
    h += arr.map(function (c, i) {
      return '<div class="ct-row"><div class="ct-who"><b>' + (i + 1) + '.</b> ' + esc(c) + '</div><div class="ct-acts"><button class="btn-copy" data-copyc="' + i + '">Copy</button></div></div>';
    }).join("");
    return h + "</div>";
  }

  function startHtml() {
    var d = P.d, lists = d.me.lists;
    var links = lists.map(function (l) { return "<li><b>" + esc(LIST_NAMES[l]) + ":</b> " + esc(linkFor(l)) + "</li>"; }).join("");
    var nums = lists.map(function (l) { return "<li><b>" + esc(LIST_NAMES[l]) + ":</b> " + esc(NUMBERS[l]) + "</li>"; }).join("");
    return '<div class="card ct-start"><h2>Start here</h2>' +
      '<p class="hint">Welcome, ' + esc(firstName()) + ". This takes about five minutes to learn, then it is the same routine every day.</p>" +
      "<ol>" +
      "<li><b>Log in</b> with your name and your password. Your password is your name in lower case followed by botox, for example isabellabotox.</li>" +
      "<li><b>Today.</b> You get 50 new people every morning. Each one has an Open DM button. Open it, send a message from the Scripts tab, then tick <b>Messaged</b>.</li>" +
      "<li><b>Tick every one,</b> even if you do not hear back. If someone is not a good fit, tick <b>Skip</b> and they disappear.</li>" +
      "<li><b>Follow up.</b> Three working days after you message someone, they appear in the Follow up tab. Send one friendly follow up, then tick <b>Followed up</b>. That is the only reminder they ever get, so you never chase twice.</li>" +
      "<li><b>Replies.</b> Check your Instagram inbox (the pink button at the top). When someone replies, tick <b>They replied</b> in the Follow up tab or find them in Call booked. Once a call is in the diary, tick <b>Call booked</b>.</li>" +
      "<li><b>Always use your own link</b> when you send one. That is how your sign ups are counted and how your commission is worked out.</li>" +
      "<li><b>Engage.</b> Before you message people, like and comment on a few of their posts using the ready made comments in the Engage tab. It warms them up.</li>" +
      "<li><b>Scripts.</b> Every script has three versions: a message you copy, a voicenote script, and a phone call guide. Type their first name and everything fills in.</li>" +
      "</ol>" +
      "<h3 class=\"ct-h3\">Your links</h3><ul>" + links + "</ul>" +
      "<h3 class=\"ct-h3\">Your numbers</h3><ul>" + nums + "</ul>" +
      '<p class="hint">If anything looks wrong or you get stuck, message Vanessa.</p>' +
      '<button class="btn-ghost" onclick="window.print()">Print these instructions</button></div>';
  }

  function applyLocal(k, status) {
    var d = P.d, i, r = null;
    for (i = 0; i < d.rows.length; i++) { if (d.rows[i].source + "|" + d.rows[i].handle === k) { r = d.rows[i]; break; } }
    if (!r) return;
    if (status === "Messaged") {
      r.status = "Messaged"; d.messagedToday++;
      r.followupDue = r.followedUp ? null : addWorkingDays(d.today, 3);
    } else if (status === "Followed up" || status === "Not relevant") {
      d.rows.splice(i, 1);
    } else { r.status = status; r.followupDue = null; }
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var pt = t.getAttribute("data-ptab");
    if (pt && P.root) { P.tab = pt; drawPortal(); window.scrollTo(0, 0); return; }
    var act = t.getAttribute("data-act");
    if (act && P.d) {
      var k = t.getAttribute("data-k"), parts = k.split("|");
      t.disabled = true;
      req("PUT", "/crm-team/leads/" + encodeURIComponent(parts[0]) + "/" + encodeURIComponent(parts[1]), { status: act }).then(function () {
        applyLocal(k, act); drawPortal();
      }, function (e) { t.disabled = false; toast(e.message); });
      return;
    }
    var el = t.getAttribute("data-elist");
    if (el) { E.list = el; drawPortal(); return; }
    var cc = t.getAttribute("data-copyc");
    if (cc !== null) { copy(t, COMMENTS[E.list][parseInt(cc, 10)]); return; }
    var ln = t.getAttribute("data-list");
    if (ln) { S.list = ln; drawScripts(); return; }
    var m = t.getAttribute("data-mode");
    if (m) { var p = m.split("|"); S.mode[p[0]] = p[1]; drawScripts(); return; }
    var c = t.getAttribute("data-copy");
    if (c) { var s = findScript(c); if (s) copy(t, fill(s.msg)); return; }
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

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var nk = t.getAttribute("data-note");
    if (nk) {
      var parts = nk.split("|");
      req("PUT", "/crm-team/leads/" + encodeURIComponent(parts[0]) + "/" + encodeURIComponent(parts[1]), { note: t.value }).then(function () {
        for (var i = 0; i < P.d.rows.length; i++) if (P.d.rows[i].source + "|" + P.d.rows[i].handle === nk) P.d.rows[i].note = t.value;
        toast("Saved");
      }, function (e) { toast(e.message); });
    }
  });

  /* ====================== SALES TEAM (Vanessa only) ====================== */
  CT.team = function (root) {
    root.innerHTML = '<div class="card"><h2>Sales team</h2><p class="hint">Each person has their own link to the team CRM and their own password (their name in lower case followed by botox). Dean sells Hammered and Freehold. Isabella, Leah, Kelly and Rachel sell Social Media Sister and Hammered. Rob and Vanessa can work all three.</p><div id="ctt-body" class="empty-note">Loading...</div></div>' +
      '<div class="card"><h2>Add leads</h2><p class="hint">Paste usernames, one per line (with or without the @), and choose which business they are for. Each person is then handed 50 a day from their own businesses.</p>' +
      '<div class="form-row"><label class="field">Business<select id="cti-list"><option value="hammered">Hammered</option><option value="freehold">Freehold</option><option value="sms">Social Media Sister</option></select></label>' +
      '<label class="field">Where from<select id="cti-source"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select></label></div>' +
      '<textarea id="cti-text" rows="8" style="width:100%;" placeholder="@username1&#10;@username2"></textarea>' +
      '<div style="margin-top:8px;"><button class="btn-primary" id="cti-go">Add these leads</button> <span id="cti-msg" class="ct-by"></span></div></div>';
    root.querySelector("#cti-go").onclick = function () {
      var text = root.querySelector("#cti-text").value;
      var msg = root.querySelector("#cti-msg"); msg.textContent = "Adding...";
      req("POST", "/crm-team/import", { list: root.querySelector("#cti-list").value, source: root.querySelector("#cti-source").value, text: text }).then(function (d) {
        msg.textContent = "Added " + d.added + " new leads (" + d.skipped + " skipped as already in the system).";
        root.querySelector("#cti-text").value = ""; CT.team(root);
      }, function (e) { msg.textContent = e.message; });
    };
    req("GET", "/crm-team/summary").then(function (d) {
      var origin = d.origin || "";
      var rows = d.team.map(function (m) {
        var teamLink = origin + "/api/crm-team?who=" + m.slug;
        return "<tr><td><b>" + esc(m.name) + "</b><div class=\"ct-by\">" + m.lists.map(function (l) { return esc(LIST_NAMES[l]); }).join(", ") + "</div></td>" +
          '<td><a class="profile-link" href="' + esc(teamLink) + '" target="_blank" rel="noopener">Team CRM link</a> <button class="btn-copy" data-cp="' + esc(teamLink) + '">Copy</button><div class="ct-by">Password: ' + esc(m.password || m.slug + "botox") + "</div></td>" +
          "<td>" + m.messaged + "</td><td>" + m.followed + "</td><td>" + m.replied + "</td><td>" + m.booked + "</td><td>" + m.signed + "</td></tr>";
      }).join("");
      var stock = d.stock.map(function (s) { return "<b>" + esc(LIST_NAMES[s.list]) + ":</b> " + s.total + " leads, " + s.left + " not given out yet"; }).join(" &nbsp;|&nbsp; ");
      root.querySelector("#ctt-body").innerHTML = '<div class="ct-numbers">' + stock + "</div>" +
        '<table><thead><tr><th>Who</th><th>Their link</th><th>Messaged</th><th>Followed up</th><th>Replied</th><th>Call booked</th><th>Signed</th></tr></thead><tbody>' + rows + "</tbody></table>" +
        '<p class="hint" style="margin-top:12px;">Sign ups through their own links are counted on the sales dashboards. Signed is only counted once you have confirmed it there.</p>';
      root.querySelector("#ctt-body").className = "";
      root.querySelectorAll("[data-cp]").forEach(function (b) { b.onclick = function () { copy(b, b.getAttribute("data-cp")); }; });
    }, function (e) { root.querySelector("#ctt-body").textContent = e.message; });
  };

  CT.css =
    ".ct-counts{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}" +
    ".ct-pill{background:#000;color:#e6007e;border-radius:99px;padding:5px 12px;font-size:13px;font-weight:800}.ct-pill b{color:#fff}" +
    ".ct-by{font-size:12px;color:#6b6b6b;font-weight:600}" +
    ".ct-open{display:inline-block;padding:8px 12px;border-radius:10px;color:#000;font-weight:800;font-size:13px;text-decoration:none}" +
    ".ct-modes{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}" +
    ".ct-mode{background:#fff;color:#000;border:2px solid #000;padding:6px 12px;font-size:13px}.ct-mode.on{background:#000;color:#e6007e}" +
    ".ct-numbers{background:#fbd9ec;border-radius:12px;padding:12px 14px;font-size:14px;margin-bottom:14px;line-height:1.5}" +
    ".ct-call{margin:0 0 10px;padding-left:20px;font-size:14px;line-height:1.6}" +
    ".ct-rec{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}" +
    ".ct-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid #e4e4e4}" +
    ".ct-who{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:15px}" +
    ".ct-tag{background:#000;color:#e6007e;border-radius:99px;padding:2px 9px;font-size:11px;font-weight:800}" +
    ".ct-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}" +
    ".ct-act{background:#fff;color:#000;border:2px solid #000;padding:8px 12px;font-size:13px}.ct-act.go{background:#000;color:#e6007e}.ct-act.quiet{border-color:#ccc;color:#6b6b6b}" +
    ".ct-act:disabled{opacity:.4}" +
    ".ct-note{flex:1 1 100%;font-size:13px;padding:7px 10px}" +
    ".ct-prog{font-size:15px;margin-bottom:12px}.ct-bar{height:12px;background:#eee;border-radius:99px;overflow:hidden;margin-top:6px}.ct-bar div{height:100%;background:#e6007e}" +
    ".ct-alert{background:#000;color:#e6007e;border-radius:12px;padding:10px 14px;font-weight:800;margin-bottom:12px}" +
    ".ct-link{background:none;border:none;color:#fff;text-decoration:underline;padding:0;font-size:inherit;font-weight:800;cursor:pointer}" +
    ".ct-h3{font-size:17px;margin:18px 0 6px;font-weight:900}" +
    ".ct-start ol{padding-left:20px;line-height:1.7;font-size:15px}.ct-start ul{line-height:1.7;font-size:14px;word-break:break-word}" +
    "@media print{nav.tabs,.who,.card .btn-ghost,.inbox-btn{display:none!important}}";

  /* ====================== ADD THE TABS TO /crmpage (Vanessa) ====================== */
  function addCrmTabs() {
    if (typeof TABS === "undefined" || document.getElementById("navbtn-ctleads")) return;
    var origin = "";
    try { origin = window.parent.location.origin; } catch (e) { origin = window.location.origin; }
    CT.cfg.api = origin + "/api";
    CT.cfg.headers = function () { var pw = ""; try { pw = localStorage.getItem("cybersuite-pw") || ""; } catch (e) {} return { "x-app-password": pw }; };
    CT.cfg.myName = "Vanessa";
    CT.cfg.ref = "vanessa";
    CT.cfg.base = "https://www.thecybersuite.com";
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
