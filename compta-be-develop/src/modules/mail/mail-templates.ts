import type { RenderedMail } from './mail.types';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Tenant and user names are free text: one line only, so they cannot alter the message structure.
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

function render(subject: string, paragraphs: string[], link?: { label: string; url: string }): RenderedMail {
  const text = [...paragraphs, ...(link ? [`${link.label} : ${link.url}`] : [])].join('\n\n');
  const body = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  const button = link ? `<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>` : '';
  return { subject: oneLine(subject), text, html: `<!doctype html><html><body>${body}${button}</body></html>` };
}

export const invitationMail = (companyName: string, url: string, expiresAt: Date) =>
  render(
    `Invitation à rejoindre ${companyName}`,
    [
      `Vous êtes invité(e) à rejoindre ${oneLine(companyName)} sur COMPTA.`,
      `Ce lien est valable jusqu'au ${expiresAt.toISOString().slice(0, 10)} et ne peut être utilisé qu'une seule fois.`,
    ],
    { label: 'Activer mon compte', url },
  );

export const passwordResetMail = (url: string) =>
  render(
    'Réinitialisation de votre mot de passe',
    [
      'Une demande de réinitialisation de mot de passe a été faite pour votre compte.',
      "Ce lien est valable 60 minutes et ne peut être utilisé qu'une seule fois. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    ],
    { label: 'Choisir un nouveau mot de passe', url },
  );

export const accountLockedMail = (minutes: number) =>
  render('Alerte de sécurité : compte temporairement verrouillé', [
    `Trop de tentatives de connexion ont échoué sur votre compte. La connexion est bloquée pendant ${minutes} minutes.`,
    "Si vous n'êtes pas à l'origine de ces tentatives, changez votre mot de passe dès que possible.",
  ]);

export const exportReadyMail = (url: string, expiresAt: Date) =>
  render(
    'Votre export de données est prêt',
    [`Le fichier est disponible jusqu'au ${expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC.`],
    { label: "Télécharger l'export", url },
  );
