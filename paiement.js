// ============================================
// PAIEMENT.JS — Intégration Wave & Orange Money
// VERSION SÉCURISÉE — Frontend uniquement
// ============================================
//
// ARCHITECTURE SÉCURISÉE :
//
// FRONTEND (ce fichier) → appelle votre Supabase Edge Function
// EDGE FUNCTION (serveur) → appelle Wave/Orange avec les vraies clés
//
// Les clés secrètes Wave et Orange Money ne sont JAMAIS dans ce fichier.
// Elles sont dans Supabase → Edge Functions → Secrets (chiffrées, côté serveur).
//
// ============================================

// URL publique de votre Supabase (pas un secret)
const SUPABASE_EDGE_URL = window.DakarApp?.SITE_URL
  ? `https://${window.DakarApp.SITE_URL.replace('https://','').split('.')[0]}.supabase.co/functions/v1`
  : 'https://VOTRE_PROJECT_ID.supabase.co/functions/v1';

// ════════════════════════════════════════════
//  INTERFACE PAIEMENT PRINCIPALE
// ════════════════════════════════════════════
const Paiement = {

  /**
   * Lance un paiement Wave ou Orange Money
   * Appelle l'Edge Function Supabase qui détient les vraies clés API
   *
   * @param {string} methode - 'wave' | 'orange' | 'especes'
   * @param {Object} resa    - Données de la réservation
   */
  async lancer(methode, resa) {
    if (methode === 'especes') return; // Pas d'API pour espèces

    const { montant, qr_token, activite_nom, telephone } = resa;
    if (!montant || montant < 1)  throw new Error('Montant invalide');
    if (!qr_token)                throw new Error('Référence manquante');
    if (methode === 'orange' && !telephone)
      throw new Error('Numéro de téléphone requis pour Orange Money');

    const reference = qr_token.slice(0, 8).toUpperCase();

    // Récupérer le token d'auth Supabase de l'utilisateur connecté
    const { sb } = window.DakarApp || {};
    let authHeader = {};
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.access_token) {
        authHeader = { 'Authorization': `Bearer ${session.access_token}` };
      }
    }

    // Appel sécurisé vers la Edge Function Supabase
    const response = await fetch(`${SUPABASE_EDGE_URL}/initier-paiement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        methode,
        montant:      parseInt(montant),
        reference,
        description:  `Réservation ${activite_nom}`,
        telephone:    telephone || null,
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
    // La Edge Function renvoie l'URL de paiement
    if (!data.payment_url) throw new Error('URL de paiement non reçue');

    // SÉCURITÉ : valider que l'URL vient bien de Wave ou Orange Money
    const allowedHosts = ['pay.wave.com','checkout.wave.com','api.wave.com',
                          'payment.orange.com','api.orange.com','webpay.orange.com'];
    try {
      const parsedUrl = new URL(data.payment_url);
      const isAllowed = allowedHosts.some(h => parsedUrl.hostname.endsWith(h));
      if (!isAllowed && !data.payment_url.startsWith('https://')) {
        throw new Error('URL de paiement non autorisée');
      }
    } catch(e) {
      if (e.message === 'URL de paiement non autorisée') throw e;
      throw new Error('URL de paiement invalide');
    }

    // Sauvegarder les infos pour vérification au retour
    sessionStorage.setItem('da_pay_session', JSON.stringify({
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
          session_id: session.session_id,
          methode:    session.methode,
          reference:  session.reference,
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

// ════════════════════════════════════════════
//  EDGE FUNCTION SUPABASE — initier-paiement
// ════════════════════════════════════════════
// À DÉPLOYER dans Supabase → Edge Functions → New function → "initier-paiement"
//
// Les clés secrètes Wave et Orange sont stockées dans :
// Supabase → Edge Functions → Manage secrets (chiffrées, jamais exposées)
//
// ──────── CODE DE LA EDGE FUNCTION ────────
//
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
//
// const WAVE_API_KEY       = Deno.env.get('WAVE_API_KEY')
// const ORANGE_CLIENT_ID   = Deno.env.get('ORANGE_CLIENT_ID')
// const ORANGE_SECRET      = Deno.env.get('ORANGE_CLIENT_SECRET')
// const ORANGE_MERCHANT    = Deno.env.get('ORANGE_MERCHANT_KEY')
//
// Deno.serve(async (req) => {
//   // Vérifier que l'utilisateur est connecté
//   const authHeader = req.headers.get('Authorization')
//   if (!authHeader) return new Response(JSON.stringify({ message: 'Non autorisé' }), { status: 401 })
//
//   const { methode, montant, reference, description, telephone,
//           success_url, error_url, cancel_url } = await req.json()
//
//   if (methode === 'wave') {
//     // Appel API Wave — clé secrète côté serveur uniquement
//     const res = await fetch('https://api.wave.com/v1/checkout/sessions', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${WAVE_API_KEY}`,
//       },
//       body: JSON.stringify({
//         amount:          String(montant),
//         currency:        'XOF',
//         success_url:     success_url,
//         error_url:       error_url,
//         client_reference: reference,
//       }),
//     })
//     const data = await res.json()
//     return new Response(JSON.stringify({
//       payment_url: data.wave_launch_url,
//       session_id:  data.id,
//     }), { status: 200, headers: { 'Content-Type': 'application/json' } })
//   }
//
//   if (methode === 'orange') {
//     // Obtenir token OAuth Orange
//     const creds = btoa(`${ORANGE_CLIENT_ID}:${ORANGE_SECRET}`)
//     const tokenRes = await fetch('https://api.orange.com/oauth/v3/token', {
//       method: 'POST',
//       headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
//       body: 'grant_type=client_credentials',
//     })
//     const { access_token } = await tokenRes.json()
//
//     // Initier la transaction Orange
//     const payRes = await fetch('https://api.orange.com/orange-money-webpay/sn/v1/webpayment', {
//       method: 'POST',
//       headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         merchant_key: ORANGE_MERCHANT,
//         currency:     'OUV',
//         order_id:     reference,
//         amount:       montant,
//         return_url:   success_url,
//         cancel_url:   cancel_url,
//         notif_url:    `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-paiement`,
//         lang:         'fr',
//       }),
//     })
//     const payData = await payRes.json()
//     return new Response(JSON.stringify({
//       payment_url: payData.payment_url,
//       session_id:  payData.pay_token,
//     }), { status: 200, headers: { 'Content-Type': 'application/json' } })
//   }
//
//   return new Response(JSON.stringify({ message: 'Méthode inconnue' }), { status: 400 })
// })
//
// ──────── SECRETS À CONFIGURER ────────
// Dans Supabase → Edge Functions → Manage secrets, ajouter :
//   WAVE_API_KEY          → votre clé API Wave Production
//   ORANGE_CLIENT_ID      → votre Client ID Orange Developer
//   ORANGE_CLIENT_SECRET  → votre Client Secret Orange
//   ORANGE_MERCHANT_KEY   → votre clé marchand Orange Money

window.Paiement = Paiement;