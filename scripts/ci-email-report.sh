#!/usr/bin/env bash
# Email a generation report HTML artifact.
# Prefers RESEND_API_KEY; then Gmail SMTP (SMTP_USER + SMTP_PASS app password);
# finally opens a GitHub Issue (repo notifications / assignee).
set -euo pipefail

HTML_PATH="${1:-}"
SUBJECT="${2:-KinDex generation report}"
TO="${REPORT_EMAIL_TO:-glory2wide@gmail.com}"
FROM="${REPORT_EMAIL_FROM:-}"

if [ -z "$HTML_PATH" ] || [ ! -f "$HTML_PATH" ]; then
  echo "[report] missing html: ${HTML_PATH:-<empty>}"
  # Soft warning — generation may have exited early; do not stack a hard
  # failure annotation on top of the digest assert (seen 2026-09-17 mail).
  echo "::warning::Generation report HTML missing — cannot email ${TO}."
  if [ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
    export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
    BODY_FILE="$(mktemp)"
    {
      echo "수신 예정: **${TO}**"
      echo
      echo "> ⚠️ HTML 리포트 파일이 없어 Gmail 발송을 건너뛰었습니다 (\`${HTML_PATH:-missing}\`)."
      echo "> Daily briefings generate 단계가 digest/HTML을 남기지 않고 끝난 경우일 수 있습니다."
      echo
      echo "Actions 로그에서 generate / Assert briefing ops digest 단계를 확인해 주세요."
    } > "$BODY_FILE"
    if ISSUE_URL="$(gh issue create --title "$SUBJECT (HTML missing)" --body-file "$BODY_FILE" --label "generation-report" 2>/dev/null)"; then
      :
    else
      ISSUE_URL="$(gh issue create --title "$SUBJECT (HTML missing)" --body-file "$BODY_FILE" || true)"
    fi
    rm -f "$BODY_FILE"
    if [ -n "${ISSUE_URL:-}" ]; then
      echo "[report] opened GitHub Issue for missing HTML: ${ISSUE_URL}"
    fi
  fi
  exit 0
fi

export REPORT_HTML_PATH="$HTML_PATH"
export REPORT_SUBJECT="$SUBJECT"
export REPORT_TO="$TO"
export REPORT_FROM="$FROM"

TXT_PATH="${HTML_PATH%.html}.txt"
if [ ! -f "$TXT_PATH" ]; then
  TXT_PATH="$HTML_PATH"
fi
export REPORT_TXT_PATH="$TXT_PATH"

if [ -n "${RESEND_API_KEY:-}" ]; then
  export REPORT_FROM="${FROM:-KinDex Reports <onboarding@resend.dev>}"
  python3 - <<'PY'
import json, os, pathlib, urllib.request
payload = {
  "from": os.environ["REPORT_FROM"],
  "to": [os.environ["REPORT_TO"]],
  "subject": os.environ["REPORT_SUBJECT"],
  "html": pathlib.Path(os.environ["REPORT_HTML_PATH"]).read_text(encoding="utf-8"),
}
req = urllib.request.Request(
  "https://api.resend.com/emails",
  data=json.dumps(payload).encode("utf-8"),
  headers={
    "Authorization": f"Bearer {os.environ['RESEND_API_KEY']}",
    "Content-Type": "application/json",
  },
  method="POST",
)
with urllib.request.urlopen(req) as resp:
  print(resp.read().decode("utf-8", errors="replace")[:400])
print(f"[report] emailed via Resend to {os.environ['REPORT_TO']}")
PY
  exit 0
fi

if [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASS:-}" ]; then
  export REPORT_FROM="${FROM:-$SMTP_USER}"
  export SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
  export SMTP_PORT="${SMTP_PORT:-465}"
  python3 - <<'PY'
import os, pathlib, smtplib, ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

to = os.environ["REPORT_TO"]
frm = os.environ["REPORT_FROM"]
subject = os.environ["REPORT_SUBJECT"]
html = pathlib.Path(os.environ["REPORT_HTML_PATH"]).read_text(encoding="utf-8")

msg = MIMEMultipart("alternative")
msg["Subject"] = subject
msg["From"] = frm
msg["To"] = to
msg.attach(MIMEText(html, "html", "utf-8"))

host = os.environ["SMTP_HOST"]
port = int(os.environ["SMTP_PORT"])
user = os.environ["SMTP_USER"]
password = os.environ["SMTP_PASS"]

context = ssl.create_default_context()
with smtplib.SMTP_SSL(host, port, context=context) as server:
    server.login(user, password)
    server.sendmail(frm, [to], msg.as_string())
print(f"[report] emailed via SMTP to {to}")
PY
  exit 0
fi

# Fallback: GitHub Issue → notification email to repo watchers (owner).
echo "::warning::Gmail was NOT sent to ${TO}. Add GitHub Actions secrets RESEND_API_KEY or SMTP_USER+SMTP_PASS (Gmail app password). Falling back to a GitHub Issue."
if [ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  BODY_FILE="$(mktemp)"
  {
    echo "수신 예정: **${TO}**"
    echo
    echo "> ⚠️ SMTP/Resend 시크릿이 없어 **Gmail로 발송되지 않았습니다.**"
    echo "> Settings → Secrets and variables → Actions 에 \`SMTP_USER\`+\`SMTP_PASS\`(앱 비밀번호) 또는 \`RESEND_API_KEY\`를 추가하세요."
    echo
    echo '```'
    head -c 120000 "$TXT_PATH"
    echo
    echo '```'
  } > "$BODY_FILE"
  if ISSUE_URL="$(gh issue create --title "$SUBJECT" --body-file "$BODY_FILE" --label "generation-report" 2>/dev/null)"; then
    :
  else
    ISSUE_URL="$(gh issue create --title "$SUBJECT" --body-file "$BODY_FILE")"
  fi
  rm -f "$BODY_FILE"
  echo "[report] opened GitHub Issue for ${TO}: ${ISSUE_URL}"
  # Exit 0 once the Issue is opened — generation already published; avoid a
  # second GitHub "Run failed" mail that only means "no SMTP secret".
  exit 0
fi

echo "[report] no mail transport configured for ${TO}, and GitHub issue fallback is unavailable"
echo "::warning::Add GitHub secrets SMTP_USER + SMTP_PASS (Gmail app password) or RESEND_API_KEY for direct email delivery."
exit 0
