const EMAIL_COPY = {
  pt: {
    subject: 'Seu acesso ao Starting Toolkit está pronto',
    heading: 'Vamos começar seu planejamento?',
    intro: 'Recebemos sua compra. Para ativar sua conta, crie uma senha segura no botão abaixo.',
    button: 'Criar minha senha',
    expiry: 'Por segurança, este link expira em 48 horas. Se não foi você quem fez a compra, ignore esta mensagem.',
    resetSubject: 'Redefina sua senha do Starting Toolkit',
    resetIntro: 'Recebemos uma solicitação para redefinir a senha da sua conta.',
    resetButton: 'Redefinir senha'
  },
  en: {
    subject: 'Your Starting Toolkit access is ready',
    heading: 'Ready to plan your business?',
    intro: 'We received your purchase. Create a secure password using the button below to activate your account.',
    button: 'Create my password',
    expiry: 'For security, this link expires in 48 hours. If you did not make this purchase, you can ignore this email.',
    resetSubject: 'Reset your Starting Toolkit password',
    resetIntro: 'We received a request to reset your account password.',
    resetButton: 'Reset password'
  },
  es: {
    subject: 'Tu acceso a Starting Toolkit está listo',
    heading: '¿Listo para planificar tu negocio?',
    intro: 'Recibimos tu compra. Crea una contraseña segura con el botón de abajo para activar tu cuenta.',
    button: 'Crear mi contraseña',
    expiry: 'Por seguridad, este enlace vence en 48 horas. Si no realizaste esta compra, ignora este mensaje.',
    resetSubject: 'Restablece tu contraseña de Starting Toolkit',
    resetIntro: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta.',
    resetButton: 'Restablecer contraseña'
  }
};

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendEmail(env, { to, language = 'en', type = 'activation', url }) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new Error('Email service is not configured. Set RESEND_API_KEY and MAIL_FROM.');
  const lang = EMAIL_COPY[language] ? language : 'en';
  const c = EMAIL_COPY[lang];
  const isReset = type === 'reset';
  const subject = isReset ? c.resetSubject : c.subject;
  const heading = isReset ? c.resetSubject : c.heading;
  const intro = isReset ? c.resetIntro : c.intro;
  const button = isReset ? c.resetButton : c.button;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f7;font-family:Arial,sans-serif;color:#203746"><div style="max-width:560px;margin:32px auto;background:#fff;padding:36px 28px;border-radius:16px"><div style="font-weight:700;letter-spacing:.5px;color:#172d3b;font-size:20px">STARTING<span style="color:#c6a66b">TOOLKIT</span></div><h1 style="font-size:24px;margin:28px 0 12px">${escapeHtml(heading)}</h1><p style="font-size:16px;line-height:1.6">${escapeHtml(intro)}</p><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#172d3b;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold">${escapeHtml(button)}</a></p><p style="font-size:13px;line-height:1.5;color:#71818a">${escapeHtml(c.expiry)}</p></div></body></html>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${detail.slice(0, 500)}`);
  }
  return await response.json();
}

export { sendEmail };
