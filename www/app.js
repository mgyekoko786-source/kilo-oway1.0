/* =====================================================
   KILO OWAY
   Version 1.0
   Myanmar Oway Kilometer Meter
   ===================================================== */


/* =========================
   SETTINGS
   ========================= */

const DEFAULT_SETTINGS = {
    baseFare: 3000,
    perKm: 1000,
    perMinute: 150
};

let settings =
    JSON.parse(localStorage.getItem("kiloOwaySettings"))
    || DEFAULT_SETTINGS;


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

let audioContext = null;

let warningTimer = null;

let currentSpeed = 0;


/* =========================
   DOM
   ========================= */

const $ = id => document.getElementById(id);

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
   FORMAT
   ========================= */

function formatMoney(value) {

    return Math.round(value)
        .toLocaleString("en-US");
}


function formatTime(ms) {

    let totalSeconds =
        Math.max(0, Math.floor(ms / 1000));

    const hours =
        Math.floor(totalSeconds / 3600);

    totalSeconds %= 3600;

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        totalSeconds % 60;

    return (
        String(hours).padStart(2, "0")
        + ":" +
        String(minutes).padStart(2, "0")
        + ":" +
        String(seconds).padStart(2, "0")
    );
}


/* =========================
   HAVERSINE DISTANCE
   ========================= */

function calculateDistance(lat1, lon1, lat2, lon2) {

    const R = 6371000;

    const toRad =
        degrees => degrees * Math.PI / 180;

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
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


/* =========================
   FARE CALCULATION
   ========================= */

function getCurrentWaitingMs() {

    if (!isWaiting) {
        return totalWaitingMs;
    }

    return totalWaitingMs
        + (Date.now() - waitingStartTime);
}


function calculateFare() {

    const waitingMs =
        getCurrentWaitingMs();

    const distanceFare =
        totalDistance
        * settings.perKm;

    const waitingMinutes =
        waitingMs / 60000;

    const waitingFare =
        waitingMinutes
        * settings.perMinute;

    const fare =
        settings.baseFare
        + distanceFare
        + waitingFare;

    return Math.max(
        settings.baseFare,
        fare
    );
}


/* =========================
   UI UPDATE
   ========================= */

function updateUI() {

    distanceEl.textContent =
        totalDistance.toFixed(2);

    speedEl.textContent =
        currentSpeed.toFixed(1);

    totalFareEl.textContent =
        formatMoney(calculateFare());

    $("baseFareText").textContent =
        formatMoney(settings.baseFare);

    $("perKmText").textContent =
        formatMoney(settings.perKm);

    $("perMinuteText").textContent =
        formatMoney(settings.perMinute);


    if (isRunning) {

        durationEl.textContent =
            formatTime(Date.now() - startTime);

    } else {

        durationEl.textContent =
            startTime
                ? formatTime(
                    Date.now() - startTime
                )
                : "00:00:00";
    }


    waitingTimeEl.textContent =
        formatTime(getCurrentWaitingMs());
}


/* =========================
   GPS STATUS
   ========================= */

function setGpsStatus(status, text, sub) {

    gpsStatusEl.textContent = text;

    gpsAccuracyEl.textContent = sub;

    gpsDotEl.classList.remove(
        "connected",
        "error"
    );

    const bars =
        document.querySelector(".signal-bars");

    bars.classList.remove("good");


    if (status === "connected") {

        gpsDotEl.classList.add("connected");

        bars.classList.add("good");

    }

    if (status === "error") {

        gpsDotEl.classList.add("error");
    }
}


/* =========================
   GPS START
   ========================= */

function startGPS() {

    if (!navigator.geolocation) {

        setGpsStatus(
            "error",
            "GPS မထောက်ပံ့ပါ",
            "ဒီဖုန်း Browser/WebView တွင် GPS မရနိုင်ပါ"
        );

        return;
    }


    setGpsStatus(
        "waiting",
        "GPS ရှာနေသည်...",
        "Satellite / Location အချက်အလက် စောင့်နေပါသည်"
    );


    watchId =
        navigator.geolocation.watchPosition(
            handlePosition,
            handleGpsError,
            {
                enableHighAccuracy: true,

                maximumAge: 1000,

                timeout: 10000
            }
        );
}


/* =========================
   GPS POSITION
   ========================= */

function handlePosition(position) {

    const now = Date.now();

    lastGpsTime = now;


    const coords =
        position.coords;

    const lat =
        coords.latitude;

    const lon =
        coords.longitude;

    const accuracy =
        Number(coords.accuracy) || 999;


    setGpsStatus(
        "connected",
        "GPS ချိတ်ဆက်ထားသည်",
        "Accuracy ±" +
        Math.round(accuracy) +
        " m"
    );


    if (accuracy > 80) {

        showWarning(
            "GPS တိကျမှုနည်းနေပါသည်။ လမ်းပေါ်တွင် မောင်းနေချိန် Location တည်ငြိမ်အောင် ခဏစောင့်ပါ။"
        );
    }


    if (!isRunning) {

        lastPosition = {
            lat,
            lon,
            accuracy,
            time: now
        };

        return;
    }


    if (lastPosition) {

        const meters =
            calculateDistance(
                lastPosition.lat,
                lastPosition.lon,
                lat,
                lon
            );


        /*
         * GPS noise ကနေ distance မတက်အောင်
         * Accuracy နဲ့ movement ကို စစ်ပါ။
         */

        const timeDiff =
            now - lastPosition.time;


        const speedFromPoints =
            timeDiff > 0
                ? meters / (timeDiff / 1000)
                : 0;


        /*
         * GPS jump ဖြစ်ပြီး
         * အလွန်ဝေးတဲ့ point တစ်ခု ရုတ်တရက်
         * ရောက်လာရင် မထည့်ပါ။
         */

        const unrealisticJump =
            meters > 300
            &&
            speedFromPoints > 55;


        const tinyGpsNoise =
            meters < Math.max(
                4,
                accuracy * 0.35
            );


        if (
            !unrealisticJump
            &&
            !tinyGpsNoise
        ) {

            totalDistance +=
                meters / 1000;
        }


        /*
         * Speed
         */

        if (
            typeof coords.speed === "number"
            &&
            coords.speed >= 0
        ) {

            currentSpeed =
                coords.speed * 3.6;

        } else {

            if (
                !unrealisticJump
                &&
                timeDiff > 0
            ) {

                currentSpeed =
                    Math.min(
                        150,
                        speedFromPoints * 3.6
                    );

            } else {

                currentSpeed = 0;
            }
        }


        /*
         * မောင်းနေချိန် GPS point
         * ကို update လုပ်ပါ။
         */

        lastPosition = {
            lat,
            lon,
            accuracy,
            time: now
        };

        updateUI();
    }
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


    showWarning(message);
}


/* =========================
   START
   ========================= */

async function startTrip() {

    if (isRunning) {
        stopTrip();
        return;
    }


    /*
     * User tap နဲ့ AudioContext
     * စတင်ဖို့ကြိုးစားပါ။
     */

    initAudio();


    /*
     * GPS permission / location
     */

    startGPS();


    isRunning = true;

    isWaiting = false;

    totalDistance = 0;

    totalWaitingMs = 0;

    currentSpeed = 0;

    startTime = Date.now();

    waitingStartTime = 0;

    lastPosition = null;


    mainBtn.classList.add("stop");

    mainBtnIcon.textContent = "■";

    mainBtnText.textContent = "ရပ်တန့်";

    waitingBtn.classList.remove("active");

    waitingBtnIcon.textContent = "○";

    waitingBtnText.textContent =
        "စောင့်ဆိုင်းရန်";

    waitingStatusText.textContent =
        "ခလုတ်နှိပ်၍ စတင်နိုင်ပါသည်";


    hideWarning();


    timerId =
        setInterval(() => {

            updateUI();

            checkGpsTimeout();

        }, 500);


    updateUI();
}


/* =========================
   STOP
   ========================= */

function stopTrip() {

    if (!isRunning) {
        return;
    }


    /*
     * Waiting ဖြစ်နေရင် အရင်ပိတ်
     */

    if (isWaiting) {

        totalWaitingMs +=
            Date.now() - waitingStartTime;

        isWaiting = false;
    }


    const finalWaiting =
        totalWaitingMs;


    const finalDuration =
        Date.now() - startTime;


    const finalFare =
        calculateFare();


    const record = {

        id: Date.now(),

        date:
            new Date().toLocaleString(),

        distance:
            totalDistance,

        duration:
            finalDuration,

        waiting:
            finalWaiting,

        fare:
            finalFare
    };


    saveHistory(record);


    isRunning = false;

    currentSpeed = 0;

    clearInterval(timerId);

    timerId = null;


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

    waitingBtnText.textContent =
        "စောင့်ဆိုင်းရန်";

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


    setTimeout(
        hideWarning,
        2500
    );
}


/* =========================
   WAITING TOGGLE
   ========================= */

function toggleWaiting() {

    /*
     * Trip မစရသေးရင်
     * Waiting မလုပ်နိုင်ပါ။
     */

    if (!isRunning) {

        showWarning(
            "အရင်ဆုံး “စတင်” ခလုတ်ကို နှိပ်ပါ။"
        );

        return;
    }


    initAudio();


    if (!isWaiting) {

        /*
         * Waiting START
         */

        isWaiting = true;

        waitingStartTime =
            Date.now();


        waitingBtn.classList.add(
            "active"
        );

        waitingBtnIcon.textContent = "●";

        waitingBtnText.textContent =
            "စောင့်နေသည်";

        waitingStatusText.textContent =
            "စောင့်ဆိုင်းချိန် ဆက်လက်တွက်နေသည်";


        /*
         * မိနစ် ၁ ပြည့်ပြီးရင်
         * အသံသတိပေးမှု စတင်ပါ။
         */

        startWaitingReminder();


    } else {

        /*
         * Waiting STOP
         */

        totalWaitingMs +=
            Date.now() - waitingStartTime;

        waitingStartTime = 0;

        isWaiting = false;


        waitingBtn.classList.remove(
            "active"
        );

        waitingBtnIcon.textContent = "○";

        waitingBtnText.textContent =
            "စောင့်ဆိုင်းရန်";

        waitingStatusText.textContent =
            "စောင့်ဆိုင်းချိန် ရပ်ထားသည်";


        stopWaitingReminder();

        updateUI();
    }
}


/* =========================
   WAITING REMINDER
   ========================= */

function startWaitingReminder() {

    stopWaitingReminder();


    warningTimer =
        setTimeout(() => {

            if (
                isRunning
                &&
                isWaiting
            ) {

                playReminder();

                showWarning(
                    "စောင့်ဆိုင်းချိန် ဖွင့်ထားဆဲဖြစ်ပါသည်။ မောင်းနေပြီဆိုရင် စောင့်ဆိုင်းမှုကို ပိတ်ပါ။"
                );


                /*
                 * နောက်ထပ် 1 မိနစ်ကြာရင်
                 * ထပ်သတိပေးပါမယ်။
                 */

                warningTimer =
                    setInterval(() => {

                        if (
                            isRunning
                            &&
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

    if (warningTimer !== null) {

        clearTimeout(warningTimer);

        clearInterval(warningTimer);

        warningTimer = null;
    }
}


/* =========================
   AUDIO
   ========================= */

function initAudio() {

    try {

        if (!audioContext) {

            audioContext =
                new (
                    window.AudioContext
                    ||
                    window.webkitAudioContext
                )();

        }


        if (
            audioContext.state ===
            "suspended"
        ) {

            audioContext.resume();
        }

    } catch (e) {

        console.log(
            "Audio unavailable",
            e
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

        gain.gain.setValueAtTime(
            0.001,
            audioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.20,
            audioContext.currentTime + 0.03
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + 0.6
        );


        oscillator.connect(gain);

        gain.connect(
            audioContext.destination
        );


        oscillator.start();

        oscillator.stop(
            audioContext.currentTime + 0.65
        );

    } catch (e) {

        console.log(
            "Reminder sound unavailable",
            e
        );
    }
}


/* =========================
   GPS TIMEOUT
   ========================= */

function checkGpsTimeout() {

    if (!isRunning) {
        return;
    }


    if (
        lastGpsTime > 0
        &&
        Date.now() - lastGpsTime > 12000
    ) {

        setGpsStatus(
            "error",
            "GPS ပြတ်နေပါသည်",
            "Location အချက်အလက် မရရှိသေးပါ"
        );


        showWarning(
            "GPS ပြတ်နေသောကြောင့် ကီလိုမီတာတွက်ချက်မှု မတိကျနိုင်ပါ။"
        );
    }
}


/* =========================
   WARNING
   ========================= */

function showWarning(message, autoHide = true) {

    warningText.textContent =
        message;

    warningBox.classList.remove(
        "hidden"
    );


    if (autoHide) {

        setTimeout(
            () => {

                /*
                 * Waiting reminder warning
                 * ကို အလိုအလျောက် မဖျောက်ပါ။
                 */

                if (
                    !(
                        isRunning
                        &&
                        isWaiting
                        &&
                        message.includes(
                            "စောင့်ဆိုင်း"
                        )
                    )
                ) {

                    hideWarning();
                }

            },
            5000
        );
    }
}


function hideWarning() {

    warningBox.classList.add(
        "hidden"
    );
}


/* =========================
   HISTORY
   ========================= */

function getHistory() {

    return JSON.parse(
        localStorage.getItem(
            "kiloOwayHistory"
        )
    ) || [];
}


function saveHistory(record) {

    let history =
        getHistory();


    history.unshift(record);


    /*
     * နောက်ဆုံး 100 ခရီးပဲ သိမ်းထားမယ်။
     */

    history =
        history.slice(0, 100);


    localStorage.setItem(
        "kiloOwayHistory",
        JSON.stringify(history)
    );
}


function renderHistory() {

    const history =
        getHistory();


    historyList.innerHTML = "";


    if (history.length === 0) {

        historyList.innerHTML =
            `
            <div class="history-empty">
                ခရီးမှတ်တမ်း မရှိသေးပါ။
            </div>
            `;

        return;
    }


    history.forEach(record => {

        const item =
            document.createElement("div");

        item.className =
            "history-item";


        item.innerHTML = `

            <div class="history-date">
                ${escapeHtml(record.date)}
            </div>

            <div class="history-grid">

                <div class="history-cell">
                    အကွာအဝေး
                    <strong>
                        ${Number(record.distance).toFixed(2)} km
                    </strong>
                </div>

                <div class="history-cell">
                    ကြာချိန်
                    <strong>
                        ${formatTime(record.duration)}
                    </strong>
                </div>

                <div class="history-cell">
                    စောင့်ဆိုင်းချိန်
                    <strong>
                        ${formatTime(record.waiting)}
                    </strong>
                </div>

                <div class="history-cell">
                    ကျသင့်ငွေ
                    <strong>
                        ${formatMoney(record.fare)} Ks
                    </strong>
                </div>

            </div>
        `;


        historyList.appendChild(item);
    });
}


function escapeHtml(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================
   SETTINGS
   ========================= */

function loadSettingsUI() {

    $("baseFareInput").value =
        sett
