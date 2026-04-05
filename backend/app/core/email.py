"""
Async email sender using aiosmtplib.
Dark-themed, on-brand HTML email matching the Rookies HQ app design system.
"""
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import settings


def _otp_email_html(otp: str, full_name: str, org_name: str) -> str:
    digits = list(otp)

    # Each OTP digit cell
    digit_cells = "".join(
        f"""<td style="padding:0 5px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Use linear-gradient hack to prevent color inversion -->
                  <td style="width:48px;height:56px;
                             background:linear-gradient(#131320,#131320);
                             background-color:#131320;
                             border:1px solid #1c1c2c;
                             border-bottom:2px solid #2d5fdf;
                             border-radius:8px;
                             text-align:center;
                             vertical-align:middle;
                             font-size:24px;
                             font-weight:800;
                             color:#ffffff;
                             font-family:'Inter',-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
                    {d}
                  </td>
                </tr>
              </table>
            </td>"""
        for d in digits
    )

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light dark"/>
  <meta name="supported-color-schemes" content="light dark"/>
  <title>Verify your Rookies HQ account</title>
  <style>
    /* Prevent auto-resizing */
    body {{
      margin: 0 !important;
      padding: 0 !important;
      -webkit-text-size-adjust: 100%;
    }}
    table {{ border-collapse: collapse !important; border-spacing: 0 !important; }}
    /* Prevent blue links in Apple Mail */
    a {{ color: inherit !important; text-decoration: none !important; }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#08080d;">

<!-- Master container using linear-gradient to FORCE dark mode and prevent Apple/Gmail auto-inversion -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:linear-gradient(#08080d,#08080d);background-color:#08080d;min-width:100%;">
  <tr>
    <td align="center" style="padding:50px 16px;">

      <!-- Inner Card Container -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;">
        
        <!-- ── LOGO ───────────────────────────────────────── -->
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:48px;height:48px;
                           background:linear-gradient(#2d5fdf,#2d5fdf);
                           background-color:#2d5fdf;
                           border-radius:12px;
                           text-align:center;
                           vertical-align:middle;
                           font-size:24px;">
                  ⚡
                </td>
                <td style="padding-left:14px;vertical-align:middle;">
                  <span style="font-size:18px;font-weight:800;letter-spacing:0.35em;color:#e0e0ec;font-family:'Inter',-apple-system,Arial,sans-serif;">
                    ROOKIES HQ
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── CONTENT CARD ───────────────────────────────── -->
        <tr>
          <td style="background:linear-gradient(#0d0d14,#0d0d14);background-color:#0d0d14;
                     border:1px solid #1a1a28;border-radius:16px;padding:36px;text-align:center;">
                     
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.18em;
                      color:#2d5fdf;text-transform:uppercase;font-family:'Inter',-apple-system,Arial,sans-serif;">
              Secure Verification
            </p>
            
            <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#e0e0ec;line-height:1.3;font-family:'Inter',-apple-system,Arial,sans-serif;">
              Authorize your login
            </h1>
            
            <p style="margin:0 0 8px;font-size:14px;color:#a0a0b0;line-height:1.6;font-family:'Inter',-apple-system,Arial,sans-serif;">
              Hi <strong>{full_name}</strong>,
            </p>
            <p style="margin:0 0 32px;font-size:14px;color:#808090;line-height:1.6;font-family:'Inter',-apple-system,Arial,sans-serif;">
              You requested to join <strong style="color:#d0d0e0;">{org_name}</strong>.<br/>
              Enter the code below to complete setup.
            </p>

            <!-- OTP DIGITS -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 36px;">
              <tr>
                {digit_cells}
              </tr>
            </table>

            <div style="background:linear-gradient(#131320,#131320);background-color:#131320;
                        border:1px solid #1c1c2c;border-radius:8px;padding:16px;">
              <p style="margin:0;font-size:12px;color:#606070;line-height:1.6;font-family:'Inter',-apple-system,Arial,sans-serif;">
                Code expires in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.
              </p>
            </div>
            
          </td>
        </tr>

        <!-- ── FOOTER ─────────────────────────────────────── -->
        <tr>
          <td align="center" style="padding-top:28px;">
            <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;color:#3a3a50;text-transform:uppercase;font-family:'Inter',-apple-system,Arial,sans-serif;">
              © 2024 Rookies HQ · Creative Agency OS
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>"""


async def send_otp_email(to_email: str, otp: str, full_name: str, org_name: str) -> None:
    """Send the OTP verification email."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{otp} is your Rookies HQ verification code"
    msg["From"] = f"Rookies HQ <{settings.SMTP_USER}>"
    msg["To"] = to_email

    html_body = _otp_email_html(otp, full_name, org_name)
    plain_body = (
        f"Hi {full_name},\n\n"
        f"Your Rookies HQ verification code is: {otp}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you didn't request this, ignore this email.\n\n"
        f"— Rookies HQ Team"
    )

    msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        start_tls=True,
    )
