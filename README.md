# VGacha

Suivi de collection de cartes VGacha (collection + panel admin), 100 % côté navigateur : aucun serveur, aucun compte.

## Mettre en ligne sur GitHub Pages

1. Crée un dépôt GitHub et envoie-y **tous les fichiers de ce dossier** (sauf `node_modules`, déjà ignoré).
2. Dans le dépôt : **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
3. Le site est disponible à l'adresse `https://<ton-pseudo>.github.io/<nom-du-depot>/`.

Aucune étape de build n'est nécessaire pour publier : `app.js` et `style.css` sont déjà générés.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page (charge uniquement des fichiers du site, rien d'externe) |
| `vgacha-db.js` | La base : cartes, raretés, séries, cadres. C'est ce fichier que l'admin exporte |
| `app.js`, `style.css` | Code et styles **générés** (ne pas modifier à la main) |
| `src/app.jsx` | Le code source de l'application |
| `build.mjs`, `package.json` | Reconstruction de `app.js` et `style.css` |

## Mettre à jour la base (panel admin)

1. Ouvre le site, onglet **Admin**, fais tes modifications (elles s'affichent tout de suite dans ton navigateur).
2. Onglet **Exporter → Télécharger `vgacha-db.js`**.
3. Remplace `vgacha-db.js` dans le dépôt, puis commit et push. Le site public se met à jour.

Important : n'importe quel visiteur peut ouvrir l'onglet Admin, mais ses modifications restent dans son propre navigateur. Seul le `vgacha-db.js` que tu publies change le site pour tout le monde.

## Progression

Elle est enregistrée dans le navigateur de chaque visiteur (`localStorage`). Menu ☰ : exporter, importer (fusion) ou lier un fichier `vgacha-progression.js`. Ce fichier est ignoré par git (`.gitignore`) : ne le publie pas si tu veux garder ta collection privée.

## Modifier le code

```
npm install
npm run build
```
puis commit `app.js` et `style.css` avec tes changements de `src/app.jsx`.
