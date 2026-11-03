/**
 * Demo / hypothetical replies for COMPTA Assistant UI testing.
 * Not live company data — replace when a real AI backend is connected.
 */

export type DemoAssistantResult = {
  reply: string;
  followUps: string[];
};

type LocaleCopy = { en: string; fr: string };
type LocaleList = { en: string[]; fr: string[] };

type DemoReply = {
  match: string[];
  reply: LocaleCopy;
  followUps: LocaleList;
};

function lines(en: string[], fr: string[]): LocaleCopy {
  return { en: en.join("\n"), fr: fr.join("\n") };
}

const DEMO_REPLIES: DemoReply[] = [
  {
    match: [
      "which invoices are overdue",
      "invoices are overdue",
      "overdue invoices",
      "factures sont en retard",
      "factures en retard",
      "quelles factures",
    ],
    reply: lines(
      [
        "Here’s a demo snapshot of overdue invoices (sample data):",
        "",
        "• FAC-2026-014 — Maison Laurent — 2 480,00 € — 12 days overdue",
        "• FAC-2026-021 — Atelier Nord — 1 150,00 € — 5 days overdue",
        "• FAC-2026-028 — Verde Agro — 860,00 € — due yesterday",
        "",
        "Total overdue (demo): 4 490,00 € across 3 invoices.",
      ],
      [
        "Voici un aperçu démo des factures en retard (données d’exemple) :",
        "",
        "• FAC-2026-014 — Maison Laurent — 2 480,00 € — 12 jours de retard",
        "• FAC-2026-021 — Atelier Nord — 1 150,00 € — 5 jours de retard",
        "• FAC-2026-028 — Verde Agro — 860,00 € — échue hier",
        "",
        "Total en retard (démo) : 4 490,00 € sur 3 factures.",
      ],
    ),
    followUps: {
      en: [
        "Draft a reminder for FAC-2026-014",
        "Which customers still owe money?",
        "Show unmatched bank payments",
      ],
      fr: [
        "Rédiger une relance pour FAC-2026-014",
        "Quels clients ont encore un solde dû ?",
        "Afficher les paiements bancaires non rapprochés",
      ],
    },
  },
  {
    match: [
      "summarize my quote pipeline",
      "quote pipeline",
      "pipeline de devis",
      "résumer mon pipeline",
      "resumer mon pipeline",
      "résume mon pipeline",
      "resume mon pipeline",
    ],
    reply: lines(
      [
        "Demo quote pipeline summary:",
        "",
        "• Draft: 4 quotes · ~18 200 €",
        "• Sent / awaiting reply: 6 quotes · ~41 500 €",
        "• To approve: 1 quote · DEV-2026-044 · 9 800 €",
        "• Accepted this month: 3 quotes · ~22 100 €",
        "",
        "Win rate (demo): 38% on quotes closed in the last 30 days.",
      ],
      [
        "Résumé démo du pipeline de devis :",
        "",
        "• Brouillons : 4 devis · ~18 200 €",
        "• Envoyés / en attente : 6 devis · ~41 500 €",
        "• À approuver : 1 devis · DEV-2026-044 · 9 800 €",
        "• Acceptés ce mois : 3 devis · ~22 100 €",
        "",
        "Taux de conversion (démo) : 38 % sur les devis clos sur 30 jours.",
      ],
    ),
    followUps: {
      en: [
        "Which quotes expire this week?",
        "What should I approve first?",
        "What changed today?",
      ],
      fr: [
        "Quels devis expirent cette semaine ?",
        "Que dois-je approuver en premier ?",
        "Qu’est-ce qui a changé aujourd’hui ?",
      ],
    },
  },
  {
    match: [
      "which customers still owe money",
      "customers still owe",
      "customers owe",
      "clients ont encore",
      "solde dû",
      "solde du",
      "still owe money",
      "quels clients",
    ],
    reply: lines(
      [
        "Demo open balances by customer:",
        "",
        "1. Maison Laurent — 2 480,00 € (1 overdue invoice)",
        "2. Atelier Nord — 1 150,00 € (1 overdue invoice)",
        "3. Verde Agro — 860,00 € (1 invoice due)",
        "4. Studio Helios — 320,00 € (partial payment remaining)",
        "",
        "Receivables still open (demo): 4 810,00 €.",
      ],
      [
        "Soldes ouverts démo par client :",
        "",
        "1. Maison Laurent — 2 480,00 € (1 facture en retard)",
        "2. Atelier Nord — 1 150,00 € (1 facture en retard)",
        "3. Verde Agro — 860,00 € (1 facture échue)",
        "4. Studio Helios — 320,00 € (reste d’un paiement partiel)",
        "",
        "Créances encore ouvertes (démo) : 4 810,00 €.",
      ],
    ),
    followUps: {
      en: [
        "Which invoices are overdue?",
        "Draft a reminder for Maison Laurent",
        "Show payment collection this month",
      ],
      fr: [
        "Quelles factures sont en retard ?",
        "Rédiger une relance pour Maison Laurent",
        "Afficher les encaissements du mois",
      ],
    },
  },
  {
    match: [
      "what changed today",
      "changed today",
      "qu'est-ce qui a changé",
      "quest-ce qui a change",
      "qui a changé aujourd",
      "aujourdhui",
      "aujourd'hui",
    ],
    reply: lines(
      [
        "Demo activity for today:",
        "",
        "• 2 payments recorded (3 200,00 € collected)",
        "• 1 quote sent — DEV-2026-051 to Maison Laurent",
        "• 1 invoice validated — FAC-2026-033",
        "• 3 bank transactions waiting for reconciliation",
        "• 1 AI payment reminder draft ready for review",
        "",
        "Nothing blocking validation right now in this demo set.",
      ],
      [
        "Activité démo du jour :",
        "",
        "• 2 paiements enregistrés (3 200,00 € encaissés)",
        "• 1 devis envoyé — DEV-2026-051 à Maison Laurent",
        "• 1 facture validée — FAC-2026-033",
        "• 3 opérations bancaires en attente de rapprochement",
        "• 1 brouillon de relance IA prêt à revoir",
        "",
        "Rien ne bloque la validation dans ce jeu de démo.",
      ],
    ),
    followUps: {
      en: [
        "Show unmatched bank payments",
        "Which invoices are overdue?",
        "Summarize my quote pipeline",
      ],
      fr: [
        "Afficher les paiements bancaires non rapprochés",
        "Quelles factures sont en retard ?",
        "Résume mon pipeline de devis",
      ],
    },
  },
  {
    match: [
      "draft a reminder for fac-2026-014",
      "reminder for fac-2026-014",
      "draft a reminder for maison laurent",
      "reminder for maison",
      "rédiger une relance pour fac-2026-014",
      "relance pour fac-2026-014",
      "rédiger une relance pour maison laurent",
      "relance pour maison",
    ],
    reply: lines(
      [
        "Demo reminder draft (not sent):",
        "",
        "To: Maison Laurent",
        "Subject: Friendly reminder — FAC-2026-014",
        "",
        "Hello,",
        "Our records show invoice FAC-2026-014 for 2 480,00 € is 12 days overdue.",
        "Could you confirm payment status or a planned settlement date?",
        "",
        "This is sample text for UI testing. Sending still requires approval.",
      ],
      [
        "Brouillon de relance démo (non envoyé) :",
        "",
        "À : Maison Laurent",
        "Objet : Rappel amical — FAC-2026-014",
        "",
        "Bonjour,",
        "Selon nos enregistrements, la facture FAC-2026-014 de 2 480,00 € a 12 jours de retard.",
        "Pouvez-vous confirmer le statut du paiement ou une date de règlement prévue ?",
        "",
        "Texte d’exemple pour tester l’UI. L’envoi nécessite toujours une approbation.",
      ],
    ),
    followUps: {
      en: [
        "Which invoices are overdue?",
        "Show payment collection this month",
        "What changed today?",
      ],
      fr: [
        "Quelles factures sont en retard ?",
        "Afficher les encaissements du mois",
        "Qu’est-ce qui a changé aujourd’hui ?",
      ],
    },
  },
  {
    match: [
      "which quotes expire this week",
      "quotes expire",
      "expire this week",
      "devis expirent",
      "expirent cette semaine",
    ],
    reply: lines(
      [
        "Demo quotes expiring within 7 days:",
        "",
        "• DEV-2026-039 — Atelier Nord — 4 200 € — expires in 2 days",
        "• DEV-2026-047 — Studio Helios — 1 850 € — expires in 6 days",
        "",
        "Suggested focus: follow up on DEV-2026-039 first.",
      ],
      [
        "Devis démo expirant sous 7 jours :",
        "",
        "• DEV-2026-039 — Atelier Nord — 4 200 € — expire dans 2 jours",
        "• DEV-2026-047 — Studio Helios — 1 850 € — expire dans 6 jours",
        "",
        "Priorité suggérée : relancer d’abord DEV-2026-039.",
      ],
    ),
    followUps: {
      en: [
        "Summarize my quote pipeline",
        "What should I approve first?",
        "What changed today?",
      ],
      fr: [
        "Résume mon pipeline de devis",
        "Que dois-je approuver en premier ?",
        "Qu’est-ce qui a changé aujourd’hui ?",
      ],
    },
  },
  {
    match: [
      "what should i approve first",
      "approve first",
      "que dois-je approuver",
      "approuver en premier",
    ],
    reply: lines(
      [
        "Demo approval priority:",
        "",
        "1. DEV-2026-044 — 9 800 € — waiting for owner approval",
        "2. Expense EXP-2026-018 — 420 € — receipt attached",
        "",
        "Start with the quote: highest commercial impact in this sample set.",
      ],
      [
        "Priorité d’approbation démo :",
        "",
        "1. DEV-2026-044 — 9 800 € — en attente d’approbation propriétaire",
        "2. Dépense EXP-2026-018 — 420 € — reçu joint",
        "",
        "Commencez par le devis : impact commercial le plus élevé dans cet exemple.",
      ],
    ),
    followUps: {
      en: [
        "Summarize my quote pipeline",
        "Which quotes expire this week?",
        "What changed today?",
      ],
      fr: [
        "Résume mon pipeline de devis",
        "Quels devis expirent cette semaine ?",
        "Qu’est-ce qui a changé aujourd’hui ?",
      ],
    },
  },
  {
    match: [
      "show unmatched bank payments",
      "unmatched bank",
      "bank payments",
      "reconciliation",
      "paiements bancaires non rapprochés",
      "non rapprochés",
      "rapprochement",
    ],
    reply: lines(
      [
        "Demo unmatched bank lines:",
        "",
        "• 1 150,00 € — likely FAC-2026-021 (Atelier Nord) — high confidence",
        "• 640,00 € — no clear invoice match — needs review",
        "• 220,00 € — possible partial on Studio Helios",
        "",
        "Open Payments → Reconciliation to confirm (demo).",
      ],
      [
        "Opérations bancaires non rapprochées (démo) :",
        "",
        "• 1 150,00 € — probable FAC-2026-021 (Atelier Nord) — confiance élevée",
        "• 640,00 € — aucune facture claire — à revoir",
        "• 220,00 € — possible partial sur Studio Helios",
        "",
        "Ouvrez Paiements → Rapprochement pour confirmer (démo).",
      ],
    ),
    followUps: {
      en: [
        "Show payment collection this month",
        "Which invoices are overdue?",
        "What changed today?",
      ],
      fr: [
        "Afficher les encaissements du mois",
        "Quelles factures sont en retard ?",
        "Qu’est-ce qui a changé aujourd’hui ?",
      ],
    },
  },
  {
    match: [
      "show payment collection this month",
      "payment collection",
      "collected this month",
      "encaissements du mois",
      "encaissements",
    ],
    reply: lines(
      [
        "Demo collection this month:",
        "",
        "• Collected: 28 400,00 €",
        "• Still open / overdue: 4 490,00 €",
        "• Collection rate (demo): 86%",
        "",
        "Biggest open item remains FAC-2026-014 (Maison Laurent).",
      ],
      [
        "Encaissements démo du mois :",
        "",
        "• Encaissé : 28 400,00 €",
        "• Encore ouvert / en retard : 4 490,00 €",
        "• Taux d’encaissement (démo) : 86 %",
        "",
        "Le plus gros poste ouvert reste FAC-2026-014 (Maison Laurent).",
      ],
    ),
    followUps: {
      en: [
        "Which invoices are overdue?",
        "Which customers still owe money?",
        "Draft a reminder for FAC-2026-014",
      ],
      fr: [
        "Quelles factures sont en retard ?",
        "Quels clients ont encore un solde dû ?",
        "Rédiger une relance pour FAC-2026-014",
      ],
    },
  },
  {
    match: ["payment", "paiement", "reconcile"],
    reply: lines(
      [
        "Demo payments view:",
        "",
        "• Collected this month: 28 400,00 €",
        "• Unmatched bank lines: 3",
        "• Highest-confidence match: 1 150,00 € → FAC-2026-021 (Atelier Nord)",
      ],
      [
        "Vue paiements démo :",
        "",
        "• Encaissé ce mois : 28 400,00 €",
        "• Lignes bancaires non rapprochées : 3",
        "• Meilleure correspondance : 1 150,00 € → FAC-2026-021 (Atelier Nord)",
      ],
    ),
    followUps: {
      en: [
        "Show unmatched bank payments",
        "Which invoices are overdue?",
        "Show payment collection this month",
      ],
      fr: [
        "Afficher les paiements bancaires non rapprochés",
        "Quelles factures sont en retard ?",
        "Afficher les encaissements du mois",
      ],
    },
  },
  {
    match: ["customer", "client", "customers", "clients"],
    reply: lines(
      [
        "Demo customers overview:",
        "",
        "• Active customers: 42",
        "• With open balance: 4",
        "• New this month: 2 (Studio Helios, Atelier Riviera)",
      ],
      [
        "Vue clients démo :",
        "",
        "• Clients actifs : 42",
        "• Avec solde ouvert : 4",
        "• Nouveaux ce mois : 2 (Studio Helios, Atelier Riviera)",
      ],
    ),
    followUps: {
      en: [
        "Which customers still owe money?",
        "Which invoices are overdue?",
        "What changed today?",
      ],
      fr: [
        "Quels clients ont encore un solde dû ?",
        "Quelles factures sont en retard ?",
        "Qu’est-ce qui a changé aujourd’hui ?",
      ],
    },
  },
  {
    match: ["invoice", "facture", "invoices", "factures"],
    reply: lines(
      [
        "Demo invoices overview:",
        "",
        "• Open: 11 · Overdue: 3 · Paid this month: 9",
        "• Oldest overdue: FAC-2026-014 (Maison Laurent)",
      ],
      [
        "Vue factures démo :",
        "",
        "• Ouvertes : 11 · En retard : 3 · Payées ce mois : 9",
        "• Plus ancien retard : FAC-2026-014 (Maison Laurent)",
      ],
    ),
    followUps: {
      en: [
        "Which invoices are overdue?",
        "Draft a reminder for FAC-2026-014",
        "Which customers still owe money?",
      ],
      fr: [
        "Quelles factures sont en retard ?",
        "Rédiger une relance pour FAC-2026-014",
        "Quels clients ont encore un solde dû ?",
      ],
    },
  },
  {
    match: ["quote", "devis", "quotes"],
    reply: lines(
      [
        "Demo quotes overview:",
        "",
        "• Open pipeline value: ~69 500 €",
        "• Expiring within 7 days: 2",
        "• Awaiting approval: DEV-2026-044",
      ],
      [
        "Vue devis démo :",
        "",
        "• Valeur pipeline ouverte : ~69 500 €",
        "• Expirent sous 7 jours : 2",
        "• En attente d’approbation : DEV-2026-044",
      ],
    ),
    followUps: {
      en: [
        "Summarize my quote pipeline",
        "Which quotes expire this week?",
        "What should I approve first?",
      ],
      fr: [
        "Résume mon pipeline de devis",
        "Quels devis expirent cette semaine ?",
        "Que dois-je approuver en premier ?",
      ],
    },
  },
  {
    match: ["report", "rapport", "revenue", "chiffre"],
    reply: lines(
      [
        "Demo reports snapshot:",
        "",
        "• Monthly revenue (MTD): 31 200,00 €",
        "• vs previous period: +8%",
        "• Collection rate: 86%",
      ],
      [
        "Instantané rapports démo :",
        "",
        "• CA du mois (MTD) : 31 200,00 €",
        "• vs période précédente : +8 %",
        "• Taux d’encaissement : 86 %",
      ],
    ),
    followUps: {
      en: [
        "Show payment collection this month",
        "Which invoices are overdue?",
        "Summarize my quote pipeline",
      ],
      fr: [
        "Afficher les encaissements du mois",
        "Quelles factures sont en retard ?",
        "Résume mon pipeline de devis",
      ],
    },
  },
  {
    match: ["project", "projet", "expense", "dépense", "depense", "cost"],
    reply: lines(
      [
        "Demo projects & costs:",
        "",
        "• Active projects: 14",
        "• Expenses awaiting approval: 2",
        "• Lowest margin (demo): PRJ-2026-005 — Stone Façade",
      ],
      [
        "Projets & coûts démo :",
        "",
        "• Projets actifs : 14",
        "• Dépenses en attente d’approbation : 2",
        "• Marge la plus basse (démo) : PRJ-2026-005 — Stone Façade",
      ],
    ),
    followUps: {
      en: [
        "What should I approve first?",
        "What changed today?",
        "Summarize my quote pipeline",
      ],
      fr: [
        "Que dois-je approuver en premier ?",
        "Qu’est-ce qui a changé aujourd’hui ?",
        "Résume mon pipeline de devis",
      ],
    },
  },
  {
    match: ["hello", "hi", "bonjour", "salut", "hey"],
    reply: lines(
      [
        "Hello — I’m the COMPTA Assistant demo shell.",
        "",
        "I can simulate answers about overdue invoices, quotes, customers, payments and today’s activity.",
      ],
      [
        "Bonjour — je suis l’assistant COMPTA en mode démo.",
        "",
        "Je peux simuler des réponses sur les factures en retard, devis, clients, paiements et l’activité du jour.",
      ],
    ),
    followUps: {
      en: [
        "Which invoices are overdue?",
        "Summarize my quote pipeline",
        "What changed today?",
      ],
      fr: [
        "Quelles factures sont en retard ?",
        "Résume mon pipeline de devis",
        "Qu’est-ce qui a changé aujourd’hui ?",
      ],
    },
  },
  {
    match: ["help", "aide", "what can you", "que peux"],
    reply: lines(
      [
        "In this demo I can pretend to answer:",
        "",
        "• Overdue invoices",
        "• Quote pipeline",
        "• Customers with open balances",
        "• What changed today",
        "• Payments, reports or projects",
        "",
        "Replies use sample data for UI testing — not a live AI backend.",
      ],
      [
        "Dans cette démo, je peux simuler des réponses sur :",
        "",
        "• Factures en retard",
        "• Pipeline de devis",
        "• Clients avec solde ouvert",
        "• Ce qui a changé aujourd’hui",
        "• Paiements, rapports ou projets",
        "",
        "Les réponses utilisent des données d’exemple pour tester l’UI — pas de backend IA réel.",
      ],
    ),
    followUps: {
      en: [
        "Which invoices are overdue?",
        "Which customers still owe money?",
        "Show unmatched bank payments",
      ],
      fr: [
        "Quelles factures sont en retard ?",
        "Quels clients ont encore un solde dû ?",
        "Afficher les paiements bancaires non rapprochés",
      ],
    },
  },
];

const FALLBACK: { en: DemoAssistantResult; fr: DemoAssistantResult } = {
  en: {
    reply: [
      "Thanks — I received your message in the demo shell.",
      "",
      "I don’t have a real AI backend yet, but you can try one of the questions below.",
    ].join("\n"),
    followUps: [
      "Which invoices are overdue?",
      "Summarize my quote pipeline",
      "Which customers still owe money?",
      "What changed today?",
    ],
  },
  fr: {
    reply: [
      "Merci — votre message a bien été reçu dans le mode démo.",
      "",
      "Il n’y a pas encore de backend IA réel, mais vous pouvez essayer une des questions ci-dessous.",
    ].join("\n"),
    followUps: [
      "Quelles factures sont en retard ?",
      "Résume mon pipeline de devis",
      "Quels clients ont encore un solde dû ?",
      "Qu’est-ce qui a changé aujourd’hui ?",
    ],
  },
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/g, "'")
    .trim();
}

function pickLocale(locale: string): "en" | "fr" {
  return locale.toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** Resolve a hypothetical demo answer + follow-up questions for UI testing. */
export function resolveDemoReply(
  userText: string,
  locale = "en",
): DemoAssistantResult {
  const lang = pickLocale(locale);
  const needle = normalize(userText);
  if (!needle) return FALLBACK[lang];

  for (const entry of DEMO_REPLIES) {
    if (entry.match.some((phrase) => needle.includes(normalize(phrase)))) {
      return {
        reply: entry.reply[lang],
        followUps: entry.followUps[lang],
      };
    }
  }

  return FALLBACK[lang];
}
