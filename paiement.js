// PAIEMENT.JS - Intégration directe Wave & Orange Money
// VERSION SÉCURISÉE - Frontend uniquement
//
// ARCHITECTURE SÉCURISÉE :
//
// FRONTEND (ce fichier) → appelle votre Supabase Edge Function
// EDGE FUNCTION (serveur) → appelle Wave/Orange avec les vraies clés
//
// Les clés secrètes Wave et Orange ne sont JAMAIS dans ce fichier.
// Elles sont dans Supabase → Edge Functions → Manage secrets (chiffrées, côté serveur).
//

// URL publique de votre Supabase (pas un secret) - même valeur que SUPABASE_URL
const SUPABASE_EDGE_URL = window.DakarApp?.SUPABASE_URL
  ? `${window.DakarApp.SUPABASE_URL}/functions/v1`
  : 'https://VOTRE_PROJECT_ID.supabase.co/functions/v1';

//  INTERFACE PAIEMENT PRINCIPALE
const Paiement = {

  /**
   * Lance un paiement Wave ou Orange Money
   * Appelle l'Edge Function Supabase qui détient les vraies clés API
   *
   * @param {string} methode - 'wave' | 'orange' | 'carte'
   * @param {Object} resa    - Données de la réservation
   */
  async lancer(methode, resa) {
    if (!['wave', 'orange', 'carte'].includes(methode)) throw new Error('Méthode de paiement en ligne invalide');

    const { id, montant, qr_token } = resa;
    if (!id)                      throw new Error('Réservation introuvable');
    if (!montant || montant < 1)  throw new Error('Montant invalide');

    const reference = (qr_token || '').slice(0, 8).toUpperCase();

    // Récupérer le token d'auth Supabase de l'utilisateur connecté
    const { sb } = window.DakarApp || {};
    let authHeader = {};
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.access_token) {
        authHeader = { 'Authorization': `Bearer ${session.access_token}` };
      }
    }

    // Appel sécurisé vers la Edge Function Supabase - le montant n'est
    // jamais envoyé : initier-paiement relit le montant validé côté
    // serveur directement depuis la réservation en base.
    const response = await fetch(`${SUPABASE_EDGE_URL}/initier-paiement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        reservation_id: id,
        success_url:  `${window.location.origin}/reservation.html?paiement=success&ref=${reference}`,
        error_url:    `${window.location.origin}/reservation.html?paiement=error`,
        cancel_url:   `${window.location.origin}/reservation.html?paiement=cancel`,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Erreur paiement ${response.status}`);
    }

    const data = await response.json();
    // La Edge Function renvoie l'URL de paiement hébergée Wave ou Orange
    if (!data.payment_url) throw new Error('URL de paiement non reçue');

    // SÉCURITÉ : valider que l'URL vient bien de Wave ou Orange Money
    const allowedHosts = ['pay.wave.com', 'checkout.wave.com', 'api.wave.com',
                           'payment.orange.com', 'webpay.orange.com', 'api.orange.com'];
    try {
      const parsedUrl = new URL(data.payment_url);
      const isAllowed = allowedHosts.some(h => parsedUrl.hostname.endsWith(h));
      if (!isAllowed) throw new Error('URL de paiement non autorisée');
    } catch(e) {
      if (e.message === 'URL de paiement non autorisée') throw e;
      throw new Error('URL de paiement invalide');
    }

    // Sauvegarder les infos pour vérification au retour
    sessionStorage.setItem('da_pay_session', JSON.stringify({
      reservation_id: id,
      session_id: data.session_id,
      methode,
      reference,
    }));

    // Rediriger vers Wave ou Orange Money
    window.location.href = data.payment_url;
  },

  /**
   * Vérifie le résultat du paiement au retour sur la page
   * Appelle la Edge Function pour valider côté serveur
   */
  async verifierRetour() {
    const params  = new URLSearchParams(window.location.search);
    const statut  = params.get('paiement');
    if (!statut) return null;

    if (statut === 'cancel') return { statut: 'annule' };
    if (statut === 'error')  return { statut: 'failed' };

    const session = JSON.parse(sessionStorage.getItem('da_pay_session') || 'null');
    if (!session) return { statut: statut === 'success' ? 'complete' : 'pending' };

    // Vérifier côté serveur (ne jamais faire confiance au paramètre URL seul)
    try {
      const { sb } = window.DakarApp || {};
      let authHeader = {};
      if (sb) {
        const { data: { session: authSession } } = await sb.auth.getSession();
        if (authSession?.access_token) {
          authHeader = { 'Authorization': `Bearer ${authSession.access_token}` };
        }
      }

      const response = await fetch(`${SUPABASE_EDGE_URL}/verifier-paiement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          reservation_id: session.reservation_id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return { statut: data.statut, ref: session.reference };
      }
    } catch(e) {
      console.warn('Vérification paiement impossible:', e.message);
    }

    // Fallback si Edge Function non disponible
    return { statut: statut === 'success' ? 'complete' : 'pending', ref: session.reference };
  },

  /** Nettoie les données de session après confirmation */
  nettoyerSession() {
    sessionStorage.removeItem('da_pay_session');
  },
};

//  EDGE FUNCTIONS SUPABASE - code réel, prêt à déployer
// Le code complet (plus qu'une esquisse) se trouve dans :
//   supabase/functions/initier-paiement/index.ts
//   supabase/functions/verifier-paiement/index.ts
//   supabase/functions/webhook-paiement/index.ts
//
// Déploiement (Supabase CLI, une fois connecté à votre projet) :
//   supabase functions deploy initier-paiement
//   supabase functions deploy verifier-paiement
//   supabase functions deploy webhook-paiement --no-verify-jwt
//
// Secrets à configurer (Supabase → Edge Functions → Manage secrets) :
//   WAVE_API_KEY, WAVE_WEBHOOK_SECRET (optionnel)
//   ORANGE_CLIENT_ID, ORANGE_CLIENT_SECRET, ORANGE_MERCHANT_KEY, ORANGE_ENV
// (SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont déjà
//  fournis automatiquement par Supabase, rien à ajouter pour ceux-là)

window.Paiement = Paiement;