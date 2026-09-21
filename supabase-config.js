// ============================================
// SUPABASE CONFIG — Dakar PLUG
// ============================================
// MODIFIEZ CES 7 VALEURS AVEC VOS VRAIES INFORMATIONS
// Trouvez vos clés dans Supabase → Project Settings → API
// ============================================

const SUPABASE_URL      = 'https://jjlkdogolzdaxsxfuxpi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbGtkb2dvbHpkYXhzeGZ1eHBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzIzMTEsImV4cCI6MjEwNDIwODMxMX0.ESAF47a3S9-7FrByEB7t2SuEHoXWFg-eAwuOCPL6rus';
const ADMIN_EMAIL       = 'lefayoussef@gmail.com';         // votre email admin
const WHATSAPP_NUMBER   = '221779913729';             // sans + ni espaces
const SITE_URL          = 'https://dakarplug.netlify.app'; // URL finale du site

// ============================================
// CLIENT SUPABASE
// ============================================
// Helper : timeout sur les requêtes (évite les requêtes infinies)
async function withTimeout(promise, ms = 10000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Délai dépassé — vérifiez votre connexion')), ms)
  );
  return Promise.race([promise, timeout]);
}
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: true,
  }
});

// ============================================
// SÉCURITÉ — nettoyage des entrées
// ============================================
const Security = {
  escape(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/\//g,'&#x2F;');
  },
  // Neutralise les caractères ayant un sens spécial dans la syntaxe de filtre
  // PostgREST (virgule = séparateur de conditions, parenthèses = groupement,
  // *,% = wildcards) avant d'interpoler une saisie utilisateur dans .or()/.ilike().
  escapePostgrest(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[,()*%]/g, '').trim().slice(0, 100);
  },
  sanitize(obj) {
    const out = {};
    for (const [k,v] of Object.entries(obj)) {
      out[k] = typeof v === 'string' ? v.trim().slice(0,2000) : v;
    }
    return out;
  },
  isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); },
  // Accepte tous les numéros internationaux : +33, +1, +212, +221, etc.
  isValidPhone(p) {
    if (!p) return false;
    const clean = p.replace(/[\s\-\.\(\)]/g, '');  // supprimer espaces, tirets, points, parenthèses
    return /^\+?[0-9]{7,15}$/.test(clean);             // entre 7 et 15 chiffres
  },
  // Formate un numéro pour l'affichage propre
  formatPhone(p) {
    if (!p) return '';
    const clean = p.replace(/[\s\-\.\(\)]/g, '');
    // Sénégal sans indicatif → ajoute +221
    if (/^[0-9]{9}$/.test(clean) && ['77','78','76','70','75','33'].some(p => clean.startsWith(p))) {
      return '+221 ' + clean.slice(0,2) + ' ' + clean.slice(2,5) + ' ' + clean.slice(5,7) + ' ' + clean.slice(7);
    }
    return p.trim();
  },
  generateToken() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a, b=>b.toString(16).padStart(2,'0')).join('');
  },
};

// ============================================
// AUTH
// ============================================
const Auth = {
  async signUp(email, password, nom, prenom) {
    if (!Security.isValidEmail(email)) throw new Error('Email invalide');
    if (password.length < 8) throw new Error('Mot de passe trop court (min. 8 caractères)');
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: {
        data: { nom: Security.escape(nom), prenom: Security.escape(prenom) },
        emailRedirectTo: SITE_URL + '/espace-utilisateur.html'
      }
    });
    if (error) throw error;
    return data;
  },
  async signIn(email, password) {
    if (!Security.isValidEmail(email)) throw new Error('Email invalide');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signInWithGoogle() {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: SITE_URL + '/espace-utilisateur.html' }
    });
    if (error) throw error;
    return data;
  },
  async signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  },
  async getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  },
  async isAdmin() {
    const user = await this.getUser();
    if (!user) return false;
    return user.email === ADMIN_EMAIL;
  },
  async updateProfile(data) {
    const { error } = await sb.auth.updateUser({ data });
    if (error) throw error;
  },
  async updatePassword(pwd) {
    if (pwd.length < 8) throw new Error('Mot de passe trop court');
    const { error } = await sb.auth.updateUser({ password: pwd });
    if (error) throw error;
  },
  async resetPassword(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: SITE_URL + '/auth.html?mode=reset'
    });
    if (error) throw error;
  },
  onAuthChange(cb) {
    return sb.auth.onAuthStateChange(cb);
  },
};

// ============================================
// ACTIVITÉS
// ============================================
const Activites = {
  async getAll(filters = {}) {
    let q = sb.from('activites').select('*').eq('publiee', true);
    if (filters.categorie) q = q.eq('categorie', filters.categorie);
    if (filters.zone)      q = q.ilike('zone', `%${Security.escapePostgrest(filters.zone)}%`);
    if (filters.prix_max)  q = q.lte('prix', Number(filters.prix_max));
    if (filters.search)    {
      const s = Security.escapePostgrest(filters.search);
      q = q.or(`nom.ilike.%${s}%,description.ilike.%${s}%,zone.ilike.%${s}%`);
    }
    switch(filters.tri) {
      case 'prix_asc':  q = q.order('prix', { ascending: true });  break;
      case 'prix_desc': q = q.order('prix', { ascending: false }); break;
      case 'note':      q = q.order('note', { ascending: false });  break;
      default:          q = q.order('created_at', { ascending: false });
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const numId = parseInt(id, 10);
    if (!Number.isFinite(numId)) throw new Error('ID invalide');
    const { data, error } = await sb
      .from('activites')
      .select('*, avis(id,note,texte,created_at,profiles(prenom,nom)), disponibilites(*)')
      .eq('id', numId)
      .eq('publiee', true)
      .single();
    if (error) throw error;
    return data;
  },

  async getBonsPlans() {
    const { data, error } = await sb
      .from('activites').select('*')
      .eq('publiee', true).eq('bons_plans', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getByCategorie(cat, limit = 3) {
    const { data, error } = await sb
      .from('activites').select('*')
      .eq('publiee', true).eq('categorie', cat).limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getAllAdmin() {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const { data, error } = await sb
      .from('activites').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getFavoris(userId) {
    const { data, error } = await sb
      .from('favoris').select('activite_id, activites(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(f => f.activites).filter(Boolean);
  },

  async getFavorisIds(userId) {
    const { data } = await sb
      .from('favoris').select('activite_id').eq('user_id', userId);
    return (data || []).map(f => f.activite_id);
  },

  async toggleFavori(userId, activiteId) {
    const { data: existing } = await sb
      .from('favoris').select('id')
      .eq('user_id', userId).eq('activite_id', activiteId).maybeSingle();
    if (existing) {
      await sb.from('favoris').delete().eq('id', existing.id);
      return false;
    }
    await sb.from('favoris').insert({ user_id: userId, activite_id: activiteId });
    return true;
  },

  async getDisponibilites(activiteId) {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await sb
      .from('disponibilites').select('*')
      .eq('activite_id', activiteId).gte('date', today).order('date');
    return data || [];
  },
};

// ============================================
// RÉSERVATIONS
// ============================================
const Reservations = {
  async creer(data) {
    const user = await Auth.getUser();
    if (!user) throw new Error('Connexion requise pour réserver');
    const clean   = Security.sanitize(data);
    const token   = Security.generateToken();
    const payload = {
      user_id:          user.id,
      activite_id:      parseInt(clean.activite_id, 10),
      date:             clean.date,
      heure:            clean.heure,
      nb_personnes:     parseInt(clean.nb_personnes, 10),
      options:          Array.isArray(clean.options) ? clean.options : [],
      montant_total:    parseInt(clean.montant_total, 10),
      methode_paiement: clean.methode_paiement,
      note_client:      clean.note_client || null,
      statut:           'en_attente',
      qr_token:         token,
    };
    const { data: resa, error } = await sb
      .from('reservations').insert(payload).select().single();
    if (error) throw error;
    return resa;
  },

  async getMesReservations(userId) {
    const { data, error } = await sb
      .from('reservations')
      .select('*, activites(id,nom,categorie,image_principale,adresse,zone)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getToutes() {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const { data, error } = await sb
      .from('reservations')
      .select('*, activites(nom,categorie), profiles(nom,prenom,telephone)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async confirmer(id) {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const { error } = await sb
      .from('reservations').update({ statut: 'confirmee' })
      .eq('id', parseInt(id, 10));
    if (error) throw error;
  },

  async annuler(id) {
    const user = await Auth.getUser();
    if (!user) throw new Error('Non connecté');
    const { error } = await sb
      .from('reservations').update({ statut: 'annulee' })
      .eq('id', parseInt(id, 10)).eq('user_id', user.id);
    if (error) throw error;
  },
};

// ============================================
// ADMIN
// ============================================
const Admin = {
  async publierActivite(data) {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const c = Security.sanitize(data);
    if (!c.nom || c.nom.length < 3)            throw new Error('Nom invalide');
    if (!c.prix || parseInt(c.prix) < 0)       throw new Error('Prix invalide');
    // SÉCURITÉ : valider URL image (https uniquement, pas de javascript: ni data:)
    const imgUrl = (c.image_principale || '').trim();
    if (!imgUrl.startsWith('https://')) throw new Error('URL image invalide (https requis)');
    if (/[<>"'`]/.test(imgUrl)) throw new Error('URL image contient des caractères invalides');
    const payload = {
      nom: c.nom, categorie: c.categorie, zone: c.zone,
      adresse: c.adresse||null, description: c.description,
      prix: parseInt(c.prix),
      promo: c.promo ? parseInt(c.promo) : null,
      duree: c.duree||null, niveau: c.niveau||'Tout public',
      capacite: c.capacite ? parseInt(c.capacite) : null,
      image_principale: c.image_principale,
      images: c.images||[], options: c.options||[],
      periode: c.periode || 'jour',
      creneaux_jour: c.creneaux_jour || ['08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00'],
      creneaux_nuit: c.creneaux_nuit || ['18:00','19:00','20:00','21:00','22:00','23:00'],
      bons_plans: Boolean(c.bons_plans), publiee: Boolean(c.publiee),
      lat: c.lat ? parseFloat(c.lat) : null,
      lng: c.lng ? parseFloat(c.lng) : null,
    };
    const { data: act, error } = await sb
      .from('activites').insert(payload).select().single();
    if (error) throw error;
    return act;
  },

  async modifierActivite(id, data) {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const c = Security.sanitize(data);
    const { error } = await sb.from('activites').update({
      nom: c.nom, categorie: c.categorie, zone: c.zone,
      adresse: c.adresse||null, description: c.description,
      prix: parseInt(c.prix),
      promo: c.promo ? parseInt(c.promo) : null,
      duree: c.duree||null, niveau: c.niveau||'Tout public',
      capacite: c.capacite ? parseInt(c.capacite) : null,
      image_principale: c.image_principale,
      images: c.images||[], options: c.options||[],
      bons_plans: Boolean(c.bons_plans), publiee: Boolean(c.publiee),
      lat: c.lat ? parseFloat(c.lat) : null,
      lng: c.lng ? parseFloat(c.lng) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', parseInt(id, 10));
    if (error) throw error;
  },

  async togglePublication(id, publiee) {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const { error } = await sb.from('activites')
      .update({ publiee, updated_at: new Date().toISOString() })
      .eq('id', parseInt(id, 10));
    if (error) throw error;
  },

  async supprimerActivite(id) {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const { error } = await sb.from('activites').delete().eq('id', parseInt(id, 10));
    if (error) throw error;
  },

  async getStats() {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const [
      { count: totalResa },
      { count: resaEnAttente },
      { count: resaConfirmees },
      { count: totalAct },
      { data: revenus },
    ] = await Promise.all([
      sb.from('reservations').select('*', { count:'exact', head:true }),
      sb.from('reservations').select('*', { count:'exact', head:true }).eq('statut','en_attente'),
      sb.from('reservations').select('*', { count:'exact', head:true }).eq('statut','confirmee'),
      sb.from('activites').select('*', { count:'exact', head:true }).eq('publiee', true),
      sb.from('reservations').select('montant_total').eq('statut','confirmee'),
    ]);
    const totalRevenus = (revenus||[]).reduce((s,r)=>s+(r.montant_total||0), 0);
    return { totalResa, resaEnAttente, resaConfirmees, totalAct, totalRevenus };
  },

  async setDisponibilite(activiteId, date, disponible, placesMax=null) {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const { error } = await sb.from('disponibilites').upsert({
      activite_id: parseInt(activiteId, 10),
      date, disponible, places_max: placesMax,
    }, { onConflict: 'activite_id,date' });
    if (error) throw error;
  },
};

// ============================================
// STORAGE — Upload photos
// ============================================
const Storage = {
  async uploadImage(file) {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const allowed = ['image/jpeg','image/png','image/webp'];
    if (!allowed.includes(file.type)) throw new Error('Format invalide (JPG, PNG, WebP)');
    if (file.size > 5*1024*1024)      throw new Error('Image trop lourde (max 5 Mo)');
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    const ext  = file.name.split('.').pop().toLowerCase();
    const name = Array.from(arr, b=>b.toString(16).padStart(2,'0')).join('') + '.' + ext;
    const path = `activites/${name}`;
    const { error } = await sb.storage.from('images').upload(path, file, {
      cacheControl: '3600', upsert: false,
    });
    if (error) throw error;
    const { data: { publicUrl } } = sb.storage.from('images').getPublicUrl(path);
    return publicUrl;
  },
};

// ============================================
// AVIS
// ============================================
const Avis = {
  async soumettre(activiteId, note, texte) {
    const user = await Auth.getUser();
    if (!user) throw new Error('Connexion requise');
    const clean = texte.trim().replace(/[<>"']/g,'').slice(0,500);
    if (clean.length < 10) throw new Error('Avis trop court');
    if (note < 1 || note > 5) throw new Error('Note invalide');
    const { error } = await sb.from('avis').upsert({
      user_id: user.id, activite_id: parseInt(activiteId,10),
      note: parseInt(note), texte: clean, verifie: false,
    }, { onConflict: 'user_id,activite_id' });
    if (error) throw error;
  },

  async getTousAdmin() {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const { data, error } = await sb
      .from('avis')
      .select('*, profiles(prenom,nom), activites(nom)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async valider(id) {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) throw new Error('Accès refusé');
    const { error } = await sb.from('avis').update({ verifie:true }).eq('id', parseInt(id,10));
    if (error) throw error;
  },
};

// ============================================
// WHATSAPP
// ============================================
function redirectWhatsApp(reservation, activiteNom) {
  const msg = encodeURIComponent(
    `Nouvelle réservation — ${activiteNom}\n` +
    `Date : ${reservation.date} a ${reservation.heure}\n` +
    `Personnes : ${reservation.nb_personnes}\n` +
    `Montant : ${(reservation.montant_total||0).toLocaleString('fr-FR')} FCFA\n` +
    `Paiement : ${reservation.methode_paiement||''}\n` +
    `Ref : ${(reservation.qr_token||'').slice(0,8).toUpperCase()}`
  );
  window.open(`https://wa.me/${779913729}?text=${msg}`, '_blank', 'noopener,noreferrer');
}

// ============================================
// EXPORT GLOBAL
// ============================================
window.DakarApp = {
  sb, SUPABASE_URL,
  ADMIN_EMAIL, WHATSAPP_NUMBER, SITE_URL,
  Security, Auth, Activites, Reservations, Admin, Storage, Avis,
  redirectWhatsApp,
};