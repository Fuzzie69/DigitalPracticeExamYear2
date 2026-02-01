const link = document.getElementById('redirect-link');
const secondsEl = document.getElementById('seconds');
const countEl = document.getElementById('visit-count');
const cancelBtn = document.getElementById('cancel-redirect');
const getMeta = (n) => document.querySelector(`meta[name="${n}"]`)?.content || '';

const DEFAULT_SECONDS = 5;
// Allow override via ?to=...&delay=...
const params = new URLSearchParams(location.search);
const target = params.get('to') || link.getAttribute('href') || '/';
const delay = Math.max(1, Number(params.get('delay') || DEFAULT_SECONDS));
if (params.get('to')) link.setAttribute('href', target);

// Countdown logic
let remaining = delay;
let timerId = null;
const updateSeconds = (val) => { secondsEl.textContent = String(val); };
updateSeconds(remaining);

const navigateWithTracking = () => {
  incrementRedirectStat();
  window.location.href = target;
};

const startCountdown = () => {
  timerId = setInterval(() => {
    remaining -= 1;
    updateSeconds(remaining);
    if (remaining <= 0) {
      clearInterval(timerId);
      navigateWithTracking();
    }
  }, 1000);
};

const cancelCountdown = () => {
  if (timerId) clearInterval(timerId);
  timerId = null;
  updateSeconds('-');
  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.textContent = 'Redirect canceled';
  }
};

cancelBtn && cancelBtn.addEventListener('click', cancelCountdown);

// Track redirect on manual click
link.addEventListener('click', () => {
  incrementRedirectStat();
});

// --- Visit counter and redirect stats ---
const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
const preferHitsBadge = /\.github\.io$/i.test(location.hostname);
const ns = (location.host || 'local').replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
const keyRaw = location.pathname && location.pathname !== '/' ? location.pathname : 'root';
const key = keyRaw.replace(/[^a-z0-9/_-]/gi, '_').toLowerCase();

function showVisitBadge() {
  if (!countEl) return;
  try {
    const host = location.hostname;
    const path = (location.pathname || '/').toLowerCase();
    const imgUrl = `https://hits.sh/${host}${encodeURI(path)}.svg?style=flat-square&label=visits`;
    const img = new Image();
    img.src = imgUrl;
    img.alt = 'visit count';
    img.height = 20;
    countEl.replaceChildren(img);
  } catch {
    countEl.textContent = 'n/a';
  }
}

function updateVisitCounter() {
  if (!countEl) return;
  if (isLocalHost) {
    try {
      const storeKey = `visits:${key}`;
      const next = (parseInt(localStorage.getItem(storeKey) || '0', 10) + 1);
      localStorage.setItem(storeKey, String(next));
      countEl.textContent = next.toLocaleString();
    } catch {
      countEl.textContent = 'n/a';
    }
  } else {
    const capiBase = getMeta('counterapi-base');
    const capiKey = getMeta('counterapi-key');
    if (capiBase) {
      // If page is not visible (prerender/prefetch), wait until visible to avoid double fires
      try {
        if (document.visibilityState && document.visibilityState !== 'visible') {
          if (!window.__visitVisibilityHooked) {
            window.__visitVisibilityHooked = true;
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') updateVisitCounter();
            }, { once: true });
          }
          return;
        }
      } catch {}
      // In-process guard for this page context
      if (window.__capiVisitFired) return;
      window.__capiVisitFired = true;
      // Guard against accidental double-fires within a short window for this tab
      try {
        const guardKey = `visits:guard:${capiBase}`;
        const last = Number(sessionStorage.getItem(guardKey) || '0');
        const now = Date.now();
        if (now - last < 3000) {
          return; // skip duplicate within 3s
        }
        sessionStorage.setItem(guardKey, String(now));
      } catch {}
      // Cross-navigation guard (same origin, short window) using localStorage
      try {
        const lsKey = `visits:guard:ls:${capiBase}`;
        const lastLS = Number(localStorage.getItem(lsKey) || '0');
        const nowLS = Date.now();
        if (nowLS - lastLS < 3000) {
          return; // skip duplicate within 3s across reloads/tabs
        }
        localStorage.setItem(lsKey, String(nowLS));
      } catch {}
      const opts = capiKey ? { headers: { Authorization: `Bearer ${capiKey}` } } : {};
      fetch(`${capiBase}/up`, opts)
        .then(r => r.json())
        .then(data => {
          const v = typeof data?.value === 'number' ? data.value
                  : typeof data?.count === 'number' ? data.count
                  : typeof data?.counter === 'number' ? data.counter
                  : typeof data?.current === 'number' ? data.current
                  : null;
          if (v != null) countEl.textContent = Number(v).toLocaleString(); else showVisitBadge();
        })
        .catch(() => { showVisitBadge(); });
    } else {
      // Avoid CORS/DNS issues by using hits.sh badge if not configured
      showVisitBadge();
    }
  }
}

function incrementRedirectStat() {
  let host = 'unknown';
  try { host = new URL(target, location.href).host || 'relative'; } catch {}
  const rKey = `redirect_${host.replace(/[^a-z0-9.-]/gi, '-')}`;
  if (isLocalHost) {
    try {
      const storeKey = `redirect:${rKey}`;
      const next = (parseInt(localStorage.getItem(storeKey) || '0', 10) + 1);
      localStorage.setItem(storeKey, String(next));
    } catch {}
  } else {
    // Fire-and-forget via image ping to avoid CORS noise; also works on strict browsers
    try {
      const host = location.hostname;
      const path = (location.pathname || '/').toLowerCase();
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.src = `https://hits.sh/${host}${encodeURI(path)}redirect.png?_=${Date.now()}`;
    } catch {}
  }
}

updateVisitCounter();
startCountdown();


