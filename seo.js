// ============================================
// SEO.JS — Balises structurées + optimisations
// Dakar PLUG
// ============================================
// Injecte automatiquement les balises JSON-LD Schema.org
// pour un meilleur référencement Google
// ============================================

const SEO = {

  /**
   * Injecte les métadonnées de base dans <head>
   * Appeler sur chaque page
   */
  setMeta({ titre, description, image, url, type = 'website' }) {
    // Title
    document.title = titre;

    // Helper pour créer/mettre à jour une meta
    const setMeta = (selector, attr, value) => {
      let el = document.querySelector(selector);
      if (!el) { el = document.createElement('meta'); document.head.appendChild(el); }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]',         'content', description);
    setMeta('meta[property="og:title"]',        'content', titre);
    setMeta('meta[property="og:description"]',  'content', description);
    setMeta('meta[property="og:image"]',        'content', image);
    setMeta('meta[property="og:url"]',          'content', url);
    setMeta('meta[property="og:type"]',         'content', type);
    setMeta('meta[property="og:locale"]',       'content', 'fr_SN');
    setMeta('meta[name="twitter:card"]',        'content', 'summary_large_image');
    setMeta('meta[name="twitter:title"]',       'content', titre);
    setMeta('meta[name="twitter:description"]', 'content', description);
    setMeta('meta[name="twitter:image"]',       'content', image);

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = url;
  },

  /**
   * Schema.org pour la page d'accueil — WebSite + SearchAction
   */
  injectHomepage(siteUrl) {
    this._inject({
      '@context':  'https://schema.org',
      '@type':     'WebSite',
      'name':      'Dakar PLUG',
      'url':        siteUrl,
      'description':'Plateforme de réservation d\'activités touristiques et de loisirs à Dakar, Sénégal.',
      'inLanguage': 'fr',
      'potentialAction': {
        '@type':       'SearchAction',
        'target':      `${siteUrl}/index.html?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    });

    this._inject({
      '@context': 'https://schema.org',
      '@type':    'Organization',
      'name':     'Dakar PLUG',
      'url':       siteUrl,
      'logo':      `${siteUrl}/icon-512.png`,
      'sameAs':   [],
      'contactPoint': {
        '@type':           'ContactPoint',
        'contactType':     'customer service',
        'availableLanguage': 'French',
      },
      'address': {
        '@type':           'PostalAddress',
        'addressLocality': 'Dakar',
        'addressCountry':  'SN',
      },
    });
  },

  /**
   * Schema.org pour une fiche activité — TouristAttraction + Offer
   */
  injectActivite(activite, siteUrl) {
    const prixAff = activite.promo
      ? Math.round(activite.prix * (1 - activite.promo / 100))
      : activite.prix;

    const schema = {
      '@context':    'https://schema.org',
      '@type':       'TouristAttraction',
      'name':         activite.nom,
      'description':  activite.description,
      'image':        activite.image_principale,
      'url':          `${siteUrl}/activite.html?id=${activite.id}`,
      'touristType':  'Leisure',
      'availableLanguage': ['French'],
      'address': {
        '@type':           'PostalAddress',
        'streetAddress':    activite.adresse || activite.zone,
        'addressLocality':  'Dakar',
        'addressCountry':   'SN',
      },
      'offers': {
        '@type':         'Offer',
        'price':          prixAff,
        'priceCurrency': 'XOF',
        'availability':  'https://schema.org/InStock',
        'url':           `${siteUrl}/reservation.html?id=${activite.id}`,
      },
    };

    if (activite.lat && activite.lng) {
      schema.geo = {
        '@type':     'GeoCoordinates',
        'latitude':   activite.lat,
        'longitude':  activite.lng,
      };
    }

    if (activite.note > 0 && activite.nb_avis > 0) {
      schema.aggregateRating = {
        '@type':       'AggregateRating',
        'ratingValue':  activite.note,
        'reviewCount':  activite.nb_avis,
        'bestRating':   5,
        'worstRating':  1,
      };
    }

    this._inject(schema);
  },

  /**
   * Schema.org pour la page de réservation — ReservationPackage
   */
  injectReservation(activite, siteUrl) {
    this._inject({
      '@context': 'https://schema.org',
      '@type':    'ReservationPackage',
      'name':     `Réservation — ${activite.nom}`,
      'url':       `${siteUrl}/reservation.html?id=${activite.id}`,
      'broker': {
        '@type': 'TravelAgency',
        'name':  'Dakar PLUG',
        'url':    siteUrl,
      },
    });
  },

  /**
   * Breadcrumb Schema.org
   */
  injectBreadcrumb(items, siteUrl) {
    this._inject({
      '@context':  'https://schema.org',
      '@type':     'BreadcrumbList',
      'itemListElement': items.map((item, i) => ({
        '@type':   'ListItem',
        'position': i + 1,
        'name':     item.label,
        'item':     item.url ? `${siteUrl}${item.url}` : undefined,
      })),
    });
  },

  /** Injecte un objet JSON-LD dans le <head> */
  _inject(schema) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  },
};

// ════════════════════════════════════════════
//  SITEMAP.XML — à créer à la racine du site
// ════════════════════════════════════════════
// Copiez ce contenu dans un fichier sitemap.xml
// et remplacez VOTRE_DOMAINE par votre vrai domaine
//
// <?xml version="1.0" encoding="UTF-8"?>
// <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
//   <url>
//     <loc>https://VOTRE_DOMAINE/index.html</loc>
//     <changefreq>daily</changefreq>
//     <priority>1.0</priority>
//   </url>
//   <url>
//     <loc>https://VOTRE_DOMAINE/auth.html</loc>
//     <changefreq>monthly</changefreq>
//     <priority>0.3</priority>
//   </url>
//   <url>
//     <loc>https://VOTRE_DOMAINE/cgv.html</loc>
//     <changefreq>yearly</changefreq>
//     <priority>0.2</priority>
//   </url>
// </urlset>

// ════════════════════════════════════════════
//  ROBOTS.TXT — à créer à la racine du site
// ════════════════════════════════════════════
// User-agent: *
// Allow: /
// Disallow: /dashboard.html
// Disallow: /espace-utilisateur.html
// Sitemap: https://VOTRE_DOMAINE/sitemap.xml

window.SEO = SEO;