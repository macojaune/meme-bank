# MemeBank pour Raycast

Ouvrez un brouillon de message, lancez Raycast, puis tapez **MemeBank**. La commande affiche d’abord les huit dernières vidéos utilisées sur ce Mac, puis les vidéos publiées du catalogue par date de publication. Chaque ligne affiche le titre et jusqu’à trois tags ou personnes associées. Sans tag ni personne, elle affiche un extrait de la transcription si elle existe. Tapez quelques mots du titre, de la description ou d’une transcription pour chercher une réplique.

| Action | Raccourci |
| --- | --- |
| Coller le fichier vidéo dans l’app active | Entrée |
| Copier le fichier pour le coller avec ⌘V | ⌘C |
| Afficher le fichier dans le Finder pour le glisser ou le joindre | ⌘F |
| Copier le chemin local pour un sélecteur de fichier | ⇧⌘C |

Entrée copie le fichier sur le presse-papiers de macOS, puis demande à Raycast de le coller. Le brouillon reste à envoyer par vos soins. Si l’application ignore le collage, le fichier reste disponible pour ⌘V. Dans un navigateur qui demande une pièce jointe, utilisez le fichier du Finder. La plateforme choisit les formats qu’elle accepte. [Presse-papiers de Raycast](https://developers.raycast.com/api-reference/clipboard)

## Installation locale

Avec Raycast ouvert sur macOS, depuis la racine du dépôt :

```sh
pnpm install --frozen-lockfile
pnpm dev:raycast
```

Depuis votre tableau de bord MemeBank, cliquez sur **Connecter Raycast**, puis copiez le jeton dans le champ **Jeton de lecture MemeBank** de l’extension. Il est valable 30 jours. Chaque jeton est rattaché à un utilisateur de l’instance et peut être révoqué. L’administrateur peut le générer avec `node ace video:read-token issue <user-id> --output /chemin/prive/token` sur le serveur. Raycast enregistre ce secret dans sa préférence de type mot de passe. L’extension le transmet à l’origine configurée avec l’en-tête HTTP Bearer.

La commande apparaît dans Raycast après compilation. Pour lui attribuer un raccourci global, ouvrez **Raycast Settings → Extensions → MemeBank**, puis renseignez le champ **Hotkey** de la commande. L’adresse par défaut est `https://memebank-dev.marvinl.com`. Modifiez **Adresse de MemeBank** dans les préférences pour utiliser une autre instance. [Développer une extension locale](https://developers.raycast.com/basics/getting-started)

## Catalogue et fichiers

MemeBank interroge `GET /api/v1/search` à l’ouverture et à chaque recherche. Les vidéos publiées arrivent par pages de 25 après authentification. La vignette de la ligne sélectionnée se charge en mémoire. L’extension réinterroge aussi le catalogue pour vérifier que les vidéos récentes restent publiées. Raycast conserve localement leurs identifiants pour chaque instance. La copie d’un fichier et son collage alimentent cet historique.

Les fichiers vidéo se téléchargent à la sélection, dans le sous-dossier `com.memebank.raycast/videos` du répertoire temporaire macOS. Le cache accepte les fichiers jusqu’à 64 Mio. Les préférences de MemeBank permettent de choisir la durée depuis la dernière utilisation (1, 7 ou 30 jours) et le plafond (128, 256 ou 512 Mio). Par défaut, un fichier reste disponible pendant 7 jours après son dernier usage. Le nettoyage se fait lors d’une utilisation et retire les fichiers les moins récents lorsque le total dépasse 256 Mio. macOS peut également vider ce répertoire. La recherche nécessite une connexion à l’instance.

Le délai du presse-papiers se règle séparément dans les préférences de MemeBank (2, 5, 15 ou 30 minutes, ou « Jamais »). Par défaut, le fichier ou son chemin est effacé après 5 minutes si le presse-papiers contient toujours cette copie. Les nouvelles copies de MemeBank utilisent l’option privée de Raycast pour éviter leur ajout à son historique du presse-papiers. Les huit vidéos récentes de MemeBank et les fichiers du cache restent disponibles après cet effacement.
