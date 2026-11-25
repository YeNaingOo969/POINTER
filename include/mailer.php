<?php
// Pure-PHP SMTP mailer (STARTTLS / SSL, AUTH LOGIN) with zero Composer dependencies.
declare(strict_types=1);

/**
 * Send a multipart/alternative (plain text + HTML) email via authenticated SMTP.
 *
 * @throws RuntimeException if connecting, authenticating, or sending fails.
 */
function smtp_send_mail(
    array $smtp,
    string $toEmail,
    string $toName,
    string $subject,
    string $htmlBody,
    string $textBody
): void {
    $host       = trim((string) ($smtp['host'] ?? 'smtp.gmail.com'));
    $port       = (int) ($smtp['port'] ?? 587);
    $encryption = strtolower(trim((string) ($smtp['encryption'] ?? 'tls')));
    $username   = trim((string) ($smtp['username'] ?? ''));
    $password   = (string) ($smtp['password'] ?? '');
    if (str_contains(strtolower($host), 'gmail.com') && preg_match('/^[a-zA-Z]{4}(?:\s+[a-zA-Z]{4}){3}$/', trim($password))) {
        $password = preg_replace('/\s+/', '', $password);
    }
    $fromEmail  = trim((string) ($smtp['from_email'] ?? '')) ?: $username;
    $fromName   = trim((string) ($smtp['from_name'] ?? 'POINTER'));

    if ($host === '' || $port <= 0 || $username === '' || $password === '' || $fromEmail === '') {
        throw new RuntimeException('SMTP credentials are not configured');
    }

    // Strip CR/LF from header values to prevent SMTP header injection.
    $cleanHeader = static fn (string $v): string => str_replace(["\r", "\n"], '', trim($v));
    $toEmail   = $cleanHeader($toEmail);
    $toName    = $cleanHeader($toName);
    $fromEmail = $cleanHeader($fromEmail);
    $fromName  = $cleanHeader($fromName);
    $subject   = $cleanHeader($subject);

    $attempts = [[$port, $encryption]];
    if (str_contains(strtolower($host), 'gmail.com') && $port === 587 && $encryption === 'tls') {
        $attempts[] = [465, 'ssl'];
    }

    // Resolve IPv4 addresses up front so broken IPv6 routes don't stall socket connect,
    // while keeping $host as peer_name for strict TLS certificate verification.
    $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (@gethostbynamel($host) ?: []);
    $targets = $ips !== [] ? array_slice($ips, 0, 2) : [$host];

    $errors = [];
    foreach ($attempts as [$tryPort, $tryEnc]) {
        foreach ($targets as $connectHost) {
            try {
                smtp_send_once($host, $connectHost, $tryPort, $tryEnc, $username, $password, $fromEmail, $fromName, $toEmail, $toName, $subject, $htmlBody, $textBody);
                return;
            } catch (RuntimeException $e) {
                $errors[] = "{$tryPort}/{$tryEnc} ({$connectHost}): " . $e->getMessage();
                // Only retry alternate IP/port if failure happened before auth/recipient stage.
                if (
                    !str_contains($e->getMessage(), 'connect failed')
                    && !str_contains($e->getMessage(), 'closed unexpectedly')
                    && !str_contains($e->getMessage(), 'greeting failed')
                    && !str_contains($e->getMessage(), 'TLS encryption')
                ) {
                    throw $e;
                }
            }
        }
    }
    throw new RuntimeException(implode(' | ', $errors));
}

function smtp_send_once(
    string $peerHost,
    string $connectHost,
    int $port,
    string $encryption,
    string $username,
    string $password,
    string $fromEmail,
    string $fromName,
    string $toEmail,
    string $toName,
    string $subject,
    string $htmlBody,
    string $textBody
): void {
    $remote = ($encryption === 'ssl' ? 'ssl://' : 'tcp://') . $connectHost . ':' . $port;
    $context = stream_context_create([
        'ssl' => [
            'verify_peer'       => true,
            'verify_peer_name'  => true,
            'peer_name'         => $peerHost,
            'allow_self_signed' => false,
        ],
    ]);

    $errno = 0;
    $errstr = '';
    $fp = @stream_socket_client($remote, $errno, $errstr, 8, STREAM_CLIENT_CONNECT, $context);
    if (!$fp) {
        throw new RuntimeException("SMTP connect failed ($errno): $errstr");
    }
    stream_set_timeout($fp, 10);

    $read = static function () use ($fp): array {
        $lines = [];
        $code = 0;
        while (($line = fgets($fp, 4096)) !== false) {
            $lines[] = rtrim($line, "\r\n");
            if (preg_match('/^(\d{3})([ -])/', $line, $m)) {
                $code = (int) $m[1];
                if ($m[2] === ' ') {
                    break;
                }
            } else {
                break;
            }
        }
        if ($code === 0) {
            throw new RuntimeException('SMTP connection closed unexpectedly');
        }
        return [$code, implode("\n", $lines)];
    };

    $cmd = static function (string $command, array $expectedCodes) use ($fp, $read): string {
        if ($command !== '') {
            fwrite($fp, $command . "\r\n");
        }
        [$code, $resp] = $read();
        if (!in_array($code, $expectedCodes, true)) {
            throw new RuntimeException("SMTP unexpected response ($code): $resp");
        }
        return $resp;
    };

    try {
        // Greeting
        [$greetCode, $greetResp] = $read();
        if ($greetCode !== 220) {
            throw new RuntimeException("SMTP greeting failed ($greetCode): $greetResp");
        }

        $ehloHost = 'localhost';
        $cmd("EHLO $ehloHost", [250]);

        if ($encryption === 'tls') {
            $cmd('STARTTLS', [220]);
            $ok = @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT);
            if ($ok !== true) {
                throw new RuntimeException('Failed to establish TLS encryption with SMTP server');
            }
            $cmd("EHLO $ehloHost", [250]);
        }

        // Authenticate via AUTH LOGIN
        $cmd('AUTH LOGIN', [334]);
        $cmd(base64_encode($username), [334]);
        $cmd(base64_encode($password), [235]);

        // Envelope
        $cmd("MAIL FROM:<$fromEmail>", [250]);
        $cmd("RCPT TO:<$toEmail>", [250, 251]);
        $cmd('DATA', [354]);

        $boundary = 'ptr_' . bin2hex(random_bytes(16));
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encodedFromName = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
        $encodedToName = $toName !== '' ? '=?UTF-8?B?' . base64_encode($toName) . '?= ' : '';
        $messageId = '<' . bin2hex(random_bytes(12)) . '@pointer.local>';

        $headers = [
            "Date: " . date('r'),
            "From: $encodedFromName <$fromEmail>",
            "To: {$encodedToName}<$toEmail>",
            "Subject: $encodedSubject",
            "Message-ID: $messageId",
            "MIME-Version: 1.0",
            "Content-Type: multipart/alternative; boundary=\"$boundary\"",
        ];

        $bodyLines = [
            "--$boundary",
            "Content-Type: text/plain; charset=UTF-8",
            "Content-Transfer-Encoding: base64",
            "",
            chunk_split(base64_encode($textBody)),
            "--$boundary",
            "Content-Type: text/html; charset=UTF-8",
            "Content-Transfer-Encoding: base64",
            "",
            chunk_split(base64_encode($htmlBody)),
            "--$boundary--",
        ];

        // Dot-stuff lines beginning with '.' per RFC 5321
        $payload = implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $bodyLines);
        $payload = preg_replace('/^\./m', '..', $payload);

        fwrite($fp, $payload . "\r\n.\r\n");
        [$dataCode, $dataResp] = $read();
        if ($dataCode !== 250) {
            throw new RuntimeException("SMTP DATA rejected ($dataCode): $dataResp");
        }

        fwrite($fp, "QUIT\r\n");
    } finally {
        fclose($fp);
    }
}

/** Build the POINTER OTP email content (HTML + plain text). */
function send_verification_otp_email(array $smtp, string $toEmail, string $name, string $code): void
{
    $safeName = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeCode = htmlspecialchars($code, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $spacedCode = implode(' ', str_split($safeCode));

    $subject = 'Your POINTER verification code: ' . $code;

    $textBody = "Hello $name,\n\n"
        . "Use the verification code below to finish creating your POINTER account:\n\n"
        . "    $code\n\n"
        . "This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.\n\n"
        . "— POINTER · Explore Yangon";

    $htmlBody = <<<HTML
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#1a1410;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f4ead8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#241c17;border:1px solid rgba(244,234,216,0.16);border-radius:20px;overflow:hidden;">
    <tr>
      <td style="height:3px;background:linear-gradient(90deg,transparent,#e8b04a,transparent);"></td>
    </tr>
    <tr>
      <td style="padding:32px 28px;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#f1d6a3;">POINTER · YANGON</p>
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#f4ead8;">Verify your email address</h1>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:rgba(244,234,216,0.82);">Hi {$safeName}, enter this 6-digit code to finish creating your POINTER account:</p>
        <div style="margin:0 0 22px;padding:18px 16px;border-radius:14px;background:rgba(232,176,74,0.1);border:1px solid rgba(232,176,74,0.35);text-align:center;">
          <span style="font-family:ui-monospace,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.22em;color:#f1d6a3;">{$spacedCode}</span>
        </div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(244,234,216,0.68);">This code expires in <strong>10 minutes</strong>. If you did not try to sign up for POINTER, you can ignore this message.</p>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;

    smtp_send_mail($smtp, $toEmail, $name, $subject, $htmlBody, $textBody);
}

/**
 * Send the verification email via a Google Apps Script HTTPS Web App relay (port 443).
 * Useful when local networks / ISPs block outbound SMTP ports 587 and 465.
 */
function apps_script_send_otp_email(string $webAppUrl, string $secret, string $toEmail, string $name, string $code): void
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP cURL extension is required for HTTPS email relay');
    }
    $safeName = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $spacedCode = implode(' ', str_split($code));
    $subject = 'Your POINTER verification code: ' . $code;
    $textBody = "Hello $name,\n\n"
        . "Use this 6-digit code to finish creating your POINTER account:\n\n"
        . "    $code\n\n"
        . "This code expires in 10 minutes. If you didn't request this, ignore this email.\n\n"
        . "— POINTER · Explore Yangon";
    $htmlBody = "<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#1a1410;color:#f4ead8;border-radius:16px;\">"
        . "<p style=\"color:#f1d6a3;font-size:12px;letter-spacing:2px;margin:0 0 8px;\">POINTER · YANGON</p>"
        . "<h2 style=\"margin:0 0 12px;color:#f4ead8;\">Verify your email address</h2>"
        . "<p style=\"margin:0 0 18px;color:#e7dac3;\">Hi {$safeName}, enter this 6-digit code to finish creating your POINTER account:</p>"
        . "<div style=\"padding:16px;border-radius:12px;background:rgba(232,176,74,0.14);border:1px solid rgba(232,176,74,0.4);text-align:center;font-family:monospace;font-size:30px;font-weight:700;letter-spacing:6px;color:#f1d6a3;\">{$spacedCode}</div>"
        . "<p style=\"margin:16px 0 0;font-size:13px;color:#b9ab94;\">This code expires in 10 minutes.</p></div>";

    $payload = json_encode([
        'secret'   => $secret,
        'to'       => $toEmail,
        'subject'  => $subject,
        'textBody' => $textBody,
        'htmlBody' => $htmlBody,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $ch = curl_init($webAppUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 4,
        CURLOPT_TIMEOUT        => 12,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $status < 200 || $status >= 300) {
        throw new RuntimeException('HTTPS email relay failed (' . ($curlErr ?: "HTTP $status") . ')');
    }
    $decoded = json_decode($raw, true);
    if (is_array($decoded) && isset($decoded['ok']) && $decoded['ok'] !== true) {
        throw new RuntimeException((string) ($decoded['error'] ?? 'HTTPS email relay rejected request'));
    }
}
