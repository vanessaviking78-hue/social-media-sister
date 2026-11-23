// The Instagram layer for /crmpage. Added to the CRM page when it is served (see routes/crm-page.ts), so the big CRM page itself stays untouched.
// It adds: an Instagram tab (post performance, who is commenting, who has been messaged), an engagement badge and a DM button beside every
// Instagram username in the CRM, and it ticks people off as Sent or Replied in the Black Friday lists once you have messaged them.
// Written with plain quotes and no template strings, because it travels inside a String.raw block.
export const CRM_INSTAGRAM_JS: string = String.raw`
(function () {
  var BF_START = "2026-11-16"; // only DMs from the Black Friday push onwards are ticked off automatically
  var OPEN_KEY = "cs_ig_opened";
  var IG = null, err = "", loading = false, onlyNew = true;

  function apiUrl(force) {
    var origin = "";
    try { origin = window.parent.location.origin; } catch (e) { origin = window.location.origin; }
    return origin + "/api/crm-instagram" + (force ? "?refresh=1" : "");
  }
  function pw() { try { return localStorage.getItem("cybersuite-pw") || ""; } catch (e) { return ""; } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function ago(iso) {
    if (!iso) return "";
    var d = Math.floor((new Date(today()) - new Date(String(iso).slice(0, 10))) / 86400000);
    if (d <= 0) return "today";
    if (d === 1) return "yesterday";
    return d + " days ago";
  }
  function n(v) { return v == null ? "-" : Number(v).toLocaleString("en-GB"); }
  function person(u) { return IG && IG.people ? IG.people[String(u).toLowerCase()] : null; }
  function dmUrl(u) { return "https://ig.me/m/" + encodeURIComponent(u); }

  function markOpened(u) {
    var o = ls(OPEN_KEY, {});
    o[u] = today();
    setLs(OPEN_KEY, o);
    refreshBadges();
  }
  window.csIgOpened = markOpened;

  /* ---------- badges and DM buttons beside every Instagram username ---------- */
  function badgeHtml(u) {
    var p = person(u), bits = [];
    function pill(text, colour) {
      return '<span style="display:inline-block;margin:3px 4px 0 0;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:800;color:#fff;background:' + colour + ';">' + esc(text) + "</span>";
    }
    if (p) {
      if (p.comments) bits.push(pill("Commented " + p.comments + "x", "#e6007e"));
      if (p.dm === "replied") bits.push(pill("Replied to your DM", "#0a8f5a"));
      else if (p.dm === "sent") bits.push(pill("DM sent, no reply", "#6b6b6b"));
      else if (p.dm === "inbound") bits.push(pill(p.dmLastFrom === "them" ? "Messaged you, waiting" : "Chatting", "#E6007E"));
    }
    var opened = ls(OPEN_KEY, {})[u];
    if (opened && (!p || p.dm === "none")) bits.push(pill("DM opened " + ago(opened), "#999"));
    return bits.length ? "<br>" + bits.join("") : "";
  }
  function refreshBadges() {
    var nodes = document.querySelectorAll(".ig-badge");
    for (var i = 0; i < nodes.length; i++) nodes[i].innerHTML = badgeHtml(nodes[i].getAttribute("data-u"));
  }
  function decorate() {
    var links = document.querySelectorAll("a.profile-link");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-ig")) continue;
      var m = /instagram\.com\/([A-Za-z0-9._]+)/.exec(a.getAttribute("href") || "");
      if (!m || /^(p|reel|reels|tv|stories|explore|accounts)$/i.test(m[1])) continue;
      a.setAttribute("data-ig", "1");
      var u = m[1];
      var dm = document.createElement("a");
      dm.className = "profile-link";
      dm.href = dmUrl(u);
      dm.target = "_blank";
      dm.rel = "noopener";
      dm.textContent = "DM";
      dm.style.marginLeft = "10px";
      dm.style.fontWeight = "800";
      dm.setAttribute("data-u", u);
      dm.addEventListener("click", function (ev) { markOpened(ev.currentTarget.getAttribute("data-u")); });
      a.parentNode.insertBefore(dm, a.nextSibling);
      var tr = a.closest("tr");
      var td = tr ? tr.querySelector("td") : null;
      if (td && !td.querySelector(".ig-badge")) {
        var b = document.createElement("span");
        b.className = "ig-badge";
        b.setAttribute("data-u", u);
        b.innerHTML = badgeHtml(u);
        td.appendChild(b);
      }
    }
  }

  /* ---------- tick people off in the Black Friday lists once they have been messaged ---------- */
  function knownPeople() {
    var set = {};
    try {
      (DATA.followers || []).forEach(function (u) { set[String(u).toLowerCase()] = 1; });
      (DATA.following || []).forEach(function (u) { set[String(u).toLowerCase()] = 1; });
      ls("cs_bf_warm", []).forEach(function (u) { set[String(u).toLowerCase()] = 1; });
    } catch (e) {}
    return set;
  }
  function excluded() {
    var out = {};
    ["cs_actions_followers", "cs_actions_following"].forEach(function (k) {
      var s = ls(k, {});
      Object.keys(s).forEach(function (u) {
        var a = s[u] && s[u].action;
        if (a === "Existing Client" || a === "Not Relevant") out[u.toLowerCase()] = 1;
      });
    });
    return out;
  }
  function syncStatuses() {
    if (!IG || !IG.people) return;
    var known = knownPeople(), skip = excluded();
    var st = ls("cs_bf_status", {}), changed = 0;
    Object.keys(IG.people).forEach(function (u) {
      var p = IG.people[u];
      if ((p.dm !== "sent" && p.dm !== "replied") || !known[u] || skip[u]) return;
      var date = String(p.dmLastAt || "").slice(0, 10);
      if (!date || date < BF_START) return;
      var cur = st[u];
      if (!cur) {
        st[u] = { s: p.dm === "replied" ? "replied" : "sent", sd: date, d: date, w: "ig" };
        changed++;
      } else if (cur.s === "sent" && p.dm === "replied") {
        cur.s = "replied";
        cur.d = today();
        changed++;
      }
    });
    if (changed) {
      setLs("cs_bf_status", st);
      if (typeof renderBlackFridaySection === "function") renderBlackFridaySection();
      if (typeof showToast === "function") showToast(changed + " updated from Instagram");
    }
  }

  /* ---------- the Instagram tab ---------- */
  function box(num, lab) { return '<div class="box"><div class="num">' + num + '</div><div class="lab">' + lab + "</div></div>"; }
  function btn(u) {
    return '<a class="profile-link" data-ig="1" style="font-weight:800;" href="' + dmUrl(u) + '" target="_blank" rel="noopener" onclick="csIgOpened(\'' + esc(u) + '\')">DM</a>' +
      ' &nbsp; <a class="profile-link" data-ig="1" href="https://www.instagram.com/' + encodeURIComponent(u) + '/" target="_blank" rel="noopener">Profile</a>';
  }
  function stateLabel(p) {
    if (p.dm === "replied") return "They replied";
    if (p.dm === "sent") return "You messaged, no reply";
    if (p.dm === "inbound") return p.dmLastFrom === "them" ? "They messaged you" : "You are chatting";
    return "Not messaged";
  }
  function table(head, rows) {
    return '<table><thead><tr>' + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table>";
  }

  function renderTab() {
    var sec = document.getElementById("section-instagram");
    if (!sec) return;
    var h = "";
    if (loading && !IG) { sec.innerHTML = '<div class="card"><h2>Instagram</h2><p class="hint">Reading your Instagram...</p></div>'; return; }
    if (err && !IG) { sec.innerHTML = '<div class="card"><h2>Instagram</h2><p class="hint">' + esc(err) + '</p><button class="btn-primary" onclick="csIgRefresh()">Try again</button></div>'; return; }
    if (!IG) return;
    if (!IG.connected) { sec.innerHTML = '<div class="card"><h2>Instagram</h2><p class="hint">' + esc(IG.reason || "Not connected.") + "</p></div>"; return; }

    var people = IG.people || {}, names = Object.keys(people), posts = (IG.posts || []).slice();
    var commenters = names.filter(function (u) { return people[u].comments > 0; });
    var messaged = names.filter(function (u) { return people[u].dm !== "none"; });
    var iMessaged = names.filter(function (u) { return people[u].dm === "sent" || people[u].dm === "replied"; });
    var replied = names.filter(function (u) { return people[u].dm === "replied"; });
    var waiting = names.filter(function (u) { return (people[u].dm === "replied" || people[u].dm === "inbound") && people[u].dmLastFrom === "them"; });
    var followers = {};
    (DATA.followers || []).forEach(function (u) { followers[String(u).toLowerCase()] = 1; });

    var errs = IG.errors || {};
    var notes = [];
    if (errs.dms) notes.push("Messages are not coming through yet. This usually means the account needs reconnecting with the extra messaging permission. Meta said: " + esc(errs.dms));
    if (errs.insights) notes.push("Reach, saves and shares are not coming through yet (they need the insights permission). Likes and comments still work. Meta said: " + esc(errs.insights));
    if (errs.posts) notes.push("Posts could not be read. Meta said: " + esc(errs.posts));

    h += '<div class="card"><h2>Instagram: @' + esc(IG.account || "") + "</h2>";
    h += '<p class="hint">Live from your connected account, last read ' + esc(ago(IG.fetchedAt)) + '. Instagram does not tell anyone who liked a post, so likes show as a total per post. Comments and messages are tracked by name.</p>';
    notes.forEach(function (t) { h += '<p class="hint" style="color:#b00020;">' + t + "</p>"; });
    h += '<button class="btn-primary" onclick="csIgRefresh()">' + (loading ? "Refreshing..." : "Refresh now") + "</button>";
    h += '<div class="bf-count" style="margin-top:14px;">' +
      box(commenters.length, "people commenting") + box(iMessaged.length, "you messaged") + box(replied.length, "replied to you") +
      box(waiting.length, "waiting for your reply") + box(posts.length, "recent posts tracked") + "</div></div>";

    // waiting for you
    h += '<div class="card"><h2>Waiting for your reply</h2>';
    if (!waiting.length) h += '<div class="empty-note">Nobody is waiting on you.</div>';
    else {
      waiting.sort(function (a, b) { return String(people[b].dmLastAt).localeCompare(String(people[a].dmLastAt)); });
      h += table(["Username", "Their message", "When", ""], waiting.slice(0, 40).map(function (u) {
        var p = people[u];
        return "<tr><td>@" + esc(u) + "</td><td>" + esc(p.dmLastText) + "</td><td>" + esc(ago(p.dmLastAt)) + "</td><td>" + btn(u) + "</td></tr>";
      }));
    }
    h += "</div>";

    // commenters
    var list = commenters.filter(function (u) { return !onlyNew || people[u].dm === "none"; });
    list.sort(function (a, b) { return people[b].comments - people[a].comments || String(people[b].lastCommentAt).localeCompare(String(people[a].lastCommentAt)); });
    h += '<div class="card"><h2>Who is commenting</h2>';
    h += '<p class="hint"><label><input type="checkbox" ' + (onlyNew ? "checked" : "") + ' onchange="csIgOnlyNew(this.checked)"> Only people I have not messaged yet</label></p>';
    if (!list.length) h += '<div class="empty-note">' + (commenters.length ? "Everyone who commented has been messaged." : "No comments on recent posts yet.") + "</div>";
    else {
      h += table(["Username", "Comments", "Latest comment", "Status", ""], list.slice(0, 80).map(function (u) {
        var p = people[u];
        return "<tr><td>@" + esc(u) + (followers[u] ? '<br><span class="hint">Follows you</span>' : "") + "</td><td>" + p.comments + " on " + p.postsCommented + " post" + (p.postsCommented === 1 ? "" : "s") +
          "</td><td>" + esc(p.lastCommentText) + "<br><span class=\"hint\">" + esc(ago(p.lastCommentAt)) + "</span></td><td>" + stateLabel(p) + "</td><td>" + btn(u) + "</td></tr>";
      }));
    }
    h += "</div>";

    // posts
    posts.sort(function (a, b) { return b.score - a.score; });
    h += '<div class="card"><h2>How your posts are doing</h2><p class="hint">Best first. Score is likes, plus 2 for each comment, 3 for each save and 4 for each share.</p>';
    if (!posts.length) h += '<div class="empty-note">No posts to show.</div>';
    else {
      h += table(["Posted", "Post", "Likes", "Comments", "Saves", "Shares", "Reach", ""], posts.map(function (p, i) {
        return "<tr><td>" + esc(String(p.postedAt).slice(0, 10)) + "<br><span class=\"hint\">" + esc(ago(p.postedAt)) + "</span></td><td>" + (i < 3 ? "<strong>Top " + (i + 1) + ".</strong> " : "") + esc(p.caption) + "</td><td>" + n(p.likes) + "</td><td>" + n(p.comments) +
          "</td><td>" + n(p.saved) + "</td><td>" + n(p.shares) + "</td><td>" + n(p.reach) + "</td><td>" + (p.permalink ? '<a class="profile-link" data-ig="1" href="' + esc(p.permalink) + '" target="_blank" rel="noopener">Open post</a>' : "") + "</td></tr>";
      }));
    }
    h += "</div>";

    // everyone messaged
    messaged.sort(function (a, b) { return String(people[b].dmLastAt).localeCompare(String(people[a].dmLastAt)); });
    h += '<div class="card"><h2>Your messages</h2><p class="hint">Everyone in your recent Instagram conversations, newest first.</p>';
    if (!messaged.length) h += '<div class="empty-note">No conversations found.</div>';
    else {
      h += table(["Username", "Status", "Last message", "When", ""], messaged.slice(0, 80).map(function (u) {
        var p = people[u];
        return "<tr><td>@" + esc(u) + "</td><td>" + stateLabel(p) + "</td><td>" + (p.dmLastFrom === "me" ? "You: " : "") + esc(p.dmLastText) + "</td><td>" + esc(ago(p.dmLastAt)) + "</td><td>" + btn(u) + "</td></tr>";
      }));
    }
    h += "</div>";
    sec.innerHTML = h;
  }
  window.csIgOnlyNew = function (v) { onlyNew = !!v; renderTab(); };

  /* ---------- loading ---------- */
  function load(force) {
    if (loading) return;
    loading = true;
    renderTab();
    fetch(apiUrl(force), { headers: { "x-app-password": pw() } })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status === 401 ? "Please log in to your tools first." : "Could not read Instagram just now.");
        return r.json();
      })
      .then(function (d) { IG = d; err = ""; })
      .catch(function (e) { err = e.message || "Could not read Instagram just now."; })
      .then(function () {
        loading = false;
        refreshBadges();
        decorate();
        syncStatuses();
        renderTab();
      });
  }
  window.csIgRefresh = function () { load(true); };

  /* ---------- wire it in ---------- */
  function addTab() {
    if (typeof TABS === "undefined" || document.getElementById("navbtn-instagram")) return;
    TABS.splice(1, 0, { id: "instagram", label: "Instagram" });
    var nav = document.getElementById("tabNav");
    var b = document.createElement("button");
    b.textContent = "Instagram";
    b.id = "navbtn-instagram";
    b.onclick = function () { window.switchTab("instagram"); };
    nav.insertBefore(b, nav.children[1] || null);
    var sec = document.createElement("div");
    sec.className = "tab-section";
    sec.id = "section-instagram";
    document.getElementById("sections").appendChild(sec);
    var orig = window.switchTab;
    window.switchTab = function (id) { orig(id); if (id === "instagram") renderTab(); };
    if (localStorage.getItem("cs_active_tab") === "instagram") window.switchTab("instagram");
  }

  try {
    addTab();
    var timer = null;
    new MutationObserver(function () {
      if (timer) return;
      timer = setTimeout(function () { timer = null; decorate(); }, 60);
    }).observe(document.getElementById("sections"), { childList: true, subtree: true });
    decorate();
    load(false);
    setInterval(function () { load(false); }, 5 * 60 * 1000);
  } catch (e) {
    if (window.console) console.warn("Instagram layer did not start", e);
  }
})();
`;
