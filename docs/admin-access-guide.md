# Palmetto Presents — Admin Access Guide

## Admin Login

**Your admin passphrase grants access to ALL EPC portals, ALL reports, and ALL competitive intelligence pages.**

### Retrieving Your Admin Passphrase

Your admin passphrase is stored securely in macOS Keychain. To retrieve it:

```bash
security find-generic-password -a "$USER" -s "palmetto-presents-admin-passphrase" -w
```

### How to Sign In

1. Go to [palmetto-presents.vercel.app](https://palmetto-presents.vercel.app)
2. Click any EPC tile or navigate to any protected page
3. Enter your admin passphrase on the login page
4. You'll be redirected to the page you were trying to access

### What Admin Access Gives You

- Full access to **all 24 EPC partner portals** and their reports
- Full access to **all 11 competitive intelligence reports** (`/intel/*`)
- 7-day session (re-authenticate after expiry)
- "Sign Out" link appears in the nav bar on every page

---

## Managing EPC Passphrases

### Retrieving Any EPC Passphrase

Every EPC passphrase is stored in macOS Keychain. To retrieve one:

```bash
# Format: palmetto-presents-{slug}-passphrase
security find-generic-password -a "$USER" -s "palmetto-presents-spartanx-passphrase" -w
security find-generic-password -a "$USER" -s "palmetto-presents-fastrac-passphrase" -w
```

### Full List of EPC Slugs

```
earthlight        empower-energy    emt-solar         equity
fastrac           freedom-solar     ion-solar         ion-solar-pros
kin-home          ny-state-solar    nys-solar         our-world-energy
owe               power-energy      powur             spartanx
spectrum-solar    standard-energy   sunpower          sunsolar-solutions
team-sunshine     trinity-solar     unicity           volt-solar
```

### Listing All Stored Passphrases

```bash
for slug in earthlight empower-energy emt-solar equity fastrac freedom-solar ion-solar ion-solar-pros kin-home ny-state-solar nys-solar our-world-energy owe power-energy powur spartanx spectrum-solar standard-energy sunpower sunsolar-solutions team-sunshine trinity-solar unicity volt-solar; do
  pass=$(security find-generic-password -a "$USER" -s "palmetto-presents-${slug}-passphrase" -w 2>/dev/null)
  echo "${slug}: ${pass}"
done
```

---

## Rotating a Passphrase

If an EPC needs a new passphrase (e.g., staff turnover, security concern):

### Step 1: Generate a New Passphrase

```bash
# Example: new passphrase for SpartanX
NEW_PASS="PLR-SpartanX-$(printf '%04d' $((RANDOM % 10000)))"
echo "New passphrase: $NEW_PASS"
```

### Step 2: Store It in Keychain

```bash
security add-generic-password -U -a "$USER" -s "palmetto-presents-spartanx-passphrase" -w "$NEW_PASS"
```

### Step 3: Hash It

```bash
echo -n "$NEW_PASS" | shasum -a 256 | cut -d' ' -f1
```

### Step 4: Update the Vercel Environment Variable

1. Go to [Vercel Dashboard](https://vercel.com) → palmetto-presents → Settings → Environment Variables
2. Edit `PP_EPC_PASSPHRASES`
3. Replace the hash value for the specific slug in the JSON
4. Save and redeploy

### Step 5: Send the New Passphrase to the EPC

Send the new plaintext passphrase to the EPC's Relationship Manager for distribution. The old passphrase stops working immediately after redeploy.

---

## Rotating the Admin Passphrase

```bash
# Generate new admin passphrase
NEW_ADMIN="PLR-Admin-$(printf '%04d' $((RANDOM % 10000)))"
echo "New admin passphrase: $NEW_ADMIN"

# Store in Keychain
security add-generic-password -U -a "$USER" -s "palmetto-presents-admin-passphrase" -w "$NEW_ADMIN"

# Get the hash
echo -n "$NEW_ADMIN" | shasum -a 256 | cut -d' ' -f1
```

Then update `PP_ADMIN_HASH` in Vercel Dashboard with the new hash and redeploy.

---

## Rotating the Session Secret

Changing the session secret **invalidates ALL active sessions** (admin + all EPCs). Everyone must re-authenticate.

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -hex 32)
echo "$NEW_SECRET"

# Store in Keychain
security add-generic-password -U -a "$USER" -s "palmetto-presents-session-secret" -w "$NEW_SECRET"
```

Then update `PP_SESSION_SECRET` in Vercel Dashboard and redeploy.

---

## Vercel Environment Variables Reference

| Variable | Purpose | Where to Set |
|----------|---------|--------------|
| `PP_SESSION_SECRET` | HMAC signing key for session cookies | Vercel Dashboard → Settings → Env Vars |
| `PP_ADMIN_HASH` | SHA-256 hash of admin passphrase | Vercel Dashboard → Settings → Env Vars |
| `PP_EPC_PASSPHRASES` | JSON map of `{slug: sha256hash}` for all EPCs | Vercel Dashboard → Settings → Env Vars |

### Retrieving Current Values from Keychain

```bash
# Session secret
security find-generic-password -a "$USER" -s "palmetto-presents-session-secret" -w

# Admin passphrase (plaintext — hash it before putting in Vercel)
security find-generic-password -a "$USER" -s "palmetto-presents-admin-passphrase" -w
```

---

## Access Control Summary

| Route | Admin | EPC User | Unauthenticated |
|-------|-------|----------|-----------------|
| `/` (homepage) | Full view + Sign Out | Own tile only + Sign Out | Full view (public) |
| `/solar-3-0.html` | Public | Public | Public |
| `/channel-program.html` | Public | Public | Public |
| `/epc/{slug}/*` | All EPCs | Own slug only | Redirected to login |
| `/intel/*` | Full access | 403 Denied | Redirected to login |
| `/login.html` | Public | Public | Public |

---

## Adding a New EPC

When onboarding a new EPC partner:

1. Create their portal directory: `epc/{new-slug}/`
2. Add `index.html`, `plr-logo.png`, and EPC logo
3. Add `<script src="/auth-ui.js"></script>` before `</body>` in their `index.html`
4. Generate a passphrase and hash it
5. Store the plaintext in Keychain: `palmetto-presents-{slug}-passphrase`
6. Add the slug + hash to `PP_EPC_PASSPHRASES` JSON in Vercel
7. Add their tile to `/index.html` in the EPC grid
8. Deploy and send the passphrase to their RM
