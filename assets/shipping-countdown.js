/**
 * KARINEX — Shipping Countdown Timer
 * Kaufland-style urgency: counts down to 13:00 Europe/Berlin cutoff.
 * Handles weekends, holidays, out-of-stock, drift-free via setTimeout.
 *
 * Data attributes expected on the host element:
 *   data-shipping-cutoff="13:00"
 *   data-shipping-eligible="true"   (false = out of stock / digital)
 *   data-shipping-tz="Europe/Berlin"
 *
 * Exposed globally: window.KxShippingCountdown
 */

(function () {
    'use strict';

    /* ── German locale helpers ─────────────────────────────── */
    var DAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    var MONTHS_DE = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    /* ── German public holidays (national) ─────────────────── */
    /* Add state-specific via data-holidays attribute if needed */
    var BASE_HOLIDAYS_2025 = [
        '2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01',
        '2025-05-29', '2025-06-09', '2025-10-03', '2025-10-31',
        '2025-12-25', '2025-12-26'
    ];
    var BASE_HOLIDAYS_2026 = [
        '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01',
        '2026-05-14', '2026-05-25', '2026-10-03', '2026-10-31',
        '2026-12-25', '2026-12-26'
    ];

    function getHolidays() {
        var y = new Date().getFullYear();
        if (y === 2025) return BASE_HOLIDAYS_2025;
        if (y === 2026) return BASE_HOLIDAYS_2026;
        /* Fallback: national fixed holidays only */
        return [
            y + '-01-01', y + '-05-01', y + '-10-03', y + '-12-25', y + '-12-26'
        ];
    }

    /* ── Timezone-aware "now" in Berlin ────────────────────── */
    function nowInBerlin() {
        /* Use Intl to get Berlin date parts; no library needed */
        var d = new Date();
        try {
            var parts = new Intl.DateTimeFormat('de-DE', {
                timeZone: 'Europe/Berlin',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            }).formatToParts(d);
            var map = {};
            parts.forEach(function (p) { map[p.type] = p.value; });
            return {
                year: parseInt(map.year, 10),
                month: parseInt(map.month, 10) - 1, /* 0-based */
                day: parseInt(map.day, 10),
                hour: parseInt(map.hour, 10),
                minute: parseInt(map.minute, 10),
                second: parseInt(map.second, 10),
                /* 0=Sun .. 6=Sat via reconstructed Date in Berlin */
                dow: new Date(
                    parseInt(map.year, 10), parseInt(map.month, 10) - 1,
                    parseInt(map.day, 10)
                ).getDay()
            };
        } catch (e) {
            /* Fallback: system local time */
            return {
                year: d.getFullYear(), month: d.getMonth(), day: d.getDate(),
                hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(),
                dow: d.getDay()
            };
        }
    }

    /* ── Is today a business day? ───────────────────────────── */
    function isBusinessDay(b) {
        if (b.dow === 0 || b.dow === 6) return false; /* Sun/Sat */
        var iso = pad4(b.year) + '-' + pad2(b.month + 1) + '-' + pad2(b.day);
        return getHolidays().indexOf(iso) === -1;
    }

    /* ── Next business day offset ───────────────────────────── */
    function nextBusinessDayDate(fromBerlin, daysOffset) {
        /* Walk forward from today+daysOffset until we find a business day */
        var d = new Date(fromBerlin.year, fromBerlin.month, fromBerlin.day + daysOffset);
        var safety = 0;
        while (safety < 14) {
            var candidate = {
                year: d.getFullYear(), month: d.getMonth(), day: d.getDate(),
                dow: d.getDay()
            };
            var iso = pad4(candidate.year) + '-' + pad2(candidate.month + 1) + '-' + pad2(candidate.day);
            if (candidate.dow !== 0 && candidate.dow !== 6 && getHolidays().indexOf(iso) === -1) {
                return d;
            }
            d.setDate(d.getDate() + 1);
            safety++;
        }
        return d;
    }

    /* ── Format delivery window ─────────────────────────────── */
    function formatDeliveryWindow(b, shipsToday) {
        /* Ships today OR tomorrow (next business day) */
        var shipStart = nextBusinessDayDate(b, shipsToday ? 0 : 1);
        var shipEnd = nextBusinessDayDate(b, shipsToday ? 2 : 3);

        function fmt(d) {
            return DAYS_DE[d.getDay()] + '. ' + d.getDate() + '. ' + MONTHS_DE[d.getMonth()];
        }
        return fmt(shipStart) + ' – ' + fmt(shipEnd);
    }

    /* ── Padding helpers ────────────────────────────────────── */
    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function pad4(n) { return n < 1000 ? '0' + n : '' + n; }

    /* ── Build the countdown display ──────────────────────────*/
    function buildTimerString(remainSecs) {
        var h = Math.floor(remainSecs / 3600);
        var m = Math.floor((remainSecs % 3600) / 60);
        var s = remainSecs % 60;
        
        var minSecStr = pad2(m) + ':' + pad2(s);
        if (h > 0) {
            return h + ':' + minSecStr; // No leading zero on hours
        } else {
            return minSecStr; // Hide hours entirely if less than 1 hour remains
        }
    }

    /* ── Seconds until cutoff in Berlin ────────────────────── */
    function secsUntilCutoff(b, cutoffH, cutoffM) {
        var totalNowSecs = b.hour * 3600 + b.minute * 60 + b.second;
        var cutoffSecs = cutoffH * 3600 + cutoffM * 60;
        return cutoffSecs - totalNowSecs; /* positive = before cutoff */
    }

    /* ── Main init ──────────────────────────────────────────── */
    function init(el) {
        /* Read data attributes */
        var eligible = el.getAttribute('data-shipping-eligible') !== 'false';
        var cutoffStr = el.getAttribute('data-shipping-cutoff') || '14:30'; // Target 14:30
        var cutoffParts = cutoffStr.split(':');
        var cutoffH = parseInt(cutoffParts[0], 10);
        var cutoffM = parseInt(cutoffParts[1], 10);

        /* Find sub-elements */
        var mainEl = el.querySelector('.kx-ship-cd__main');
        var timerEl = el.querySelector('.kx-ship-cd__timer');
        var subEl = el.querySelector('.kx-ship-cd__sub');
        var windowEl = el.querySelector('.kx-ship-cd__window');
        var iconEl = el.querySelector('.kx-ship-cd__icon svg');

        if (!eligible) {
            /* Out of stock or not shippable */
            el.classList.add('kx-ship-cd--neutral');
            mainEl.innerHTML = 'Lieferung nach Verfügbarkeit';
            if (timerEl) timerEl.style.display = 'none';
            if (subEl) subEl.textContent = 'Bitte kontaktieren Sie uns für Verfügbarkeit.';
            if (windowEl) windowEl.parentNode && windowEl.parentNode.removeChild(windowEl);
            return;
        }

        var tid = null;

        function tick() {
            var b = nowInBerlin();
            var remain = secsUntilCutoff(b, cutoffH, cutoffM);
            var todayIsBusinessDay = isBusinessDay(b);
            
            // Only show between 06:00 and exactly 14:00 (when remain > 0 if cutoffH=14)
            var isWithinTimeWindow = (b.hour >= 6 && remain > 0);

            if (isWithinTimeWindow && todayIsBusinessDay) {
                /* ── BEFORE CUTOFF on a business day ── */
                el.style.display = ''; // Ensure it's visible
                var timerStr = buildTimerString(remain);
                if (timerEl) timerEl.textContent = timerStr;
                mainEl.innerHTML = 'Bestelle innerhalb von <span class="kx-ship-cd__timer">' + timerStr + '</span>, Versand noch heute';
                if (subEl) {
                    subEl.innerHTML = 'Lieferbar &#8211; in 1&#8211;2 Werktagen bei dir &middot; Versand aus DE';
                }
                el.classList.remove('kx-ship-cd--neutral');

                /* Schedule next tick precisely 1 second later (drift-free) */
                tid = setTimeout(tick, 1000 - (Date.now() % 1000));

            } else {
                /* ── AFTER CUTOFF, BEFORE 06:00, or WEEKEND ── */
                el.style.display = 'none'; // Completely hide the widget
                if (tid) clearTimeout(tid);
                
                // If it's before 06:00, we need a timeout to wake it up at 06:00:00.
                // If it's after cutoff, we wake it up tomorrow at 06:00:00.
                var wakeUpDelay = 0;
                if (b.hour < 6) {
                    wakeUpDelay = secsUntilCutoff(b, 6, 0) * 1000;
                } else {
                    // It's after 14:00 or weekend. Wake up tomorrow at 06:00
                    var secsToMidnight = (23 - b.hour) * 3600 + (59 - b.minute) * 60 + (60 - b.second);
                    wakeUpDelay = (secsToMidnight + 6 * 3600) * 1000;
                }
                tid = setTimeout(tick, wakeUpDelay);
            }
        }

        /* Start immediately, aligned to next second boundary */
        setTimeout(tick, 1000 - (Date.now() % 1000));
        tick(); /* Render immediately (no flicker) */
    }

    /* ── Bootstrap ──────────────────────────────────────────── */
    function bootstrap() {
        var els = document.querySelectorAll('.kx-ship-cd[data-shipping-eligible]');
        els.forEach(init);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

    /* Expose for programmatic use (e.g. cart page) */
    window.KxShippingCountdown = { init: init, bootstrap: bootstrap };

})();
