const USERS = {
    gas: "1234"
};

let invoiceNumber = 10000;
let transactions = [];

const MONTH_NAMES = [
    "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
    "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"
];

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/* LOGIN */
function login() {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value.trim();

    if (USERS[user] && USERS[user] === pass) {
        document.getElementById("loginPage").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");
    } else {
        document.getElementById("loginError").innerText =
            "Invalid username/password";
    }
}

function logout() {
    location.reload();
}

/* AUTO COMPUTE (entry form) */
document.addEventListener("input", function (e) {
    if (e.target.id === "entryLiters" || e.target.id === "entryPrice") {
        const liters = Number(document.getElementById("entryLiters").value || 0);
        const price = Number(document.getElementById("entryPrice").value || 0);
        document.getElementById("entryAmount").value = (liters * price).toFixed(2);
    }
});

/* ADD TRANSACTION */
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
        paid: type === "Sales"
    };

    transactions.push(transaction);
    invoiceNumber++;

    clearEntryForm();
    alert("Transaction added for " + agency + ".");
}

function clearEntryForm() {
    document.getElementById("entryDate").value = "";
    document.getElementById("entryLiters").value = "";
    document.getElementById("entryPrice").value = "";
    document.getElementById("entryAmount").value = "";
    document.getElementById("entryPlateNo").value = "";
    document.getElementById("entryAgency").value = "";
}

/* Build a map of agency -> { "YYYY-MM": [transactions] } */
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

/* Render the clickable list of agency+month "SOA cards" */
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

function togglePeriodSelection(i) {
    renderSelectedSOAs();
}

function selectAllPeriods() {
    document.querySelectorAll(".periodCheck").forEach(cb => cb.checked = true);
    renderSelectedSOAs();
}

/* Build the actual SOA preview pages for every checked period card */
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

/* Render a single SOA page (one agency, one month) in the letterhead format */
function renderSoaPaper(group, groupIndex) {
    const label = `${MONTH_NAMES[group.monthIndex]} ${group.year}`;
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
    </div>
    `;
}

/* CHECKBOX - PAID STATUS (re-renders to keep running balance correct) */
function toggleTransactionPaid(idx, rowId) {
    transactions[idx].paid = !transactions[idx].paid;
    document.getElementById(rowId).classList.toggle("paid-row");
}

/* PRINT */
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

/* CLEAR */
function clearForm() {
    location.reload();
}