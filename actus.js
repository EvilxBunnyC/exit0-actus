// Lit les flux de sources.js et poste les nouveaux articles dans Discord via
// un webhook. Les articles déjà postés sont retenus dans etat.json.
//
//   DISCORD_WEBHOOK=… node actus.js   poste les nouveautés
//   node actus.js --essai              affiche ce qui serait posté, sans rien envoyer ni enregistrer
//
// Variables : DISCORD_WEBHOOK (secret), ROLE_NOTIFICATION (rôle notifié pour
// les sources marquées « notifier »).

const fs = require('node:fs');
const path = require('node:path');
const Parser = require('rss-parser');
const SOURCES = require('./sources');

const ESSAI = process.argv.includes('--essai');
const FICHIER_ETAT = path.join(__dirname, 'etat.json');
const WEBHOOK = process.env.DISCORD_WEBHOOK;
const ROLE_NOTIFICATION = process.env.ROLE_NOTIFICATION;

const MEMOIRE_PAR_SOURCE = 300;
// Certains flux (CERT-FR) remontent d'anciens articles mis à jour : on les ignore.
const AGE_MAX_JOURS = 7;
const MAX_CADRES = 10;
const MAX_RESUME = 300;

const parser = new Parser({
  timeout: 20000,
  headers: { 'User-Agent': 'Exit0-Actus/1.0 (+https://github.com/EvilxBunnyC/exit0-actus)' },
});

function lireEtat() {
  try { return JSON.parse(fs.readFileSync(FICHIER_ETAT, 'utf8')); } catch { return {}; }
}

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', rsquo: '’', lsquo: '‘', hellip: '…', laquo: '«', raquo: '»' };

function texteBrut(html = '') {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(\w+);/g, (m, nom) => ENTITES[nom] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function couper(texte, max) {
  return texte.length > max ? `${texte.slice(0, max - 1).trimEnd()}…` : texte;
}

const idArticle = item => item.guid || item.id || item.link;

function dateArticle(item) {
  const date = new Date(item.isoDate ?? item.pubDate ?? NaN);
  return Number.isNaN(date.getTime()) ? null : date;
}

function enCadre(source, item) {
  const date = dateArticle(item);
  return {
    title: couper(texteBrut(item.title) || 'Sans titre', 256),
    url: item.link,
    description: couper(texteBrut(item.contentSnippet ?? item.summary ?? item.content), MAX_RESUME) || undefined,
    color: source.couleur,
    footer: { text: source.nom },
    timestamp: date?.toISOString(),
  };
}

async function envoyer(corps) {
  for (let essai = 0; essai < 5; essai++) {
    const reponse = await fetch(`${WEBHOOK}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    if (reponse.status === 429) {
      const { retry_after: attente = 2 } = await reponse.json().catch(() => ({}));
      await new Promise(r => setTimeout(r, attente * 1000 + 250));
      continue;
    }
    if (!reponse.ok) throw new Error(`Discord a répondu ${reponse.status} : ${await reponse.text()}`);
    return;
  }
  throw new Error('Trop de tentatives (limite de débit Discord)');
}

// Les articles qui notifient partent seuls, avec la mention du rôle ; les autres par paquets de 10.
async function poster(articles) {
  const normaux = [];
  for (const a of articles) {
    if (a.source.notifier && ROLE_NOTIFICATION) {
      await envoyer({
        content: `<@&${ROLE_NOTIFICATION}> 🚨 Nouvelle alerte du CERT-FR`,
        embeds: [a.cadre],
        allowed_mentions: { roles: [ROLE_NOTIFICATION] },
      });
    } else {
      normaux.push(a.cadre);
    }
  }
  for (let i = 0; i < normaux.length; i += MAX_CADRES) {
    await envoyer({ embeds: normaux.slice(i, i + MAX_CADRES), allowed_mentions: { parse: [] } });
  }
}

async function main() {
  if (!ESSAI && !WEBHOOK) throw new Error('Variable DISCORD_WEBHOOK manquante.');
  const etat = lireEtat();
  let erreurs = 0;

  for (const source of SOURCES) {
    let flux;
    try {
      flux = await parser.parseURL(source.url);
    } catch (e) {
      console.error(`✗ ${source.nom} : ${e.message}`);
      erreurs++;
      continue;
    }

    // Du plus récent au plus ancien : tous les flux ne sont pas triés.
    const items = flux.items.filter(idArticle)
      .sort((a, b) => (dateArticle(b)?.getTime() ?? 0) - (dateArticle(a)?.getTime() ?? 0));
    const dejaVus = etat[source.id];
    const limite = Date.now() - AGE_MAX_JOURS * 24 * 3600 * 1000;
    const recent = item => (dateArticle(item)?.getTime() ?? Date.now()) >= limite;
    // Première fois : seulement le dernier article, le reste est marqué comme vu.
    const nouveaux = dejaVus ? items.filter(i => !dejaVus.includes(idArticle(i)) && recent(i)) : items.slice(0, 1);
    // Du plus ancien au plus récent, pour un fil chronologique.
    const articles = nouveaux.reverse().map(item => ({ source, cadre: enCadre(source, item) }));

    console.log(`${articles.length ? '+' : '·'} ${source.nom} : ${articles.length} nouveau(x) sur ${items.length}`);
    if (ESSAI) {
      for (const a of articles) console.log(`    « ${a.cadre.title} »`);
      continue;
    }

    // L'état n'est enregistré qu'après l'envoi : en cas d'échec, on réessaiera au prochain passage.
    await poster(articles);
    const ids = [...new Set([...items.map(idArticle), ...(dejaVus ?? [])])];
    etat[source.id] = ids.slice(0, MEMOIRE_PAR_SOURCE);
    fs.writeFileSync(FICHIER_ETAT, `${JSON.stringify(etat, null, 2)}\n`);
  }

  if (erreurs === SOURCES.length) throw new Error('Aucune source n\'a pu être lue.');
}

main().catch(e => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
