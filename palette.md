# Palette de couleurs - Meme Bank (Néobrutalisme)

## 🎨 Palette principale

### Primary (Or/Chaleur)
- **500**: `#f59e0b` - Couleur principale - or
- **Usage**: Boutons principaux, liens, accents
- **Énergie**: Chaleur, créativité, mèmes

### Secondary (Rouge Vif)
- **500**: `#ef4444` - Rouge attention
- **Usage**: Actions dangereuses, erreurs, suppression
- **Énergie**: Urgence, attention, énergie

### Accent (Bleu Tech)
- **500**: `#3b82f6` - Bleu confiance
- **Usage**: Liens, info, tech, données
- **Énergie**: Confiance, professionnalisme, données

### Brick (Rose Fun)
- **500**: `#ec4899` - Rose néon
- **Usage**: Boutons fun, mèmes, social
- **Énergie**: Fun, social, communauté

### Lime (Vert Croissance)
- **500**: `#84cc16` - Vert néon
- **Usage**: Succès, validation, croissance
- **Énergie**: Positif, confirmation, growth

## 📊 Fond et surfaces

| Nom | Couleur | Usage |
|-----|---------|-------|
| **bg** | `#fafafa` | Fond principal clair |
| **bg-dark** | `#18181b` | Fond sombre (dark mode) |
| **surface** | `#ffffff` | Cartes, inputs |
| **surface-2** | `#f4f4f5` | Cartes secondaires |
| **surface-3** | `#e4e4e7` | Fond tiers |
| **border** | `#27272a` | Borders épais (néobrutaliste) |
| **border-soft** | `#a1a1aa` | Borders subtiles |
| **text** | `#18181b` | Texte principal |
| **text-muted** | `#71717a` | Texte secondaire |
| **text-invert** | `#fafafa` | Texte sur fond sombre |

## 🎯 Palette Tailwind Config

```typescript
colors: {
  primary: {
    500: '#f59e0b',  // Or
    600: '#d97706',
    700: '#b45309',
  },
  secondary: {
    500: '#ef4444',  // Rouge
    600: '#dc2626',
    700: '#b91c1c',
  },
  accent: {
    500: '#3b82f6',  // Bleu
    600: '#2563eb',
    700: '#1d4ed8',
  },
  brick: {
    500: '#ec4899',  // Rose
    600: '#db2777',
    700: '#be185d',
  },
  lime: {
    500: '#84cc16',  // Vert
    600: '#65a30d',
    700: '#4d7c0f',
  },
}
```

## 📋 Usage par composant

### Boutons
- **Primary**: Upload, recherche, actions principales
- **Secondary**: Suppression, erreurs
- **Accent**: Lien vers stats, données
- **Brick**: Social, partage, fun
- **Lime**: Validation, succès

### Badges
- **Published**: Lime
- **Pending**: Primary
- **Rejected**: Secondary
- **Social**: Brick

### Cartes (Videos)
- Fond: `surface` ou `surface-2`
- Border: `border` (épais)
- Shadow: `shadow-neo` (4px 4px 0px rgba(0,0,0,1))

### Upload Zone
- Border dashed: `border-border`
- Fond: `surface-2`
- Hover: `primary-50`

## 🎨 Style Néobrutalisme

### Caractéristiques
- **Borders épais**: `border-2` (2px minimum)
- **Shadows dures**: `4px 4px 0px 0px rgba(0,0,0,1)`
- **Radius minimal**: `4px` (néo)
- **Pas de gradients**: Couleurs plates
- **Contraste élevé**: Couleurs vives sur fond clair

### Composants prêts
- `.btn-neo` - Boutons de base
- `.btn-neo-primary` - Bouton principal
- `.card-neo` - Cartes
- `.input-neo` - Inputs
- `.badge-neo` - Badges
- `.avatar-neo` - Avatars
- `.progress-neo` - Progress bars

## 📱 Dark Mode

Pour le dark mode, inverser:
- Fond: `bg-dark` (`#18181b`)
- Surface: `surface-3` (`#e4e4e7`)
- Texte: `text-invert` (`#fafafa`)
- Borders: `border` (`#27272a`)

## 🎯 Prochaines étapes

1. Installer Tailwind CSS
2. Configurer `tailwind.config.ts`
3. Importer `resources/css/neobrutalism.css`
4. Utiliser les composants React/Inertia
5. Tester sur différents écrans

## 📁 Fichiers créés

- `tailwind.config.ts` - Configuration Tailwind
- `resources/css/neobrutalism.css` - Styles CSS complets
- `resources/js/components/ui/neo-button.tsx` - Composant bouton React
- `palette.md` - Ce fichier de documentation

## 🎨 Inspiration

Inspiré par:
- **Shadcn/ui** - Structure composants
- **Neobrutalism.dev** - Style néobrutaliste
- **Vercel** - Minimalisme tech
- **Stripe** - Design systèmes

---

**Note**: Cette palette est optimisée pour le projet meme-bank avec son focus sur:
- La recherche sémantique (accent/bleu)
- Les mèmes fun (brick/rose)
- La croissance (lime/vert)
- L'upload (primary/or)
- Les erreurs (secondary/rouge)<tool_call>
<function=TodoWrite>
<parameter=todos>[{"content": "Générer palette de couleurs néobrutaliste pour meme-bank", "status": "completed", "activeForm": "Générant palette de couleurs néobrutaliste"}, {"content": "Exporter pour Tailwind config", "status": "completed", "activeForm": "Exportant pour Tailwind config"}]