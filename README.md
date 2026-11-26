# VGacha (version sans panel admin)

Suivi de collection de cartes VGacha, 100 % côté navigateur : aucun serveur, aucun compte.

## Mettre en ligne sur GitHub Pages

1. Crée un dépôt GitHub et envoie-y tous les fichiers de ce dossier (sauf `node_modules`, déjà ignoré).
2. **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
3. Le site est disponible à `https://<ton-pseudo>.github.io/<nom-du-depot>/`.

Aucun build n'est nécessaire pour publier. Indispensables : `index.html`, `vendor.js`, `app.js`, `style.css`, `vgacha-db.js`.

## Fonctions

- Filtres rareté / série, recherche, tri (alphabétique, nombre de cartes, complétion %), boutons Possédé / Non possédé.
- Vue Pokecardex d'une carte : clic sur un numéro, ou saisie de plages (`1-20, 35, 40-50`) avec Cocher / Décocher.
- **Annuler** (bouton ou Ctrl+Z) : revient sur les 50 dernières actions.
- **Copier les manquantes** : liste de ce qu'il te manque, pour les cartes affichées (selon les filtres) ou pour une seule carte depuis sa popup.
- Menu ☰ : exporter / importer (fusion) / lier un fichier `vgacha-progression.js` (ignoré par git).

## Modifier la base de cartes

Pas d'admin dans cette version : édite `vgacha-db.js` à la main (une ligne par personne dans `cards`, avec ses `rarities`, `series` et `sections`), puis commit et push. L'en-tête du fichier explique la structure.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page (aucune ressource externe) |
| `vgacha-db.js` | La base : cartes, raretés, séries, cadres |
| `app.js` | Code de l'application, lisible (généré depuis `src/app.jsx`) |
| `vendor.js` | React, minifié |
| `style.css` | Styles Tailwind générés |
| `src/app.jsx`, `build.mjs`, `package.json` | Source et reconstruction (`npm install` puis `npm run build`) |
