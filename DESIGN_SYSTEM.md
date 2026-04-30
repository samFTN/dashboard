# Guitarisation™ — Design System

> Guide de référence complet pour reproduire l'identité visuelle, le style et la direction artistique de tous les sites Guitarisation™. Ce fichier est à copier à la racine de chaque nouveau projet.

---

## 1. Identité de la marque

| Élément         | Valeur                                          |
|-----------------|-------------------------------------------------|
| Nom de marque   | Guitarisation™                                  |
| Sous-titre      | L'École de Guitare 2.0                          |
| Fondateur       | Samuel Ferton                                   |
| Portail élèves  | https://guitarschool.guitarisation.fr/login     |
| Langue UI       | Français                                        |

**Règle :** Le symbole ™ s'écrit toujours après "Guitarisation" dans les textes visibles (titres, boutons, footer). Pas dans les noms de fichiers ni les URLs.

**Format du titre de page (`<title>`) :** `Sujet de la page — Guitarisation™`
Exemple : `Métronome — Guitarisation™`. Le sujet (sous-domaine ou fonction de la page) est toujours en premier.

---

## 2. Typographie

**Une seule police : Inter** — importée depuis Google Fonts.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
```

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

### Échelle typographique

| Rôle                     | Taille  | Poids | Lettre-spacing | Notes                             |
|--------------------------|---------|-------|----------------|-----------------------------------|
| Affichage héros (BPM)    | 92px    | 900   | −5px           | `font-variant-numeric: tabular-nums` |
| Titre de section         | 22px    | 900   | −0.5px         |                                   |
| Titre carte              | 13px    | 700   |                |                                   |
| Byline / signature       | 12px    | 500   | 0.2px          | couleur `--muted2`                |
| Labels uppercase         | 10px    | 700   | 2px            | `text-transform: uppercase`       |
| Corps / boutons          | 13–15px | 600–700|               |                                   |
| Légendes, hints          | 11px    | 500   |                | couleur `--muted`                 |

---

## 3. Palette de couleurs

```css
:root {
  --bg:           #f5f5f3;   /* fond page — blanc cassé chaud, jamais blanc pur */
  --card:         #ffffff;   /* fond des cartes */
  --accent:       #d4a017;   /* jaune doré — action principale du produit (cohérent avec brand #fac100) */
  --accent-soft:  #fef9e3;   /* fond doux associé à l'accent */
  --gold:         #e8c23a;   /* or Guitarisation — réservé au CTA école */
  --gold-hover:   #d4af30;   /* or foncé au survol du CTA */
  --dark:         #111111;   /* titres, boutons primaires, texte fort */
  --text:         #1a1a1a;   /* texte courant */
  --muted:        #9ca3af;   /* texte secondaire clair (labels, hints) */
  --muted2:       #6b7280;   /* texte secondaire moyen */
  --border:       #e8e8e4;   /* bordures visibles */
  --border2:      #f0f0ec;   /* séparateurs très légers */
}
```

### Règles d'usage couleur

- **`--accent` jaune doré** → actions du produit (play, tap, toggles actifs, focus des inputs)
- **`--gold` or** → exclusivement le bouton "Aller sur l'école Guitarisation™"
- **`--dark`** → bouton play principal, textes forts, éléments actifs en mode sombre
- Ne jamais mettre de fond blanc pur (#ffffff) sur la `<body>` — toujours `--bg`

---

## 4. Fond de page

```css
body {
  background: var(--bg);
  background-image: radial-gradient(
    ellipse 80% 60% at 50% 0%,
    rgba(255,255,255,0.85) 0%,
    transparent 70%
  );
}
```

Ce dégradé radial crée une source de lumière subtile en haut de page, renforçant la profondeur sans image de fond.

---

## 5. Ombres & effet 3D

Les cartes "lévitent" au-dessus du fond. L'ombre est toujours composée de 3 couches : grande/diffuse + moyenne + petite/nette.

```css
/* Carte principale */
box-shadow:
  0 60px 120px rgba(0,0,0,0.10),
  0 20px 48px  rgba(0,0,0,0.07),
  0 4px  12px  rgba(0,0,0,0.04);
```

**Principe :** plus une carte est au premier plan, plus son ombre est grande et diffuse. Ne jamais utiliser une ombre unique plate.

---

## 6. Rayons de bordure

```css
--r:    22px;   /* carte principale */
--r-sm: 11px;   /* éléments internes (outils, panneaux) */
--r-xs:  8px;   /* boutons, inputs, selects */
```

Cohérence : le rayon diminue avec la taille de l'élément.

---

## 7. En-tête standard (3 colonnes)

Chaque site Guitarisation™ a un en-tête identique en 3 colonnes :
- **Gauche** : "par Samuel Ferton"
- **Centre** : logo `Logo Guitarisation.png`
- **Droite** : bouton or → portail élèves (desktop) / hamburger → menu (mobile)

### HTML

```html
<header class="anim-header">
  <div class="header-byline">par Samuel Ferton</div>

  <div class="header-logo">
    <img src="Logo Guitarisation.png" alt="Guitarisation™ — L'École de Guitare 2.0"
         onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
    <div class="header-logo-text" style="display:none">Guitar<em>isation</em>™</div>
  </div>

  <div class="header-cta" style="position:relative;">
    <a class="btn-school" href="https://guitarschool.guitarisation.fr/login"
       target="_blank" rel="noopener">
      Aller sur l'école Guitarisation™
    </a>
    <button class="hamburger" id="hamburgerBtn" onclick="toggleNav()" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <div class="nav-dropdown" id="navDropdown">
      <a href="https://guitarschool.guitarisation.fr/login" target="_blank" rel="noopener">
        Aller sur l'école Guitarisation™
      </a>
    </div>
  </div>
</header>
```

### CSS en-tête

```css
header {
  width: 100%;
  max-width: 760px;
  padding: 10px 0 18px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  position: relative; z-index: 10; /* crée un contexte d'empilement au-dessus de .anim-card */
}

.header-byline {
  font-size: 12px; font-weight: 500;
  color: var(--muted2); letter-spacing: 0.2px;
  justify-self: start;
}

.header-logo { justify-self: center; }
.header-logo img { height: 42px; width: auto; display: block; }

/* Fallback texte si l'image manque */
.header-logo-text {
  font-size: 22px; font-weight: 900;
  letter-spacing: -0.5px; color: var(--dark); line-height: 1;
}
.header-logo-text em { font-style: normal; color: var(--accent); }

.header-cta { justify-self: end; }
```

---

## 8. Bouton CTA école (or)

```css
.btn-school {
  display: inline-block;
  padding: 10px 18px;
  border-radius: 10px;
  background: #e8c23a;
  color: #fff;
  font-family: inherit; font-size: 13px; font-weight: 700;
  text-decoration: none; border: none; cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(232,194,58,0.35);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s;
}
.btn-school:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(232,194,58,0.45);
  background: #d4af30;
}
.btn-school:active { transform: translateY(0); }
```

---

## 9. Hamburger menu (mobile)

Affiché uniquement en dessous de 640px, remplace le bouton or.

```css
.hamburger {
  display: none; /* caché par défaut, activé via media query */
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px; height: 36px; padding: 6px;
  background: none;
  border: 1.5px solid var(--border);
  border-radius: var(--r-xs);
  cursor: pointer; position: relative;
}
.hamburger span {
  display: block; height: 2px; border-radius: 2px;
  background: var(--dark); transition: background 0.15s;
}
.hamburger:hover span { background: var(--accent); }

.nav-dropdown {
  display: none;
  position: absolute; top: calc(100% + 8px); right: 0;
  background: white;
  border: 1.5px solid var(--border); border-radius: var(--r-sm);
  box-shadow: 0 12px 36px rgba(0,0,0,0.12);
  min-width: 220px; overflow: hidden; z-index: 100;
}
.nav-dropdown.open { display: block; }
.nav-dropdown a {
  display: block; padding: 14px 18px;
  font-size: 13px; font-weight: 600;
  color: var(--text); text-decoration: none;
  transition: background 0.1s;
}
.nav-dropdown a:hover { background: var(--border2); }
.nav-dropdown a::before { content: '→ '; color: #e8c23a; }
```

```js
function toggleNav() {
  document.getElementById('navDropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#hamburgerBtn') && !e.target.closest('#navDropdown')) {
    document.getElementById('navDropdown').classList.remove('open');
  }
});
```

---

## 10. Animations au chargement

Deux animations : fondu simple pour le header, flip-depuis-gauche pour le contenu principal.

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes flipFromLeft {
  from {
    opacity: 0;
    transform: perspective(900px) translateX(-70px) rotateY(-18deg);
  }
  to {
    opacity: 1;
    transform: perspective(900px) translateX(0) rotateY(0deg);
  }
}

/* Classes à appliquer */
.anim-header { animation: fadeIn       0.45s ease                              both; }
.anim-card   { animation: flipFromLeft 0.65s cubic-bezier(0.08, 0.92, 0.18, 1) 0.05s both; }
```

**Règle d'usage :**
- `anim-header` → sur le `<header>`
- `anim-card` → sur le bloc de contenu principal (carte, section hero…)
- Le logo n'est **pas** animé — il apparaît instantanément avec le header
- La courbe `cubic-bezier(0.08, 0.92, 0.18, 1)` donne un départ rapide avec une décélération très douce vers la fin

---

## 11. Responsive (mobile ≤ 640px)

```css
@media (max-width: 640px) {
  /* En-tête : 1 seule ligne, mêmes 3 colonnes qu'en desktop */
  header { padding: 10px 0 14px; grid-template-columns: 1fr auto 1fr; }
  .header-logo img { height: 32px; }
  .header-byline { font-size: 10px; }

  /* Bouton or → hamburger */
  .btn-school { display: none; }
  .hamburger  { display: flex; }
}
```

**Logique :** l'en-tête garde sa structure 3 colonnes sur tous les formats. Le logo est réduit à 32px et la byline à 10px pour tenir sur une seule ligne. Ne jamais passer en layout 2 rangées : ça crée un décalage visuel indésirable.

---

## 12. Inputs, selects, toggles

### Inputs & selects
```css
padding: 6px 10px;
border-radius: var(--r-xs);
border: 1.5px solid var(--border);
background: white; font-family: inherit; font-weight: 700;
outline: none;
transition: border-color 0.15s;
/* Au focus/hover : */
border-color: var(--accent);
```

### Toggle on/off
Pill `46×26px`, thumb `20px`, fond inactif `var(--border)`, fond actif `var(--accent)`.

```css
.toggle-track { border-radius: 13px; background: var(--border); transition: background 0.2s; }
.toggle-track::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 20px; height: 20px; border-radius: 50%;
  background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  transition: transform 0.2s;
}
input:checked + .toggle-track { background: var(--accent); }
input:checked + .toggle-track::after { transform: translateX(20px); }
```

### Hauteur égale entre colonnes d'outils

Quand une section affiche plusieurs blocs côte à côte dans une grille (ex. chronomètre et minuteur), les blocs internes doivent avoir la même hauteur même si leur contenu diffère. Pattern :

```css
.tool-group {
  display: flex;
  flex-direction: column;
  align-self: stretch; /* s'étire sur toute la hauteur de la cellule de grille */
}
.tool-inner {
  flex: 1; /* remplit l'espace restant dans le tool-group */
}
```

---

## 13. Boutons d'action secondaires

```css
/* Bouton discret (ajustement) */
.adj-btn {
  border-radius: var(--r-xs);
  background: var(--border2); border: 1.5px solid var(--border);
  font-weight: 700; font-family: inherit;
  transition: background 0.1s, transform 0.08s;
}
.adj-btn:hover { background: var(--border); transform: translateY(-1px); }

/* Bouton play principal */
.play-btn {
  border-radius: 50%; background: var(--dark); color: white;
  box-shadow: 0 8px 28px rgba(0,0,0,0.18);
  transition: transform 0.12s, box-shadow 0.12s, background 0.15s;
}
.play-btn:hover { transform: scale(1.06); box-shadow: 0 14px 36px rgba(0,0,0,0.22); }
.play-btn.playing { background: var(--accent); box-shadow: 0 8px 28px rgba(212,160,23,0.35); }
```

---

## 14. Footer copyright

À ajouter après le contenu principal, avant le `<script>` :

```html
<footer style="
  width: 100%; max-width: 760px;
  margin-top: 20px; padding: 12px 0 6px;
  text-align: center;
  font-size: 11px; font-weight: 500; color: var(--muted);
  border-top: 1px solid var(--border2);
">
  © 2026 Guitarisation™ — L'École de Guitare 2.0 · par Samuel Ferton
</footer>
```

---

## 15. Bouton d'aide flottant (?)

À ajouter uniquement sur les sites dont l'utilisation n'est pas évidente (outils interactifs, interfaces complexes). Ne pas ajouter sur les pages simples de type tableau de bord ou liste.

**Comportement :**
- Bouton `?` fixe, coin inférieur droit de l'écran, toujours visible au scroll
- Un clic ouvre/ferme le panneau d'aide (toggle) — **pas de survol**
- Un clic en dehors du panneau le ferme
- Le contenu est propre à chaque site (instructions d'utilisation spécifiques)

### HTML

À placer juste avant `</body>` :

```html
<button class="help-btn" id="helpBtn" onclick="toggleHelp()" aria-label="Aide">?</button>

<div class="help-panel" id="helpPanel">
  <div class="help-header">
    <span class="help-title">Comment utiliser ce site</span>
    <button class="help-close" onclick="toggleHelp()" aria-label="Fermer">✕</button>
  </div>
  <div class="help-body">
    <!-- Contenu spécifique au site -->
    <p><strong>Titre de la section</strong></p>
    <p>Explication ici.</p>
  </div>
</div>
```

### CSS

```css
/* Bouton flottant ? */
.help-btn {
  position: fixed;
  bottom: 24px; right: 24px;
  width: 44px; height: 44px;
  border-radius: 50%;
  background: var(--dark);
  color: white;
  font-size: 20px; font-weight: 700; font-family: inherit;
  border: none; cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.22);
  transition: background 0.15s, transform 0.12s;
  z-index: 200;
  line-height: 1;
}
.help-btn:hover { background: var(--accent); transform: scale(1.08); }
.help-btn.open  { background: var(--accent); }

/* Panneau d'aide */
.help-panel {
  display: none;
  position: fixed;
  bottom: 78px; right: 24px;
  width: 300px;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: var(--r);
  box-shadow: 0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08);
  z-index: 199;
  overflow: hidden;
}
.help-panel.open { display: block; }

.help-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border2);
}
.help-title {
  font-size: 13px; font-weight: 700; color: var(--dark);
}
.help-close {
  background: none; border: none; cursor: pointer;
  font-size: 14px; color: var(--muted2);
  line-height: 1; padding: 2px 4px; border-radius: 4px;
  transition: color 0.1s, background 0.1s;
}
.help-close:hover { color: var(--dark); background: var(--border2); }

.help-body {
  padding: 14px 16px 16px;
  font-size: 13px; line-height: 1.6; color: var(--text);
  max-height: 320px; overflow-y: auto;
}
.help-body p { margin-bottom: 10px; }
.help-body p:last-child { margin-bottom: 0; }
.help-body strong { color: var(--dark); font-weight: 700; }

@media (max-width: 640px) {
  .help-panel { width: calc(100vw - 32px); right: 16px; bottom: 72px; }
  .help-btn   { bottom: 16px; right: 16px; }
}
```

### JS

```js
function toggleHelp() {
  const btn   = document.getElementById('helpBtn');
  const panel = document.getElementById('helpPanel');
  const isOpen = panel.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
}
document.addEventListener('click', e => {
  if (!e.target.closest('#helpBtn') && !e.target.closest('#helpPanel')) {
    document.getElementById('helpPanel').classList.remove('open');
    document.getElementById('helpBtn').classList.remove('open');
  }
});
```

---

## 16. Checklist de démarrage d'un nouveau site

- [ ] Copier les variables CSS (section 3) dans `:root`
- [ ] Importer Inter (section 2)
- [ ] Copier le fond de page avec dégradé radial (section 4)
- [ ] Copier l'en-tête 3 colonnes complet + JS hamburger (sections 7, 9)
- [ ] Copier les animations (section 10), appliquer `.anim-header` et `.anim-card`
- [ ] Copier le media query responsive 640px (section 11)
- [ ] Ajouter le footer copyright (section 14)
- [ ] Placer `Logo Guitarisation.png` à la racine du projet
- [ ] Vérifier que ™ est présent après chaque occurrence textuelle de "Guitarisation"
- [ ] Si site interactif complexe : ajouter le bouton d'aide flottant (section 15)
