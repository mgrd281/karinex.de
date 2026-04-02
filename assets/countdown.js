(() => {
  const banners = document.querySelectorAll('[data-countdown]');
  if (!banners.length) return;

  const pad = (n) => String(n).padStart(2, '0');
  const getNowInTimeZone = (timeZone) => {
    try {
      return new Date(new Date().toLocaleString('en-US', { timeZone }));
    } catch (e) {
      return new Date();
    }
  };

  banners.forEach((banner) => {
    const enabled = banner.dataset.enabled === 'true';
    if (!enabled) {
      banner.style.display = 'none';
      return;
    }

    const sectionId = banner.dataset.sectionId;
    const mode = banner.dataset.mode || 'fixed_end_datetime';
    const endRaw = banner.dataset.end || '';
    const timeZone = banner.dataset.timezone || 'Europe/Berlin';
    const expiredBehavior = banner.dataset.expired || 'show';
    const expiredText = banner.dataset.expiredText || 'Aktion beendet';

    const timerEl = banner.querySelector('.timer');
    const units = {
      d: banner.querySelector('[data-unit="days"]'),
      h: banner.querySelector('[data-unit="hours"]'),
      m: banner.querySelector('[data-unit="minutes"]'),
      s: banner.querySelector('[data-unit="seconds"]'),
    };
    const nums = {
      d: document.getElementById(`days-${sectionId}`),
      h: document.getElementById(`hours-${sectionId}`),
      m: document.getElementById(`minutes-${sectionId}`),
      s: document.getElementById(`seconds-${sectionId}`),
    };
    const headline = banner.querySelector('.headline');

    let prevVisibility = '';

    const getTargetDate = () => {
      if (!endRaw) return null;

      if (mode === 'daily_reset') {
        const nowTz = getNowInTimeZone(timeZone);
        let timePart = endRaw;
        if (endRaw.includes('T')) {
          timePart = endRaw.split('T')[1];
        }
        timePart = timePart.replace(/Z|[+-].*$/, '');
        const parts = timePart.split(':');
        const hours = parseInt(parts[0] || '23', 10);
        const minutes = parseInt(parts[1] || '59', 10);
        const seconds = parseInt(parts[2] || '59', 10);

        const target = new Date(nowTz);
        target.setHours(hours, minutes, seconds, 0);
        if (target <= nowTz) {
          target.setDate(target.getDate() + 1);
        }
        return target;
      }

      const parsed = new Date(endRaw);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed;
    };

    let targetDate = getTargetDate();

    const handleExpired = () => {
      if (expiredBehavior === 'hide') {
        banner.style.display = 'none';
        return;
      }
      if (headline) headline.textContent = expiredText;
      if (timerEl) timerEl.style.display = 'none';
    };

    const setUnit = (key, value, show) => {
      if (nums[key]) nums[key].textContent = pad(value);
      if (units[key]) units[key].style.display = show ? '' : 'none';
    };

    const tick = () => {
      if (!targetDate) { handleExpired(); return; }
      if (mode === 'daily_reset') targetDate = getTargetDate();

      const now = getNowInTimeZone(timeZone);
      let diff = targetDate - now;
      if (diff <= 0) { handleExpired(); return; }

      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      /* Adaptive display: show only relevant units */
      let showD, showH, showM, showS;
      if (totalSec >= 86400) {
        /* > 1 day: days | hours | minutes */
        showD = true; showH = true; showM = true; showS = false;
      } else if (totalSec >= 3600) {
        /* < 1 day: hours | minutes | seconds */
        showD = false; showH = true; showM = true; showS = true;
      } else if (totalSec >= 60) {
        /* < 1 hour: minutes | seconds */
        showD = false; showH = false; showM = true; showS = true;
      } else {
        /* < 1 minute: seconds only */
        showD = false; showH = false; showM = false; showS = true;
      }

      setUnit('d', days, showD);
      setUnit('h', hours, showH);
      setUnit('m', minutes, showM);
      setUnit('s', seconds, showS);

      /* Urgency states */
      const vis = showD ? 'normal' : totalSec >= 3600 ? 'no-days' : totalSec >= 60 ? 'urgent' : 'critical';
      if (vis !== prevVisibility) {
        banner.dataset.urgency = vis;
        prevVisibility = vis;
      }
    };

    let timer = setInterval(tick, 1000);
    tick();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        clearInterval(timer);
        tick();
        timer = setInterval(tick, 1000);
      }
    });

    const shopBtn = document.getElementById(`shop-button-${sectionId}`);
    if (shopBtn) {
      shopBtn.addEventListener('click', () => {
        const slider = document.getElementById(`slider-${sectionId}`);
        const activeSlide = slider ? slider.querySelector('.slide.active') : null;
        const productLink = activeSlide ? activeSlide.querySelector('a') : null;
        if (productLink && productLink.href) {
          window.location.href = productLink.href;
        }
      });
    }
  });
})();
