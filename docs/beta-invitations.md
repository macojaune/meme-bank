# Accès bêta sur invitation

La préinscription publique et le questionnaire sont une candidature. Ils ne créent ni compte ni invitation. L’admission est décidée progressivement par l’opérateur. Les comptes existants et leur connexion restent inchangés.

## Émettre, réémettre, révoquer

Appliquer la migration additive `1792900000000_create_beta_invitations_table` sur la cible vérifiée avant d’utiliser ce flux. Elle ajoute uniquement `beta_invitations`, sans modifier les comptes. Le rollback supprime les invitations de cette table : ne pas le lancer sur des invitations à conserver.

La commande Ace utilise la base configurée pour **le processus courant**. Vérifier l’application, la base et l’origine choisies avant toute émission réelle. La commande n’envoie aucun message et ne contacte pas Brevo ou Tally.

```sh
node ace beta:invite issue personne@example.invalid --origin https://app.example.invalid --output /chemin/prive/invitation.txt
node ace beta:invite reissue personne@example.invalid --origin https://app.example.invalid --output /chemin/prive/nouvelle-invitation.txt --days 7
node ace beta:invite revoke personne@example.invalid
```

Ces adresses et domaines sont des exemples, pas des destinations de livraison. `--output` doit désigner un **nouveau fichier absolu** : création exclusive, permissions `0600`, aucun écrasement, aucun lien dans stdout ou les logs. Choisir un répertoire privé, transmettre le lien uniquement à son destinataire par une opération distincte autorisée, puis retirer le fichier lorsqu’il n’est plus utile. Ne pas le publier dans un ticket, une PR, une capture ou un outil d’analytics. Aucun envoi automatique n’est associé à la commande.

L’email est normalisé (`trim` puis minuscules). Un compte existant pour cette adresse empêche l’émission et la consommation ; il n’est pas modifié. `issue` exige une nouvelle adresse ; `reissue` remplace le jeton d’une invitation existante sans compte et invalide immédiatement l’ancien. `revoke` est idempotent. La validité est de **7 jours par défaut**, configurable par `--days` entier strictement positif. Réémettre après expiration ou révocation crée une nouvelle période de validité.

## Transport et consommation

Le jeton contient 32 octets aléatoires, encodés en hexadécimal. Seul son SHA-256 est stocké en base. Le lien est `/register#invitation=…` : le fragment n’est pas transmis au serveur dans l’URL. Le navigateur le retire de son URL, puis échange le jeton via `POST /register/invitation`, sous CSRF. La session anonyme chiffrée et HTTP-only ne contient que le hash ; aucune session authentifiée n’est ouverte à cette étape. L’analytics existant exclut déjà les fragments et les paramètres d’URL.

Shield vérifie le CSRF sur l’échange et l’inscription. Un refus retourne JSON 403 ; pour POST `/register` via Inertia, il redirige vers `/register` avec uniquement un message général. Aucun corps de requête n’est flashé : ni jeton brut, ni mot de passe, ni confirmation. La vérification CSRF et le traitement des autres routes restent inchangés. Sans invitation valide, GET et POST `/register` refusent l’inscription et renvoient vers la préinscription. Un cookie de session anonyme pour le CSRF ne vaut pas connexion.

La politique `no-referrer` est conservée. Une validation de formulaire invalide redirige explicitement Inertia vers `/register` avec seulement les messages Vine, afin que le formulaire garde ses champs en mémoire et permette une nouvelle tentative. Le chemin JSON conserve sa réponse 422. Les saisies ne sont pas recopiées dans le flash de session.

Le formulaire Inertia existant reçoit l’email lié à l’invitation en lecture seule. Le serveur revérifie cet email, l’expiration, la révocation et la consommation sous verrou PostgreSQL. Création du compte et consommation sont dans la même transaction ; la connexion Adonis intervient seulement après le commit. Un échec de transaction ne laisse aucun compte. Deux consommations concurrentes donnent un seul compte ; le rejeu est refusé. Un token brut fourni directement à POST `/register` n’évite pas l’échange ni le CSRF.

## Tests locaux isolés

`tests/functional/beta_invitations.spec.ts` est opt-in (`MAR369_INVITATION_TESTS=1`). Il exige PostgreSQL sur `127.0.0.1:46380` (ou `46384` pour un cluster natif jetable), base `mar369_invitations_fixture`, utilisateur `mar369_fixture`, HTTP sur `127.0.0.1:46379`, et `NODE_ENV=test`. Il refuse une base contenant déjà la table `users`.

Créer un PostgreSQL jetable identifié, avec stockage tmpfs et `--rm`, à partir d’une image déjà disponible ; ou un cluster natif neuf dans un dossier privé, limité à la boucle locale, avec PID, dossier et port consignés pour son nettoyage. Ne pas utiliser la base de développement habituelle. Fournir une clé d’application locale, `SESSION_DRIVER=cookie`, les variables DB ci-dessus et une fausse clé Brevo avec des IDs explicitement définis pour le test de candidature simulée. Aucun `.env` réel ne doit être copié. Les tests bloquent `fetch` externe et remplacent le fournisseur uniquement pour le cas de candidature ; les requêtes HTTP visent exclusivement la boucle locale.

```sh
node ace test functional --files='tests/functional/beta_invitations.spec.ts'
```

La suite applique les trois migrations existantes nécessaires à `User`, puis la migration d’invitations. Elle vérifie le rejeu/rollback de cette migration, la préservation d’un compte synthétique, la consommation unique avec deux transactions réellement en attente de verrou, le rollback après insertion du compte, les refus et sessions HTTP, CSRF, le login existant, la séparation candidature/admission et les fichiers privés de la commande. Elle ne prétend pas valider la chaîne complète des migrations vidéo/pgvector. Après les tests, nettoyer uniquement le conteneur tmpfs, les clés, liens et processus créés pour cette fixture.

La recette navigateur est distincte : invitation valide jusqu’au formulaire et à la connexion, invalidité/rejeu, erreurs de validation et conservation des champs. Neutraliser l’analytics uniquement dans le montage QA, sans changer la configuration de l’application.
