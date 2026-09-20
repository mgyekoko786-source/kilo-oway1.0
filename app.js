/* Kilo Oway - app.js
   Version 1.1
   Complete replacement JavaScript
*/

"use strict";

/* =========================
   SETTINGS
========================= */

const DEFAULT_SETTINGS = {
    baseFare: 3000,
    perKm: 1000,
    perMinute: 150
};

let settings = loadSettings();

/* =========================
   STATE
========================= */

let isRunning = false;
let isWaiting = false;

let totalDistance = 0;
let totalWaitingMs = 0;

let startTime = 0;
let waitingStartTime = 0;

let currentSpeed = 0;

let lastPosition = null;
let lastGpsTime = 0;
let watchId = null;

let timerId = null;
let reminderTimer = null;

let audioContext = null;

/* =========================
   DOM HELPERS
========================= */

function $(id) {
    return document.getElementById(id);
}

const mainBtn = $("mainBtn");
const mainBtnIcon = $("mainBtnIcon");
const mainBtnText = $("mainBtnText");

const waitingBtn = $("waitingBtn");
const waitingBtnIcon = $("waitingBtnIcon");
const waitingBtnText = $("waitingBtnText");
const waitingStatusText = $("waitingStatusText");

const totalFareEl = $("totalFare");
const distanceEl = $("distance");
const durationEl = $("duration");
const waitingTimeEl = $("waitingTime");
const speedEl = $("speed");

const baseFareText = $("baseFareText");
const perKmText = $("perKmText");
const perMinuteText = $("perMinuteText");

const gpsStatusEl = $("gpsStatus");
const gpsAccuracyEl = $("gpsAccuracy");
const gpsDot = $("gpsDot");

const warningBox = $("warningBox");
const warningText = $("warningText");

const historyModal = $("historyModal");
const historyList = $("historyList");
const settingsModal = $("settingsModal");

/* =========================
   NUMBER / TIME FORMAT
========================= */

function formatMoney(value) {
    const number = Number(value) || 0;
    return Math.round(number).toLocaleString("en-US");
}

function formatTime(milliseconds) {
    const totalSeconds = Math.max(
        0,
        Math.floor((Number(milliseconds) || 0) / 1000)
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
    );
}

/* =========================
   SETTINGS STORAGE
========================= */

function loadSettings() {
    try {
        const saved = localStorage.getItem("kiloOwaySettings");

        if (!saved) {
            return { ...DEFAULT_SETTINGS };
        }

        const parsed = JSON.parse(saved);

        return {
            baseFare: Number.isFinite(Number(parsed.baseFare))
                ? Math.max(0, Math.round(Number(parsed.baseFare)))
                : DEFAULT_SETTINGS.baseFare,

            perKm: Number.isFinite(Number(parsed.perKm))
                ? Math.max(0, Math.round(Number(parsed.perKm)))
                : DEFAULT_SETTINGS.perKm,

            perMinute: Number.isFinite(Number(parsed.perMinute))
                ? Math.max(0, Math.round(Number(parsed.perMinute)))
                : DEFAULT_SETTINGS.perMinute
        };
    } catch (error) {
        console.log("Settings load error:", error);
        return { ...DEFAULT_SETTINGS };
    }
}

/* =========================
   GPS DISTANCE
========================= */

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;

    const p1 = Number(lat1) * Math.PI / 180;
    const p2 = Number(lat2) * Math.PI / 180;

    const dLat =
        (Number(lat2) - Number(lat1)) *
        Math.PI / 180;

    const dLon =
        (Number(lon2) - Number(lon1)) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(p1) *
        Math.cos(p2) *
        Math.sin(dLon / 2) ** 2;

    return (
        2 *
        R *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        )
    );
}

/* =========================
   WAITING TIME
========================= */

function getCurrentWaitingMs() {
    if (
        isRunning &&
        isWaiting &&
        waitingStartTime > 0
    ) {
        return (
            totalWaitingMs +
            (Date.now() - waitingStartTime)
        );
    }

    return totalWaitingMs;
}

/* =========================
   FARE
   Waiting is calculated
   in 10-second units.
   perMinute / 6 = one unit.
========================= */

function calculateFare() {
    const waitingMs = getCurrentWaitingMs();

    const waitingUnits = Math.floor(
        waitingMs / 10000
    );

    const waitingFare = Math.round(
        waitingUnits *
        settings.perMinute /
        6
    );

    const distanceFare =
        totalDistance *
        settings.perKm;

    const fare =
        settings.baseFare +
        distanceFare +
        waitingFare;

    return Math.max(
        settings.baseFare,
        Math.round(fare)
    );
}

/* =========================
   UI
========================= */

function updateUI() {
    if (totalFareEl) {
        totalFareEl.textContent =
            formatMoney(calculateFare());
    }

    if (distanceEl) {
        distanceEl.textContent =
            totalDistance.toFixed(2);
    }

    if (durationEl) {
        const duration =
            isRunning && startTime > 0
                ? Date.now() - startTime
                : 0;

        durationEl.textContent =
            formatTime(duration);
    }

    if (waitingTimeEl) {
        waitingTimeEl.textContent =
            formatTime(getCurrentWaitingMs());
    }

    if (speedEl) {
        const safeSpeed =
            Number.isFinite(currentSpeed)
                ? Math.max(0, currentSpeed)
                : 0;

        speedEl.textContent =
            safeSpeed.toFixed(1);
    }

    if (baseFareText) {
        baseFareText.textContent =
            formatMoney(settings.baseFare);
    }

    if (perKmText) {
        perKmText.textContent =
            formatMoney(settings.perKm);
    }

    if (perMinuteText) {
        perMinuteText.textContent =
            formatMoney(settings.perMinute);
    }
}

/* =========================
   GPS STATUS
========================= */

function setGpsStatus(type, title, subtitle) {
    if (gpsStatusEl) {
        gpsStatusEl.textContent = title;
    }

    if (gpsAccuracyEl) {
        gpsAccuracyEl.textContent = subtitle;
    }

    if (gpsDot) {
        gpsDot.classList.remove(
            "connected",
            "weak",
            "error"
        );

        if (type) {
            gpsDot.classList.add(type);
        }
    }
}

/* =========================
   GPS START
========================= */

function startGPS() {
    if (!navigator.geolocation) {
        setGpsStatus(
            "error",
            "GPS မရနိုင်ပါ",
            "ဒီစက်တွင် Geolocation မထောက်ပံ့ပါ"
        );

        showWarning(
            "ဒီဖုန်းတွင် GPS Location မရနိုင်ပါ။"
        );

        return;
    }

    if (watchId !== null) {
        navigator.geolocation.clearWatch(
            watchId
        );
        watchId = null;
    }

    setGpsStatus(
        "weak",
        "GPS ရှာနေသည်",
        "Location signal စောင့်နေပါသည်"
    );

    watchId =
        navigator.geolocation.watchPosition(
            handlePosition,
            handleGpsError,
            {
                enableHighAccuracy: true,
                maximumAge: 1000,
                timeout: 15000
            }
        );
}

/* =========================
   GPS POSITION FILTER
========================= */

function handlePosition(position) {
    if (!isRunning || isWaiting) {
        return;
    }

    const coords = position.coords;

    const lat = Number(coords.latitude);
    const lon = Number(coords.longitude);
    const accuracy = Number(coords.accuracy);

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        !Number.isFinite(accuracy)
    ) {
        return;
    }

    /* Bad GPS accuracy is ignored */
    if (accuracy > 25) {
        setGpsStatus(
            "weak",
            "GPS အချက်အလက် မတိကျသေးပါ",
            "Accuracy ±" +
            Math.round(accuracy) +
            " m"
        );

        currentSpeed = 0;
        updateUI();
        return;
    }

    const now = Date.now();

    const gpsSpeedMps =
        Number.isFinite(Number(coords.speed)) &&
        Number(coords.speed) >= 0
            ? Number(coords.speed)
            : 0;

    const newPoint = {
        lat,
        lon,
        accuracy,
        time: now,
        speed: gpsSpeedMps
    };

    /* First good GPS point becomes anchor */
    if (!lastPosition) {
        lastPosition = newPoint;
        lastGpsTime = now;
        currentSpeed = gpsSpeedMps * 3.6;

        setGpsStatus(
            "connected",
            "GPS ချိတ်ဆက်ပြီး",
            "Accuracy ±" +
            Math.round(accuracy) +
            " m"
        );

        updateUI();
        return;
    }

    const elapsed =
        (now - lastPosition.time) / 1000;

    if (
        elapsed <= 0 ||
        elapsed > 30
    ) {
        lastPosition = newPoint;
        lastGpsTime = now;
        currentSpeed = 0;
        updateUI();
        return;
    }

    const distanceMeters =
        haversineDistance(
            lastPosition.lat,
            lastPosition.lon,
            newPoint.lat,
            newPoint.lon
        );

    /*
      Reject tiny GPS movement.
      IMPORTANT:
      lastPosition is NOT moved here.
      This prevents stationary GPS drift
      from accumulating into kilometers.
    */
    if (distanceMeters < 10) {
        currentSpeed = 0;

        setGpsStatus(
            "connected",
            "GPS ချိတ်ဆက်ပြီး",
            "Accuracy ±" +
            Math.round(accuracy) +
            " m"
        );

        updateUI();
        return;
    }

    const calculatedSpeed =
        (distanceMeters / elapsed) * 3.6;

    const gpsSpeed =
        gpsSpeedMps * 3.6;

    /* Impossible jump */
    if (calculatedSpeed > 120) {
        currentSpeed = 0;
        return;
    }

    /*
      If both calculated and GPS speed are very low,
      treat the movement as GPS jitter.
    */
    if (
        gpsSpeed < 3 &&
        calculatedSpeed < 5
    ) {
        currentSpeed = 0;
        updateUI();
        return;
    }

    /*
      Accept only believable movement.
    */
    totalDistance +=
        distanceMeters / 1000;

    currentSpeed =
        gpsSpeed >= 3
            ? gpsSpeed
            : calculatedSpeed;

    lastPosition = newPoint;
    lastGpsTime = now;

    setGpsStatus(
        "connected",
        "GPS ချိတ်ဆက်ပြီး",
        "Accuracy ±" +
        Math.round(accuracy) +
        " m"
    );

    updateUI();
}

/* =========================
   GPS ERROR
========================= */

function handleGpsError(error) {
    let message =
        "GPS အချက်အလက် မရရှိသေးပါ။";

    if (error && error.code === 1) {
        message =
            "Location permission ခွင့်ပြုပါ။";
    } else if (error && error.code === 2) {
        message =
            "GPS signal မရသေးပါ။";
    } else if (error && error.code === 3) {
        message =
            "GPS timeout ဖြစ်နေပါသည်။";
    }

    setGpsStatus(
        "error",
        "GPS အခက်အခဲ",
        message
    );

    if (isRunning) {
        showWarning(message);
    }
}

/* =========================
   GPS TIMEOUT CHECK
========================= */

function checkGpsTimeout() {
    if (!isRunning || isWaiting) {
        return;
    }

    if (
        lastGpsTime > 0 &&
        Date.now() - lastGpsTime > 20000
    ) {
        setGpsStatus(
            "weak",
            "GPS signal အားနည်းနေသည်",
            "Location ပြန်ရှာနေပါသည်"
        );
    }
}

/* =========================
   WARNING
========================= */

function showWarning(message, autoHide = true) {
    if (!warningBox || !warningText) {
        return;
    }

    warningText.textContent =
        String(message || "");

    warningBox.classList.remove("hidden");

    if (autoHide) {
        setTimeout(() => {
            hideWarning();
        }, 4000);
    }
}

function hideWarning() {
    if (warningBox) {
        warningBox.classList.add("hidden");
    }
}

/* =========================
   START / STOP
========================= */

function startTrip() {
    if (isRunning) {
        stopTrip();
        return;
    }

    initAudio();

    totalDistance = 0;
    totalWaitingMs = 0;
    currentSpeed = 0;

    startTime = Date.now();

    waitingStartTime = 0;
    isWaiting = false;

    lastPosition = null;
    lastGpsTime = 0;

    isRunning = true;

    mainBtn?.classList.add("stop");

    if (mainBtnIcon) {
        mainBtnIcon.textContent = "■";
    }

    if (mainBtnText) {
        mainBtnText.textContent =
            "ရပ်တန့်";
    }

    waitingBtn?.classList.remove("active");

    if (waitingBtnIcon) {
        waitingBtnIcon.textContent = "○";
    }

    if (waitingBtnText) {
        waitingBtnText.textContent =
            "စောင့်ဆိုင်းရန်";
    }

    if (waitingStatusText) {
        waitingStatusText.textContent =
            "ခလုတ်နှိပ်၍ စတင်နိုင်ပါသည်";
    }

    hideWarning();

    startGPS();

    if (timerId !== null) {
        clearInterval(timerId);
    }

    timerId = setInterval(() => {
        updateUI();
        checkGpsTimeout();
    }, 500);

    updateUI();
}

/* =========================
   STOP TRIP
========================= */

function stopTrip() {
    if (!isRunning) {
        return;
    }

    if (isWaiting) {
        totalWaitingMs +=
            Date.now() - waitingStartTime;

        isWaiting = false;
        waitingStartTime = 0;
    }

    const finalWaiting =
        totalWaitingMs;

    const finalDuration =
        Date.now() - startTime;

    const finalDistance =
        totalDistance;

    /* Same fare calculation as live screen */
    const finalFare =
        calculateFare();

    const record = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        distance: finalDistance,
        duration: finalDuration,
        waiting: finalWaiting,
        fare: finalFare
    };

    saveHistory(record);

    isRunning = false;
    isWaiting = false;
    currentSpeed = 0;

    if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
    }

    stopWaitingReminder();

    if (watchId !== null) {
        navigator.geolocation.clearWatch(
            watchId
        );
        watchId = null;
    }

    mainBtn?.classList.remove("stop");

    if (mainBtnIcon) {
        mainBtnIcon.textContent = "▶";
    }

    if (mainBtnText) {
        mainBtnText.textContent =
            "စတင်";
    }

    waitingBtn?.classList.remove("active");

    if (waitingBtnIcon) {
        waitingBtnIcon.textContent = "○";
    }

    if (waitingBtnText) {
        waitingBtnText.textContent =
            "စောင့်ဆိုင်းရန်";
    }

    if (waitingStatusText) {
        waitingStatusText.textContent =
            "ခလုတ်နှိပ်၍ စတင်နိုင်ပါသည်";
    }

    lastPosition = null;
    lastGpsTime = 0;

    updateUI();

    setGpsStatus(
        "waiting",
        "GPS အသင့်",
        "နောက်ခရီးစဉ်အတွက် စောင့်နေပါသည်"
    );

    showWarning(
        "ခရီးစဉ်ကို မှတ်တမ်းထဲ သိမ်းပြီးပါပြီ။",
        false
    );

    setTimeout(hideWarning, 2500);
}

/* =========================
   WAITING
========================= */

function toggleWaiting() {
    if (!isRunning) {
        showWarning(
            "အရင်ဆုံး “စတင်” ခလုတ်ကို နှိပ်ပါ။"
        );
        return;
    }

    initAudio();

    if (!isWaiting) {
        isWaiting = true;
        waitingStartTime = Date.now();

        /*
          Reset GPS anchor.
          Movement while waiting must not be
          counted as driving distance.
        */
        lastPosition = null;
        lastGpsTime = 0;

        currentSpeed = 0;

        waitingBtn?.classList.add("active");

        if (waitingBtnIcon) {
            waitingBtnIcon.textContent = "●";
        }

        if (waitingBtnText) {
            waitingBtnText.textContent =
                "စောင့်နေသည်";
        }

        if (waitingStatusText) {
            waitingStatusText.textContent =
                "စောင့်ဆိုင်းချိန် ဆက်လက်တွက်နေသည်";
        }

        startWaitingReminder();
        updateUI();
        return;
    }

    totalWaitingMs +=
        Date.now() - waitingStartTime;

    waitingStartTime = 0;
    isWaiting = false;

    waitingBtn?.classList.remove("active");

    if (waitingBtnIcon) {
        waitingBtnIcon.textContent = "○";
    }

    if (waitingBtnText) {
        waitingBtnText.textContent =
            "စောင့်ဆိုင်းရန်";
    }

    if (waitingStatusText) {
        waitingStatusText.textContent =
            "စောင့်ဆိုင်းချိန် ရပ်ထားသည်";
    }

    stopWaitingReminder();

    /* New GPS anchor after waiting */
    lastPosition = null;
    lastGpsTime = 0;

    updateUI();
}

/* =========================
   WAITING REMINDER
========================= */

function startWaitingReminder() {
    stopWaitingReminder();

    reminderTimer = setTimeout(() => {
        if (isRunning && isWaiting) {
            playReminder();

            showWarning(
                "စောင့်ဆိုင်းချိန် ဖွင့်ထားဆဲဖြစ်ပါသည်။ မောင်းနေပြီဆိုရင် စောင့်ဆိုင်းမှုကို ပိတ်ပါ။"
            );

            reminderTimer = setInterval(() => {
                if (isRunning && isWaiting) {
                    playReminder();

                    showWarning(
                        "စောင့်ဆိုင်းချိန် ဖွင့်ထားဆဲဖြစ်ပါသည်။"
                    );
                }
            }, 60000);
        }
    }, 60000);
}

function stopWaitingReminder() {
    if (reminderTimer !== null) {
        clearTimeout(reminderTimer);
        clearInterval(reminderTimer);
        reminderTimer = null;
    }
}

/* =========================
   AUDIO
========================= */

function initAudio() {
    try {
        if (!audioContext) {
            const AudioCtx =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioCtx) {
                return;
            }

            audioContext =
                new AudioCtx();
        }

        if (
            audioContext.state ===
            "suspended"
        ) {
            audioContext.resume();
        }
    } catch (error) {
        console.log(
            "Audio unavailable:",
            error
        );
    }
}

function playReminder() {
    try {
        initAudio();

        if (!audioContext) {
            return;
        }

        const oscillator =
            audioContext.createOscillator();

        const gain =
            audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 880;

        const now =
            audioContext.currentTime;

        gain.gain.setValueAtTime(
            0.001,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.20,
            now + 0.05
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.50
        );

        oscillator.connect(gain);
        gain.connect(
            audioContext.destination
        );

        oscillator.start(now);
        oscillator.stop(now + 0.55);
    } catch (error) {
        console.log(
            "Reminder sound error:",
            error
        );
    }
}

/* =========================
   HISTORY
========================= */

function saveHistory(record) {
    try {
        const saved =
            localStorage.getItem(
                "kiloOwayHistory"
            );

        let history =
            saved
                ? JSON.parse(saved)
                : [];

        if (!Array.isArray(history)) {
            history = [];
        }

        history.unshift(record);

        history =
            history.slice(0, 100);

        localStorage.setItem(
            "kiloOwayHistory",
            JSON.stringify(history)
        );
    } catch (error) {
        console.log(
            "History save error:",
            error
        );
    }
}

function loadHistory() {
    try {
        const saved =
            localStorage.getItem(
                "kiloOwayHistory"
            );

        if (!saved) {
            return [];
        }

        const history =
            JSON.parse(saved);

        return Array.isArray(history)
            ? history
            : [];
    } catch (error) {
        console.log(
            "History load error:",
            error
        );

        return [];
    }
}

function renderHistory() {
    if (!historyList) {
        return;
    }

    const history =
        loadHistory();

    if (history.length === 0) {
        historyList.innerHTML =
            `<div class="empty-history">ခရီးမှတ်တမ်း မရှိသေးပါ။</div>`;

        return;
    }

    historyList.innerHTML =
        history.map(item => {
            return `
                <div class="history-item">
                    <div class="history-top">
                        <span>${escapeHtml(item.date)}</span>
                        <strong>
                            ${formatMoney(item.fare)} Ks
                        </strong>
                    </div>

                    <div class="history-details">
                        <span>
                            📍 ${Number(item.distance || 0).toFixed(2)} km
                        </span>

                        <span>
                            ◷ ${formatTime(item.duration)}
                        </span>

                        <span>
                            ⏱ ${formatTime(item.waiting)}
                        </span>
                    </div>
                </div>
            `;
        }).join("");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function openHistory() {
    renderHistory();

    historyModal?.classList.remove(
        "hidden"
    );
}

function closeHistoryModal() {
    historyModal?.classList.add(
        "hidden"
    );
}

/* =========================
   SETTINGS UI
========================= */

function loadSettingsUI() {
    const baseInput =
        $("baseFareInput");

    const kmInput =
        $("perKmInput");

    const minuteInput =
        $("perMinuteInput");

    if (baseInput) {
        baseInput.value =
            settings.baseFare;
    }

    if (kmInput) {
        kmInput.value =
            settings.perKm;
    }

    if (minuteInput) {
        minuteInput.value =
            settings.perMinute;
    }
}

function saveSettings() {
    const baseInput =
        $("baseFareInput");

    const kmInput =
        $("perKmInput");

    const minuteInput =
        $("perMinuteInput");

    if (
        !baseInput ||
        !kmInput ||
        !minuteInput
    ) {
        return;
    }

    const base =
        Number(baseInput.value);

    const km =
        Number(kmInput.value);

    const minute =
        Number(minuteInput.value);

    if (
        !Number.isFinite(base) ||
        base < 0
    ) {
        alert(
            "အခြေခံဈေးနှုန်း မှန်ကန်စွာထည့်ပါ။"
        );
        return;
    }

    if (
        !Number.isFinite(km) ||
        km < 0
    ) {
        alert(
            "1 Kilometer ဈေးနှုန်း မှန်ကန်စွာထည့်ပါ။"
        );
        return;
    }

    if (
        !Number.isFinite(minute) ||
        minute < 0
    ) {
        alert(
            "စောင့်ဆိုင်းဈေးနှုန်း မှန်ကန်စွာထည့်ပါ။"
        );
        return;
    }

    settings = {
        baseFare: Math.round(base),
        perKm: Math.round(km),
        perMinute: Math.round(minute)
    };

    localStorage.setItem(
        "kiloOwaySettings",
        JSON.stringify(settings)
    );

    loadSettingsUI();
    updateUI();

    settingsModal?.classList.add(
        "hidden"
    );

    showWarning(
        "ဈေးနှုန်းဆက်တင်များ သိမ်းပြီးပါပြီ။"
    );
}

function resetSettings() {
    const ok = confirm(
        "မူလဈေးနှုန်း 3,000 / 1,000 / 150 Ks သို့ ပြန်ထားမလား?"
    );

    if (!ok) {
        return;
    }

    settings = {
        ...DEFAULT_SETTINGS
    };

    localStorage.setItem(
        "kiloOwaySettings",
        JSON.stringify(settings)
    );

    loadSettingsUI();
    updateUI();

    showWarning(
        "မူလဈေးနှုန်းသို့ ပြန်ထားပြီးပါပြီ။"
    );
}

function openSettings() {
    loadSettingsUI();

    settingsModal?.classList.remove(
        "hidden"
    );
}

function closeSettingsModal() {
    settingsModal?.classList.add(
        "hidden"
    );
}

/* =========================
   BUTTON EVENTS
========================= */

function bindEvents() {
    mainBtn?.addEventListener(
        "click",
        startTrip
    );

    waitingBtn?.addEventListener(
        "click",
        toggleWaiting
    );

    const historyBtn =
        $("historyBtn");

    const historyNav =
        $("historyNav");

    const closeHistory =
        $("closeHistory");

    historyBtn?.addEventListener(
        "click",
        openHistory
    );

    historyNav?.addEventListener(
        "click",
        openHistory
    );

    closeHistory?.addEventListener(
        "click",
        closeHistoryModal
    );

    historyModal?.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                historyModal
            ) {
                closeHistoryModal();
            }
        }
    );

    const settingsBtn =
        $("settingsBtn");

    const settingsNav =
        $("settingsNav");

    const closeSettings =
        $("closeSettings");

    const saveSettingsBtn =
        $("saveSettings");

    const resetSettingsBtn =
        $("resetSettings");

    settingsBtn?.addEventListener(
        "click",
        openSettings
    );

    settingsNav?.addEventListener(
        "click",
        openSettings
    );

    closeSettings?.addEventListener(
        "click",
        closeSettingsModal
    );

    saveSettingsBtn?.addEventListener(
        "click",
        saveSettings
    );

    resetSettingsBtn?.addEventListener(
        "click",
        resetSettings
    );

    settingsModal?.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                settingsModal
            ) {
                closeSettingsModal();
            }
        }
    );

    const closeWarning =
        $("closeWarning");

    closeWarning?.addEventListener(
        "click",
        hideWarning
    );

    const homeNav =
        $("homeNav");

    homeNav?.addEventListener(
        "click",
        () => {
            historyModal?.classList.add(
                "hidden"
            );

            settingsModal?.classList.add(
                "hidden"
            );
        }
    );
}

/* =========================
   INITIALIZE
========================= */

function initializeApp() {
    loadSettingsUI();
    updateUI();
    hideWarning();

    setGpsStatus(
        "waiting",
        "GPS အသင့်",
        "ခရီးစဉ်စတင်ရန် စောင့်နေပါသည်"
    );
}

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        () => {
            bindEvents();
            initializeApp();
        },
        { once: true }
    );
} else {
    bindEvents();
    initializeApp();
}
