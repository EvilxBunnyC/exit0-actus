// Sources d'actualité postées dans 📰・actus. Pour en ajouter une : un id unique,
// un nom affiché, l'adresse du flux RSS/Atom et une couleur.

module.exports = [
  { id: 'cert-alertes', nom: 'CERT-FR · Alerte', url: 'https://www.cert.ssi.gouv.fr/alerte/feed/', couleur: 0xE64553, notifier: true },
  { id: 'cert-actus', nom: 'CERT-FR · Actualité', url: 'https://www.cert.ssi.gouv.fr/actualite/feed/', couleur: 0x1E66F5 },
  { id: 'cybermalveillance', nom: 'Cybermalveillance.gouv.fr', url: 'https://www.cybermalveillance.gouv.fr/feed/atom-flux-actualites', couleur: 0x04A5E5 },
  { id: 'zataz', nom: 'ZATAZ', url: 'https://www.zataz.com/feed/', couleur: 0xFAB387 },
  { id: 'numerama', nom: 'Numerama Cyberguerre', url: 'https://www.numerama.com/cyberguerre/feed/', couleur: 0xF38BA8 },
  { id: 'itconnect', nom: 'IT-Connect', url: 'https://www.it-connect.fr/feed/', couleur: 0x89B4FA },
  { id: 'korben', nom: 'Korben', url: 'https://korben.info/feed', couleur: 0xA6E3A1 },
  { id: 'thehackernews', nom: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', couleur: 0xCBA6F7 },
  { id: 'krebs', nom: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', couleur: 0xF9E2AF },
];
