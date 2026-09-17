// ============================================
// NOTIFICATIONS.JS — Push Notifications
// Dakar PLUG
// ============================================
// Notifie l'admin en temps réel quand une réservation arrive
// Notifie le client quand sa réservation est confirmée
//
// PRÉREQUIS :
// 1. Générer les clés VAPID sur https://vapidkeys.com/
// 2. Remplacer VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY
// 3. Les utilisateurs doivent accepter les notifications dans leur navigateur
// ============================================

const VAPID_PUBLIC_KEY = 'VOTRE_VAPID_PUBLIC_KEY'; // depuis vapidkeys.com

// ════════════════════════════════════════════
//  CONVERSION CLÉ VAPID
// ════════════════════════════════════════════
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ════════════════════════════════════════════
//  DEMANDE DE PERMISSION
// ════════════════════════════════════════════
const PushNotif = {

  /**
   * Vérifie si les notifications push sont supportées et autorisées
   */
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  isGranted() {
    return Notification.permission === 'granted';
  },

  /**
   * Demande la permission à l'utilisateur
   * Retourne true si accordée, false sinon
   */
  async demanderPermission() {
    if (!this.isSupported()) return false;
    if (this.isGranted()) return true;

    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  /**
   * Abonne l'utilisateur aux notifications push
   * Sauvegarde l'abonnement dans Supabase
   */
  async abonner(userId = null) {
    if (!this.isSupported()) return null;

    const granted = await this.demanderPermission();
    if (!granted) return null;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Sauvegarder en localStorage (et Supabase si connecté)
      localStorage.setItem('da_push_sub', JSON.stringify(sub));

      if (userId) {
        const { sb } = window.DakarApp || {};
        if (sb) {
          await sb.from('push_subscriptions').upsert({
            user_id:      userId,
            subscription: sub,
            updated_at:   new Date().toISOString(),
          }, { onConflict: 'user_id' });
        }
      }

      return sub;
    } catch(e) {
      console.warn('Push subscription failed:', e.message);
      return null;
    }
  },

  /**
   * Affiche une notification locale immédiate
   * (sans serveur, fonctionne quand l'onglet est ouvert)
   */
  async afficher({ titre, corps, url = '/', icone = null }) {
    if (!this.isGranted()) return;

    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(titre, {
      body:    corps,
      icon:    icone || '/icon-192.png',
      badge:   '/icon-192.png',
      vibrate: [200, 100, 200],
      data:    { url },
      actions: [
        { action: 'voir', title: 'Voir' },
        { action: 'fermer', title: 'Fermer' },
      ],
    });
  },

  // ── Notifications prédéfinies ──

  async nouvelleReservation(activiteNom, ref) {
    await this.afficher({
      titre: 'Nouvelle réservation',
      corps: `${activiteNom} — Réf. ${ref}`,
      url:   '/dashboard.html',
    });
  },

  async reservationConfirmee(activiteNom, date) {
    await this.afficher({
      titre: 'Réservation confirmée !',
      corps: `${activiteNom} le ${date}`,
      url:   '/espace-utilisateur.html#reservations',
    });
  },

  async rappelActivite(activiteNom, heure) {
    await this.afficher({
      titre: 'Rappel — Activité demain',
      corps: `${activiteNom} à ${heure}`,
      url:   '/espace-utilisateur.html#reservations',
    });
  },
};

// ════════════════════════════════════════════
//  ÉCOUTE TEMPS RÉEL SUPABASE → ADMIN
//  Déclenche une notification à chaque nouvelle réservation
// ════════════════════════════════════════════
const RealtimeNotif = {

  channel: null,

  /**
   * Démarre l'écoute temps réel des nouvelles réservations
   * À appeler dans dashboard.html quand l'admin est connecté
   */
  async demarrer() {
    const { sb, Auth } = window.DakarApp || {};
    if (!sb) return;

    const isAdmin = await Auth.isAdmin().catch(() => false);
    if (!isAdmin) return;

    // Demander la permission push
    await PushNotif.demanderPermission();

    // S'abonner aux changements de la table reservations
    this.channel = sb
      .channel('reservations-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reservations' },
        async (payload) => {
          const resa = payload.new;
          const ref  = (resa.qr_token || '').slice(0, 8).toUpperCase();

          // Charger le nom de l'activité
          let activiteNom = 'Nouvelle activité';
          try {
            const { data } = await sb
              .from('activites').select('nom').eq('id', resa.activite_id).single();
            if (data) activiteNom = data.nom;
          } catch(e) {}

          // Notification push
          await PushNotif.nouvelleReservation(activiteNom, ref);

          // Toast dans le dashboard (si visible)
          if (window.showToast) {
            window.showToast(`Nouvelle réservation — ${activiteNom} (${ref})`, 'success');
          }

          // Rafraîchir le dashboard si la fonction existe
          if (window.renderOverview) window.renderOverview();
          if (window.renderResas)    window.renderResas();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reservations' },
        async (payload) => {
          const resa = payload.new;
          if (resa.statut === 'confirmee') {
            const ref = (resa.qr_token || '').slice(0, 8).toUpperCase();
            if (window.showToast) {
              window.showToast(`Réservation confirmée — Réf. ${ref}`, 'success');
            }
          }
          if (window.renderResas) window.renderResas();
        }
      )
      .subscribe();
  },

  /**
   * Écoute pour l'utilisateur client
   * Notifie quand sa réservation est confirmée
   */
  async demarrerClient(userId) {
    const { sb } = window.DakarApp || {};
    if (!sb || !userId) return;

    await PushNotif.demanderPermission();

    this.channel = sb
      .channel(`reservations-user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', schema: 'public', table: 'reservations',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const resa = payload.new;
          if (resa.statut === 'confirmee') {
            let activiteNom = 'votre activité';
            try {
              const { data } = await sb
                .from('activites').select('nom').eq('id', resa.activite_id).single();
              if (data) activiteNom = data.nom;
            } catch(e) {}

            await PushNotif.reservationConfirmee(activiteNom, resa.date);

            if (window.showToast) {
              window.showToast(`Votre réservation ${activiteNom} est confirmée !`, 'success');
            }
            if (window.renderReservations) window.renderReservations();
          }
        }
      )
      .subscribe();
  },

  arreter() {
    const { sb } = window.DakarApp || {};
    if (sb && this.channel) {
      sb.removeChannel(this.channel);
      this.channel = null;
    }
  },
};

// ════════════════════════════════════════════
//  SERVICE WORKER — gestion des clics notif
//  À ajouter dans sw.js
// ════════════════════════════════════════════
// self.addEventListener('notificationclick', event => {
//   event.notification.close();
//   const url = event.notification.data?.url || '/';
//   if (event.action === 'fermer') return;
//   event.waitUntil(
//     clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
//       for (const client of list) {
//         if (client.url.includes(url)) return client.focus();
//       }
//       return clients.openWindow(url);
//     })
//   );
// });

window.PushNotif     = PushNotif;
window.RealtimeNotif = RealtimeNotif;