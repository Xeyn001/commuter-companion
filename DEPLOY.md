# Deploying to Google Cloud

NebulaX requires the submission to be running on Google Cloud. This is
the whole procedure. It takes about ten minutes the first time and
about ninety seconds every time after that.

You do **not** need to install anything on your laptop. All of it runs
in Cloud Shell, in the browser. That matters if you are on a locked-down
school machine.

---

## Before you start

From the hackathon portal you will have:

- a username like `student-02-xxxxx@qwiklabs.net`
- a password
- a project ID like `qwiklabs-gcp-00-xxxxxxxx`
- a default region, `asia-southeast1` (Singapore)

Open the Google Cloud console **in an incognito window** and sign in with
those. Not your personal Google account — an existing session is the
single most common reason the console shows the wrong project.

---

## Step 1 — get the code into Cloud Shell

Click the **Cloud Shell** icon (`>_`) in the top-right of the console. A
terminal opens at the bottom. It already has `gcloud`, `git`, `node` and
`docker`.

If your code is on GitHub:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

If it is not on GitHub yet, use the Cloud Shell editor's **Upload**
(three-dot menu, top right of the file pane) to upload the zip, then:

```bash
unzip commuter-companion.zip
cd commuter-companion
```

Push to GitHub tonight regardless. It is how you move between your
desktop and the school laptop, and it is a required deliverable.

---

## Step 2 — point Cloud Shell at the right project

```bash
gcloud config set project qwiklabs-gcp-00-xxxxxxxx    # your project ID
gcloud config set run/region asia-southeast1
gcloud config list
```

Check the printed project ID matches the portal exactly.

---

## Step 3 — deploy

```bash
bash deploy.sh
```

With a DataMall key, so the live feeds switch on:

```bash
LTA_ACCOUNT_KEY='your-key' bash deploy.sh
```

The first build takes three to five minutes — Cloud Build is creating a
container image. Subsequent deploys are much faster.

When it finishes it prints a URL ending in `.run.app`. **That is what
you submit.** Open it on your actual phone straight away.

---

## Step 4 — check it

```bash
SERVICE_URL=$(gcloud run services describe commuter-companion \
  --region asia-southeast1 --format='value(status.url)')

curl -s "$SERVICE_URL/api/health" | head -c 400
```

You want `"ok":true` and a `capabilities` block. Each capability that
reads `true` is a live data source; `false` means the app is on its
embedded snapshot for that source, which it says in the Sources tab.

---

## Things that go wrong in a Qwiklabs project

These projects are training sandboxes with restrictions a normal GCP
project does not have. In rough order of likelihood:

### `--allow-unauthenticated` is refused

You will see something about `constraints/iam.allowedPolicyMemberDomains`
or "domain restricted sharing". The org policy forbids granting access
to `allUsers`, which is exactly what public access needs.

First try granting it explicitly, which sometimes succeeds when the
deploy-time flag does not:

```bash
gcloud run services add-iam-policy-binding commuter-companion \
  --region asia-southeast1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

If that is refused too, the project genuinely cannot serve public
traffic and **you must raise it with the organisers immediately** — a
judge has to be able to open your URL. Do not spend an hour on it. Ask
on the Telegram channel or at the mentor desk, because it affects every
team in the same position and they will have a standard answer.

Interim fallback so you are never without a working link: deploy the
static half to Firebase Hosting, which has a different permission model.

```bash
npm install -g firebase-tools
firebase login --no-localhost
firebase init hosting     # public directory: .  | single-page app: No
firebase deploy --only hosting
```

The functions will not run there, so the app falls back to its embedded
snapshot. Fine as a safety net, not as your submission.

### "API not enabled" / `PERMISSION_DENIED` on `run.googleapis.com`

`deploy.sh` enables them, but if enabling is itself blocked:

```bash
gcloud services list --available | grep -E 'run|cloudbuild|artifactregistry'
```

If they cannot be enabled, that is an organiser question, not something
you can fix.

### Build fails on `npm install`

The image needs no runtime dependencies (`jsdom` is dev-only), so this
usually means a corrupted `package-lock.json`. Delete it and redeploy:

```bash
rm -f package-lock.json && bash deploy.sh
```

### The service deploys but returns 500

```bash
gcloud run services logs read commuter-companion \
  --region asia-southeast1 --limit 50
```

### Credits or the project disappear

Qwiklabs projects are often time-boxed and torn down after the event.
**Do not leave your only copy of anything in one.** The repository is
the source of truth; the deploy is disposable and takes ninety seconds
to recreate.

---

## Keeping the key out of the repository

`deploy.sh` passes the key as a Cloud Run environment variable, which is
fine for a hackathon. Secret Manager is the better practice and is worth
the extra two minutes if you have them:

```bash
gcloud services enable secretmanager.googleapis.com

printf 'your-datamall-key' | gcloud secrets create lta-account-key --data-file=-

PROJECT_NUMBER=$(gcloud projects describe "$(gcloud config get-value project)" \
  --format='value(projectNumber)')

gcloud secrets add-iam-policy-binding lta-account-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud run deploy commuter-companion \
  --source . --region asia-southeast1 --allow-unauthenticated \
  --set-secrets=LTA_ACCOUNT_KEY=lta-account-key:latest
```

Either way: the key is never in the repository, and `.env` is
gitignored. A credential committed to the repo caps that part of your
score, and the history counts — if one ever lands in a commit, rotate
it rather than just deleting the line.

---

## Cost

Cloud Run bills per request with a generous always-free tier, and
`--min-instances 0` means it scales to zero and costs nothing when idle.
A hackathon's worth of traffic on the provided credits will not come
close to exhausting them. `--max-instances 3` is set as a guard against
a runaway loop rather than because you need the ceiling.

---

## What a judge does

They open the `.run.app` URL on a phone. Nothing else is required of
them — no clone, no install, no key. That is the point of deploying it.

Your README still has to explain how to run it locally, because the
brief says judges follow the README on a clean machine. Both paths need
to work.
