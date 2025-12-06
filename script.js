// ---------------------- CONFIG -------------------------
// API base depends on selected demo project/language (DEMO_AUTH)
function getApi() {
    let host = 'en.wikipedia.org';
    try {
        const raw = localStorage.getItem('DEMO_AUTH');
        if (raw) {
            const auth = JSON.parse(raw);
            if (auth && auth.project) {
                if (auth.project === 'commons') {
                    host = 'commons.wikimedia.org';
                } else if (auth.project === 'wikidata') {
                    host = 'www.wikidata.org';
                } else {
                    // wikipedia: use selected language or default to 'en'
                    const lang = auth.lang && auth.lang.length ? auth.lang : 'en';
                    host = `${lang}.wikipedia.org`;
                }
            }
        }
    } catch (e) {
        console.warn('Could not read DEMO_AUTH for API selection', e);
    }
    return `https://${host}/w/api.php?origin=*`;
}

// ---------------------- LOGIN MOCK ---------------------
let USER = null;

function login(btn) {
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Logging in...';
    btn.classList.add('loading');
    
    setTimeout(() => {
        alert("OAuth login successful! (This is a demo; no real login occurred.)");
        USER = { name: "DIVU" };

        // Update UI: show user area and set avatar/username
        document.getElementById("loginArea").style.display = "none";
        const userArea = document.getElementById("userArea");
        userArea.style.display = "flex";
        document.getElementById("username").innerText = USER.name;
        const initials = USER.name.charAt(0).toUpperCase();
        const avatar = document.getElementById("userAvatar");
        if (avatar) avatar.innerText = initials;

        // Ensure profile menu is hidden initially
        const pm = document.getElementById('profileMenu');
        if (pm) pm.style.display = 'none';

        btn.innerHTML = originalContent;
        btn.classList.remove('loading');
    }, 1000);
}

// Open demo login page
function openDemoLogin() {
    // go to login flow (demo). Updated to land on `home.html`.
    window.location.href = 'home.html';
}

// On load, check for DEMO_AUTH saved by the demo login flow
document.addEventListener('DOMContentLoaded', () => {
    try {
        const raw = localStorage.getItem('DEMO_AUTH');
        if (raw) {
            const auth = JSON.parse(raw);
            if (auth && auth.name) {
                USER = { name: auth.name };
                // Update UI to logged-in
                const loginArea = document.getElementById('loginArea');
                const userArea = document.getElementById('userArea');
                if (loginArea) loginArea.style.display = 'none';
                if (userArea) userArea.style.display = 'flex';
                const uname = document.getElementById('username');
                if (uname) uname.innerText = auth.name;
                const avatar = document.getElementById('userAvatar');
                if (avatar) avatar.innerText = auth.name.charAt(0).toUpperCase();

                // Add a small badge or info about selected project (optional)
                const authInfoId = 'demoAuthInfo';
                let infoEl = document.getElementById(authInfoId);
                if (!infoEl) {
                    infoEl = document.createElement('div');
                    infoEl.id = authInfoId;
                    infoEl.style.fontSize = '12px';
                    infoEl.style.color = 'var(--text-secondary)';
                    infoEl.style.marginLeft = '10px';
                    const profileBtn = document.getElementById('profileBtn');
                    if (profileBtn && profileBtn.parentNode) profileBtn.parentNode.appendChild(infoEl);
                }
                // For Wikidata, always show language as English
                const displayLang = (auth.project === 'wikidata') ? 'en' : (auth.lang ? auth.lang : '');
                if (infoEl) infoEl.innerText = `${auth.project}${displayLang ? ' · ' + displayLang : ''}`;

                // Keep DEMO_AUTH in storage until logout; no further action needed
            }
        }
    } catch (e) {
        console.error('Error reading DEMO_AUTH', e);
    }
});

function getDemoAuth() {
    try {
        const raw = localStorage.getItem('DEMO_AUTH');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function logout() {
    USER = null;
    document.getElementById("loginArea").style.display = "block";
    document.getElementById("userArea").style.display = "none";
    // clear demo auth too
    try { localStorage.removeItem('DEMO_AUTH'); } catch (e) {}
}

// ---------------------- LOAD PAGE ----------------------
async function loadPage(form) {
    const title = document.getElementById("pageTitle").value;
    if (!title) {
        showAlert("Please enter a page title to search.", "warning");
        return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Loading...';
    btn.classList.add('loading');
    btn.disabled = true;

    showAlert("Loading article and revision data...", "info");

    try {
        await loadParsedHTML(title);
        await loadRevisions(title);
        hideAlert();
    } catch (error) {
        showAlert("Error loading page. Please check the page title and try again.", "danger");
        console.error(error);
    } finally {
        btn.innerHTML = originalContent;
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// ---------------------- PARSED HTML ----------------------
async function loadParsedHTML(title) {
    const auth = getDemoAuth();

    // Special handling for Wikidata: search entity and show a summary
    if (auth && auth.project === 'wikidata') {
        const api = getApi(); // this will point to www.wikidata.org
        try {
            // Wikidata queries should use English for this demo regardless of selected language
            const lang = 'en';
            const searchUrl = `${api}&action=wbsearchentities&search=${encodeURIComponent(title)}&language=${encodeURIComponent(lang)}&format=json`;
            const sres = await fetch(searchUrl);
            const sdata = await sres.json();
            if (!sdata.search || sdata.search.length === 0) {
                document.getElementById("articleHTML").innerHTML = `<p><i>No Wikidata entity found for "${title}"</i></p>`;
                document.getElementById("resultsContainer").style.display = "block";
                return;
            }

            const entityId = sdata.search[0].id;
            const detailsUrl = `${api}&action=wbgetentities&ids=${encodeURIComponent(entityId)}&props=labels|descriptions|sitelinks|claims&languages=${encodeURIComponent(lang)}&format=json`;
            const dres = await fetch(detailsUrl);
            const ddata = await dres.json();
            const ent = ddata.entities && ddata.entities[entityId];

            let out = `<div class="article-preview"><h2 style="margin-top:0">${ent.labels && ent.labels[auth.lang || 'en'] ? ent.labels[auth.lang || 'en'].value : (ent.labels && ent.labels.en ? ent.labels.en.value : entityId)}</h2>`;
            out += `<p style="color:var(--text-secondary)">${ent.descriptions && ent.descriptions[auth.lang || 'en'] ? ent.descriptions[auth.lang || 'en'].value : (ent.descriptions && ent.descriptions.en ? ent.descriptions.en.value : '')}</p>`;

            // show some sitelinks if present
            if (ent.sitelinks) {
                out += `<h4 style="margin-bottom:6px">Sitelinks</h4><ul>`;
                const keys = Object.keys(ent.sitelinks).slice(0, 8);
                for (const k of keys) {
                    const s = ent.sitelinks[k];
                    out += `<li><a href="${s.url}" target="_blank" rel="noopener">${s.site}: ${s.title}</a></li>`;
                }
                out += `</ul>`;
            }

            // show top-level claims (property ids and count)
            if (ent.claims) {
                out += `<h4 style="margin-bottom:6px">Claims</h4><div style="display:flex;flex-wrap:wrap;gap:8px">`;
                for (const p of Object.keys(ent.claims).slice(0, 12)) {
                    const claimCount = ent.claims[p].length;
                    out += `<span class="badge badge-primary">${p}: ${claimCount}</span>`;
                }
                out += `</div>`;
            }

            out += `</div>`;
            document.getElementById("articleHTML").innerHTML = out;
            document.getElementById("resultsContainer").style.display = "block";
            document.getElementById("resultsContainer").classList.add("animate-fade-in");
            // store current entity for potential use elsewhere
            window._currentWikidataEntity = entityId;
            return;
        } catch (e) {
            console.error('Wikidata fetch error', e);
            document.getElementById("articleHTML").innerHTML = `<p><i>Error fetching Wikidata entity.</i></p>`;
            document.getElementById("resultsContainer").style.display = "block";
            return;
        }
    }

    // Default: parse/display HTML from mediawiki parse API
    const url = `${getApi()}&action=parse&page=${encodeURIComponent(title)}&prop=text&format=json`;

    const res = await fetch(url);
    const data = await res.json();

    const html = data.parse ? data.parse.text["*"] : "<i>No article found</i>";

    document.getElementById("articleHTML").innerHTML = html;
    document.getElementById("resultsContainer").style.display = "block";
    document.getElementById("resultsContainer").classList.add("animate-fade-in");
}

// ---------------------- REVISIONS ----------------------
async function loadRevisions(title) {
    const auth = getDemoAuth();

    // For Wikidata, revisions are not handled in this demo; show a helpful message
    if (auth && auth.project === 'wikidata') {
        const entityId = window._currentWikidataEntity;
        if (entityId) {
            document.getElementById("revTable").innerHTML = `<p>Showing summary for <strong>${entityId}</strong>. Revision history for Wikidata entities isn't displayed in this demo.</p>`;
        } else {
            document.getElementById("revTable").innerHTML = `<p>No revision data available for Wikidata (no entity loaded).</p>`;
        }
        return;
    }

    const url = `${getApi()}&action=query&prop=revisions&rvprop=ids|user|timestamp|comment|size&rvlimit=50&rvdir=newer&titles=${encodeURIComponent(title)}&format=json`;

    const res = await fetch(url);
    const data = await res.json();

    const pages = data.query.pages;
    const page = Object.values(pages)[0];

    if (!page.revisions) {
        document.getElementById("revTable").innerHTML = "<p>No revisions found.</p>";
        return;
    }

    showRevisions(page.revisions);
    showContributors(page.revisions);

    document.getElementById("resultsContainer").style.display = "block";
    document.getElementById("resultsContainer").classList.add("animate-fade-in");
}

// ---------------------- SHOW REVISIONS ----------------------
function showRevisions(revs) {
    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Rev ID</th>
                    <th>User</th>
                    <th>Timestamp</th>
                    <th>Comment</th>
                    <th>Size</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
    `;

    revs.forEach(r => {
        const userInitial = r.user.charAt(0).toUpperCase();
        html += `
            <tr>
                <td><span class="rev-id">${r.revid}</span></td>
                <td>
                    <div class="user-name">
                        <span class="user-avatar">${userInitial}</span>
                        ${r.user}
                    </div>
                </td>
                <td><span class="timestamp">${formatTimestamp(r.timestamp)}</span></td>
                <td><span class="comment" title="${r.comment || 'No comment'}">${r.comment || 'No comment'}</span></td>
                <td><span class="size">${r.size.toLocaleString()} bytes</span></td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="sendThank(this, ${r.revid})">
                        <i class="fa-solid fa-heart"></i> Thank
                    </button>
                </td>
            </tr>`;
    });

    html += "</tbody></table>";
    document.getElementById("revTable").innerHTML = html;
}

// ---------------------- CONTRIBUTORS LIST ----------------------
function showContributors(revs) {
    const map = {};

    for (const r of revs) {
        if (!map[r.user]) map[r.user] = { count: 0, last: r.timestamp, lastRevId: r.revid };
        map[r.user].count++;
        if (new Date(r.timestamp) > new Date(map[r.user].last)) {
            map[r.user].last = r.timestamp;
            map[r.user].lastRevId = r.revid;
        }
    }

    // Sort contributors chronologically by most recent contribution
    const sortedContributors = Object.entries(map).sort((a, b) => {
        return new Date(b[1].last) - new Date(a[1].last);
    });

    let html = "";

    sortedContributors.forEach(([user, info], index) => {
        const initials = user.charAt(0).toUpperCase();

        html += `
            <div class="card" style="animation-delay: ${index * 0.1}s">
                <div class="avatar">${initials}</div>
                <div class="contributor-info">
                    <div class="contributor-name">${user}</div>
                    <div class="contributor-stats">
                        <div class="contributor-stat">
                            <i class="fa-solid fa-edit"></i>
                            <span class="contributor-stat-value">${info.count}</span>
                            <span>edits</span>
                        </div>
                        <div class="contributor-stat">
                            <i class="fa-solid fa-clock"></i>
                            <span>${formatTimestamp(info.last)}</span>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success btn-sm" onclick="sendThank(this, ${info.lastRevId})">
                    <i class="fa-solid fa-hands-clapping"></i> Thank
                </button>
            </div>
        `;
    });

    document.getElementById("contributors").innerHTML = html;
}

// Helper to format ISO timestamps into a nicer local string
function formatTimestamp(ts) {
    try {
        const d = new Date(ts);
        return d.toLocaleString();
    } catch (e) {
        return ts;
    }
}

// ---------------------- TAB SWITCHING ----------------------
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName + 'Content').style.display = 'block';
    
    // Add active class to clicked button
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    activeBtn.classList.add('active');
}

// ---------------------- SEND THANK ----------------------
function sendThank(btn, revId) {
    if (!USER) {
        showAlert("Please login first to send thanks!", "warning");
        return;
    }

    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Sending...';
    btn.classList.add('loading');
    btn.disabled = true;

    setTimeout(() => {
        alert(`Thank API placeholder.\nThis will send THANK for revision ${revId}.\nConnect backend API here.`);
        
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Thanked!';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-outline');
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.classList.remove('btn-outline');
            btn.classList.add('btn-success');
            btn.classList.remove('loading');
            btn.disabled = false;
        }, 2000);
    }, 1000);
}

// ---------------------- MESSAGE HELPERS ----------------------
function showAlert(msg, type = 'info') {
    const box = document.getElementById("message");
    box.className = `alert alert-${type}`;
    box.innerHTML = `<i class="fa-solid fa-info-circle"></i> ${msg}`;
    box.style.display = "flex";
}

function hideAlert() {
    const box = document.getElementById("message");
    box.style.display = "none";
}

// ---------------------- PROFILE MENU ----------------------
function toggleProfileMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('profileMenu');
    if (!menu) return;
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function closeProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (menu) menu.style.display = 'none';
}

// ---------------------- FOOTER MENU ----------------------
function toggleFooterMenu(menuId, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const menu = document.getElementById(menuId);
    if (!menu) return;
    // close other footer menus first
    document.querySelectorAll('.footer-menu').forEach(m => {
        if (m.id !== menuId) m.style.display = 'none';
    });
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function closeAllFooterMenus() {
    document.querySelectorAll('.footer-menu').forEach(m => m.style.display = 'none');
}

function openContributors(e) {
    if (e && e.preventDefault) e.preventDefault();
    closeAllFooterMenus();
    try { switchTab('contributors'); } catch (err) {}
    const el = document.getElementById('contributors');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function openTopContributors(e) {
    if (e && e.preventDefault) e.preventDefault();
    closeAllFooterMenus();
    try { switchTab('contributors'); } catch (err) {}
    // simple behavior: scroll to top of contributors
    const el = document.getElementById('contributors');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // optionally highlight top contributors briefly
        el.style.transition = 'box-shadow 0.3s';
        el.style.boxShadow = '0 8px 24px rgba(2,6,23,0.06)';
        setTimeout(() => { el.style.boxShadow = ''; }, 1200);
    }
}

function openMentor(e) {
    if (e && e.preventDefault) e.preventDefault();
    closeAllFooterMenus();
    // show simple mentor contact modal (native prompt for demo)
    alert('Mentor: Jane Doe — jane.doe@example.org (demo)');
}

function openMentorResources(e) {
    if (e && e.preventDefault) e.preventDefault();
    closeAllFooterMenus();
    // open documentation or resource link - for demo we show an alert
    alert('Mentor resources: https://meta.wikimedia.org/wiki/Community_portal (demo)');
}

// close profile menu when clicking outside
document.addEventListener('click', function (e) {
    // Profile menu close
    const menu = document.getElementById('profileMenu');
    const btn = document.getElementById('profileBtn');
    if (menu && btn && menu.style.display !== 'none') {
        if (!(menu.contains(e.target) || btn.contains(e.target))) {
            menu.style.display = 'none';
        }
    }

    // Footer menus close
    const footerBtns = document.querySelectorAll('.footer-dropdown-btn');
    const footerMenus = document.querySelectorAll('.footer-menu');
    footerMenus.forEach(m => {
        if (m.style.display === 'block') {
            const correspondingBtn = Array.from(footerBtns).find(b => {
                // check if button controls this menu by ID reference in onclick or id naming
                const id = m.id;
                // simple heuristic: button id contains 'Contrib' for contrib menu, 'Mentor' for mentor
                return b && (b.id && (b.id.toLowerCase().includes(id.replace('footer', '').toLowerCase())));
            });
            if (correspondingBtn) {
                if (!(m.contains(e.target) || correspondingBtn.contains(e.target))) {
                    m.style.display = 'none';
                }
            } else {
                // If we can't find a specific button, close by default when clicking outside menu
                if (!m.contains(e.target)) m.style.display = 'none';
            }
        }
    });
});
