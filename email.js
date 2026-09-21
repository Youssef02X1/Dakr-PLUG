// ============================================
// EMAILS.JS — Système d'emails automatiques
// Via Resend (resend.com) — 3000 emails/mois gratuits
// ============================================
//
// INSTALLATION :
// 1. Créer un compte sur resend.com (gratuit)
// 2. Vérifier votre domaine ou utiliser resend.dev pour les tests
// 3. API Keys → Create API Key → copier la clé
// 4. Remplacer VOTRE_CLE_RESEND ci-dessous
// 5. Ce fichier tourne dans une Supabase Edge Function (voir bas de fichier)
//
// ============================================

const RESEND_API_KEY  = 're_E8nA32NT_4Ude958DiFcMEFZ566qprvGX';       // depuis resend.com → API Keys
const EMAIL_FROM      = 'reservations@dakarplug.sn'; // votre email vérifié
const EMAIL_ADMIN     = 'youssef@dakarplug.sn';  // votre email admin
const SITE_NAME       = 'Dakar PLUG';
const SITE_URL        = 'https://dakarplug.netlify.app';

// ============================================
// TEMPLATES D'EMAILS
// ============================================

const Templates = {

  // ── Email de confirmation au client ──
  confirmationClient(resa, activite) {
    const ref     = (resa.qr_token || '').slice(0,8).toUpperCase();
    const dateF   = new Date(resa.date + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    });
    const montant = (resa.montant_total || 0).toLocaleString('fr-FR');

    return {
      subject: `Réservation confirmée — ${activite.nom} (${ref})`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Confirmation de réservation</title>
</head>
<body style="margin:0;padding:0;background:#F2F2EF;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2EF;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#FFFFFF;border-radius:16px;overflow:hidden;max-width:560px;width:100%">

        <!-- HEADER -->
        <tr>
          <td style="background:#0D0D0D;padding:28px 36px">
            <span style="font-family:Georgia,serif;font-size:20px;color:#FFFFFF;letter-spacing:-.01em">
              <span style="color:#C85A3C;font-style:italic">Dakar</span>PLUG
            </span>
          </td>
        </tr>

        <!-- HÉRO -->
        <tr>
          <td style="padding:36px 36px 24px">
            <div style="width:48px;height:48px;background:rgba(42,122,82,.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
              <span style="font-size:22px">✓</span>
            </div>
            <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#0D0D0D;margin:0 0 8px;letter-spacing:-.02em">
              Réservation confirmée
            </h1>
            <p style="font-size:14px;color:#7A7A7A;margin:0;line-height:1.6">
              Bonjour, votre réservation a bien été enregistrée.
            </p>
          </td>
        </tr>

        <!-- CARTE RÉSERVATION -->
        <tr>
          <td style="padding:0 36px 24px">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#F2F2EF;border-radius:12px;overflow:hidden">
              <tr>
                <td style="padding:20px 24px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7A7A7A;margin-bottom:4px">
                          Activité
                        </div>
                        <div style="font-size:16px;font-weight:600;color:#0D0D0D">
                          ${activite.nom}
                        </div>
                        <div style="font-size:13px;color:#7A7A7A;margin-top:2px">
                          ${activite.zone}
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 20px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%" style="padding-right:12px">
                        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7A7A7A;margin-bottom:4px">Date</div>
                        <div style="font-size:14px;font-weight:500;color:#0D0D0D">${dateF}</div>
                      </td>
                      <td width="50%">
                        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7A7A7A;margin-bottom:4px">Heure</div>
                        <div style="font-size:14px;font-weight:500;color:#0D0D0D">${resa.heure}</div>
                      </td>
                    </tr>
                    <tr><td colspan="2" style="padding-top:12px"></td></tr>
                    <tr>
                      <td width="50%" style="padding-right:12px">
                        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7A7A7A;margin-bottom:4px">Personnes</div>
                        <div style="font-size:14px;font-weight:500;color:#0D0D0D">${resa.nb_personnes}</div>
                      </td>
                      <td width="50%">
                        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7A7A7A;margin-bottom:4px">Total</div>
                        <div style="font-size:14px;font-weight:700;color:#C85A3C">${montant} FCFA</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- RÉFÉRENCE -->
        <tr>
          <td style="padding:0 36px 24px">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #E8E8E4;border-radius:12px">
              <tr>
                <td style="padding:18px 24px;text-align:center">
                  <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7A7A7A;margin-bottom:8px">
                    Référence de réservation
                  </div>
                  <div style="font-size:24px;font-weight:700;letter-spacing:.12em;color:#0D0D0D">
                    ${ref}
                  </div>
                  <div style="font-size:12px;color:#7A7A7A;margin-top:6px">
                    Présentez ce code à votre arrivée
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 36px 32px;text-align:center">
            <a href="${SITE_URL}/espace-utilisateur.html#reservations"
               style="display:inline-block;background:#0D0D0D;color:#FFFFFF;text-decoration:none;
                      padding:13px 28px;border-radius:8px;font-size:13px;font-weight:500;letter-spacing:.01em">
              Voir mes réservations
            </a>
          </td>
        </tr>

        <!-- ANNULATION -->
        <tr>
          <td style="padding:20px 36px;background:#F2F2EF;border-top:1px solid #E8E8E4">
            <p style="font-size:12px;color:#7A7A7A;margin:0;text-align:center;line-height:1.7">
              Annulation gratuite jusqu'à 24h avant l'activité.<br>
              Contactez-nous : <a href="mailto:${EMAIL_ADMIN}" style="color:#1A6560">${EMAIL_ADMIN}</a>
            </p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:20px 36px;text-align:center">
            <p style="font-size:11px;color:#B0B0B0;margin:0">
              © 2026 ${SITE_NAME} · Dakar, Sénégal
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `,
    };
  },

  // ── Email de notification à l'admin ──
  notificationAdmin(resa, activite, client) {
    const ref   = (resa.qr_token || '').slice(0,8).toUpperCase();
    const dateF = new Date(resa.date + 'T00:00:00').toLocaleDateString('fr-FR',{
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    });
    return {
      subject: `[Nouvelle réservation] ${activite.nom} — ${ref}`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#0D0D0D;padding:20px 28px">
      <span style="font-family:Georgia,serif;font-size:18px;color:#fff">
        <span style="color:#C85A3C">Dakar</span>PLUG — Admin
      </span>
    </div>
    <div style="padding:28px">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 20px;color:#0D0D0D">
        Nouvelle réservation reçue
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Référence',  ref],
          ['Activité',   activite.nom],
          ['Date',       `${dateF} à ${resa.heure}`],
          ['Personnes',  resa.nb_personnes],
          ['Montant',    `${(resa.montant_total||0).toLocaleString('fr-FR')} FCFA`],
          ['Paiement',   resa.methode_paiement],
          ['Client',     `${client.prenom || ''} ${client.nom || ''}`],
          ['Téléphone',  client.telephone || '—'],
          ['Email',      client.email || '—'],
        ].map(([k,v]) => `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#7A7A7A;width:120px">${k}</td>
            <td style="padding:8px 0;font-size:13px;font-weight:500;color:#0D0D0D">${v}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #f0f0f0"></td></tr>
        `).join('')}
      </table>
      <div style="margin-top:24px;text-align:center">
        <a href="${SITE_URL}/dashboard.html"
           style="display:inline-block;background:#C85A3C;color:#fff;text-decoration:none;
                  padding:12px 24px;border-radius:8px;font-size:13px;font-weight:500">
          Voir dans le dashboard
        </a>
      </div>
    </div>
  </div>
</body>
</html>
      `,
    };
  },

  // ── Email de rappel 24h avant ──
  rappel24h(resa, activite, client) {
    const ref = (resa.qr_token || '').slice(0,8).toUpperCase();
    return {
      subject: `Rappel — ${activite.nom} demain à ${resa.heure}`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#0D0D0D;padding:20px 28px">
      <span style="font-family:Georgia,serif;font-size:18px;color:#fff">
        <span style="color:#C85A3C">Dakar</span>PLUG
      </span>
    </div>
    <div style="padding:28px;text-align:center">
      <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#0D0D0D;margin:0 0 12px">
        C'est demain !
      </h2>
      <p style="font-size:14px;color:#7A7A7A;margin:0 0 24px;line-height:1.7">
        Rappel pour votre réservation <strong style="color:#0D0D0D">${activite.nom}</strong><br>
        <strong style="color:#0D0D0D">demain à ${resa.heure}</strong> · ${activite.zone}
      </p>
      <div style="background:#F2F2EF;border-radius:10px;padding:16px;margin-bottom:24px">
        <div style="font-size:11px;color:#7A7A7A;margin-bottom:6px">Votre référence</div>
        <div style="font-size:22px;font-weight:700;letter-spacing:.1em;color:#0D0D0D">${ref}</div>
      </div>
      <p style="font-size:13px;color:#7A7A7A;line-height:1.6">
        Annulation gratuite encore possible jusqu'à ce soir.<br>
        Contactez-nous si besoin.
      </p>
    </div>
  </div>
</body>
</html>
      `,
    };
  },
};

// ============================================
// FONCTION D'ENVOI VIA RESEND
// ============================================
async function envoyerEmail({ to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    `${SITE_NAME} <${EMAIL_FROM}>`,
      to:      Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Resend erreur ${response.status}: ${err.message || 'Envoi impossible'}`);
  }

  return await response.json();
}

// ============================================
// FONCTIONS PRINCIPALES — à appeler depuis votre code
// ============================================
const Emails = {

  /**
   * Envoie la confirmation au client + notification à l'admin
   * À appeler juste après la création d'une réservation
   */
  async confirmerReservation(resa, activite, client) {
    const erreurs = [];

    // Email au client
    try {
      const tpl = Templates.confirmationClient(resa, activite);
      await envoyerEmail({ to: client.email, ...tpl });
    } catch(e) {
      erreurs.push(`Client: ${e.message}`);
    }

    // Email à l'admin
    try {
      const tpl = Templates.notificationAdmin(resa, activite, client);
      await envoyerEmail({ to: EMAIL_ADMIN, ...tpl });
    } catch(e) {
      erreurs.push(`Admin: ${e.message}`);
    }

    if (erreurs.length) {
      console.warn('Emails partiellement envoyés:', erreurs);
    }

    return erreurs.length === 0;
  },

  /**
   * Envoie un rappel 24h avant l'activité
   * À déclencher via un cron Supabase (voir bas de fichier)
   */
  async envoyerRappel(resa, activite, client) {
    const tpl = Templates.rappel24h(resa, activite, client);
    return await envoyerEmail({ to: client.email, ...tpl });
  },
};

// ============================================
// SUPABASE EDGE FUNCTION — webhook-emails
// ============================================
// Ce code est à déployer dans Supabase → Edge Functions
// Il déclenche les emails automatiquement à chaque nouvelle réservation
//
// 1. Dans Supabase → Edge Functions → New function → "webhook-emails"
// 2. Coller le code entre les marqueurs EDGE_FUNCTION_START et EDGE_FUNCTION_END
// 3. Dans Supabase → Database → Webhooks → Create webhook :
//    - Table : reservations
//    - Events : INSERT
//    - URL : https://VOTRE_PROJECT_ID.supabase.co/functions/v1/webhook-emails
//    - HTTP Method : POST
//
// ──────────────── EDGE_FUNCTION_START ────────────────
//
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
//
// const RESEND_KEY  = Deno.env.get('RESEND_API_KEY')
// const EMAIL_FROM  = 'reservations@dakarplug.sn'
// const EMAIL_ADMIN = Deno.env.get('ADMIN_EMAIL')
// const SITE_URL    = Deno.env.get('SITE_URL')
//
// Deno.serve(async (req) => {
//   const body = await req.json()
//   const resa = body.record   // la nouvelle réservation
//
//   const supabase = createClient(
//     Deno.env.get('SUPABASE_URL'),
//     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
//   )
//
//   // Charger l'activité et le profil client
//   const [{ data: activite }, { data: client }] = await Promise.all([
//     supabase.from('activites').select('nom,zone,adresse').eq('id', resa.activite_id).single(),
//     supabase.from('profiles').select('prenom,nom,telephone').eq('id', resa.user_id).single(),
//   ])
//
//   const ref     = (resa.qr_token || '').slice(0, 8).toUpperCase()
//   const montant = (resa.montant_total || 0).toLocaleString('fr-FR')
//
//   // Email client
//   await fetch('https://api.resend.com/emails', {
//     method: 'POST',
//     headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       from: `Dakar PLUG <${EMAIL_FROM}>`,
//       to:   [resa.client_email],
//       subject: `Réservation confirmée — ${activite?.nom} (${ref})`,
//       html: `<p>Bonjour,</p><p>Votre réservation pour <strong>${activite?.nom}</strong>
//              le ${resa.date} à ${resa.heure} est enregistrée.</p>
//              <p>Référence : <strong>${ref}</strong><br>Montant : <strong>${montant} FCFA</strong></p>
//              <p><a href="${SITE_URL}/espace-utilisateur.html">Voir mes réservations</a></p>`,
//     }),
//   })
//
//   // Email admin
//   await fetch('https://api.resend.com/emails', {
//     method: 'POST',
//     headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       from: `Dakar PLUG <${EMAIL_FROM}>`,
//       to:   [EMAIL_ADMIN],
//       subject: `[Nouvelle réservation] ${activite?.nom} — ${ref}`,
//       html: `<p>Nouvelle réservation :<br>
//              <strong>${client?.prenom} ${client?.nom}</strong> —
//              ${activite?.nom} — ${resa.date} ${resa.heure} —
//              ${montant} FCFA</p>
//              <p><a href="${SITE_URL}/dashboard.html">Voir le dashboard</a></p>`,
//     }),
//   })
//
//   return new Response(JSON.stringify({ ok: true }), { status: 200 })
// })
//
// ──────────────── EDGE_FUNCTION_END ────────────────
//
// VARIABLES D'ENVIRONNEMENT à ajouter dans Supabase → Edge Functions → Secrets :
// RESEND_API_KEY       → votre clé Resend
// ADMIN_EMAIL          → votre email admin
// SITE_URL             → URL de votre site
// SUPABASE_URL         → (automatique)
// SUPABASE_SERVICE_ROLE_KEY → (automatique)

window.Emails = Emails;