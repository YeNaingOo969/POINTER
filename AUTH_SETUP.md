# Auth Setup Guide — Gmail OTP Verification & Sign in with Google

This project uses real MySQL + PHP endpoints (`USE_MOCK = false` in `frontend/src/api/config.js`).

## 1. Database Migration

If you have not yet applied the auth migration on `pointer_db`, run:

```bash
mysql -h 127.0.0.1 -P 3307 -u root pointer_db < sql/005_auth_otp_google.sql
```

## 2. Running Locally (PHP + Vite)

Open two terminals in the project:

```bash
# Terminal 1 (from repo root): PHP API server
php -S localhost:8000

# Terminal 2 (from frontend/): Vite dev server
cd frontend && npm run dev
```

Open **http://localhost:5173/login.html**.

---

## 3. Enable Real Gmail OTP Emails (`config/auth.php`)

Before SMTP credentials are added, registering on `localhost` runs in **local preview mode** (it writes the hashed OTP to MySQL and shows the 6-digit preview code on screen so you can test the full database flow immediately).

To send **real verification emails to users' Gmail inboxes**:

1. Turn on **2-Step Verification** on the Gmail account you want to send from:
   - Go to **Google Account → Security → 2-Step Verification**.
2. Create a **Gmail App Password**:
   - Go to **Google Account → Security → App passwords** (or search "App passwords").
   - Name it `POINTER Local` and copy the 16-character password.
3. Open `config/auth.php` (git-ignored) and fill in `smtp`:

```php
'smtp' => [
    'host'       => 'smtp.gmail.com',
    'port'       => 587,
    'encryption' => 'tls',
    'username'   => 'your.sender@gmail.com',
    'password'   => 'abcd efgh ijkl mnop', // 16-char Gmail App Password
    'from_email' => 'your.sender@gmail.com',
    'from_name'  => 'POINTER',
],
```

Once `username` and `password` are set, `dev_otp_preview` disables automatically and real emails are sent via `smtp.gmail.com:587`.

### Optional Fallback: If Your ISP/Network Blocks SMTP Ports `587` / `465`

If you see `SMTP connect failed (61): Connection refused` on your network, you can send real Gmail OTP emails over **HTTPS (port 443)** using a free **Google Apps Script Web App** under your own Gmail account:

1. Open [script.google.com](https://script.google.com) while signed in to your sender Gmail (`your.sender@gmail.com`) and click **New project**.
2. Paste this code:

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');
  if (data.secret !== 'CHANGE_ME_SECRET') {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  MailApp.sendEmail({
    to: data.to,
    subject: data.subject,
    body: data.textBody,
    htmlBody: data.htmlBody,
    name: 'POINTER'
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click **Deploy → New deployment → Web app** (`Execute as: Me`, `Who has access: Anyone`) and authorize Gmail send permission.
4. Copy the Web App URL (`/exec`) into `config/auth.php`:

```php
'apps_script_url'    => 'https://script.google.com/macros/s/.../exec',
'apps_script_secret' => 'CHANGE_ME_SECRET',
```

---

## 4. Enable Real "Sign in with Google" (`config/auth.php`)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. Open **APIs & Services → OAuth consent screen** (choose **External**, add app name `POINTER`, and add your test Gmail accounts under **Test users** while in Testing status).
3. Open **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Choose **Application type: Web application**.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173`
   - `http://localhost`
   - `http://localhost:8000`
   - `http://127.0.0.1:5173`
6. Copy the generated **Client ID** (ends with `.apps.googleusercontent.com`) into `config/auth.php`:

```php
'google_client_id' => '1234567890-abcdefg.apps.googleusercontent.com',
```

Reload **http://localhost:5173/login.html** — the official **Continue with Google** button will render automatically and verify Google ID tokens on `api/google-auth.php`.
