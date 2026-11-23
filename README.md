# NEXUS AI — GitHub Pages + Multi-API

## Architecture
- `index.html`, `app.js`, `style.css` : site statique GitHub Pages.
- `worker/index.js` : proxy API Cloudflare Workers, avec authentification Firebase.
- Cloudflare KV `PROVIDERS` : stockage des fournisseurs **par UID Firebase**.
- Les clés API sont chiffrées avec AES-GCM avant stockage dans KV. Le secret de chiffrement reste dans Cloudflare.
- Les conversations sont stockées localement dans le navigateur, pas synchronisées.

## 1. Déployer le site GitHub Pages
Uploader `index.html`, `404.html`, `app.js`, `style.css`, `icon.svg` à la racine du dépôt.
GitHub → Settings → Pages → Deploy from a branch → main → / (root).
Dans Firebase Authentication → Settings → Authorized domains, ajouter `VOTRE-PSEUDO.github.io`.

## 2. Créer le Worker Cloudflare
1. Créer un compte Cloudflare, installer Node.js localement.
2. Dans un terminal, depuis le dossier `worker` :
   ```
   npm install -g wrangler
   wrangler login
   wrangler kv namespace create PROVIDERS
   ```
3. Copier `wrangler.toml.example` vers `wrangler.toml`.
4. Remplacer `REMPLACER_PAR_ID_KV` par l'ID affiché par Wrangler.
5. Remplacer `https://VOTRE-PSEUDO.github.io` par l'origine exacte de votre site (sans chemin de dépôt).
   Pour plusieurs origines, les séparer par des virgules.
6. Générer un secret AES de 32 octets encodé en base64 :
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
7. Définir le secret **sans l'écrire dans un fichier versionné** :
   ```
   wrangler secret put ENCRYPTION_KEY
   ```
   Coller la valeur générée quand Wrangler la demande.
8. Déployer :
   ```
   wrangler deploy
   ```
9. Copier l'URL `https://...workers.dev` obtenue.

**Ne jamais publier** `wrangler.toml` avec des données privées, une clé d'API, ou `ENCRYPTION_KEY`. Ne pas changer ENCRYPTION_KEY après avoir enregistré des API, sinon les anciennes clés seront illisibles.

## 3. Configurer NEXUS AI
1. Se connecter au site avec Firebase.
2. Paramètres → URL du Worker → coller l'URL `workers.dev` → Enregistrer.
3. Ajouter un fournisseur :
   - Nom : `Numes.ai`
   - URL : `https://api.numes.ai/api/v1`
   - Clé : clé d'inférence Numes (pas clé de gestion).
4. Les modèles sont récupérés via `GET /models` (Numes filtre sur `output_modalities=text`).
5. Choisir un modèle. Il est possible de changer de modèle à chaque message, y compris pour une même API.
6. Ajouter d'autres fournisseurs compatibles OpenAI (par exemple OpenRouter) avec leurs propres clés.

## Notes
- Un fournisseur doit proposer `GET /models` pour la découverte automatique. Sinon, entrer manuellement son ID de modèle.
- Un fournisseur doit prendre en charge `POST /chat/completions` avec `model` et `messages`.
- Les fournisseurs aux API non compatibles OpenAI, ou exigeant des en-têtes spécifiques, ne sont pas pris en charge.
- Le Worker n'active pas de streaming; les réponses arrivent en une fois.
- Numes accepte **un seul modèle par requête**. Vous pouvez néanmoins sélectionner successivement différents modèles avec la même clé.
- Les appels sont soumis aux quotas et tarifs du fournisseur et de Cloudflare.
- Le Worker vérifie la signature des jetons Firebase via les clés publiques Google et contrôle l'origine du site. Il ne dispense pas de mettre des quotas et limites de dépenses sur les comptes fournisseurs.
- Le Worker est requis : GitHub Pages seul ne peut pas contourner les restrictions CORS de Numes.
- Ne téléversez pas le dossier `worker` sur GitHub Pages en pensant qu'il s'exécutera : il doit être déployé séparément sur Cloudflare.
