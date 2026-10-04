/**
 * German copy for the landing page. Every product statement here is backed by the Swiver
 * repository (README, docs/ROADMAP.md, docs/data-retention-privacy.md). Do not add claims about
 * certifications, customers or features that are not implemented.
 */
export const de = {
	lang: "de-DE",
	meta: {
		title: "Swiver – Finanzverwaltung für Selbstständige und kleine Unternehmen",
		description:
			"Rechnungen und E-Rechnungen schreiben, Belege erfassen, Zahlungen abgleichen und alles an die Steuerkanzlei übergeben. Gehostet in Frankfurt am Main.",
		ogImageAlt: "Swiver – Übersicht mit offenen Forderungen, Umsatz und Aufgaben",
	},
	a11y: {
		skipToContent: "Zum Inhalt springen",
		openMenu: "Menü öffnen",
		closeMenu: "Menü schließen",
		mainNav: "Hauptnavigation",
		home: "Swiver Startseite",
		productPreview: "Vorschau der Swiver-Anwendung mit Beispieldaten",
	},
	nav: {
		items: [
			{ label: "Funktionen", href: "#funktionen" },
			{ label: "Steuerkanzleien", href: "#steuerkanzleien" },
			{ label: "Sicherheit", href: "#sicherheit" },
			{ label: "Preise", href: "#preise" },
		],
		login: "Anmelden",
		signup: "Kostenlos testen",
	},
	hero: {
		eyebrow: "Finanzverwaltung für Selbstständige und kleine Unternehmen",
		titleLead: "Ordnung in Ihren Finanzen.",
		titleRest: "Von der ersten Rechnung bis zur Steuerkanzlei.",
		lede: "Swiver bündelt Angebote, Rechnungen, Belege und Zahlungen in einer Anwendung. Sie sehen jederzeit, wer Ihnen Geld schuldet, was fällig ist und was Ihre Steuerkanzlei noch braucht.",
		primary: "Kostenlos testen",
		secondary: "So funktioniert Swiver",
		facts: [
			"Gehostet in Frankfurt am Main",
			"E-Rechnung im ZUGFeRD-Format (EN 16931)",
			"Alle Daten jederzeit exportierbar",
		],
	},
	/** Product UI shown in the marketing visuals. Sample data only. */
	app: {
		org: "Hofmann Design GmbH",
		nav: ["Übersicht", "Verkauf", "Einkauf", "Finanzen", "Lager", "Einstellungen"],
		title: "Übersicht",
		period: "Dieser Monat",
		kpis: [
			{ label: "Offene Forderungen", value: 18420, meta: "7 Rechnungen" },
			{ label: "Überfällig", value: 2380, meta: "2 Rechnungen", tone: "critical" },
			{ label: "Umsatz", value: 12950, meta: "netto" },
			{ label: "Geschätzte USt", value: 1846.3, meta: "Schätzung" },
		],
		cashflow: {
			title: "Zahlungseingänge und -ausgänge",
			income: "Eingänge",
			expenses: "Ausgänge",
			months: ["Mai", "Jun", "Jul", "Aug", "Sep", "Okt"],
			incomeValues: [9800, 11200, 10400, 13100, 12300, 14650],
			expenseValues: [6100, 7400, 6900, 7800, 7200, 8150],
		},
		attention: {
			title: "Braucht Aufmerksamkeit",
			items: [
				{ count: 2, text: "überfällige Kundenrechnungen", tone: "critical" },
				{ count: 4, text: "Bankumsätze zu bestätigen", tone: "warning" },
				{ count: 3, text: "Belege im Eingang", tone: "neutral" },
				{ count: 1, text: "Rückfrage der Steuerkanzlei", tone: "neutral" },
			],
		},
		invoices: {
			title: "Letzte Rechnungen",
			columns: ["Nummer", "Kunde", "Betrag", "Status"],
			rows: [
				{ number: "0142", customer: "Nordlicht Software GmbH", amount: 4760, status: "Bezahlt", tone: "good" },
				{ number: "0141", customer: "Brandt & Söhne KG", amount: 1190, status: "Offen", tone: "neutral" },
				{ number: "0139", customer: "Kaiser Studio", amount: 2380, status: "Überfällig", tone: "critical" },
			],
		},
	},
	workflow: {
		eyebrow: "Ablauf",
		title: "Ein Vorgang, von Anfang bis Ende an einem Ort.",
		lede: "Swiver folgt dem Weg, den Ihr Geld tatsächlich nimmt. Jeder Schritt baut auf dem vorherigen auf, nichts wird doppelt erfasst.",
		steps: [
			{
				id: "rechnung",
				title: "Angebot und Rechnung",
				text: "Aus dem Angebot wird mit einem Klick die Rechnung. Festgeschriebene Rechnungen erhalten eine lückenlose Nummer und lassen sich nicht mehr verändern, nur stornieren und korrigieren. Das PDF enthält die E-Rechnung im ZUGFeRD-Format.",
			},
			{
				id: "zahlung",
				title: "Zahlung zuordnen",
				text: "Importieren Sie den Kontoauszug als CSV-Datei. Swiver schlägt passende Rechnungen anhand von Rechnungsnummer, Betrag, IBAN und Namen vor, Sie bestätigen. Teilzahlungen werden korrekt verrechnet.",
			},
			{
				id: "belege",
				title: "Belege erfassen",
				text: "Eingangsrechnungen laden Sie gesammelt in den Belegeingang. Swiver liest eingebettete E-Rechnungsdaten und PDF-Text aus, schlägt die Rechnungsdaten vor und erkennt den Lieferanten an USt-IdNr., Steuernummer oder IBAN.",
			},
			{
				id: "ueberblick",
				title: "Überblick behalten",
				text: "Das Dashboard zeigt offene Forderungen, fällige Verbindlichkeiten, Umsatz und Ausgaben des Monats sowie die geschätzte Umsatzsteuer. Was Ihre Aufmerksamkeit braucht, steht ganz oben.",
			},
			{
				id: "kanzlei",
				title: "An die Steuerkanzlei übergeben",
				text: "Ihre Steuerkanzlei erhält einen eigenen, lesenden Zugang oder ein Exportpaket je Zeitraum mit Rechnungs-PDFs, Belegen und CSV-Listen. Rückfragen klären Sie direkt am Beleg.",
			},
		],
		visuals: {
			invoice: {
				label: "Rechnung",
				status: "Festgeschrieben",
				customer: "Nordlicht Software GmbH",
				lines: [
					{ text: "Entwicklung, 24 Std.", amount: 3000 },
					{ text: "Architektur-Workshop", amount: 1000 },
				],
				net: "Netto",
				vat: "USt 19 %",
				total: "Gesamt",
				format: "ZUGFeRD · EN 16931",
			},
			match: {
				label: "Bankumsatz",
				reference: "RE-{year}-0142 Nordlicht Software",
				suggestion: "Vorschlag",
				reasons: ["Rechnungsnummer", "Betrag", "IBAN"],
				confirm: "Bestätigen",
			},
			inbox: {
				label: "Belegeingang",
				files: [
					{ name: "Mobilfunk_Oktober.pdf", state: "E-Rechnung erkannt", tone: "good" },
					{ name: "Buerobedarf_Schmidt.pdf", state: "Lieferant erkannt", tone: "good" },
					{ name: "Quittung_Bahn.jpg", state: "Zu prüfen", tone: "warning" },
				],
			},
			export: {
				label: "Export für die Steuerkanzlei",
				period: "Q3",
				items: ["Rechnungen (PDF, ZUGFeRD)", "Eingangsbelege", "Umsätze und Zahlungen (CSV)"],
				action: "ZIP herunterladen",
			},
		},
	},
	socialProof: {
		eyebrow: "Kunden",
		title: "Unternehmen, die mit Swiver arbeiten",
	},
	einvoice: {
		eyebrow: "E-Rechnung",
		title: "Vorbereitet auf die E-Rechnungspflicht.",
		text: "Swiver erstellt Rechnungen als PDF/A-3 mit eingebetteten Daten nach EN 16931 (ZUGFeRD / Factur-X) und liest eingebettete ZUGFeRD-Daten aus eingehenden Rechnungen aus.",
		timeline: [
			{ date: "1. Januar 2025", text: "Unternehmen in Deutschland müssen E-Rechnungen empfangen können." },
			{ date: "1. Januar 2027", text: "Versandpflicht für Unternehmen mit mehr als 800.000 € Vorjahresumsatz." },
			{ date: "1. Januar 2028", text: "Versandpflicht für alle Unternehmen im inländischen B2B-Geschäft." },
		],
		note: "Diese Übersicht ersetzt keine steuerliche Beratung.",
	},
	features: {
		eyebrow: "Funktionen",
		title: "Alles, was die Finanzverwaltung eines kleinen Unternehmens braucht.",
		lede: "Swiver konzentriert sich auf die tägliche Arbeit mit Geld und Belegen. Jede Funktion gilt für Ihre Organisation und ist mit den anderen verbunden.",
		groups: [
			{
				title: "Verkauf",
				items: [
					{ name: "Kunden", text: "Kontakt-, Steuer- und Bankdaten, offener Saldo je Kunde." },
					{ name: "Produkte und Leistungen", text: "Katalog mit Einheit, Preis und Steuersatz, übernimmt Positionen automatisch." },
					{ name: "Angebote", text: "Versenden, annehmen, ablehnen und in Rechnung oder Lieferschein umwandeln." },
					{ name: "Rechnungen", text: "Festschreiben, per E-Mail versenden, stornieren, Ersatzrechnung erstellen." },
					{ name: "Zahlungserinnerungen", text: "Erinnerung für überfällige Rechnungen, mit Stufe und Text dokumentiert." },
				],
			},
			{
				title: "Einkauf",
				items: [
					{ name: "Lieferanten", text: "Stammdaten, Anzahl und offener Betrag der Rechnungen je Lieferant." },
					{ name: "Eingangsrechnungen", text: "Mit Originalbeleg, Ausgabenkategorie und abgeleitetem Zahlungsstatus." },
					{ name: "Belegeingang", text: "Mehrere Dateien hochladen und später als Rechnung erfassen." },
					{ name: "Wareneingang", text: "Gekaufte Waren vollständig oder je Position einbuchen." },
				],
			},
			{
				title: "Finanzen",
				items: [
					{ name: "Zahlungen", text: "Voll- und Teilzahlungen, offene Beträge werden immer daraus berechnet." },
					{ name: "Kontoauszug-Import", text: "CSV-Import mit Erkennung doppelter Umsätze." },
					{ name: "Bankabgleich", text: "Vorschläge bestätigen, manuell zuordnen oder ignorieren." },
					{ name: "Umsatzsteuer-Übersicht", text: "Geschätzte Umsatz- und Vorsteuer eines Zeitraums." },
					{ name: "Auswertungen", text: "Umsatz, Einkauf und offene Posten nach Fälligkeit, mit Excel-Export." },
				],
			},
			{
				title: "Lager und Team",
				items: [
					{ name: "Lagerbestand", text: "Bewegungen, Mindestbestand, Lieferscheine und Retouren. Der Bestand wird nie negativ." },
					{ name: "Rollen", text: "Inhaber, Admin, Mitglied und Steuerberatung mit klar getrennten Rechten." },
					{ name: "Einladungen", text: "Per E-Mail, mit Ablaufdatum und nur einmal verwendbar." },
					{ name: "Rückfragen", text: "Kommentare an Rechnungen, Belegen und Bankumsätzen." },
					{ name: "Deutsch und Englisch", text: "Oberfläche und Rechnungslayout in beiden Sprachen." },
				],
			},
		],
	},
	taxAdvisors: {
		eyebrow: "Für Steuerkanzleien",
		title: "Ihre Kanzlei arbeitet mit, ohne dass Sie Ordner verschicken.",
		lede: "Laden Sie Ihre Steuerkanzlei mit einer eigenen Rolle ein. Der Zugang ist lesend, in Ihrer Mitgliederliste sichtbar und jederzeit widerrufbar.",
		points: [
			"Lesender Zugriff auf Rechnungen, Belege, Zahlungen und die Umsatzsteuer-Übersicht",
			"Rückfragen direkt an Rechnung, Beleg oder Bankumsatz, mit Benachrichtigung per E-Mail",
			"Mandanten-Cockpit mit allen offenen Punkten, Wechsel zum Mandanten mit einem Klick",
			"Kanzlei-Konto mit Mitarbeitenden und Zuordnung zu Mandanten",
		],
		cta: "Als Kanzlei Kontakt aufnehmen",
		cockpit: {
			title: "Mandanten",
			columns: ["Mandant", "Rückfragen", "Ohne Beleg", "Neue Belege", "Offene Umsätze"],
			rows: [
				{ name: "Hofmann Design GmbH", values: [1, 0, 3, 4] },
				{ name: "Kaiser Studio", values: [0, 2, 1, 0] },
				{ name: "Brandt & Söhne KG", values: [2, 1, 0, 6] },
				{ name: "Lindner Beratung", values: [0, 0, 0, 1] },
			],
			comment: {
				context: "Kaiser Studio · Eingangsrechnung",
				author: "Steuerkanzlei",
				text: "Zu dieser Rechnung fehlt der Beleg. Können Sie ihn im Belegeingang hochladen?",
				status: "Offen",
			},
		},
	},
	security: {
		eyebrow: "Sicherheit und Datenschutz",
		title: "Ihre Finanzdaten bleiben in Deutschland und unter Ihrer Kontrolle.",
		lede: "Swiver läuft auf SAP Business Technology Platform und SAP HANA Cloud in der Region Frankfurt am Main. Die Regeln für Zugriff und Unveränderbarkeit sind im Backend umgesetzt, nicht nur in der Oberfläche.",
		items: [
			{
				title: "Standort Frankfurt am Main",
				text: "Anwendung und Datenbank laufen auf SAP BTP und SAP HANA Cloud in der Region eu22 (Frankfurt, Deutschland).",
			},
			{
				title: "Verschlüsselt",
				text: "Verbindungen sind per TLS verschlüsselt. SAP HANA Cloud speichert die Daten verschlüsselt.",
			},
			{
				title: "Strikte Trennung je Organisation",
				text: "Jeder Lese- und Schreibzugriff ist auf Ihre Organisation beschränkt. Verweise auf fremde Daten werden abgelehnt.",
			},
			{
				title: "Unveränderbare Rechnungen",
				text: "Festgeschriebene Rechnungen sind gesperrt und lückenlos je Jahr nummeriert. Korrekturen laufen über Storno und Ersatzrechnung.",
			},
			{
				title: "Nachvollziehbar",
				text: "Ein Protokoll hält fest, wer wann festgeschrieben, storniert, Zahlungen erfasst oder exportiert hat. Änderungen werden feldgenau gespeichert.",
			},
			{
				title: "Ihre Daten gehören Ihnen",
				text: "Inhaber und Admins exportieren jederzeit alle Datensätze und Dokumente der Organisation als ZIP-Datei.",
			},
		],
		disclosure:
			"Swiver speichert keine Online-Banking-Zugangsdaten: Kontoauszüge werden als Datei importiert. Swiver ist kein Zahlungsdienst und ersetzt keine Steuerberatung.",
		link: "Datenschutzerklärung lesen",
	},
	pricing: {
		eyebrow: "Preise",
		title: "Ein Tarif. Alle Funktionen.",
		lede: "Keine Funktionspakete und keine Zusatzmodule. Sie zahlen je Organisation.",
		// TODO: placeholder pricing. Confirm price, trial length and terms before going live.
		plan: {
			name: "Swiver",
			price: "24",
			currency: "€",
			period: "pro Monat",
			note: "zzgl. USt., monatlich kündbar",
			cta: "Kostenlos testen",
			trial: "30 Tage kostenlos testen. Keine Zahlungsdaten nötig.",
			includesTitle: "Enthalten",
			includes: [
				"Angebote, Rechnungen und E-Rechnungen",
				"Belegeingang und Eingangsrechnungen",
				"Kontoauszug-Import und Bankabgleich",
				"Dashboard, Auswertungen und Umsatzsteuer-Übersicht",
				"Lagerbestand und Lieferscheine",
				"Teammitglieder und Zugang für die Steuerkanzlei",
				"Vollständiger Datenexport",
			],
		},
		asides: [
			{
				title: "Steuerkanzlei inklusive",
				text: "Der Zugang für Ihre Steuerkanzlei ist im Tarif enthalten und kostet nichts extra.",
			},
			{
				title: "Für Kanzleien",
				text: "Sie betreuen viele Mandanten mit Swiver? Sprechen Sie uns an.",
				link: "Kontakt aufnehmen",
			},
		],
	},
	faq: {
		eyebrow: "Häufige Fragen",
		title: "Klare Antworten, auch auf unbequeme Fragen.",
		items: [
			{
				q: "Ist Swiver eine Buchhaltungssoftware?",
				a: "Swiver deckt die Finanzverwaltung vor der Buchhaltung ab: Rechnungen, Belege, Zahlungen, Bankabgleich und Auswertungen. Finanzbuchhaltung und Jahresabschluss erstellt weiterhin Ihre Steuerkanzlei. Dafür erhält sie einen eigenen Zugang und Exporte.",
			},
			{
				q: "Ist Swiver GoBD-zertifiziert?",
				a: "Nein. Die GoBD betreffen Ihre gesamte Buchführung einschließlich Verfahrensdokumentation, eine Software allein kann sie nicht erfüllen. Swiver unterstützt Sie mit unveränderbaren, lückenlos nummerierten Rechnungen, Storno statt Löschen, einem Protokoll geschäftskritischer Aktionen und einer feldgenauen Änderungshistorie. Ein Testat liegt derzeit nicht vor.",
			},
			{
				q: "Welche E-Rechnungsformate unterstützt Swiver?",
				a: "Swiver erstellt Rechnungen im ZUGFeRD-Format (Factur-X, PDF/A-3 mit Daten nach EN 16931) und liest eingebettete ZUGFeRD-Daten aus eingehenden Rechnungen aus. Das reine XRechnung-Format wird derzeit nicht unterstützt.",
			},
			{
				q: "Exportiert Swiver im DATEV-Format?",
				a: "Noch nicht. Der Export für die Steuerkanzlei enthält je Zeitraum die Rechnungs-PDFs, die Eingangsbelege und CSV-Listen.",
			},
			{
				q: "Ist mein Bankkonto direkt angebunden?",
				a: "Nein. Sie importieren Kontoauszüge als CSV-Datei, Swiver erkennt doppelte Umsätze und schlägt passende Rechnungen vor. Eine direkte Bankanbindung gibt es derzeit nicht.",
			},
			{
				q: "Wo werden meine Daten gespeichert?",
				a: "In der Region Frankfurt am Main auf SAP BTP und SAP HANA Cloud. E-Mails wie Rechnungsversand und Einladungen werden über Microsoft 365 in der EU versendet.",
			},
			{
				q: "Was passiert mit meinen Daten, wenn ich kündige?",
				a: "Sie laden vorher einen vollständigen Export aller Datensätze und Dokumente herunter. 30 Tage nach Vertragsende wird Ihre Organisation mit allen Daten gelöscht. Ihre gesetzlichen Aufbewahrungspflichten erfüllen Sie mit dem Export.",
			},
		],
	},
	finalCta: {
		title: "Bringen Sie Ordnung in Ihre Finanzen.",
		text: "Organisation anlegen, Firmendaten hinterlegen, erste Rechnung schreiben.",
		primary: "Kostenlos testen",
		secondary: "Kontakt aufnehmen",
	},
	footer: {
		tagline: "Finanzverwaltung für Selbstständige und kleine Unternehmen.",
		hosting: "Gehostet in Frankfurt am Main",
		columns: [
			{
				title: "Produkt",
				links: [
					{ label: "Funktionen", href: "/#funktionen" },
					{ label: "E-Rechnung", href: "/#e-rechnung" },
					{ label: "Sicherheit", href: "/#sicherheit" },
					{ label: "Preise", href: "/#preise" },
				],
			},
			{
				title: "Ressourcen",
				links: [
					{ label: "Für Steuerkanzleien", href: "/#steuerkanzleien" },
					{ label: "Häufige Fragen", href: "/#fragen" },
					{ label: "Status", href: "status" },
				],
			},
			{
				title: "Unternehmen",
				links: [
					{ label: "Kontakt", href: "contact" },
					{ label: "Support", href: "support" },
				],
			},
			{
				title: "Rechtliches",
				links: [
					{ label: "Impressum", href: "/impressum" },
					{ label: "Datenschutz", href: "/datenschutz" },
					{ label: "AGB", href: "/agb" },
				],
			},
		],
		rights: "Alle Rechte vorbehalten.",
	},
	legal: {
		placeholder: "Dieser Inhalt wird vor dem Start veröffentlicht.",
		back: "Zur Startseite",
		pages: {
			impressum: { title: "Impressum" },
			datenschutz: { title: "Datenschutzerklärung" },
			agb: { title: "Allgemeine Geschäftsbedingungen" },
		},
	},
	notFound: {
		title: "Seite nicht gefunden",
		text: "Die angeforderte Seite existiert nicht oder wurde verschoben.",
		back: "Zur Startseite",
	},
};

export type Content = typeof de;
