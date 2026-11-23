# NEXUS AI — édition GitHub Pages

Version **statique**, adaptée depuis le projet `develop-nexus-ai-platform.zip`.

## Mise en ligne (sans commande)

1. Créez un dépôt GitHub public, par exemple `nexus-ai`.
2. À la racine du dépôt, importez **les fichiers contenus dans ce ZIP**, pas le ZIP lui-même (notamment `index.html`, `app.js`, `style.css`).
3. Dans GitHub : **Settings → Pages → Build and deployment → Deploy from a branch**.
4. Choisissez `main` et `/ (root)`, puis **Save**.
5. Votre site sera accessible à `https://VOTRE-PSEUDO.github.io/nexus-ai/` après la publication.
6. Dans **Firebase Console → Authentication → Settings → Authorized domains**, ajoutez `VOTRE-PSEUDO.github.io` (sans `https://`, sans `/nexus-ai`). Vérifiez que l'authentification **E-mail/Mot de passe** est activée.
7. Ouvrez le site, connectez-vous, puis allez à **Paramètres et API** pour indiquer une URL de base compatible OpenAI, le nom du modèle et votre clé personnelle. Le fournisseur doit explicitement autoriser **CORS** depuis votre domaine GitHub Pages.

## Fonctionnalités

- Inscription, connexion, réinitialisation du mot de passe via le projet Firebase existant.
- Chat IA avec une API compatible OpenAI autorisant les requêtes depuis un navigateur.
- Historique local, plusieurs comptes (historique local séparé par UID), export JSON et suppression.
- Interface responsive sombre.

## Différences avec le projet original

GitHub Pages n'exécute **aucun code serveur**. Les fonctionnalités suivantes ne sont donc **pas reprises** : PostgreSQL, API Next.js, quotas administrateur, administration globale, synchronisation des conversations entre appareils, documents, projets, recherche web serveur, flux SSE et appels IA derrière un proxy secret. Les conversations sont enregistrées uniquement dans `localStorage` sur l'appareil courant et **ne sont pas chiffrées**. Les préférences non sensibles sont aussi locales. La clé API n'est conservée que dans `sessionStorage` (elle peut cependant être accessible à du JavaScript du même site : ne la considérez pas comme secrète). Évitez les clés coûteuses ou privilégiées ; préférez un backend proxy sécurisé pour un service public.

Le fichier `.env.example` du projet original, ses routes Next.js et ses secrets serveur **ne doivent pas être déployés** ici.

## Vérification

Le site doit afficher la connexion Firebase, puis la page de chat. Tester un appel IA réel demande un compte Firebase et une API externe valide avec CORS ; aucun appel réel n'est garanti uniquement par le déploiement statique.
