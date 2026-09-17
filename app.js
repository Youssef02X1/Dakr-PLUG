// ============================================
// APP.JS — Utilitaires globaux Dakar PLUG
// ============================================

// ── Service Worker (PWA + cache offline) ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ── Lien actif navbar ──
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    if ((link.getAttribute('href') || '').split('#')[0] === page) {
      link.classList.add('active');
    }
  });
});

// ════════════════════════════════════════════
//  UTILITAIRES GLOBAUX
// ════════════════════════════════════════════
const AppUtils = {

  /** Formate un montant en FCFA */
  formatPrix(val) {
    return Number(val).toLocaleString('fr-FR') + ' FCFA';
  },

  /** Formate une date ISO en français */
  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
        weekday:'long', day:'numeric', month:'long', year:'numeric'
      });
    } catch { return dateStr; }
  },

  /** Anti-spam sur les appels répétés */
  debounce(fn, delay = 280) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  },

  /** Coupe un texte à n caractères */
  truncate(str, n = 80) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + '…' : str;
  },

  /**
   * Échappe le HTML pour prévenir les injections XSS
   * Utiliser pour toutes les données venant de Supabase affichées en innerHTML
   */
  esc(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  /**
   * Valide qu'une URL est sûre (commence par https://)
   * Évite les injections javascript: dans les src/href
   */
  safeUrl(url) {
    if (!url) return '';
    if (url.startsWith('https://') || url.startsWith('http://')) return url;
    return '';
  },

  /** Toast notification */
  toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg; // textContent = jamais de XSS
    t.setAttribute('role', 'alert');
    c.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  },
};

window.AppUtils = AppUtils;

// Alias globaux pratiques
window.esc      = AppUtils.esc;
window.safeUrl  = AppUtils.safeUrl;
window.toast    = AppUtils.toast;