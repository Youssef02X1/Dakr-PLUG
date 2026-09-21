// ============================================
// ANALYTICS.JS — Suivi de pages léger, maison
// ============================================
// Pas de cookie, pas de service tiers, pas de fingerprinting.
// session_id est généré via crypto.getRandomValues et vit en
// sessionStorage : il disparaît à la fermeture de l'onglet, donc
// aucune donnée personnelle n'est conservée d'une visite à l'autre.
//
// À inclure sur CHAQUE page, juste APRÈS supabase-config.js :
//   <script src="supabase-config.js"></script>
//   <script src="analytics.js"></script>
// ============================================
(function () {
  try {
    let sid = sessionStorage.getItem('da_sid');
    if (!sid) {
      const arr = new Uint8Array(10);
      crypto.getRandomValues(arr);
      sid = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem('da_sid', sid);
    }

    const sb = window.DakarApp && window.DakarApp.sb;
    if (!sb) return; // pas de config Supabase valide → on n'enregistre rien

    sb.from('page_views').insert({
      path: location.pathname,
      referrer: document.referrer ? document.referrer.slice(0, 500) : null,
      session_id: sid,
    }).then(
      () => {},
      () => {} // échec silencieux : l'analytics ne doit jamais gêner la navigation
    );
  } catch (e) {
    // idem : ne jamais laisser un souci d'analytics casser la page
  }
})();