/* =====================================================
   KILO OWAY
   Version 1.0
   Part 1/3
   ===================================================== */


/* =========================
   DEFAULT SETTINGS
   ========================= */

const DEFAULT_SETTINGS = {
    baseFare: 3000,
    perKm: 1000,
    perMinute: 150
};


/* =========================
   SETTINGS
   ========================= */

let settings = loadSavedSettings();

function loadSavedSettings() {

    try {

        const saved =
            localStorage.getItem("kiloOwaySettings");

        if (!saved) {
            return { ...DEFAULT_SETTINGS };
        }

        const data = JSON.parse(saved);

        return {
            baseFare:
                Number(data.baseFare) >= 0
                    ? Number(data.baseFare)
                    : DEFAULT_SETTINGS.baseFare,

            perKm:
                Number(data.perKm) >= 0
                    ? Number(data.perKm)
                    : DEFAULT_SETTINGS.perKm,

            perMinute:
                Number(data.perMinute) >= 0
                    ? Number(data.perMinute)
                    : DEFAULT_SETTINGS.perMinute
        };

    } catch (error) {

        console.log("Settings error:", error);

        return { ...DEFAULT_SETTINGS };
    }
}


/* =========================
   STATE
   ========================= */

let isRunning = false;
let isWaiting = false;

let watchId = null;

let lastPosition = null;

let totalDistance = 0;

let startTime = 0;

let waitingStartTime = 0;
let totalWaitingMs = 0;

let timerId = null;

let lastGpsTime = 0;

let currentSpeed = 0;

let audioContext = null;

let warningTimer = null;


/* =========================
   DOM HELPER
   ========================= */

const $ = id => document.getElementById(id);


/* =========================
   DOM ELEMENTS
   ========================= */

const totalFareEl = $("totalFare");

const distanceEl = $("distance");

const durationEl = $("duration");

const waitingTimeEl = $("waitingTime");

const speedEl = $("speed");

const gpsStatusEl = $("gpsStatus");

const gpsAccuracyEl = $("gpsAccuracy");

const gpsDotEl = $("gpsDot");

const mainBtn = $("mainBtn");

const mainBtnText = $("mainBtnText");

const mainBtnIcon = $("mainBtnIcon");

const waitingBtn = $("waitingBtn");

const waitingBtnText = $("waitingBtnText");

const waitingBtnIcon = $("waitingBtnIcon");

const waitingStatusText = $("waitingStatusText");

const warningBox = $("warningBox");

const warningText = $("warningText");

const historyModal = $("historyModal");

const settingsModal = $("settingsModal");

const historyList = $("historyList");


/* =========================
   FORMAT MONEY
   ========================= */

function formatMoney(value) {

    return Math.round(Number(value) || 0)
        .toLocaleString("en-US");
}


/* =========================
   FORMAT TIME
   ========================= */

function formatTime(ms) {

    let seconds =
        Math.max(
            0,
            Math.floor((Number(ms) || 0) / 1000)
        );

    const hours =
        Math.floor(seconds / 3600);

    seconds %= 3600;

    const minutes =
        Math.floor(seconds / 60);

    seconds %= 60;

    return (
        String(hours).padStart(2, "0")
        + ":"
        + String(minutes).padStart(2, "0")
        + ":"
        + String(seconds).padStart(2, "0")
    );
}


/* =========================
   DISTANCE
   ========================= */

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const toRad =
        value =>
            value * Math.PI / 180;

    const dLat =
        toRad(lat2 - lat1);

    const dLon =
        toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2
        +
        Math.cos(toRad(lat1))
        *
        Math.cos(toRad(lat2))
        *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


/* =========================
   WAITING TIME
   ========================= */

function getCurrentWaitingMs() {

    if (!isWaiting) {
        return totalWaitingMs;
    }

    return (
        totalWaitingMs
        +
        Date.now() -
        waitingStartTime
    );
}


/* =========================
   FARE
   ========================= */

function calculateFare() {

    const waitingMs =
        getCurrentWaitingMs();

    const distanceFare =
        totalDistance *
        settings.perKm;

    const waitingFare =
        (waitingMs / 60000) *
        settings.perMinute;

    return Math.max(
        settings.baseFare,
        settings.baseFare
        +
        distanceFare
        +
        waitingFare
    );
}


/* =========================
   UPDATE UI
   ========================= */

function updateUI() {

    if (!distanceEl) {
        return;
    }


    distanceEl.textContent =
        totalDistance.toFixed(2);


    speedEl.textContent =
        currentSpeed.toFixed(1);


    totalFareEl.textContent =
        formatMoney(
            calculateFare()
        );


    const baseFareText =
        $("baseFareText");

    const perKmText =
        $("perKmText");

    const perMinuteText =
        $("perMinuteText");


    if (baseFareText) {

        baseFareText.textContent =
            formatMoney(
                settings.baseFare
            );
    }


    if (perKmText) {

        perKmText.textContent =
            formatMoney(
                settings.perKm
            );
    }


    if (perMinuteText) {

        perMinuteText.textContent =
            formatMoney(
                settings.perMinute
            );
    }


    if (startTime > 0) {

        durationEl.textContent =
            formatTime(
                Date.now() - startTime
            );

    } else {

        durationEl.textContent =
            "00:00:00";
    }


    waitingTimeEl.textContent =
        formatTime(
            getCurrentWaitingMs()
        );
}


/* =========================
   GPS STATUS
   ========================= */

function setGpsStatus(
    status,
    title,
    sub
) {

    if (!gpsStatusEl) {
        return;
    }


    gpsStatusEl.textContent =
        title;


    gpsAccuracyEl.textContent =
        sub;


    gpsDotEl.classList.remove(
        "connected",
        "error"
    );


    const bars =
        document.querySelector(
            ".signal-bars"
        );


    if (bars) {

        bars.classList.remove(
            "good"
        );
    }


    if (status === "connected") {

        gpsDotEl.classList.add(
            "connected"
        );


        if (bars) {

            bars.classList.add(
                "good"
            );
        }
    }


    if (status === "error") {

        gpsDotEl.classList.add(
            "error"
        );
    }
}


/* =========================
   START GPS
   ========================= */

function startGPS() {

    if (!navigator.geolocation) {

        setGpsStatus(
            "error",
            "GPS မထောက်ပံ့ပါ",
            "ဒီ Browser / WebView တွင် GPS မရနိုင်ပါ"
        );

        return false;
    }


    setGpsStatus(
        "waiting",
        "GPS ရှာနေသည်...",
        "Location အချက်အလက် စောင့်နေပါသည်"
    );


    try {

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

        return true;

    } catch (error) {

        console.log(
            "GPS start error:",
            error
        );


        setGpsStatus(
            "error",
            "GPS မစတင်နိုင်ပါ",
            "Location service ကို စစ်ဆေးပါ"
        );


        return false;
    }
}


/* =========================
   GPS POSITION
   ========================= */

function handlePosition(position) {

    const now =
        Date.now();

    lastGpsTime =
        now;


    const coords =
        position.coords;


    const lat =
        Number(coords.latitude);

    const lon =
        Number(coords.longitude);

    const accuracy =
        Number(coords.accuracy) || 999;


    setGpsStatus(
        "connected",
        "GPS ချိတ်ဆက်ထားသည်",
        "Accuracy ±"
        +
        Math.round(accuracy)
        +
        " m"
    );


    /* GPS accuracy warning */

    if (
        isRunning
        &&
        accuracy > 80
    ) {

        showWarning(
            "GPS တိကျမှုနည်းနေပါသည်။ Location တည်ငြိမ်အောင် ခဏစောင့်ပါ။"
        );
    }


    /* Trip မစသေးရင် reference point သိမ်း */

    if (!isRunning) {

        lastPosition = {
            lat: lat,
            lon: lon,
            accuracy: accuracy,
            time: now
        };

        return;
    }


    /* ပထမဆုံး GPS point */

    if (!lastPosition) {

        lastPosition = {
            lat: lat,
            lon: lon,
            accuracy: accuracy,
            time: now
        };

        updateUI();

        return;
    }


    const meters =
        calculateDistance(
            lastPosition.lat,
            lastPosition.lon,
            lat,
            lon
        );


    const timeDiff =
        now -
        lastPosition.time;


    let pointSpeed = 0;


    if (timeDiff > 0) {

        pointSpeed =
            meters /
            (timeDiff / 1000);
    }


    /* GPS jump protection */

    const unrealisticJump =
        meters > 300
        &&
        pointSpeed > 55;


    /* GPS noise protection */

    const tinyNoise =
        meters <
        Math.max(
            4,
            accuracy * 0.35
        );


    /* Waiting မှာ distance မတက် */

    if (
        !isWaiting
        &&
        !unrealisticJump
        &&
        !tinyNoise
    ) {

        totalDistance +=
            meters / 1000;
    }


    /* SPEED */

    if (
        typeof coords.speed === "number"
        &&
        coords.speed >= 0
    ) {

        currentSpeed =
            Math.min(
                150,
                coords.speed * 3.6
            );

    } else if (
        !unrealisticJump
        &&
        timeDiff > 0
    ) {

        currentSpeed =
            Math.min(
                150,
                pointSpeed * 3.6
            );

    } else {

        currentSpeed = 0;
    }


    /* Waiting ဖြစ်ရင် speed = 0 */

    if (isWaiting) {

        currentSpeed = 0;
    }


    /* Reference point update */

    lastPosition = {
        lat: lat,
        lon: lon,
        accuracy: accuracy,
        time: now
    };


    updateUI();
}


/* =========================
   GPS ERROR
   ========================= */

function handleGpsError(error) {

    let message =
        "GPS အချက်အလက် မရရှိသေးပါ။";


    if (error.code === 1) {

        message =
            "Location Permission ပေးရန်လိုအပ်ပါသည်။";

    } else if (error.code === 2) {

        message =
            "GPS Location မရရှိပါ။";

    } else if (error.code === 3) {

        message =
            "GPS တုံ့ပြန်ချိန် ကြာနေပါသည်။";
    }


    setGpsStatus(
        "error",
        "GPS မချိတ်ဆက်ရသေးပါ",
        message
    );


    if (isRunning) {

        showWarning(message);
    }
}


/* =========================
   WARNING
   ========================= */

function showWarning(
    message,
    autoHide = true
) {

    if (!warningBox) {
        return;
    }


    warningText.textContent =
        message;


    warningBox.classList.remove(
        "hidden"
    );


    clearTimeout(
        warningTimer
    );


    if (
        autoHide
        &&
        !(
            isRunning
            &&
            isWaiting
            &&
            message.includes("စောင့်ဆိုင်း")
        )
    ) {

        warningTimer =
            setTimeout(
                hideWarning,
                4000
            );
    }
}


/* =========================
   HIDE WARNING
   ========================= */

function hideWarning() {

    if (!warningBox) {
        return;
    }

    warningBox.classList.add(
        "hidden"
    );
}


/* =========================
   GPS TIMEOUT CHECK
   ========================= */

function checkGpsTimeout() {

    if (!isRunning) {
        return;
    }


    if (!lastGpsTime) {
        return;
    }


    const elapsed =
        Date.now() -
        lastGpsTime;


    if (elapsed > 15000) {

        showWarning(
            "GPS အချက်အလက် အသစ်မရရှိသေးပါ။"
        );
    }
}function startTrip() {

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

    lastPosition = null;
    lastGpsTime = 0;

    isWaiting = false;
    isRunning = true;

    startGPS();

    mainBtn.classList.add("stop");
    mainBtnIcon.textContent = "■";
    mainBtnText.textContent = "ရပ်တန့်";

    waitingBtn.classList.remove("active");
    waitingBtnIcon.textContent = "○";
    waitingBtnText.textContent = "စောင့်ဆိုင်းရန်";
    waitingStatusText.textContent =
        "ခလုတ်နှိပ်၍ စတင်နိုင်ပါသည်";

    hideWarning();

    clearInterval(timerId);

    timerId = setInterval(() => {
        updateUI();
        checkGpsTimeout();
    }, 500);

    updateUI();
}


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

    const finalFare =
        settings.baseFare
        +
        finalDistance * settings.perKm
        +
        (finalWaiting / 60000)
        * settings.perMinute;


    const record = {

        id: Date.now(),

        date:
            new Date().toLocaleString(),

        distance:
            finalDistance,

        duration:
            finalDuration,

        waiting:
            finalWaiting,

        fare:
            finalFare
    };


    saveHistory(record);


    isRunning = false;
    isWaiting = false;
    currentSpeed = 0;

    clearInterval(timerId);
    timerId = null;

    stopWaitingReminder();


    if (watchId !== null) {

        navigator.geolocation.clearWatch(
            watchId
        );

        watchId = null;
    }


    mainBtn.classList.remove("stop");
    mainBtnIcon.textContent = "▶";
    mainBtnText.textContent = "စတင်";

    waitingBtn.classList.remove("active");
    waitingBtnIcon.textContent = "○";
    waitingBtnText.textContent = "စောင့်ဆိုင်းရန်";

    waitingStatusText.textContent =
        "ခလုတ်နှိပ်၍ စတင်နိုင်ပါသည်";


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


    setTimeout(() => {
        hideWarning();
    }, 2500);
}


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

        waitingStartTime =
            Date.now();

        waitingBtn.classList.add("active");

        waitingBtnIcon.textContent = "●";

        waitingBtnText.textContent =
            "စောင့်နေသည်";

        waitingStatusText.textContent =
            "စောင့်ဆိုင်းချိန် ဆက်လက်တွက်နေသည်";

        currentSpeed = 0;

        startWaitingReminder();

        updateUI();

        return;
    }


    totalWaitingMs +=
        Date.now() - waitingStartTime;

    waitingStartTime = 0;
    isWaiting = false;

    waitingBtn.classList.remove("active");

    waitingBtnIcon.textContent = "○";

    waitingBtnText.textContent =
        "စောင့်ဆိုင်းရန်";

    waitingStatusText.textContent =
        "စောင့်ဆိုင်းချိန် ရပ်ထားသည်";

    stopWaitingReminder();

    updateUI();
}


let reminderTimer = null;


function startWaitingReminder() {

    stopWaitingReminder();


    reminderTimer = setTimeout(() => {

        if (
            isRunning &&
            isWaiting
        ) {

            playReminder();

            showWarning(
                "စောင့်ဆိုင်းချိန် ဖွင့်ထားဆဲဖြစ်ပါသည်။ မောင်းနေပြီဆိုရင် စောင့်ဆိုင်းမှုကို ပိတ်ပါ။"
            );


            reminderTimer = setInterval(() => {

                if (
                    isRunning &&
                    isWaiting
                ) {

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

        if (!audioContext) {
            initAudio();
        }

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

        oscillator.stop(
            now + 0.55
        );

    } catch (error) {

        console.log(
            "Reminder sound error:",
            error
        );
    }
               }
