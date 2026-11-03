
        let savedUserJson = localStorage.getItem('ecw_currentUser');
        let currentUser = savedUserJson ? JSON.parse(savedUserJson) : { role: 'guest', name: '' };
        let adminPassword = null; // Kein Kennwort im öffentlichen Programmcode.

        let defaultMembersList = []; // Mitglieder ausschließlich aus dem bestehenden Firebase-Bestand.

        // Stellt sicher, dass jedes Mitglied ein mustChangePassword-Flag hat.
        // Mitglieder ohne gespeicherten Passwort-Hash (z. B. ganz neu oder aus
        // einer älteren, noch nicht gehashten Version) müssen ihr Passwort
        // beim nächsten Login in jedem Fall selbst setzen.
        function normalizeMembers(list) {
            return (list || []).map(m => ({
                ...m,
                mustChangePassword: m.mustChangePassword !== undefined ? m.mustChangePassword : !m.passHash
            }));
        }

        // --- Passwort-Hashing (SHA-256 mit Namens-Salt) -----------------------
        // Passwörter werden nie im Klartext gespeichert oder übertragen.
        // Funktioniert nur in einer sicheren Umgebung (https oder localhost).
        async function sha256Hex(text) {
            const data = new TextEncoder().encode(text);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        async function hashMemberPassword(name, plainPass) {
            const salt = String(name || '').trim().toLowerCase();
            return sha256Hex(`${salt}:${plainPass}`);
        }

        let membersList = normalizeMembers(defaultMembersList);
        let eventTemplates = [
            { id: 1, name: "Freies Training (Standard)", players: 4 },
            { id: 2, name: "Cup-Spiel", players: 4 },
            { id: 3, name: "Solo Turnier", players: 1 },
            { id: 4, name: "Duo Cup", players: 2 }
        ];

        let clubhouseTemplates = [
            { id: 1, name: "Vereinsfeier" },
            { id: 2, name: "Jahreshauptversammlung" },
            { id: 3, name: "Vorstandssitzung" }
        ];

        let bookingsList = [];
        let bookingHistory = [];
        let currentView = 'week';
        let editingBookingId = null;
        let pendingSlotSelection = null;

        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape" && pendingSlotSelection) {
                resetSlotSelection();
            }
        });

        document.addEventListener("DOMContentLoaded", async function() {
            document.getElementById('calendarDate').value = getMonday(getTodayFormatted());
            populateTimeDropdowns();
            
            await loadDataFromFirebase();

            updateMemberCount();
            populateLoginDropdown();
            renderTemplatesUI();
            renderClubhouseTemplatesUI();
            renderMembersTable();
            renderAdminStats();
            renderSavedBookings();

            updateUserStatusUI();

            if (currentUser.role === 'guest') {
                openLoginModal();
            } else if (currentUser.role === 'member') {
                let member = membersList.find(m => m.name === currentUser.name);
                if (member && member.mustChangePassword) {
                    openForcedPasswordModal();
                }
            }
        });

        async function loadDataFromFirebase() {
            if (!window.firebaseReady) {
                console.warn("Nutze lokale Standarddaten, da Firebase nicht initialisiert ist.");
                if (!eventTemplates.some(t => t.name === 'Duo Cup')) {
                    eventTemplates.push({ id: 4, name: 'Duo Cup', players: 2 });
                }
                try {
                    const cachedClubhouse = JSON.parse(localStorage.getItem('ecw_clubhouseTemplates') || 'null');
                    if(Array.isArray(cachedClubhouse) && cachedClubhouse.length) clubhouseTemplates = cachedClubhouse;
                } catch(_) {}
                return;
            }
            try {
                const querySnapshot = await window.getDocs(window.collection(window.db, "appData"));
                let loadedMembers = false;
                querySnapshot.forEach((docSnap) => {
                    let data = docSnap.data();
                    if(docSnap.id === "members" && data.list && data.list.length > 0) {
                        membersList = normalizeMembers(data.list);
                        loadedMembers = true;
                    }
                    if(docSnap.id === "bookings" && data.list) bookingsList = data.list;
                    if(docSnap.id === "history" && data.list) bookingHistory = data.list;
                    if(docSnap.id === "templates" && data.list) eventTemplates = data.list;
                    if(docSnap.id === "clubhouseTemplates" && data.list) clubhouseTemplates = data.list;
                });
                if(!loadedMembers) {
                    membersList = normalizeMembers(defaultMembersList);
                }

                // Duo Cup muss auch bei älteren Firebase-Template-Daten verfügbar sein.
                if (!eventTemplates.some(t => t.name === 'Duo Cup')) {
                    eventTemplates.push({ id: 4, name: 'Duo Cup', players: 2 });
                }
                // Alte/benutzerdefinierte Vorlagen ohne Spieleranzahl bleiben nutzbar.
                eventTemplates = eventTemplates.map((t, i) => ({
                    ...t,
                    id: t.id ?? (i + 1)
                }));
                try {
                    if(Array.isArray(clubhouseTemplates) && clubhouseTemplates.length) {
                        localStorage.setItem('ecw_clubhouseTemplates', JSON.stringify(clubhouseTemplates));
                    }
                } catch(_) {}
            } catch(e) {
                console.error("Fehler beim Laden aus Firebase, verwende Standarddaten: ", e);
                membersList = normalizeMembers(defaultMembersList);
            }
        }

        async function saveDataToFirebase() {
            if (!window.firebaseReady) {
                try {
                    localStorage.setItem('ecw_members', JSON.stringify(membersList));
                    localStorage.setItem('ecw_bookings', JSON.stringify(bookingsList));
                    localStorage.setItem('ecw_history', JSON.stringify(bookingHistory));
                    localStorage.setItem('ecw_templates', JSON.stringify(eventTemplates));
                    localStorage.setItem('ecw_clubhouseTemplates', JSON.stringify(clubhouseTemplates));
                } catch(_) {}
                alert("Gespeichert (lokal, da Firebase nicht verbunden ist).");
                return false;
            }
            try {
                await window.setDoc(window.doc(window.db, "appData", "members"), { list: membersList });
                await window.setDoc(window.doc(window.db, "appData", "bookings"), { list: bookingsList });
                await window.setDoc(window.doc(window.db, "appData", "history"), { list: bookingHistory });
                await window.setDoc(window.doc(window.db, "appData", "templates"), { list: eventTemplates });
                await window.setDoc(window.doc(window.db, "appData", "clubhouseTemplates"), { list: clubhouseTemplates });
                return true;
            } catch(e) {
                console.error("Fehler beim Speichern in Firebase: ", e);
                alert("Fehler beim Speichern in der Datenbank!");
                return false;
            }
        }

        function getTodayFormatted() {
            let d = new Date();
            let year = d.getFullYear();
            let month = String(d.getMonth() + 1).padStart(2, '0');
            let day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function getCurrentTimeFormatted() {
            let d = new Date();
            let hours = String(d.getHours()).padStart(2, '0');
            let minutes = String(d.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        function formatDateDE(dateStr) {
            if(!dateStr) return '';
            let parts = dateStr.split('-');
            if(parts.length === 3) {
                return `${parts[2]}.${parts[1]}.${parts[0]}`;
            }
            return dateStr;
        }

        function getWeekdayName(dateStr) {
            let d = new Date(dateStr);
            let options = { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' };
            return d.toLocaleDateString('de-DE', options);
        }

        function getCalendarWeek(dateObj) {
            let d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
            let dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            let yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            let weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return weekNo;
        }

        function getMonday(dateStr) {
            let d = new Date(dateStr);
            let day = d.getDay();
            let diff = d.getDate() - day + (day === 0 ? -6 : 1);
            let monday = new Date(d.setDate(diff));
            return monday.toISOString().split('T')[0];
        }

        function shiftWeek(direction) {
            let dateInput = document.getElementById('calendarDate');
            let currentMonday = new Date(dateInput.value);
            currentMonday.setDate(currentMonday.getDate() + (direction * 7));
            dateInput.value = currentMonday.toISOString().split('T')[0];
            renderSavedBookings();
        }

        function setWeekToToday() {
            document.getElementById('calendarDate').value = getMonday(getTodayFormatted());
            renderSavedBookings();
        }

        function populateTimeDropdowns() {
            const timeFrom = document.getElementById('modalTimeFrom');
            const timeTo = document.getElementById('modalTimeTo');
            const cbFrom = document.getElementById('clubhouseTimeFrom');
            const cbTo = document.getElementById('clubhouseTimeTo');
            
            timeFrom.innerHTML = ''; timeTo.innerHTML = ''; cbFrom.innerHTML = ''; cbTo.innerHTML = '';

            for (let h = 7; h <= 23; h++) {
                let hourStr = h < 10 ? '0' + h : h;
                for (let m of ['00', '30']) {
                    let timeVal = `${hourStr}:${m}`;
                    timeFrom.innerHTML += `<option value="${timeVal}">${timeVal}</option>`;
                    timeTo.innerHTML += `<option value="${timeVal}">${timeVal}</option>`;
                    cbFrom.innerHTML += `<option value="${timeVal}">${timeVal}</option>`;
                    cbTo.innerHTML += `<option value="${timeVal}">${timeVal}</option>`;
                }
            }
            timeFrom.value = "15:00"; timeTo.value = "17:00";
            cbFrom.value = "18:00"; cbTo.value = "22:00";
        }

        function updateMemberCount() {
            let activeCount = membersList.filter(m => m.active !== false).length;
            document.getElementById('memberCount').innerText = activeCount + " aktiv";
        }

        function updateMemberDropdowns() {
            const dropdowns = document.querySelectorAll('.member-select');
            let selectedValues = [];
            dropdowns.forEach(d => { if(d.value) selectedValues.push(d.value); });

            dropdowns.forEach((dropdown, idx) => {
                let currentValue = dropdown.value;
                let ph = idx === 0 ? "-- Spieler 1 --" : (idx < 4 ? `-- Spieler ${idx+1} --` : `-- Gegner ${idx-3} --`);
                dropdown.innerHTML = `<option value="">${ph}</option>`;

                membersList.forEach(m => {
                    if (m.hidden !== true) {
                        if(m.name === currentValue || !selectedValues.includes(m.name)) {
                            let opt = document.createElement('option');
                            opt.value = m.name; opt.textContent = m.name + (m.active === false ? " (Inaktiv)" : "");
                            if(m.name === currentValue) opt.selected = true;
                            dropdown.appendChild(opt);
                        }
                    }
                });
            });
        }

        function onTemplateChange() {
            const select = document.getElementById('modalTemplateSelect');
            const selectedTemplateName = select.value;
            let found = eventTemplates.find(t => t.name === selectedTemplateName);
            const hint = document.getElementById('gameModeHint');
            if (found && found.players !== undefined) {
                const section = document.getElementById('playerSelectionSection');
                if (section) section.classList.remove('hidden');
                applyPlayerCountToModal(found.players);
                if (hint) {
                    if (found.players === 0) {
                        hint.innerText = 'Für diesen Modus werden keine Spieler ausgewählt.';
                    } else if (found.name === 'Duo Cup') {
                        hint.innerText = 'Duo Cup: Bitte 2 Spieler für das Heimteam und 2 Spieler für das Gegnerteam auswählen.';
                    } else {
                        hint.innerText = `${found.name}: ${found.players} Spieler pro Mannschaft auswählen.`;
                    }
                }
            } else if (hint) {
                hint.innerText = 'Bitte Spielmodus auswählen – anschließend werden die benötigten Spieler ausgewählt.';
            }
        }

        function applyPlayerCountToModal(playerCount) {
            const section = document.getElementById('playerSelectionSection');
            const guestContainer = document.getElementById('guestTeamContainer');
            const playerHint = document.getElementById('playerSelectionHint');

            // Spielerauswahl nach Auswahl des Spielmodus sichtbar machen.
            if (section) section.classList.remove('hidden');
            if (guestContainer) guestContainer.style.display = playerCount > 0 ? 'block' : 'none';

            if (playerHint) {
                playerHint.innerText = playerCount > 0
                    ? `Bitte ${playerCount} Spieler pro Mannschaft auswählen.`
                    : 'Für diesen Modus ist keine Spielerauswahl erforderlich.';
            }

            for (let i = 1; i <= 4; i++) {
                const hp = document.getElementById(`homePlayer${i}`);
                const gp = document.getElementById(`guestPlayer${i}`);
                const hf = document.getElementById(`field_homePlayer${i}`);
                const gf = document.getElementById(`field_guestPlayer${i}`);
                const show = playerCount > 0 && i <= Number(playerCount);

                if (hf) hf.style.display = show ? 'block' : 'none';
                if (gf) gf.style.display = show ? 'block' : 'none';

                if (!show) {
                    if (hp) hp.value = '';
                    if (gp) gp.value = '';
                }
            }

            updateMemberDropdowns();
        }

        function populateLoginDropdown() {
            const select = document.getElementById('loginUserSelect');
            select.innerHTML = '<option value="admin">⚙️ Administrator</option>';
            membersList.forEach(m => {
                let opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = "Mitglied: " + m.name + (m.active === false ? " (Inaktiv)" : "") + (m.hidden === true ? " (Ausgeblendet)" : "");
                select.appendChild(opt);
            });
        }

        function checkTimeAvailability() {
            if((currentUser.role === 'admin' || isInformationssystemUser()) && editingBookingId !== null) {
                document.getElementById('availabilityWarning').classList.add('hidden');
                document.getElementById('modalSubmitBtn').disabled = false;
                document.getElementById('modalSubmitBtn').classList.remove('opacity-50', 'cursor-not-allowed');
                return;
            }

            let userObj = membersList.find(m => m.name === currentUser.name);
            let hasSpecial = userObj && userObj.specialRights === true;

            const resource = document.getElementById('modalSelectedResource').value;
            const date = document.getElementById('modalBookDate').value;
            const timeFrom = document.getElementById('modalTimeFrom').value;
            const timeTo = document.getElementById('modalTimeTo').value;

            let conflict = bookingsList.find(b => {
                if(editingBookingId && b.id === editingBookingId) return false;
                if(b.resource !== resource || b.date !== date) return false;
                return (timeFrom < b.timeTo && timeTo > b.timeFrom);
            });

            let playerToCheck = currentUser.role === 'member' ? currentUser.name : null;
            const homePlayer1Val = document.getElementById('homePlayer1').value;
            if(homePlayer1Val) playerToCheck = homePlayer1Val;

            let userConflict = null;
            if (playerToCheck) {
                userConflict = bookingsList.find(b => {
                    if(editingBookingId && b.id === editingBookingId) return false;
                    if(b.date !== date) return false;
                    let isOverlapping = (timeFrom < b.timeTo && timeTo > b.timeFrom);
                    if (!isOverlapping) return false;
                    return (b.bookedBy === playerToCheck || (b.homeTeam && b.homeTeam.includes(playerToCheck)) || (b.guestTeam && b.guestTeam.includes(playerToCheck)));
                });
            }

            const warningBox = document.getElementById('availabilityWarning');
            const submitBtn = document.getElementById('modalSubmitBtn');

            if((conflict || userConflict) && !hasSpecial && currentUser.role !== 'admin') {
                warningBox.classList.remove('hidden');
                if (userConflict) {
                    warningBox.innerHTML = `⚠️ Achtung: Der Spieler (${playerToCheck}) hat zu dieser Zeit bereits eine andere Buchung (${userConflict.resource})!`;
                } else {
                    warningBox.innerHTML = "⚠️ Achtung: In diesem Zeitraum ist diese Bahn bereits belegt!";
                }
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                warningBox.classList.add('hidden');
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        function renderSavedBookings() {
            resetSlotSelection();
            const container = document.getElementById('savedBookingsContainer');
            container.innerHTML = '';
            let selectedDateInput = document.getElementById('calendarDate').value;
            let mondayStr = getMonday(selectedDateInput);
            if(document.getElementById('calendarDate').value !== mondayStr) {
                document.getElementById('calendarDate').value = mondayStr;
            }

            let mondayDateObj = new Date(mondayStr);
            let kwNumber = getCalendarWeek(mondayDateObj);
            document.getElementById('kwDisplayBadge').innerText = `KW ${kwNumber}`;

            if (currentView === 'day') {
                let todayStr = getTodayFormatted();
                let currentTime = getCurrentTimeFormatted();

                let filtered = bookingsList.filter(b => {
                    if (b.date > todayStr) return true;
                    if (b.date === todayStr) { return b.timeTo >= currentTime; }
                    return false;
                }).sort((a,b) => a.date.localeCompare(b.date) || a.timeFrom.localeCompare(b.timeFrom));
                
                if(filtered.length === 0) {
                    container.innerHTML = `<p class="text-zinc-500 italic text-center py-4">Keine anstehenden oder aktuellen Reservierungen vorhanden.</p>`;
                    return;
                }

                let groupedByDate = {};
                filtered.forEach(b => {
                    if(!groupedByDate[b.date]) { groupedByDate[b.date] = []; }
                    groupedByDate[b.date].push(b);
                });

                for(let dateStr in groupedByDate) {
                    let prettyDateName = getWeekdayName(dateStr);
                    let isTodayHeader = dateStr === todayStr;
                    let headerBadgeClass = isTodayHeader ? "bg-red-950 text-red-300 border border-red-700" : "bg-zinc-800 text-zinc-300 border border-zinc-700";

                    container.innerHTML += `
                        <div class="space-y-1.5 mb-3">
                            <div class="${headerBadgeClass} px-3 py-1 rounded font-bold text-xs uppercase tracking-wide">
                                📅 ${prettyDateName}
                            </div>
                            <div class="space-y-1 pl-1" id="day-group-${dateStr}"></div>
                        </div>
                    `;

                    let groupContainer = document.getElementById(`day-group-${dateStr}`);

                    groupedByDate[dateStr].forEach(b => {
                        let homeStr = b.homeTeam && b.homeTeam.length > 0 ? b.homeTeam.join(', ') : '';
                        let guestStr = b.guestTeam && b.guestTeam.length > 0 ? b.guestTeam.join(', ') : '';

                        let teamsHtml = homeStr ? `<p class="text-zinc-300">🏠 Spieler/Team: ${homeStr}</p>` : '';
                        if(guestStr) teamsHtml += `<p class="text-zinc-300">✈️ Gegner: ${guestStr}</p>`;

                        let modeHtml = b.mode ? `<p class="text-zinc-400 italic">Modus/Anlass: ${b.mode}</p>` : '';
                        let isClubhouse = b.resource === "Vereinsheim";
                        let resIcon = isClubhouse ? "🏠" : "🏟️";
                        
                        let isCurrentLive = (b.date === todayStr && b.timeFrom <= currentTime && b.timeTo > currentTime);
                        let liveBadge = isCurrentLive ? `<span class="bg-green-950 text-green-300 border border-green-700 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">🔴 AKTUELL LÄUFT</span>` : '';

                        let canManageBooking = canManageReservation(b);
                        let bookingActionHint = canManageBooking ? `<p class="text-[10px] text-zinc-500 pt-1">👆 Tippen für Ändern / Stornieren</p>` : '';

                        groupContainer.innerHTML += `
                            <div class="border ${isCurrentLive ? 'border-green-600 bg-zinc-900/90' : 'border-zinc-700 bg-zinc-900'} rounded p-2 space-y-1 ${canManageBooking ? 'cursor-pointer active:bg-zinc-700' : ''}" ${canManageBooking ? `onclick="showBookingActions(${b.id})" ondblclick="showBookingActions(${b.id})"` : ''}>
                                <div class="flex justify-between items-center font-bold text-zinc-100">
                                    <span class="${isClubhouse ? 'text-blue-400' : 'text-red-500'} flex items-center gap-1.5">${resIcon} ${b.resource}</span>
                                    <div class="flex items-center gap-2">${liveBadge}<span>🕒 ${b.timeFrom} - ${b.timeTo} Uhr</span></div>
                                </div>
                                ${modeHtml} ${teamsHtml}
                                <p class="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800 flex justify-between">
                                    <span>Reserviert von: <strong>${b.bookedBy}</strong></span>
                                </p>
                                ${bookingActionHint}
                            </div>`;
                    });
                }

            } else if (currentView === 'week') {
                let weekDates = getWeekDates(mondayStr);
                let dayNames = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
                
                let times = [];
                for (let h = 7; h <= 23; h++) {
                    let hourStr = h < 10 ? '0' + h : h;
                    times.push(`${hourStr}:00`);
                    times.push(`${hourStr}:30`);
                }

                let hasClubhouseOnDay = {};
                weekDates.forEach(dStr => {
                    hasClubhouseOnDay[dStr] = bookingsList.some(b => b.date === dStr && b.resource === "Vereinsheim");
                });

                let matrixHtml = `
                    <div class="overflow-auto w-full max-h-[70vh]">
                        <table class="w-full border-collapse text-center min-w-[1300px]">
                            <thead>
                                <tr class="bg-zinc-950 border-b border-zinc-700 text-zinc-300 font-bold text-[11px] sticky top-0 z-25">
                                    <th class="p-1.5 border-r border-zinc-800 w-16 bg-zinc-950 sticky left-0 z-30">Uhrzeit</th>`;

                weekDates.forEach((dateStr, dIndex) => {
                    let isToday = dateStr === getTodayFormatted();
                    let headerColor = isToday ? "bg-red-950 text-red-200 border-red-700" : "bg-zinc-900 text-zinc-200";
                    let colspan = hasClubhouseOnDay[dateStr] ? 5 : 4;
                    matrixHtml += `<th colspan="${colspan}" class="p-1.5 text-xs ${headerColor} border-r-2 border-zinc-600">${dayNames[dIndex]} (${formatDateDE(dateStr)})</th>`;
                });

                matrixHtml += `</tr>
                                <tr class="bg-zinc-900 border-b border-zinc-700 text-zinc-400 font-semibold text-[10px] sticky top-[29px] z-20">
                                    <th class="border-r border-zinc-800 bg-zinc-950 sticky left-0 z-30"></th>`;

                weekDates.forEach((dateStr) => {
                    let dayRes = ["Bahn 1", "Bahn 2", "Bahn 3", "Bahn 4"];
                    if(hasClubhouseOnDay[dateStr]) dayRes.push("Vereinsheim");

                    dayRes.forEach((res, rIndex) => {
                        let borderClass = (rIndex === dayRes.length - 1) ? "week-day-divider" : "week-lane-divider";
                        if (res === "Vereinsheim") {
                            matrixHtml += `<th data-resource="${res}" data-date="${dateStr}" class="p-1 ${borderClass} text-blue-400 font-bold vertical-text h-16 align-bottom pb-1" title="Vereinsheim">Vereinsheim</th>`;
                        } else {
                            matrixHtml += `<th data-resource="${res}" data-date="${dateStr}" class="p-1 ${borderClass} text-red-400">${res}</th>`;
                        }
                    });
                });

                matrixHtml += `</tr></thead><tbody class="divide-y divide-zinc-700">`;

                times.forEach(t => {
                    let isCore = t >= "15:00" && t <= "23:00";
                    let rowBg = isCore ? "bg-zinc-900/40" : "bg-zinc-950/20";
                    let timeBg = isCore ? "bg-zinc-900 text-zinc-200 font-bold" : "bg-zinc-950 text-zinc-500";

                    matrixHtml += `<tr class="${rowBg} hover:bg-zinc-800/40">`;
                    matrixHtml += `<td class="p-1 border-r border-zinc-800 font-semibold ${timeBg} sticky left-0 z-10 text-[10px]">${t}</td>`;

                    weekDates.forEach((dateStr) => {
                        let dayBookings = bookingsList.filter(b => b.date === dateStr);
                        let dayRes = ["Bahn 1", "Bahn 2", "Bahn 3", "Bahn 4"];
                        if(hasClubhouseOnDay[dateStr]) dayRes.push("Vereinsheim");

                        dayRes.forEach((res, rIndex) => {
                            let activeBooking = dayBookings.find(b => b.resource === res && b.timeFrom <= t && b.timeTo > t);
                            let borderClass = (rIndex === dayRes.length - 1) ? "week-day-divider" : "week-lane-divider";

                            if(activeBooking) {
                                let homeStr = activeBooking.homeTeam && activeBooking.homeTeam.length > 0 ? activeBooking.homeTeam.join(', ') : '';
                                let guestStr = activeBooking.guestTeam && activeBooking.guestTeam.length > 0 ? ` | Gegner: ${activeBooking.guestTeam.join(', ')}` : '';
                                let teamsText = homeStr ? `Spieler: ${homeStr}${guestStr}` : 'Keine Spieler eingetragen';
                                let tooltipText = `Modus: ${activeBooking.mode || '-'}\nGebucht von: ${activeBooking.bookedBy}\n${teamsText}`;
                                let canManageBooking = canManageReservation(activeBooking);
                                let bookingClick = `onclick="showBookingActions(${activeBooking.id})"`;
                                let cursorStyle = canManageBooking ? 'cursor-pointer hover:opacity-80 active:opacity-60' : 'cursor-pointer hover:opacity-90 active:opacity-70';
                                let cellColorBg = res === "Vereinsheim" ? "bg-blue-700 text-white" : "bg-red-900/70 text-red-200";

                                matrixHtml += `<td data-resource="${res}" data-date="${dateStr}" class="p-1 ${borderClass} ${cellColorBg} font-bold text-xs ${cursorStyle}" ${bookingClick}>✓</td>`;
                            } else {
                                let clickAction = res === "Vereinsheim" ? `openClubhouseModal()` : `handleSlotClick(event, '${res}', '${dateStr}', '${t}')`;
                                matrixHtml += `<td data-resource="${res}" data-date="${dateStr}" class="p-1 ${borderClass} hover:bg-red-950/45 cursor-pointer text-zinc-700 text-[10px] slot-cell" onclick="${clickAction}">+</td>`;
                            }
                        });
                    });
                    matrixHtml += `</tr>`;
                });

                matrixHtml += `</tbody></table></div>`;
                container.innerHTML = matrixHtml;

                requestAnimationFrame(() => {
                    const scrollContainer = container.querySelector('.overflow-auto');
                    if(scrollContainer) { scrollContainer.scrollTop = 16 * 29; }
                });
            }
        }

        function getWeekDates(mondayStr) {
            let monday = new Date(mondayStr);
            let week = [];
            for (let i = 0; i < 7; i++) {
                let nextDay = new Date(monday);
                nextDay.setDate(monday.getDate() + i);
                week.push(nextDay.toISOString().split('T')[0]);
            }
            return week;
        }

        function changeView(view) {
            currentView = view;
            document.getElementById('btnDay').className = "px-3 py-0.5 text-zinc-300 rounded hover:bg-zinc-700 cursor-pointer text-xs";
            document.getElementById('btnWeek').className = "px-3 py-0.5 text-zinc-300 rounded hover:bg-zinc-700 cursor-pointer text-xs";

            if(view === 'day') document.getElementById('btnDay').className = "px-3 py-0.5 bg-red-700 text-white rounded font-semibold cursor-pointer text-xs";
            else if(view === 'week') document.getElementById('btnWeek').className = "px-3 py-0.5 bg-red-700 text-white rounded font-semibold cursor-pointer text-xs";

            renderSavedBookings();
        }

        function openBookingModal(resourceName) {
            resetSlotSelection();
            editingBookingId = null;
            document.getElementById('modalTitleHeading').innerText = "📝 Bahn reservieren";
            openBookingModalAtTime(resourceName, getTodayFormatted(), "15:00");
        }

        function openBookingModalAtTime(resourceName, dateStr, timeStr, endTimeStr) {
            let todayStr = getTodayFormatted();
            if (currentUser.role !== 'admin' && dateStr < todayStr) {
                alert("Reservierungen in der Vergangenheit sind nicht möglich!");
                return;
            }

            if(editingBookingId === null) {
                document.getElementById('modalTitleHeading').innerText = "📝 Bahn reservieren";
            }
            document.getElementById('modalSelectedResource').value = resourceName;
            document.getElementById('modalBookDate').value = dateStr;
            document.getElementById('modalTimeFrom').value = timeStr;

            if (endTimeStr) {
                document.getElementById('modalTimeTo').value = endTimeStr;
            } else {
                let [h, m] = timeStr.split(':').map(Number);
                let endH = (h + 2) % 24;
                let endHStr = endH < 10 ? '0' + endH : endH;
                document.getElementById('modalTimeTo').value = `${endHStr}:${m < 10 ? '0' + m : m}`;
            }

            const selects = document.querySelectorAll('.member-select');
            selects.forEach(sel => sel.value = "");
            updateMemberDropdowns();

            const p1Select = document.getElementById('homePlayer1');
            if(currentUser.role === 'member') {
                p1Select.value = currentUser.name;
                updateMemberDropdowns();
            }

            onTemplateChange();
            checkTimeAvailability();
            document.getElementById('bookingModal').classList.remove('hidden');
        }

        function addMinutesToTime(timeStr, minsToAdd) {
            let [h, m] = timeStr.split(':').map(Number);
            let total = ((h * 60 + m + minsToAdd) % 1440 + 1440) % 1440;
            let hh = Math.floor(total / 60);
            let mm = total % 60;
            return `${hh < 10 ? '0' + hh : hh}:${mm < 10 ? '0' + mm : mm}`;
        }

        function showSlotSelectionHint(text) {
            let hint = document.getElementById('slotSelectionHint');
            let hintText = document.getElementById('slotSelectionHintText');
            if (hintText) hintText.innerText = text;
            if (hint) { hint.classList.remove('hidden'); hint.classList.add('inline-flex'); }
        }

        function hideSlotSelectionHint() {
            let hint = document.getElementById('slotSelectionHint');
            if (hint) { hint.classList.add('hidden'); hint.classList.remove('inline-flex'); }
        }

        function resetSlotSelection() {
            document.querySelectorAll('.slot-lane-selected').forEach(el => el.classList.remove('slot-lane-selected'));
            document.querySelectorAll('.slot-start-selected').forEach(el => el.classList.remove('slot-start-selected'));

            if (pendingSlotSelection && pendingSlotSelection.cell) {
                let cell = pendingSlotSelection.cell;
                cell.classList.remove('bg-amber-500/80', 'text-black', 'font-bold', 'slot-start-selected');
                if (cell.classList.contains('slot-cell')) {
                    cell.classList.add('text-zinc-700');
                    cell.textContent = '+';
                }
            }
            pendingSlotSelection = null;
            hideSlotSelectionHint();
        }

        function handleSlotClick(event, res, dateStr, t) {
            let todayStr = getTodayFormatted();
            if (currentUser.role !== 'admin' && dateStr < todayStr) {
                alert("Reservierungen in der Vergangenheit sind nicht möglich!");
                return;
            }

            const cell = event.currentTarget;

            // Kein Start markiert -> diese Zelle als Start setzen
            if (!pendingSlotSelection) {
                pendingSlotSelection = { resource: res, date: dateStr, start: t, cell: cell };

                // Die komplette Bahn-Spalte hervorheben, damit auf Touch-Geräten
                // sofort klar ist, auf welcher Bahn die Auswahl erfolgt.
                document.querySelectorAll(`[data-resource="${res}"][data-date="${dateStr}"]`)
                    .forEach(el => el.classList.add('slot-lane-selected'));

                // Das zuerst angetippte Zeitfeld deutlich und hell markieren.
                cell.classList.remove('text-zinc-700');
                cell.classList.add('slot-start-selected');
                cell.textContent = '●';
                showSlotSelectionHint(`Start ${t} Uhr gewählt – jetzt Ende anklicken`);
                return;
            }

            // Andere Bahn/anderer Tag angeklickt -> Auswahl dort neu starten
            if (pendingSlotSelection.resource !== res || pendingSlotSelection.date !== dateStr) {
                resetSlotSelection();
                handleSlotClick(event, res, dateStr, t);
                return;
            }

            let start = pendingSlotSelection.start;
            let end;
            if (t === start) {
                // gleiche Zelle erneut angeklickt -> genau diese halbe Stunde buchen
                end = addMinutesToTime(t, 30);
            } else if (t > start) {
                end = addMinutesToTime(t, 30);
            } else {
                end = addMinutesToTime(start, 30);
                start = t;
            }

            resetSlotSelection();
            openBookingModalAtTime(res, dateStr, start, end);
        }

        // Sonderrecht nur für den bereits angemeldeten Reservierungssystem-Benutzer
        // „Informationssystem“; alle anderen Mitgliederrechte bleiben unverändert.
        function isInformationssystemUser() {
            return currentUser && currentUser.role === 'member' &&
                String(currentUser.name || '').trim().toLocaleLowerCase('de-DE') === 'informationssystem';
        }

        function canManageReservation(booking) {
            return Boolean(booking) && (currentUser.role === 'admin' ||
                isInformationssystemUser() || booking.bookedBy === currentUser.name);
        }

        function showBookingActions(id) {
            resetSlotSelection();
            const b = bookingsList.find(item => item.id === id);
            if(!b) return;

            const canManage = canManageReservation(b);
            const info = document.getElementById('bookingActionInfo');
            const buttons = document.getElementById('bookingActionButtons');
            if(!info || !buttons) return;

            const home = b.homeTeam && b.homeTeam.length ? b.homeTeam.join(', ') : '-';
            const opponent = b.guestTeam && b.guestTeam.length ? b.guestTeam.join(', ') : '-';
            info.innerHTML = `
                <div><strong>Datum:</strong> ${formatDateDE(b.date)}</div>
                <div><strong>Zeit:</strong> ${b.timeFrom} - ${b.timeTo} Uhr</div>
                <div><strong>Bahn:</strong> ${b.resource}</div>
                <div><strong>Spielmodus:</strong> ${b.mode || '-'}</div>
                <div><strong>Spieler:</strong> ${home}</div>
                <div><strong>Gegner:</strong> ${opponent}</div>
                <div class="pt-1 border-t border-zinc-700"><strong>Reserviert von:</strong> ${b.bookedBy || '-'}</div>`;

            if(canManage) {
                buttons.innerHTML = `
                    <button type="button" onclick="closeBookingActionModal(); editBooking(${id})" class="bg-blue-700 hover:bg-blue-800 text-white py-2 rounded font-semibold">✏️ Reservierung ändern</button>
                    <button type="button" onclick="closeBookingActionModal(); deleteBooking(${id})" class="bg-red-700 hover:bg-red-800 text-white py-2 rounded font-semibold">🗑️ Reservierung stornieren</button>`;
            } else {
                buttons.innerHTML = `<div class="col-span-full text-center text-zinc-400 bg-zinc-900 rounded p-2">Nur die buchende Person, Informationssystem oder der Administrator darf diese Reservierung ändern oder stornieren.</div>`;
            }
            document.getElementById('bookingActionModal').classList.remove('hidden');
        }

        function closeBookingActionModal() {
            const modal = document.getElementById('bookingActionModal');
            if(modal) modal.classList.add('hidden');
        }

        function editBooking(id) {
            let b = bookingsList.find(item => item.id === id);
            if(!b) return;
            if(!canManageReservation(b)) {
                alert("Nur die buchende Person, Informationssystem oder der Administrator darf diese Reservierung ändern.");
                return;
            }
            if(!b) return;

            if(b.resource === "Vereinsheim") {
                openClubhouseModal();
                document.getElementById('clubhouseDate').value = b.date;
                document.getElementById('clubhouseTimeFrom').value = b.timeFrom;
                document.getElementById('clubhouseTimeTo').value = b.timeTo;
                document.getElementById('clubhouseTemplateSelect').value = b.mode || "";
                return;
            }

            editingBookingId = b.id;
            document.getElementById('modalTitleHeading').innerText = "✏️ Reservierung ändern";
            document.getElementById('modalSelectedResource').value = b.resource;
            document.getElementById('modalBookDate').value = b.date;
            document.getElementById('modalTimeFrom').value = b.timeFrom;
            document.getElementById('modalTimeTo').value = b.timeTo;
            document.getElementById('modalTemplateSelect').value = b.mode || "";

            onTemplateChange();

            const selects = document.querySelectorAll('.member-select');
            selects.forEach(sel => sel.value = "");

            if(b.homeTeam) b.homeTeam.forEach((name, idx) => { let el = document.getElementById(`homePlayer${idx+1}`); if(el) el.value = name; });
            if(b.guestTeam) b.guestTeam.forEach((name, idx) => { let el = document.getElementById(`guestPlayer${idx+1}`); if(el) el.value = name; });

            updateMemberDropdowns();
            checkTimeAvailability();
            document.getElementById('bookingModal').classList.remove('hidden');
        }

        async function deleteBooking(id) {
            let b = bookingsList.find(item => item.id === id);
            if(!b) return;
            if(!canManageReservation(b)) {
                alert("Nur die buchende Person, Informationssystem oder der Administrator darf diese Reservierung stornieren.");
                return;
            }
            if(confirm("Möchten Sie diese Reservierung wirklich stornieren?")) {
                const cancellationRecord = {
                    ...b,
                    action: "cancellation",
                    cancellationId: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                    cancelledBy: currentUser.name,
                    cancelledAt: new Date().toISOString()
                };
                bookingsList = bookingsList.filter(item => item.id !== id);
                bookingHistory.push(cancellationRecord);
                await saveDataToFirebase();
                renderSavedBookings();
                renderAdminStats();
                alert("Reservierung erfolgreich storniert.");
            }
        }

        function closeBookingModal() { 
            document.getElementById('bookingModal').classList.add('hidden'); 
            editingBookingId = null;
        }

        function openClubhouseModal() {
            resetSlotSelection();
            document.getElementById('clubhouseDate').value = getTodayFormatted();
            document.getElementById('clubhouseModal').classList.remove('hidden');
        }
        function closeClubhouseModal() { document.getElementById('clubhouseModal').classList.add('hidden'); }

        async function handleClubhouseBooking(event) {
            event.preventDefault();
            const date = document.getElementById('clubhouseDate').value;
            const timeFrom = document.getElementById('clubhouseTimeFrom').value;
            const timeTo = document.getElementById('clubhouseTimeTo').value;
            const reason = document.getElementById('clubhouseTemplateSelect').value;

            let todayStr = getTodayFormatted();
            if(currentUser.role !== 'admin' && date < todayStr) {
                alert("Reservierungen in der Vergangenheit sind nicht möglich!");
                return;
            }

            let newBooking = {
                id: Date.now(),
                resource: "Vereinsheim",
                date: date,
                timeFrom: timeFrom,
                timeTo: timeTo,
                mode: reason,
                bookedBy: currentUser.name,
                homeTeam: [],
                guestTeam: []
            };

            bookingsList.push(newBooking);
            bookingHistory.push(newBooking);

            await saveDataToFirebase();
            renderSavedBookings();
            renderAdminStats();
            closeClubhouseModal();
            alert("Vereinsheim erfolgreich gebucht!");
        }

        function renderTemplatesUI() {
            const container = document.getElementById('templatesListContainer');
            const select = document.getElementById('modalTemplateSelect');
            if(!container || !select) return;
            container.innerHTML = ''; select.innerHTML = '';

            eventTemplates.forEach(t => {
                let opt = document.createElement('option');
                opt.value = t.name; opt.textContent = `${t.name} (${t.players} Spieler)`;
                select.appendChild(opt);

                container.innerHTML += `
                    <div class="flex justify-between items-center bg-zinc-900 p-1.5 rounded border border-zinc-700">
                        <span class="font-medium text-zinc-300">${t.name} <span class="text-xs text-red-400">(${t.players} Spieler)</span></span>
                        <button type="button" onclick="deleteTemplate(${t.id})" class="text-red-500 hover:underline cursor-pointer">Löschen</button>
                    </div>`;
            });
            onTemplateChange();
        }

        function renderClubhouseTemplatesUI() {
            const container = document.getElementById('clubhouseTemplatesListContainer');
            const select = document.getElementById('clubhouseTemplateSelect');
            if(!container || !select) return;
            container.innerHTML = ''; select.innerHTML = '';

            clubhouseTemplates.forEach(t => {
                let opt = document.createElement('option');
                opt.value = t.name; opt.textContent = t.name;
                select.appendChild(opt);

                container.innerHTML += `
                    <div class="flex justify-between items-center bg-zinc-900 p-1.5 rounded border border-zinc-700">
                        <span class="font-medium text-zinc-300">${t.name}</span>
                        <button type="button" onclick="deleteClubhouseTemplate(${t.id})" class="text-red-500 hover:underline cursor-pointer">Löschen</button>
                    </div>`;
            });
        }

        async function addTemplate() {
            const name = document.getElementById('newTemplateName').value.trim();
            const players = parseInt(document.getElementById('newTemplatePlayers').value);
            if(name) {
                eventTemplates.push({ id: Date.now(), name: name, players: players });
                document.getElementById('newTemplateName').value = '';
                renderTemplatesUI();
                await saveDataToFirebase();
            }
        }

        async function deleteTemplate(id) {
            eventTemplates = eventTemplates.filter(t => t.id !== id);
            renderTemplatesUI();
            await saveDataToFirebase();
        }

        async function saveClubhouseTemplatesOnly() {
            if(!window.firebaseReady) {
                localStorage.setItem('ecw_clubhouseTemplates', JSON.stringify(clubhouseTemplates));
                return true;
            }
            try {
                await window.setDoc(window.doc(window.db, "appData", "clubhouseTemplates"), { list: clubhouseTemplates });
                localStorage.setItem('ecw_clubhouseTemplates', JSON.stringify(clubhouseTemplates));
                return true;
            } catch(e) {
                console.error("Vereinsheim-Anlässe konnten nicht gespeichert werden:", e);
                localStorage.setItem('ecw_clubhouseTemplates', JSON.stringify(clubhouseTemplates));
                alert("Der Anlass wurde lokal gespeichert, konnte aber nicht in Firebase gespeichert werden. Bitte Firebase-Berechtigungen prüfen.");
                return false;
            }
        }

        async function addClubhouseTemplate() {
            if(currentUser.role !== 'admin') { alert('Nur der Administrator darf Vereinsheim-Anlässe verwalten.'); return; }
            const name = document.getElementById('newClubhouseTemplateName').value.trim();
            if(name) {
                if(clubhouseTemplates.some(t => t.name.toLowerCase() === name.toLowerCase())) { alert('Dieser Anlass ist bereits vorhanden.'); return; }
                clubhouseTemplates.push({ id: Date.now(), name: name });
                document.getElementById('newClubhouseTemplateName').value = '';
                renderClubhouseTemplatesUI();
                await saveClubhouseTemplatesOnly();
            }
        }

        async function deleteClubhouseTemplate(id) {
            if(currentUser.role !== 'admin') { alert('Nur der Administrator darf Vereinsheim-Anlässe verwalten.'); return; }
            clubhouseTemplates = clubhouseTemplates.filter(t => t.id !== id);
            renderClubhouseTemplatesUI();
            await saveClubhouseTemplatesOnly();
        }

        function populateSeriesTimeDropdowns() {
            const from = document.getElementById('seriesTimeFrom');
            const to = document.getElementById('seriesTimeTo');
            if(!from || !to) return;
            from.innerHTML = ''; to.innerHTML = '';
            for(let h=6; h<=23; h++) {
                for(let m of [0,30]) {
                    if(h===23 && m===30) continue;
                    const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                    from.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`);
                    to.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`);
                }
            }
            from.value = '18:00'; to.value = '19:00';
        }

        function populateSeriesMembers() {
            const box = document.getElementById('seriesPlayersSection');
            if(!box) return;
            box.innerHTML = '';
            const groups = [ ['home','Spieler'], ['guest','Gegner'] ];
            for(const [prefix,label] of groups) {
                for(let i=1;i<=4;i++) {
                    const wrap=document.createElement('div'); wrap.id=`series_${prefix}Wrap${i}`;
                    wrap.innerHTML=`<label class="block font-semibold text-zinc-300 text-xs">${label} ${i}</label><select id="series_${prefix}${i}" class="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-white text-xs"><option value="">– nicht belegen –</option>${membersList.filter(m=>m.active!==false && !m.hidden).map(m=>`<option value="${String(m.name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}">${String(m.name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('')}</select>`; box.appendChild(wrap);
                }
            }
        }

        function openSeriesReservationModal() {
            if(currentUser.role !== 'admin') { alert('Serienreservierungen dürfen nur vom Administrator angelegt werden.'); return; }
            const start=document.getElementById('seriesStartDate'); const end=document.getElementById('seriesEndDate');
            start.value=getTodayFormatted(); end.value=getTodayFormatted();
            populateSeriesTimeDropdowns(); populateSeriesMembers();
            onSeriesResourceChange();
            document.getElementById('seriesReservationModal').classList.remove('hidden');
        }

        function closeSeriesReservationModal() { const m=document.getElementById('seriesReservationModal'); if(m) m.classList.add('hidden'); }

        function onSeriesResourceChange() {
            const resource=document.getElementById('seriesResource').value;
            const modeSelect=document.getElementById('seriesTemplateSelect');
            const playerSection=document.getElementById('seriesPlayersSection');
            const hint=document.getElementById('seriesClubhouseHint');
            modeSelect.innerHTML='';
            if(resource==='Vereinsheim') {
                clubhouseTemplates.forEach(t=>modeSelect.insertAdjacentHTML('beforeend',`<option value="${String(t.name).replace(/"/g,'&quot;')}">${String(t.name).replace(/</g,'&lt;')}</option>`));
                playerSection.classList.add('hidden'); hint.classList.remove('hidden');
            } else {
                eventTemplates.forEach(t=>modeSelect.insertAdjacentHTML('beforeend',`<option value="${String(t.name).replace(/"/g,'&quot;')}" data-players="${t.players||0}">${String(t.name).replace(/</g,'&lt;')} (${t.players||0} Spieler)</option>`));
                playerSection.classList.remove('hidden'); hint.classList.add('hidden'); onSeriesTemplateChange();
            }
        }

        function onSeriesTemplateChange() {
            const resource=document.getElementById('seriesResource').value; if(resource==='Vereinsheim') return;
            const opt=document.getElementById('seriesTemplateSelect').selectedOptions[0]; const count=parseInt(opt?.dataset.players||0);
            for(const prefix of ['home','guest']) for(let i=1;i<=4;i++) { const w=document.getElementById(`series_${prefix}Wrap${i}`); if(w) w.classList.toggle('hidden', i>count); }
        }

        function addDaysLocal(dateStr, days) { const d=new Date(dateStr+'T12:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

        async function handleSeriesReservation() {
            if(currentUser.role !== 'admin') { alert('Nur der Administrator darf Serienreservierungen anlegen.'); return; }
            const start=document.getElementById('seriesStartDate').value, end=document.getElementById('seriesEndDate').value;
            const weekday=parseInt(document.getElementById('seriesWeekday').value);
            const resource=document.getElementById('seriesResource').value;
            const timeFrom=document.getElementById('seriesTimeFrom').value, timeTo=document.getElementById('seriesTimeTo').value;
            const mode=document.getElementById('seriesTemplateSelect').value;
            if(!start||!end||start>end) { alert('Bitte einen gültigen Zeitraum eingeben.'); return; }
            if(!timeFrom||!timeTo||timeFrom>=timeTo) { alert('Die Endzeit muss nach der Startzeit liegen.'); return; }
            let home=[],guest=[];
            if(resource!=='Vereinsheim') {
                const count=parseInt(document.getElementById('seriesTemplateSelect').selectedOptions[0]?.dataset.players||0);
                for(let i=1;i<=count;i++) { const h=document.getElementById(`series_home${i}`)?.value; const g=document.getElementById(`series_guest${i}`)?.value; if(h) home.push(h); if(g) guest.push(g); }
            }
            let created=0, skipped=[];
            for(let d=start; d<=end; d=addDaysLocal(d,1)) {
                const jsDay=new Date(d+'T12:00:00').getDay(); if(jsDay!==weekday) continue;
                const conflict=bookingsList.some(b=>b.date===d && b.resource===resource && b.timeFrom<timeTo && b.timeTo>timeFrom);
                if(conflict) { skipped.push(formatDateDE(d)); continue; }
                const booking={id:Date.now()+created, resource, date:d, timeFrom, timeTo, mode, bookedBy:currentUser.name, homeTeam:[...home], guestTeam:[...guest], series:true};
                bookingsList.push(booking); bookingHistory.push(booking); created++;
            }
            if(created===0) { alert('Es wurde kein Termin angelegt. Prüfen Sie Zeitraum, Wochentag und vorhandene Reservierungen.'); return; }
            await saveDataToFirebase(); renderSavedBookings(); renderAdminStats(); closeSeriesReservationModal();
            alert(`Serienreservierung angelegt: ${created} Termin(e).${skipped.length ? '\n\nÜbersprungen wegen Belegung: '+skipped.join(', ') : ''}`);
        }

        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, ch => ({
                '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
            }[ch]));
        }

        function getHistoryReservationRecords() {
            return bookingHistory.filter(b => b && b.action !== "cancellation");
        }

        function getHistoryCancellationRecords() {
            return bookingHistory.filter(b => b && b.action === "cancellation");
        }

        function ensureStatsYearSelect() {
            const select = document.getElementById('statsYearSelect');
            if(!select) return;
            const years = new Set();
            [...getHistoryReservationRecords(), ...getHistoryCancellationRecords()].forEach(b => {
                if(b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) years.add(parseInt(b.date.slice(0,4)));
            });
            years.add(new Date().getFullYear());
            const sorted = [...years].sort((a,b)=>b-a);
            const old = select.value;
            select.innerHTML = sorted.map(y => `<option value="${y}">${y}</option>`).join('');
            select.value = sorted.includes(parseInt(old)) ? old : String(new Date().getFullYear());
        }

        function renderAdminStats() {
            const container = document.getElementById('adminStatsContainer');
            if(!container) return;
            if(currentUser.role !== 'admin') {
                container.innerHTML = '';
                return;
            }

            ensureStatsYearSelect();
            const selectedYear = parseInt(document.getElementById('statsYearSelect')?.value || new Date().getFullYear());
            const reservations = getHistoryReservationRecords();
            const cancellations = getHistoryCancellationRecords();

            const reservationsByMember = {};
            const cancellationsByMember = {};
            membersList.forEach(m => {
                reservationsByMember[m.name] = 0;
                cancellationsByMember[m.name] = 0;
            });

            reservations.forEach(b => {
                const name = b.bookedBy || 'Unbekannt';
                reservationsByMember[name] = (reservationsByMember[name] || 0) + 1;
            });
            cancellations.forEach(b => {
                const name = b.cancelledBy || b.bookedBy || 'Unbekannt';
                cancellationsByMember[name] = (cancellationsByMember[name] || 0) + 1;
            });

            const monthly = Array.from({length:12}, (_,i) => ({
                month: i,
                reservations: 0,
                cancellations: 0
            }));
            reservations.forEach(b => {
                if(b.date?.startsWith(`${selectedYear}-`)) {
                    const m = parseInt(b.date.slice(5,7)) - 1;
                    if(m >= 0 && m < 12) monthly[m].reservations++;
                }
            });
            cancellations.forEach(b => {
                if(b.date?.startsWith(`${selectedYear}-`)) {
                    const m = parseInt(b.date.slice(5,7)) - 1;
                    if(m >= 0 && m < 12) monthly[m].cancellations++;
                }
            });

            const years = new Set([...reservations, ...cancellations].map(b => b.date?.slice(0,4)).filter(Boolean));
            years.add(String(selectedYear));
            const yearly = [...years].sort((a,b)=>b.localeCompare(a)).map(year => ({
                year,
                reservations: reservations.filter(b => b.date?.startsWith(`${year}-`)).length,
                cancellations: cancellations.filter(b => b.date?.startsWith(`${year}-`)).length
            }));

            const memberNames = new Set([...Object.keys(reservationsByMember), ...Object.keys(cancellationsByMember)]);
            const memberRows = [...memberNames]
                .sort((a,b)=>a.localeCompare(b,'de'))
                .map(name => `
                    <tr>
                        <td>${escapeHtml(name)}</td>
                        <td class="text-center font-bold text-red-300">${reservationsByMember[name] || 0}</td>
                        <td class="text-center font-bold text-amber-300">${cancellationsByMember[name] || 0}</td>
                    </tr>`).join('');

            const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
            const monthRows = monthly.map((m,i) => `
                <tr>
                    <td>${monthNames[i]}</td>
                    <td class="text-center font-bold text-red-300">${m.reservations}</td>
                    <td class="text-center font-bold text-amber-300">${m.cancellations}</td>
                </tr>`).join('');

            const yearRows = yearly.map(y => `
                <tr>
                    <td>${y.year}</td>
                    <td class="text-center font-bold text-red-300">${y.reservations}</td>
                    <td class="text-center font-bold text-amber-300">${y.cancellations}</td>
                </tr>`).join('');

            const recent = [...bookingHistory]
                .sort((a,b) => {
                    const da = a.cancelledAt || `${a.date || ''}T${a.timeFrom || ''}`;
                    const db = b.cancelledAt || `${b.date || ''}T${b.timeFrom || ''}`;
                    return db.localeCompare(da);
                })
                .slice(0, 25);

            const recentRows = recent.length ? recent.map(b => {
                const cancelled = b.action === "cancellation";
                const actor = cancelled ? (b.cancelledBy || 'Unbekannt') : (b.bookedBy || 'Unbekannt');
                const when = cancelled && b.cancelledAt
                    ? new Date(b.cancelledAt).toLocaleString('de-DE')
                    : `${formatDateDE(b.date)} ${b.timeFrom || ''}`;
                return `
                    <tr>
                        <td>${cancelled ? '🗑️ Storniert' : '📅 Reserviert'}</td>
                        <td>${escapeHtml(actor)}</td>
                        <td>${formatDateDE(b.date)} ${b.timeFrom || ''}-${b.timeTo || ''}</td>
                        <td>${escapeHtml(b.resource || '')}</td>
                        <td>${escapeHtml(when)}</td>
                    </tr>`;
            }).join('') : `<tr><td colspan="5" class="text-center text-zinc-500 py-3">Noch keine Historieneinträge vorhanden.</td></tr>`;

            const yearReservations = reservations.filter(b => b.date?.startsWith(`${selectedYear}-`)).length;
            const yearCancellations = cancellations.filter(b => b.date?.startsWith(`${selectedYear}-`)).length;

            container.innerHTML = `
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div class="stats-card"><div class="text-[10px] text-zinc-400">Reservierungen gesamt</div><div class="text-xl font-black text-red-300">${reservations.length}</div></div>
                    <div class="stats-card"><div class="text-[10px] text-zinc-400">Stornierungen gesamt</div><div class="text-xl font-black text-amber-300">${cancellations.length}</div></div>
                    <div class="stats-card"><div class="text-[10px] text-zinc-400">Reservierungen ${selectedYear}</div><div class="text-xl font-black text-red-300">${yearReservations}</div></div>
                    <div class="stats-card"><div class="text-[10px] text-zinc-400">Stornierungen ${selectedYear}</div><div class="text-xl font-black text-amber-300">${yearCancellations}</div></div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    <div class="stats-card overflow-x-auto">
                        <h5 class="font-bold text-red-200 mb-1.5">👤 Auswertung pro Spieler</h5>
                        <table class="stats-table w-full text-left">
                            <thead><tr><th>Spieler / Benutzer</th><th class="text-center">Reserviert</th><th class="text-center">Storniert</th></tr></thead>
                            <tbody>${memberRows || '<tr><td colspan="3" class="text-center text-zinc-500 py-2">Keine Daten</td></tr>'}</tbody>
                        </table>
                    </div>
                    <div class="stats-card overflow-x-auto">
                        <h5 class="font-bold text-red-200 mb-1.5">📅 Monatsübersicht ${selectedYear}</h5>
                        <table class="stats-table w-full text-left">
                            <thead><tr><th>Monat</th><th class="text-center">Reservierungen</th><th class="text-center">Stornierungen</th></tr></thead>
                            <tbody>${monthRows}</tbody>
                        </table>
                    </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    <div class="stats-card overflow-x-auto">
                        <h5 class="font-bold text-red-200 mb-1.5">📈 Jahresübersicht</h5>
                        <table class="stats-table w-full text-left">
                            <thead><tr><th>Jahr</th><th class="text-center">Reservierungen</th><th class="text-center">Stornierungen</th></tr></thead>
                            <tbody>${yearRows}</tbody>
                        </table>
                    </div>
                    <div class="stats-card overflow-x-auto">
                        <h5 class="font-bold text-red-200 mb-1.5">🕘 Letzte 25 Aktionen</h5>
                        <table class="stats-table w-full text-left">
                            <thead><tr><th>Aktion</th><th>Durchgeführt von</th><th>Termin</th><th>Ressource</th><th>Zeitpunkt</th></tr></thead>
                            <tbody>${recentRows}</tbody>
                        </table>
                    </div>
                </div>`;
        }

        async function resetStatistics() {
            if(currentUser.role !== 'admin') { alert("Nur der Administrator darf die Historie zurücksetzen."); return; }
            if(confirm("Möchten Sie die gesamte Reservierungs-Historie wirklich zurücksetzen? Die aktuellen Reservierungen bleiben erhalten.")) {
                bookingHistory = [];
                await saveDataToFirebase();
                renderAdminStats();
                alert("Reservierungs-Historie wurde erfolgreich zurückgesetzt.");
            }
        }

        function printStatistics() {
            if(currentUser.role !== 'admin') { alert("Nur der Administrator darf die Statistik ausdrucken."); return; }
            const reservations = getHistoryReservationRecords();
            const cancellations = getHistoryCancellationRecords();
            const selectedYear = parseInt(document.getElementById('statsYearSelect')?.value || new Date().getFullYear());
            const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

            let byMember = {};
            [...membersList].forEach(m => byMember[m.name] = {r:0,c:0});
            reservations.forEach(b => { byMember[b.bookedBy || 'Unbekannt'] ??= {r:0,c:0}; byMember[b.bookedBy || 'Unbekannt'].r++; });
            cancellations.forEach(b => { const n=b.cancelledBy || b.bookedBy || 'Unbekannt'; byMember[n] ??= {r:0,c:0}; byMember[n].c++; });

            let content = `<html><head><meta charset="utf-8"><title>EC Wegscheid - Reservierungs-Historie</title>
                <style>body{font-family:Arial,sans-serif;padding:24px;color:#222}h1,h2{color:#8b0000}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th,td{border:1px solid #bbb;padding:7px;text-align:left;font-size:12px}th{background:#f3d7d7}td.num{text-align:center;font-weight:bold}</style></head><body>`;
            content += `<h1>EC Wegscheid – Reservierungs-Historie & Statistik</h1>`;
            content += `<h2>Spieler-Auswertung</h2><table><tr><th>Spieler / Benutzer</th><th>Reservierungen</th><th>Stornierungen</th></tr>`;
            Object.keys(byMember).sort((a,b)=>a.localeCompare(b,'de')).forEach(n => content += `<tr><td>${escapeHtml(n)}</td><td class="num">${byMember[n].r}</td><td class="num">${byMember[n].c}</td></tr>`);
            content += `</table><h2>Monatsübersicht ${selectedYear}</h2><table><tr><th>Monat</th><th>Reservierungen</th><th>Stornierungen</th></tr>`;
            for(let i=0;i<12;i++){
                const r=reservations.filter(b=>b.date?.startsWith(`${selectedYear}-${String(i+1).padStart(2,'0')}-`)).length;
                const c=cancellations.filter(b=>b.date?.startsWith(`${selectedYear}-${String(i+1).padStart(2,'0')}-`)).length;
                content += `<tr><td>${monthNames[i]}</td><td class="num">${r}</td><td class="num">${c}</td></tr>`;
            }
            content += `</table><h2>Jahresübersicht</h2><table><tr><th>Jahr</th><th>Reservierungen</th><th>Stornierungen</th></tr>`;
            const years = [...new Set([...reservations,...cancellations].map(b=>b.date?.slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
            years.forEach(y => content += `<tr><td>${y}</td><td class="num">${reservations.filter(b=>b.date?.startsWith(`${y}-`)).length}</td><td class="num">${cancellations.filter(b=>b.date?.startsWith(`${y}-`)).length}</td></tr>`);
            content += `</table><h2>Letzte Aktionen</h2><table><tr><th>Aktion</th><th>Durchgeführt von</th><th>Termin</th><th>Ressource</th><th>Zeitpunkt</th></tr>`;
            [...bookingHistory].slice().reverse().slice(0,100).forEach(b => {
                const cancelled=b.action==="cancellation";
                const actor=cancelled ? (b.cancelledBy || b.bookedBy || 'Unbekannt') : (b.bookedBy || 'Unbekannt');
                const when=cancelled && b.cancelledAt ? new Date(b.cancelledAt).toLocaleString('de-DE') : `${formatDateDE(b.date)} ${b.timeFrom||''}`;
                content += `<tr><td>${cancelled?'Storniert':'Reserviert'}</td><td>${escapeHtml(actor)}</td><td>${formatDateDE(b.date)} ${b.timeFrom||''}-${b.timeTo||''}</td><td>${escapeHtml(b.resource||'')}</td><td>${escapeHtml(when)}</td></tr>`;
            });
            content += `</table>
</body></html>`;
            const printWindow = window.open('', '_blank');
            if(!printWindow) { alert("Das Druckfenster wurde vom Browser blockiert."); return; }
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }

        function renderMembersTable() {
            const tbody = document.getElementById('membersTableBody');
            const headerAction = document.getElementById('adminActionHeader');
            const addSec = document.getElementById('addMemberSection');
            const membersAdminSaveSec = document.getElementById('membersAdminSaveSection');
            const ownPassBox = document.getElementById('ownPasswordChangeBox');
            if(!tbody) return;
            tbody.innerHTML = '';

            if(currentUser.role === 'member' || currentUser.role === 'admin') ownPassBox.classList.remove('hidden');
            else ownPassBox.classList.add('hidden');

            if(currentUser.role === 'admin') {
                headerAction.classList.remove('hidden');
                addSec.classList.remove('hidden');
                membersAdminSaveSec.classList.remove('hidden');
            } else {
                headerAction.classList.add('hidden');
                addSec.classList.add('hidden');
                membersAdminSaveSec.classList.add('hidden');
            }

            membersList.forEach((m, index) => {
                let isActive = m.active !== false;
                let isHidden = m.hidden === true;
                let hasSpecial = m.specialRights === true;

                let nameDisplay = currentUser.role === 'admin' ? 
                    `<input type="text" value="${m.name}" onchange="updateMemberName(${index}, this.value)" class="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 font-medium w-full max-w-[200px]" placeholder="Nachname Vorname">` : 
                    `<span class="font-medium text-zinc-200">${m.name}</span>`;

                let passDisplay = currentUser.role === 'admin' ? 
                    `<input type="text" value="" placeholder="Neues Passwort setzen" onchange="updateMemberPassword(${index}, this.value); this.value='';" class="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 w-32 font-mono text-zinc-200" title="Passwort für dieses Mitglied zurücksetzen (wird gehasht gespeichert)">
                     <div class="text-[9px] mt-0.5 ${m.mustChangePassword ? 'text-amber-400' : 'text-zinc-500'}">${m.mustChangePassword ? '🔑 muss Passwort ändern' : '🔒 gesichert'}</div>` : `••••`;

                let statusBadge = isActive ? 
                    `<span class="bg-green-950 text-green-300 border border-green-800 px-2 py-0.5 rounded text-[10px]">Aktiv</span>` : 
                    `<span class="bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded text-[10px]">Inaktiv</span>`;

                let specialCheckbox = currentUser.role === 'admin' ?
                    `<input type="checkbox" ${hasSpecial ? 'checked' : ''} onchange="toggleSpecialRights(${index})" class="cursor-pointer accent-red-600 w-4 h-4">` :
                    (hasSpecial ? `<span class="text-red-400 font-bold">Ja</span>` : `Nein`);

                let adminActionTd = currentUser.role === 'admin' ? `
                    <td class="p-1.5 flex flex-wrap gap-1.5 items-center">
                        <button type="button" onclick="toggleMemberActive(${index})" class="bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-0.5 rounded text-[10px] cursor-pointer">
                            ${isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                        <button type="button" onclick="toggleMemberHidden(${index})" class="bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-0.5 rounded text-[10px] cursor-pointer">
                            ${isHidden ? 'Einblenden' : 'Ausblenden'}
                        </button>
                        <button type="button" onclick="deleteMember(${index})" class="text-red-500 hover:underline text-[10px] cursor-pointer">Löschen</button>
                    </td>` : '';

                tbody.innerHTML += `
                    <tr class="border-b border-zinc-700 ${!isActive ? 'opacity-50' : ''} ${isHidden ? 'bg-zinc-950/40' : ''}">
                        <td class="p-1.5">${nameDisplay} ${isHidden ? '<span class="text-[9px] text-yellow-500 italic">(Ausgeblendet)</span>' : ''}</td>
                        <td class="p-1.5 font-mono">${passDisplay}</td>
                        <td class="p-1.5">${statusBadge}</td>
                        <td class="p-1.5">${specialCheckbox}</td>
                        ${adminActionTd}
                    </tr>`;
            });
        }

        function openSavePromptModal() {
            document.getElementById('confirmAdminPassInput').value = '';
            document.getElementById('savePromptModal').classList.remove('hidden');
        }

        function closeSavePromptModal() {
            document.getElementById('savePromptModal').classList.add('hidden');
        }

        async function executeAdminSave() {
            const pass = document.getElementById('confirmAdminPassInput').value;
            if(reservationAdminAllowed(pass)) {
                membersList.sort((a, b) => a.name.localeCompare(b.name, 'de'));
                
                await saveDataToFirebase();

                updateMemberCount();
                updateMemberDropdowns();
                populateLoginDropdown();
                renderMembersTable();
                
                closeSavePromptModal();
                alert("Alle Admin-Änderungen wurden erfolgreich gespeichert!");
                switchTab('booking');
            } else {
                alert("Falsches Admin-Passwort! Änderungen wurden nicht gespeichert.");
            }
        }

        function updateMemberName(index, newName) {
            let trimmed = newName.trim();
            if(trimmed) { membersList[index].name = trimmed; }
        }

        function toggleMemberHidden(index) {
            membersList[index].hidden = !membersList[index].hidden;
            renderMembersTable();
            updateMemberDropdowns();
            populateLoginDropdown();
        }

        function toggleSpecialRights(index) {
            membersList[index].specialRights = !membersList[index].specialRights;
        }

        async function changeOwnPassword() {
            const currentPassInput = document.getElementById('ownCurrentPassInput').value.trim();
            const newPass = document.getElementById('ownNewPassInput').value.trim();

            if(!currentPassInput || !newPass) {
                alert("Bitte sowohl das aktuelle als auch das neue Passwort eingeben.");
                return;
            }

            if(currentUser.role === 'admin') {
                if(currentPassInput === adminPassword) {
                    adminPassword = newPass;
                    alert("Admin-Passwort erfolgreich geändert!");
                    document.getElementById('ownCurrentPassInput').value = '';
                    document.getElementById('ownNewPassInput').value = '';
                } else { alert("Das eingegebene aktuelle Admin-Passwort ist falsch!"); }
            } else {
                let member = membersList.find(m => m.name === currentUser.name);
                if(member) {
                    let currentOk = false;
                    if(member.passHash) {
                        currentOk = (await hashMemberPassword(member.name, currentPassInput)) === member.passHash;
                    } else if(member.pass !== undefined) {
                        currentOk = (member.pass === currentPassInput);
                    }
                    if(currentOk) {
                        member.passHash = await hashMemberPassword(member.name, newPass);
                        delete member.pass;
                        member.mustChangePassword = false;
                        await saveDataToFirebase();
                        alert(`Passwort für ${member.name} erfolgreich geändert und gespeichert!`);
                        document.getElementById('ownCurrentPassInput').value = '';
                        document.getElementById('ownNewPassInput').value = '';
                    } else { alert("Das eingegebene aktuelle Passwort ist falsch!"); }
                }
            }
            renderMembersTable();
        }

        async function addMember() {
            const name = document.getElementById('newMemberName').value.trim();
            const pass = document.getElementById('newMemberPass').value.trim();
            if(name && pass) {
                const passHash = await hashMemberPassword(name, pass);
                membersList.push({ name: name, passHash: passHash, active: true, hidden: false, specialRights: false, mustChangePassword: true });
                membersList.sort((a, b) => a.name.localeCompare(b.name, 'de'));
                await saveDataToFirebase();
                document.getElementById('newMemberName').value = '';
                document.getElementById('newMemberPass').value = '';
                updateMemberCount(); updateMemberDropdowns(); populateLoginDropdown(); renderMembersTable();
                alert(`Mitglied ${name} hinzugefügt!`);
            }
        }

        async function toggleMemberActive(index) {
            membersList[index].active = membersList[index].active === false ? true : false;
            await saveDataToFirebase();
            renderMembersTable();
            updateMemberCount();
            updateMemberDropdowns();
            populateLoginDropdown();
        }

        async function deleteMember(index) {
            membersList.splice(index, 1);
            await saveDataToFirebase();
            renderMembersTable();
        }

        async function updateMemberPassword(index, newPass) {
            if(!newPass) return;
            const member = membersList[index];
            member.passHash = await hashMemberPassword(member.name, newPass);
            delete member.pass;
            // Ein vom Admin gesetztes Passwort gilt als neues Startpasswort:
            // Das Mitglied muss es beim nächsten Login selbst ändern.
            member.mustChangePassword = true;
            renderMembersTable();
        }

        function changeAdminPassword() {
            const newPass = document.getElementById('newAdminPassInput').value.trim();
            if(newPass) {
                adminPassword = newPass;
                document.getElementById('newAdminPassInput').value = '';
                alert("Admin-Passwort vorgemerkt! Bitte klicken Sie auf 'Änderungen speichern & zurück'.");
            }
        }

        function switchTab(tab) {
            document.getElementById('tabBooking').classList.add('hidden');
            document.getElementById('tabMembers').classList.add('hidden');
            document.getElementById('tabAdmin').classList.add('hidden');
            
            document.getElementById('navBooking').className = "navAdminOnly py-1 border-b-2 border-transparent text-zinc-400 hover:text-white font-semibold cursor-pointer";
            document.getElementById('navMembers').className = "navAdminOnly py-1 border-b-2 border-transparent text-zinc-400 hover:text-white font-semibold cursor-pointer";
            document.getElementById('navAdmin').className = "py-1 border-b-2 border-transparent text-zinc-400 hover:text-white font-semibold hidden cursor-pointer";

            if(currentUser.role === 'admin') document.getElementById('navAdmin').classList.remove('hidden');

            if(tab === 'members' && currentUser.role !== 'admin') return;

            if(tab === 'booking') {
                document.getElementById('tabBooking').classList.remove('hidden');
                document.getElementById('navBooking').className = "navAdminOnly py-1 border-b-2 border-red-600 font-semibold text-white cursor-pointer";
            } else if(tab === 'members') {
                document.getElementById('tabMembers').classList.remove('hidden');
                document.getElementById('navMembers').className = "navAdminOnly py-1 border-b-2 border-red-600 font-semibold text-white cursor-pointer";
            } else if(tab === 'admin' && currentUser.role === 'admin') {
                document.getElementById('tabAdmin').classList.remove('hidden');
                document.getElementById('navAdmin').className = "py-1 border-b-2 border-red-600 font-semibold text-white cursor-pointer";
                renderAdminStats();
            }
        }

        function updateUserStatusUI() {
            document.body.classList.toggle('adminMode', currentUser && currentUser.role === 'admin');
            const btn = document.getElementById('userLoginButton');
            const logoutBtn = document.getElementById('logoutButton');
            if (currentUser.role === 'admin') {
                btn.innerText = "⚙️ Administrator";
                btn.className = "bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 px-2.5 py-1 rounded font-bold transition cursor-pointer text-xs";
                document.getElementById('navAdmin').classList.remove('hidden');
                logoutBtn.classList.remove('hidden');
            } else if (currentUser.role === 'member') {
                btn.innerText = `👤 ${currentUser.name}`;
                btn.className = "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 px-2.5 py-1 rounded font-semibold transition cursor-pointer text-xs";
                document.getElementById('navAdmin').classList.add('hidden');
                logoutBtn.classList.remove('hidden');
            } else {
                btn.innerText = "🔐 Login";
                btn.className = "bg-red-700 hover:bg-red-800 text-white px-2.5 py-1 rounded font-semibold transition cursor-pointer text-xs";
                document.getElementById('navAdmin').classList.add('hidden');
                logoutBtn.classList.add('hidden');
            }
            renderMembersTable();
        }

        // Meldet den aktuellen Benutzer ab und öffnet direkt die Anmeldung,
        // damit z. B. beim Testen oder bei einem Geräte-/Vereinsheim-Tablet
        // problemlos ein anderer Name ausgewählt werden kann.
        function logoutUser() {
            currentUser = { role: 'guest', name: '' };
            localStorage.removeItem('ecw_currentUser');
            editingBookingId = null;
            updateUserStatusUI();
            renderSavedBookings();
            switchTab('booking');
            openLoginModal();
        }

        function openLoginModal() { 
            document.getElementById('loginModal').classList.remove('hidden'); 
            document.getElementById('loginPasswordInput').value = '';
        }
        function closeLoginModal() { document.getElementById('loginModal').classList.add('hidden'); }

        async function verifyLogin() {
            const selectedVal = document.getElementById('loginUserSelect').value;
            const pass = document.getElementById('loginPasswordInput').value;

            if(selectedVal === 'admin') {
                if(reservationAdminAllowed(pass)) {
                    currentUser = { role: 'admin', name: 'Administrator' };
                    localStorage.setItem('ecw_currentUser', JSON.stringify(currentUser));
                    updateUserStatusUI();
                    closeLoginModal(); 
                    switchTab('admin'); 
                } else { 
                    alert("Falsches Admin-Passwort!"); 
                }
            } else {
                let member = membersList.find(m => m.name === selectedVal);
                if(!member) { alert("Falsches Passwort!"); return; }

                let loginOk = false;
                if(member.passHash) {
                    const inputHash = await hashMemberPassword(member.name, pass);
                    loginOk = (inputHash === member.passHash);
                } else if(member.pass !== undefined) {
                    // Alt-Datensatz mit Klartext-Passwort (z. B. aus einer früheren
                    // Version): einmalig prüfen und danach sofort auf Hash umstellen.
                    if(member.pass === pass) {
                        loginOk = true;
                        member.passHash = await hashMemberPassword(member.name, pass);
                        delete member.pass;
                        await saveDataToFirebase();
                    }
                }

                if(loginOk) {
                    currentUser = { role: 'member', name: member.name };
                    localStorage.setItem('ecw_currentUser', JSON.stringify(currentUser));
                    updateUserStatusUI();
                    closeLoginModal();
                    if (member.mustChangePassword) {
                        openForcedPasswordModal();
                    } else {
                        switchTab('booking');
                    }
                } else { 
                    alert("Falsches Passwort!"); 
                }
            }
        }

        // Verpflichtende Passwort-Änderung (z. B. beim ersten Login mit dem
        // Standardpasswort 1234, oder nachdem der Administrator ein Passwort
        // zurückgesetzt hat). Dieses Modal hat bewusst keinen Abbrechen-Button.
        function openForcedPasswordModal() {
            document.getElementById('forcedNewPassInput').value = '';
            document.getElementById('forcedNewPassConfirm').value = '';
            document.getElementById('forcedPasswordModal').classList.remove('hidden');
        }

        async function submitForcedPasswordChange() {
            const newPass = document.getElementById('forcedNewPassInput').value.trim();
            const confirmPass = document.getElementById('forcedNewPassConfirm').value.trim();

            if(!newPass || !confirmPass) {
                alert("Bitte das neue Passwort in beiden Feldern eingeben.");
                return;
            }
            if(newPass === '1234') {
                alert("Bitte ein anderes Passwort als das Standardpasswort 1234 wählen.");
                return;
            }
            if(newPass !== confirmPass) {
                alert("Die beiden Passwörter stimmen nicht überein.");
                return;
            }

            let member = membersList.find(m => m.name === currentUser.name);
            if(member) {
                member.passHash = await hashMemberPassword(member.name, newPass);
                delete member.pass;
                member.mustChangePassword = false;
                await saveDataToFirebase();
                renderMembersTable();
            }
            document.getElementById('forcedPasswordModal').classList.add('hidden');
            alert("Passwort erfolgreich geändert!");
            switchTab('booking');
        }

        async function handleBooking(event) {
            event.preventDefault();
            const resource = document.getElementById('modalSelectedResource').value;
            const date = document.getElementById('modalBookDate').value;
            const timeFrom = document.getElementById('modalTimeFrom').value;
            const timeTo = document.getElementById('modalTimeTo').value;
            const template = document.getElementById('modalTemplateSelect').value;

            let todayStr = getTodayFormatted();
            if(currentUser.role !== 'admin' && date < todayStr) {
                alert("Reservierungen in der Vergangenheit sind nicht möglich!");
                return;
            }

            let homeTeam = [];
            let guestTeam = [];

            for (let i = 1; i <= 4; i++) {
                const hp = document.getElementById(`homePlayer${i}`);
                const gp = document.getElementById(`guestPlayer${i}`);
                const hf = document.getElementById(`field_homePlayer${i}`);
                const gf = document.getElementById(`field_guestPlayer${i}`);
                if (hp && hf && hf.style.display !== 'none' && hp.value) homeTeam.push(hp.value);
                if (gp && gf && gf.style.display !== 'none' && gp.value) guestTeam.push(gp.value);
            }

            if(editingBookingId !== null) {
                let b = bookingsList.find(item => item.id === editingBookingId);
                if(!canManageReservation(b)) {
                    alert("Keine Berechtigung zum Ändern dieser Reservierung.");
                    return;
                }
                if(b) {
                    b.resource = resource; b.date = date; b.timeFrom = timeFrom; b.timeTo = timeTo;
                    b.mode = template; b.homeTeam = homeTeam; b.guestTeam = guestTeam;
                    b.lastEditedBy = currentUser.name;
                    b.lastEditedAt = new Date().toISOString();
                }
                alert("Reservierung erfolgreich aktualisiert!");
                editingBookingId = null;
            } else {
                let newBooking = {
                    id: Date.now(),
                    resource: resource,
                    date: date,
                    timeFrom: timeFrom,
                    timeTo: timeTo,
                    mode: template,
                    bookedBy: currentUser.name,
                    homeTeam: homeTeam,
                    guestTeam: guestTeam
                };
                bookingsList.push(newBooking);
                bookingHistory.push(newBooking);
                alert(`Erfolgreich gebucht: ${resource} (${timeFrom} - ${timeTo} Uhr)!` );
            }

            await saveDataToFirebase();
            renderSavedBookings();
            renderAdminStats();
            closeBookingModal();
        }
    
        // Beendet die Web-App bestmöglich und gibt den Fokus an das zuvor geöffnete
        // Fenster zurück. Browser erlauben window.close() nur in bestimmten Fällen.
        function exitToStartPage() {
            const home = new URL("index.html#startseite",window.ECW_SITE_BASE||location.href).href;
            if (window.self !== window.top) {
                try {
                    const host = window.parent;
                    const external = host.document.getElementById('externalFrame');
                    const admin = host.document.getElementById('ecwReservationAdminFrame');
                    if (external && external.contentWindow === window && typeof host.closeExternalPage === 'function') {
                        host.closeExternalPage();
                        return;
                    }
                    if (admin && admin.contentWindow === window && typeof host.renderAdminMenuLanding === 'function') {
                        host.renderAdminMenuLanding();
                        return;
                    }
                } catch (e) {
                    // The host's existing return button remains usable across origins.
                }
                const msg = document.getElementById('exitMessage');
                if (msg) msg.style.display = 'flex';
                return;
            }
            // Use a defined destination; no logout, window closing or browser-history guess.
            window.location.assign(home);
        }

        function closeExitMessage() {
            const msg = document.getElementById('exitMessage');
            if (msg) msg.style.display = 'none';
        }


function reservationAdminAllowed(pass){try{if(window.parent!==window&&window.parent.location.origin===location.origin&&window.parent.firebaseAuthUser&&window.parent.appPermissions?.admin===true)return true}catch{}return typeof adminPassword==='string'&&adminPassword.length>0&&pass===adminPassword}
