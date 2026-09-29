# Nailly Auth Email Templates

## Confirm signup

**Subject**

```
Confirm your Nailly account
```

**Supabase Dashboard**

1. Open **Authentication**
2. Open **Email Templates**
3. Choose **Confirm signup**
4. Set the subject to `Confirm your Nailly account`
5. Paste the contents of `confirm-signup.html` into the message body
6. Save the template

The template intentionally uses `{{ .ConfirmationURL }}`, so it keeps the confirmation redirect configured by the Nailly app.

## Production note

Before public release, configure custom SMTP and a verified sending domain so authentication emails can be delivered reliably from a Nailly-branded address.
