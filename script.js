/* =========================================================
   GT GRANT FUEL STATION — SOA GENERATOR
   All app data (USERS, transactions, attachments) lives in
   memory for this session; only the login state is kept in
   localStorage so a page refresh doesn't kick the user out.
   ========================================================= */

/* Valid login accounts: username -> password */
const USERS = {
    gas: "1234"
};

let invoiceNumber = 10000;   // next invoice number to assign
let transactions  = [];      // all SOA transactions added this session

/* ATTACHMENTS: key = "agency||YYYY-MM" -> array of image dataURLs
   (the photos attached to that agency's SOA for that month) */
let attachments = {};

const MONTH_NAMES = [
    "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
    "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"
];

/* Escapes user-typed text before it's inserted into innerHTML, so
   names like O'Brien or <Agency> can't break the markup. */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/* =========================================================
   LOGIN / SESSION
   ========================================================= */

/* Shows the app and hides the login screen. Shared by the
   login button and the "stay logged in on refresh" check. */
function showApp() {
    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
}

function login() {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value.trim();

    if (USERS[user] && USERS[user] === pass) {
        localStorage.setItem("gtLoggedIn", "1"); // remember session across refresh
        showApp();
    } else {
        document.getElementById("loginError").innerText =
            "Invalid username/password";
    }
}

function logout() {
    localStorage.removeItem("gtLoggedIn"); // clear session, then reload to login screen
    location.reload();
}

/* On every page load, check if there's a remembered session.
   If so, skip straight to the app instead of showing the login
   page again (this is what fixes the "refresh logs me out" bug). */
document.addEventListener("DOMContentLoaded", function () {
    if (localStorage.getItem("gtLoggedIn") === "1") {
        showApp();
    }
});

/* =========================================================
   ENTRY FORM (ADD TRANSACTION)
   ========================================================= */

/* Auto-computes Amount = Liters x Price/Liter as the user types. */
document.addEventListener("input", function (e) {
    if (e.target.id === "entryLiters" || e.target.id === "entryPrice") {
        const liters = Number(document.getElementById("entryLiters").value || 0);
        const price = Number(document.getElementById("entryPrice").value || 0);
        document.getElementById("entryAmount").value = (liters * price).toFixed(2);
    }
});

/* Reads the entry form, validates it, and pushes a new transaction. */
function addTransaction() {
    const date = document.getElementById("entryDate").value;
    const product = document.getElementById("entryProduct").value;
    const liters = document.getElementById("entryLiters").value;
    const price = Number(document.getElementById("entryPrice").value || 0);
    const amount = Number(document.getElementById("entryAmount").value || 0);
    const plateNo = document.getElementById("entryPlateNo").value;
    const agency = document.getElementById("entryAgency").value.trim();
    const type = document.getElementById("entryType").value;

    if (!date || !liters || !price || !agency) {
        alert("Please fill in Date, Liters, Price/Liter, and Agency.");
        return;
    }

    const transaction = {
        invoiceNo: invoiceNumber,
        date: date,
        product: product,
        liters: liters,
        price: price,
        amount: amount,
        plateNo: plateNo,
        agency: agency,
        type: type,
        paid: type === "Sales" // Sales is paid on the spot; Charge starts unpaid
    };

    transactions.push(transaction);
    invoiceNumber++;

    clearEntryForm();
    alert("Transaction added for " + agency + ".");
}

/* Resets the entry form fields after a transaction is added. */
function clearEntryForm() {
    document.getElementById("entryDate").value = "";
    document.getElementById("entryLiters").value = "";
    document.getElementById("entryPrice").value = "";
    document.getElementById("entryAmount").value = "";
    document.getElementById("entryPlateNo").value = "";
    document.getElementById("entryAgency").value = "";
}

/* =========================================================
   GROUPING / SEARCH
   ========================================================= */

/* Groups transactions by agency + month ("YYYY-MM"), so each
   group becomes one printable SOA statement. Pass an agency
   name to filter, or null to group everything (FIND ALL). */
function groupTransactions(filterAgency) {
    const groups = {}; // key: agency||YYYY-MM

    transactions.forEach((t, idx) => {
        if (!t.date) return;
        if (filterAgency && t.agency.toLowerCase() !== filterAgency.toLowerCase()) return;

        const ym = t.date.slice(0, 7); // "YYYY-MM"
        const key = t.agency + "||" + ym;

        if (!groups[key]) {
            const [year, monthNum] = ym.split("-");
            groups[key] = {
                agency: t.agency,
                year: year,
                monthIndex: Number(monthNum) - 1,
                ym: ym,
                items: []
            };
        }
        groups[key].items.push(idx);
    });

    return Object.values(groups).sort((a, b) => {
        if (a.agency !== b.agency) return a.agency.localeCompare(b.agency);
        return a.ym.localeCompare(b.ym);
    });
}

/* FIND - search a specific agency, list its SOA periods (by month) */
function findAgency() {
    const query = document.getElementById("soaSearch").value.trim();

    if (!query) {
        alert("Type an agency name to search, or use FIND ALL.");
        return;
    }

    const groups = groupTransactions(query);

    if (groups.length === 0) {
        document.getElementById("soaList").innerHTML =
            `<p class="no-results">No transactions found for "${escapeHtml(query)}".</p>`;
        document.getElementById("soaPreview").innerHTML = "";
        document.getElementById("soaButtons").classList.add("hidden");
        return;
    }

    renderPeriodList(groups);
}

/* FIND ALL - list every agency's every month */
function findAll() {
    document.getElementById("soaSearch").value = "";
    const groups = groupTransactions(null);

    if (groups.length === 0) {
        document.getElementById("soaList").innerHTML =
            `<p class="no-results">No transactions recorded yet.</p>`;
        document.getElementById("soaPreview").innerHTML = "";
        document.getElementById("soaButtons").classList.add("hidden");
        return;
    }

    renderPeriodList(groups, true);
}

/* =========================================================
   PERIOD LIST (the agency + month cards the user checks off)
   ========================================================= */

/* Renders the clickable list of agency+month "SOA cards". */
function renderPeriodList(groups, isFindAll) {
    const listEl = document.getElementById("soaList");

    let html = `<div class="soa-period-header">
        ${isFindAll ? "All Agencies — select one or more statements below:" : `Found ${groups.length} statement(s) — select which to view/print:`}
        <button class="small-link" onclick="selectAllPeriods()">Select All Shown</button>
    </div>`;

    html += `<div class="period-cards">`;

    groups.forEach((g, i) => {
        const label = `${MONTH_NAMES[g.monthIndex]} ${g.year}`;
        const count = g.items.length;
        const total = g.items.reduce((sum, idx) => sum + transactions[idx].amount, 0);

        html += `
        <div class="period-card" id="periodCard${i}">
            <input type="checkbox" class="periodCheck" id="periodCheck${i}"
                onchange="togglePeriodSelection(${i})">
            <div class="period-info" onclick="document.getElementById('periodCheck${i}').click()">
                <div class="period-agency">${escapeHtml(g.agency)}</div>
                <div class="period-month">${label}</div>
                <div class="period-meta">${count} transaction(s) &middot; &#8369; ${total.toFixed(2)}</div>
            </div>
        </div>
        `;
    });

    html += `</div>`;
    listEl.innerHTML = html;

    // stash groups on window so checkbox handlers can find them
    window.__currentGroups = groups;
}

/* Re-renders the SOA preview whenever a period checkbox changes. */
function togglePeriodSelection(i) {
    renderSelectedSOAs();
}

/* Checks every visible period card, then renders all of them. */
function selectAllPeriods() {
    document.querySelectorAll(".periodCheck").forEach(cb => cb.checked = true);
    renderSelectedSOAs();
}

/* Builds the actual SOA preview pages for every checked period card. */
function renderSelectedSOAs() {
    const groups = window.__currentGroups || [];
    const preview = document.getElementById("soaPreview");
    const buttonsEl = document.getElementById("soaButtons");

    let html = "";
    let anySelected = false;

    groups.forEach((g, i) => {
        const checkbox = document.getElementById("periodCheck" + i);
        if (!checkbox || !checkbox.checked) return;
        anySelected = true;
        html += renderSoaPaper(g, i);
    });

    preview.innerHTML = html;
    buttonsEl.classList.toggle("hidden", !anySelected);
}

/* =========================================================
   SOA PAPER (the printable letterhead statement)
   ========================================================= */

/* Renders a single SOA page (one agency, one month) in the
   letterhead format, followed by its attachment photo page(s). */
function renderSoaPaper(group, groupIndex) {
    const label = `${MONTH_NAMES[group.monthIndex]} ${group.year}`;
    const groupKey = group.agency + "||" + group.ym;
    let balance = 0;
    let lastDate = "";

    let rows = "";

    group.items.forEach((idx) => {
        const t = transactions[idx];
        balance += t.amount;
        const repeatedDate = lastDate === t.date;
        lastDate = t.date;
        const rowId = `soaRow_${groupIndex}_${idx}`;

        rows += `
        <tr id="${rowId}" class="${t.paid ? "paid-row" : ""}">
            <td class="checkcol">
                <input type="checkbox" class="printCheck" checked>
            </td>
            <td class="paidcol">
                ${
                    t.type === "Charge"
                    ? `<input type="checkbox" ${t.paid ? "checked" : ""}
                        onchange="toggleTransactionPaid(${idx}, '${rowId}')">`
                    : "✓"
                }
            </td>
            <td>${repeatedDate ? "" : t.date}</td>
            <td>${t.invoiceNo}</td>
            <td>${escapeHtml(t.plateNo)}</td>
            <td>${escapeHtml(t.product)}</td>
            <td>${escapeHtml(t.liters)}</td>
            <td>${t.price.toFixed(2)}</td>
            <td>${t.amount.toFixed(2)}</td>
            <td>${balance.toFixed(2)}</td>
        </tr>
        `;
    });

    return `
    <div class="soa-paper">

        <div class="soa-watermark">
            <img src="logs.png">
        </div>

        <div class="soa-letterhead">
            <img src="logs.png" class="soa-logo">
            <div class="soa-company-info">
                <h1>GT GRANT FUEL STATION</h1>
                <div class="soa-address">NATIONAL HIGHWAY, MAGSAYSAY, NAGUILIAN, ISABELA</div>
                <div class="soa-prop">GRACE MACARILAY RODRIGUEZ &ndash; AMO</div>
                <div class="soa-contact">CONTACT NO. 09175257544</div>
            </div>
        </div>

        <div class="soa-title-bar">
            <div class="soa-month-label">FOR THE MONTH OF <strong>${label}</strong></div>
            <div class="soa-statement-label">STATEMENT OF ACCOUNT</div>
            <div class="soa-agency-name">${escapeHtml(group.agency)}</div>
        </div>

        <table class="soa-table">
            <tr>
                <th class="checkcol">PRINT</th>
                <th class="paidcol">PAID</th>
                <th>DATE</th>
                <th>INVOICE #</th>
                <th>PLATE NO</th>
                <th>PRODUCT</th>
                <th>QTY</th>
                <th>AMT/LTR</th>
                <th>AMOUNT</th>
                <th>BALANCE</th>
            </tr>
            ${rows}
        </table>

        <div class="attach-controls">
            <label class="attach-label">ATTACH FILE(S) &mdash; e.g. photos of the charge invoices for ${escapeHtml(label)}</label>
            <input type="file" accept="image/*" multiple class="attach-input"
                onchange="handleAttachFiles('${groupKey}', this)">

            ${renderPendingThumbs(groupKey)}

            <button type="button" class="save-attach-btn"
                onclick="saveAttachments('${groupKey}')"
                ${(pendingAttachments[groupKey] || []).length === 0 ? "disabled" : ""}>
                SAVE PICTURE TO THIS SOA
            </button>

            ${renderAttachThumbs(groupKey)}
        </div>
    </div>
    ${renderAttachmentPages(group, groupKey)}
    `;
}

/* =========================================================
   ATTACHMENTS (uploaded charge-invoice photos)
   ========================================================= */

/* PENDING ATTACHMENTS: key = "agency||YYYY-MM" -> array of image
   dataURLs the user has picked but not yet clicked SAVE on. These
   are NOT part of the printed SOA until saveAttachments() runs. */
let pendingAttachments = {};

/* Renders the "not yet saved" preview thumbnails plus a note,
   shown above the SAVE button so the user knows what will be
   added once they click Save. */
function renderPendingThumbs(groupKey) {
    const imgs = pendingAttachments[groupKey] || [];
    if (imgs.length === 0) return "";

    let html = `<div class="attach-pending-note">${imgs.length} photo(s) selected — not yet saved:</div>`;
    html += `<div class="attach-thumbs attach-thumbs-pending">`;
    imgs.forEach((src, idx) => {
        html += `
        <div class="attach-thumb attach-thumb-pending">
            <img src="${src}">
            <button type="button" class="remove-thumb" onclick="removePendingAttachment('${groupKey}', ${idx})">&times;</button>
        </div>
        `;
    });
    html += `</div>`;
    return html;
}

/* Renders the small on-screen thumbnails of photos already SAVED
   to this agency/month's SOA (not printed, just for review/removal). */
function renderAttachThumbs(groupKey) {
    const imgs = attachments[groupKey] || [];
    if (imgs.length === 0) return "";

    let html = `<div class="attach-saved-note">Saved to this SOA:</div>`;
    html += `<div class="attach-thumbs">`;
    imgs.forEach((src, idx) => {
        html += `
        <div class="attach-thumb">
            <img src="${src}">
            <button type="button" class="remove-thumb" onclick="removeAttachment('${groupKey}', ${idx})">&times;</button>
        </div>
        `;
    });
    html += `</div>`;
    return html;
}

/* Reads newly selected photo files as base64 dataURLs and stages
   them as "pending" for this agency/month — they aren't added to
   the SOA yet, just previewed, until the user clicks SAVE. */
function handleAttachFiles(groupKey, input) {
    const files = Array.from(input.files || []);
    if (files.length === 0) return;
    if (!pendingAttachments[groupKey]) pendingAttachments[groupKey] = [];

    let remaining = files.length;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            pendingAttachments[groupKey].push(e.target.result);
            remaining--;
            if (remaining === 0) {
                renderSelectedSOAs();
            }
        };
        reader.readAsDataURL(file);
    });
}

/* SAVE button handler: moves the staged/pending photos for this
   agency/month into the real attachments list, which is what
   actually shows up on the printed attachment page(s). */
function saveAttachments(groupKey) {
    const pending = pendingAttachments[groupKey] || [];
    if (pending.length === 0) return;

    if (!attachments[groupKey]) attachments[groupKey] = [];
    attachments[groupKey] = attachments[groupKey].concat(pending);

    pendingAttachments[groupKey] = [];
    renderSelectedSOAs();
    alert("Photo(s) saved to this SOA.");
}

/* Removes one photo from the pending (not-yet-saved) preview. */
function removePendingAttachment(groupKey, idx) {
    if (pendingAttachments[groupKey]) {
        pendingAttachments[groupKey].splice(idx, 1);
        renderSelectedSOAs();
    }
}

/* Removes one already-saved attached photo from an agency/month. */
function removeAttachment(groupKey, idx) {
    if (attachments[groupKey]) {
        attachments[groupKey].splice(idx, 1);
        renderSelectedSOAs();
    }
}

/* Builds extra page(s) holding the attached photos, laid out
   automatically 6 per page (2 columns x 3 rows) like a photocopied
   invoice sheet — no letterhead/header, just the photos. If more
   than 6 are attached, it keeps adding pages of 6 until every
   photo is placed. */
function renderAttachmentPages(group, groupKey) {
    const imgs = attachments[groupKey] || [];
    if (imgs.length === 0) return "";

    const perPage = 6;
    let pagesHtml = "";

    for (let p = 0; p < imgs.length; p += perPage) {
        const pageImgs = imgs.slice(p, p + perPage);

        let cells = "";
        pageImgs.forEach(src => {
            cells += `<div class="attachment-cell"><img src="${src}"></div>`;
        });

        pagesHtml += `
        <div class="soa-paper attachment-paper">
            <div class="attachment-grid">
                ${cells}
            </div>
        </div>
        `;
    }

    return pagesHtml;
}

/* =========================================================
   PAID STATUS / PRINTING
   ========================================================= */

/* Toggles a transaction's paid flag and re-styles its row
   (re-rendering the whole table would also reset the running
   balance, so this just flips the highlight in place). */
function toggleTransactionPaid(idx, rowId) {
    transactions[idx].paid = !transactions[idx].paid;
    document.getElementById(rowId).classList.toggle("paid-row");
}

/* Triggers the browser print dialog. mode "all" prints every row;
   mode "checked" hides any row whose PRINT checkbox is unticked. */
function printSOA(mode) {
    document.body.classList.add("print-soa");

    const allRows = document.querySelectorAll("#soaPreview .soa-table tr");

    allRows.forEach(row => {
        row.classList.remove("print-exclude");

        if (mode === "checked") {
            const checkbox = row.querySelector(".printCheck");
            if (checkbox && !checkbox.checked) {
                row.classList.add("print-exclude");
            }
        }
    });

    window.print();
}

/* Reloads the page to clear the entry form back to blank.
   (Login state is preserved since it lives in localStorage.) */
function clearForm() {
    location.reload();
}
