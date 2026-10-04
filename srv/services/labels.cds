using {swiver} from '../../db/schema';
using from '../../db/sales';
using from '../../db/settings';
using from '../../db/finance';
using from '../../db/organizations';
using from '../../db/collaboration';
using from '../../db/support';

/**
 * Business rules and labels of the domain model, independent of any UI and inherited by all services.
 */
annotate swiver.Suppliers with @(
  title                          : '{i18n>Supplier}',
  // Suppliers are deactivated, not deleted, so their invoice history stays intact.
  Capabilities.DeleteRestrictions: {Deletable: false},
  cds.search                     : {
    name,
    supplierNumber,
    taxNumber,
    email,
    city
  }
) {
  ID             @UI.Hidden;
  name           @title: '{i18n>SupplierName}';
  supplierNumber @title: '{i18n>SupplierNumber}';
  taxNumber      @title: '{i18n>TaxNumber}';
  email          @title: '{i18n>Email}'  @Communication.IsEmailAddress;
  phone          @title: '{i18n>Phone}'  @Communication.IsPhoneNumber;
  vatId          @title: '{i18n>VatId}';
  organization   @UI.Hidden;
  address        @title: '{i18n>Address}';
  city           @title: '{i18n>City}';
  postalCode     @title: '{i18n>PostalCode}';
  country        @title: '{i18n>Country}';
  iban           @title: '{i18n>IBAN}';
  notes          @title: '{i18n>Notes}'  @UI.MultiLineText;
  active         @title: '{i18n>Active}';
};

annotate swiver.SupplierBalances with {
  invoiceCount @title: '{i18n>InvoiceCount}';
  openAmount   @title: '{i18n>OpenAmount}'  @Measures.ISOCurrency: currency_code;
};

annotate swiver.SupplierInvoices with @(
  title     : '{i18n>SupplierInvoice}',
  cds.search: {
    invoiceNumber,
    notes,
    supplier
  }
) {
  ID                @UI.Hidden;
  supplier          @title: '{i18n>Supplier}';
  invoiceNumber     @title: '{i18n>InvoiceNumber}';
  invoiceDate       @title: '{i18n>InvoiceDate}';
  dueDate           @title: '{i18n>DueDate}';
  currency          @title: '{i18n>Currency}';
  netAmount         @title: '{i18n>NetAmount}'      @Measures.ISOCurrency: currency_code;
  taxAmount         @title: '{i18n>TaxAmount}'      @Measures.ISOCurrency: currency_code;
  grossAmount       @title: '{i18n>GrossAmount}'    @Measures.ISOCurrency: currency_code;
  notes             @title: '{i18n>Notes}'          @UI.MultiLineText;
  // Payment fields are only changed through the Mark as Paid / Mark as Open actions.
  paymentStatus     @title: '{i18n>PaymentStatus}'  @readonly;
  paymentDate       @title: '{i18n>PaymentDate}'    @readonly;
  status            @title: '{i18n>Status}';
  statusCriticality @UI.Hidden;
  documentContent   @title: '{i18n>InvoiceDocument}';
  documentMediaType @UI.Hidden;
  documentFileName  @title: '{i18n>FileName}';
  expenseCategory   @title: '{i18n>ExpenseCategory}'  @Common.Text: expenseCategory.name  @Common.TextArrangement: #TextOnly;
  paidAmount        @title: '{i18n>PaidAmount}'       @readonly  @Measures.ISOCurrency: currency_code;
  outstandingAmount @title: '{i18n>OutstandingAmount}' @Measures.ISOCurrency: currency_code;
  isOverdue         @title: '{i18n>Overdue}';
  isDueSoon         @title: '{i18n>DueSoon}';
  hasDocument       @title: '{i18n>HasDocument}';
  isCategorized     @title: '{i18n>Categorized}';
  incomingDocument  @UI.Hidden;
  organization      @UI.Hidden;
};

annotate swiver.PaymentStatuses with {
  code @title: '{i18n>PaymentStatus}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

annotate swiver.Customers with @(
  title                          : '{i18n>Customer}',
  // Customers are deactivated, not deleted, so their invoice history stays intact.
  Capabilities.DeleteRestrictions: {Deletable: false},
  cds.search                     : {
    companyName,
    name,
    customerNumber,
    email,
    city
  }
) {
  ID             @UI.Hidden  @Common.Text: displayName  @Common.TextArrangement: #TextOnly;
  customerNumber @title: '{i18n>CustomerNumber}'  @readonly;
  companyName    @title: '{i18n>CompanyName}';
  name           @title: '{i18n>ContactName}';
  displayName    @title: '{i18n>Customer}';
  email          @title: '{i18n>Email}'           @Communication.IsEmailAddress;
  phone          @title: '{i18n>Phone}'           @Communication.IsPhoneNumber;
  street         @title: '{i18n>Address}';
  postalCode     @title: '{i18n>PostalCode}';
  city           @title: '{i18n>City}';
  country        @title: '{i18n>Country}';
  taxNumber      @title: '{i18n>TaxNumber}';
  vatId          @title: '{i18n>VatId}';
  iban           @title: '{i18n>IBAN}';
  notes          @title: '{i18n>Notes}'           @UI.MultiLineText;
  active         @title: '{i18n>Active}';
  organization   @UI.Hidden;
};

annotate swiver.CustomerBalances with {
  invoiceCount  @title: '{i18n>InvoiceCount}';
  totalInvoiced @title: '{i18n>TotalInvoiced}'  @Measures.ISOCurrency: currency_code;
  outstanding   @title: '{i18n>Outstanding}'    @Measures.ISOCurrency: currency_code;
  overdue       @title: '{i18n>Overdue}'        @Measures.ISOCurrency: currency_code;
};

annotate swiver.SalesInvoices with @(
  title                          : '{i18n>SalesInvoice}',
  // Saved invoices keep their number: they are cancelled instead of deleted.
  Capabilities.DeleteRestrictions: {Deletable: false},
  // Only drafts can be changed; issued invoices are cancelled and corrected instead.
  Capabilities.UpdateRestrictions: {Updatable: isEditable},
  UI.UpdateHidden                : isLocked,
  cds.search                     : {
    invoiceNumber,
    subject,
    customer
  }
) {
  ID                       @UI.Hidden;
  invoiceNumber            @title: '{i18n>InvoiceNumber}'     @readonly;
  customer                 @title: '{i18n>Customer}';
  invoiceDate              @title: '{i18n>InvoiceDate}';
  dueDate                  @title: '{i18n>DueDate}';
  currency                 @title: '{i18n>Currency}';
  // Status and payment date only change through the actions.
  status                   @title: '{i18n>Status}'            @readonly;
  subject                  @title: '{i18n>Subject}';
  servicePeriodStart       @title: '{i18n>ServicePeriodStart}';
  servicePeriodEnd         @title: '{i18n>ServicePeriodEnd}';
  introductionText         @title: '{i18n>IntroductionText}'  @UI.MultiLineText;
  footerText               @title: '{i18n>FooterText}'        @UI.MultiLineText;
  customerEmail            @UI.Hidden;
  emailSubject             @UI.Hidden;
  // Amounts are calculated by the backend from the items.
  netAmount                @title: '{i18n>NetAmount}'         @readonly  @Measures.ISOCurrency: currency_code;
  taxAmount                @title: '{i18n>VatAmount}'         @readonly  @Measures.ISOCurrency: currency_code;
  grossAmount              @title: '{i18n>Total}'             @readonly  @Measures.ISOCurrency: currency_code;
  paymentDate              @title: '{i18n>PaymentDate}'       @readonly;
  notes                    @title: '{i18n>InternalNotes}'     @UI.MultiLineText;
  isOverdue                @title: '{i18n>Overdue}';
  displayStatus            @title: '{i18n>Status}';
  displayStatusCriticality @UI.Hidden;
  isEditable               @UI.Hidden;
  isLocked                 @UI.Hidden;
  isClosed                 @UI.Hidden;
  isIssued                 @UI.Hidden;
  paymentStatus            @title: '{i18n>PaymentStatus}'     @readonly;
  paidAmount               @title: '{i18n>PaidAmount}'        @readonly  @Measures.ISOCurrency: currency_code;
  outstandingAmount        @title: '{i18n>OutstandingAmount}' @Measures.ISOCurrency: currency_code;
  replacesInvoice          @title: '{i18n>ReplacesInvoice}'   @readonly  @Common.Text: replacesInvoice.invoiceNumber;
  quote                    @title: '{i18n>Quote}'             @readonly  @Common.Text: quote.quoteNumber;
  sentAt                   @title: '{i18n>SentAt}'            @readonly;
  sentTo                   @title: '{i18n>SentTo}'            @readonly;
  emailMessageId           @UI.Hidden;
  organization             @UI.Hidden;
};

annotate swiver.SalesInvoiceItems with @Capabilities.SearchRestrictions.Searchable: false {
  ID             @UI.Hidden;
  invoice        @UI.Hidden;
  productService @title: '{i18n>ProductService}';
  position    @title: '{i18n>Position}'     @readonly;
  description @title: '{i18n>Description}';
  quantity    @title: '{i18n>Quantity}';
  unit        @title: '{i18n>Unit}';
  unitPrice   @title: '{i18n>UnitPrice}';
  taxRate     @title: '{i18n>VatRatePercent}';
  netAmount   @title: '{i18n>NetAmount}'    @readonly  @Measures.ISOCurrency: invoice.currency_code;
  taxAmount   @title: '{i18n>VatAmount}'    @readonly  @Measures.ISOCurrency: invoice.currency_code;
  grossAmount @title: '{i18n>Total}'        @readonly  @Measures.ISOCurrency: invoice.currency_code;
};

annotate swiver.SalesInvoiceTaxes with @readonly {
  ID        @UI.Hidden;
  invoice   @UI.Hidden;
  taxRate   @title: '{i18n>VatRate}'    @Measures.Unit: '%';
  netAmount @title: '{i18n>NetAmount}'  @Measures.ISOCurrency: invoice.currency_code;
  taxAmount @title: '{i18n>VatAmount}'  @Measures.ISOCurrency: invoice.currency_code;
};

annotate swiver.SalesInvoiceStatuses with {
  code @title: '{i18n>Status}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};

annotate swiver.Units with {
  code @title: '{i18n>Unit}';
};

annotate swiver.CompanySettings with @(title: '{i18n>CompanySettings}') {
  ID                     @UI.Hidden;
  companyName            @title: '{i18n>CompanyName}';
  ownerName              @title: '{i18n>OwnerName}';
  street                 @title: '{i18n>Address}';
  postalCode             @title: '{i18n>PostalCode}';
  city                   @title: '{i18n>City}';
  country                @title: '{i18n>Country}';
  email                  @title: '{i18n>Email}'                   @Communication.IsEmailAddress;
  phone                  @title: '{i18n>Phone}'                   @Communication.IsPhoneNumber;
  website                @title: '{i18n>Website}';
  taxNumber              @title: '{i18n>TaxNumber}';
  vatId                  @title: '{i18n>VatId}';
  iban                   @title: '{i18n>IBAN}';
  bic                    @title: '{i18n>BIC}';
  bankName               @title: '{i18n>BankName}';
  managingDirectors      @title: '{i18n>ManagingDirectors}';
  registerCourt          @title: '{i18n>RegisterCourt}';
  registerNumber         @title: '{i18n>RegisterNumber}';
  documentLanguage       @title: '{i18n>DocumentLanguage}';
  defaultCurrency        @title: '{i18n>DefaultCurrency}';
  defaultTaxRate         @title: '{i18n>DefaultVatRate}'          @Measures.Unit: '%';
  defaultPaymentTermDays @title: '{i18n>DefaultPaymentTermDays}';
  invoicePrefix          @title: '{i18n>InvoicePrefix}';
  quotePrefix            @title: '{i18n>QuotePrefix}';
  organization           @UI.Hidden;
  logo                   @title: '{i18n>Logo}';
  logoMediaType          @UI.Hidden;
};

annotate swiver.CustomerBalances with {
  organization_ID @UI.Hidden;
};

annotate swiver.SupplierBalances with {
  organization_ID @UI.Hidden;
};

// ---------------------------------------------------------------------------
// Products, quotes
// ---------------------------------------------------------------------------

annotate swiver.ProductServices with @(
  title     : '{i18n>ProductService}',
  cds.search: {
    code,
    name,
    description
  }
) {
  ID             @UI.Hidden  @Common.Text: name  @Common.TextArrangement: #TextOnly;
  code           @title: '{i18n>Code}';
  name           @title: '{i18n>Name}';
  description    @title: '{i18n>Description}'  @UI.MultiLineText;
  unit           @title: '{i18n>Unit}';
  defaultPrice   @title: '{i18n>UnitPrice}';
  defaultTaxRate @title: '{i18n>VatRatePercent}';
  active         @title: '{i18n>Active}';
  organization   @UI.Hidden;
};

annotate swiver.Quotes with @(
  title                          : '{i18n>Quote}',
  Capabilities.DeleteRestrictions: {Deletable: false},
  Capabilities.UpdateRestrictions: {Updatable: isEditable},
  cds.search                     : {
    quoteNumber,
    subject,
    customer
  }
) {
  ID                       @UI.Hidden  @Common.Text: quoteNumber;
  quoteNumber              @title: '{i18n>QuoteNumber}'       @readonly;
  customer                 @title: '{i18n>Customer}';
  quoteDate                @title: '{i18n>QuoteDate}';
  validUntil               @title: '{i18n>ValidUntil}';
  currency                 @title: '{i18n>Currency}';
  status                   @title: '{i18n>Status}'            @readonly;
  subject                  @title: '{i18n>Subject}';
  introductionText         @title: '{i18n>IntroductionText}'  @UI.MultiLineText;
  footerText               @title: '{i18n>FooterText}'        @UI.MultiLineText;
  netAmount                @title: '{i18n>NetAmount}'         @readonly  @Measures.ISOCurrency: currency_code;
  taxAmount                @title: '{i18n>VatAmount}'         @readonly  @Measures.ISOCurrency: currency_code;
  grossAmount              @title: '{i18n>Total}'             @readonly  @Measures.ISOCurrency: currency_code;
  convertedInvoice         @title: '{i18n>ConvertedInvoice}'  @readonly  @Common.Text: convertedInvoice.invoiceNumber;
  customerEmail            @UI.Hidden;
  emailSubject             @UI.Hidden;
  sentAt                   @title: '{i18n>SentAt}'            @readonly;
  sentTo                   @title: '{i18n>SentTo}'            @readonly;
  notes                    @title: '{i18n>InternalNotes}'     @UI.MultiLineText;
  isExpired                @title: '{i18n>Expired}';
  displayStatus            @title: '{i18n>Status}';
  displayStatusCriticality @UI.Hidden;
  isEditable               @UI.Hidden;
  organization             @UI.Hidden;
};

annotate swiver.QuoteItems with @Capabilities.SearchRestrictions.Searchable: false {
  ID             @UI.Hidden;
  quote          @UI.Hidden;
  productService @title: '{i18n>ProductService}';
  position       @title: '{i18n>Position}'     @readonly;
  description    @title: '{i18n>Description}';
  quantity       @title: '{i18n>Quantity}';
  unit           @title: '{i18n>Unit}';
  unitPrice      @title: '{i18n>UnitPrice}';
  taxRate        @title: '{i18n>VatRatePercent}';
  netAmount      @title: '{i18n>NetAmount}'    @readonly  @Measures.ISOCurrency: quote.currency_code;
  taxAmount      @title: '{i18n>VatAmount}'    @readonly  @Measures.ISOCurrency: quote.currency_code;
  grossAmount    @title: '{i18n>Total}'        @readonly  @Measures.ISOCurrency: quote.currency_code;
};

annotate swiver.QuoteStatuses with {
  code @title: '{i18n>Status}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};

// ---------------------------------------------------------------------------
// Purchases: expense categories, inbox
// ---------------------------------------------------------------------------

annotate swiver.ExpenseCategories with @(title: '{i18n>ExpenseCategory}') {
  ID           @UI.Hidden  @Common.Text: name  @Common.TextArrangement: #TextOnly;
  name         @title: '{i18n>Name}';
  active       @title: '{i18n>Active}';
  organization @UI.Hidden;
};

annotate swiver.IncomingDocuments with @(
  title                          : '{i18n>IncomingDocument}',
  Capabilities.DeleteRestrictions: {Deletable: false},
  cds.search                     : {
    originalFileName,
    notes,
    extractedSupplierName,
    extractedInvoiceNumber
  }
) {
  ID                     @UI.Hidden;
  originalFileName       @title: '{i18n>FileName}';
  content                @title: '{i18n>Document}';
  mediaType              @UI.Hidden;
  uploadedAt             @title: '{i18n>UploadedAt}'        @readonly;
  source                 @title: '{i18n>Source}'            @readonly;
  processingStatus       @title: '{i18n>Status}'            @readonly;
  detectedDocumentType   @title: '{i18n>DocumentType}'      @readonly;
  linkedSupplierInvoice  @title: '{i18n>SupplierInvoice}'   @readonly  @Common.Text: linkedSupplierInvoice.invoiceNumber;
  notes                  @title: '{i18n>Notes}'             @UI.MultiLineText;
  extractedSupplier      @title: '{i18n>Supplier}'          @readonly  @Common.Text: extractedSupplier.name  @Common.TextArrangement: #TextOnly;
  extractedSupplierName  @title: '{i18n>SupplierName}'      @readonly;
  extractedVatId         @title: '{i18n>VatId}'             @readonly;
  extractedIBAN          @title: '{i18n>IBAN}'              @readonly;
  extractedInvoiceNumber @title: '{i18n>InvoiceNumber}'     @readonly;
  extractedInvoiceDate   @title: '{i18n>InvoiceDate}'       @readonly;
  extractedDueDate       @title: '{i18n>DueDate}'           @readonly;
  extractedCurrency      @title: '{i18n>Currency}'          @readonly;
  extractedNetAmount     @title: '{i18n>NetAmount}'         @readonly  @Measures.ISOCurrency: extractedCurrency_code;
  extractedTaxAmount     @title: '{i18n>TaxAmount}'         @readonly  @Measures.ISOCurrency: extractedCurrency_code;
  extractedGrossAmount   @title: '{i18n>GrossAmount}'       @readonly  @Measures.ISOCurrency: extractedCurrency_code;
  processingMessage      @title: '{i18n>ProcessingMessage}' @readonly;
  statusCriticality      @UI.Hidden;
  organization           @UI.Hidden;
};

annotate swiver.IncomingDocumentStatuses with {
  code @title: '{i18n>Status}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};

// ---------------------------------------------------------------------------
// Finance: payments, bank, reminders
// ---------------------------------------------------------------------------

annotate swiver.Payments with @(title: '{i18n>Payment}') {
  ID              @UI.Hidden;
  direction       @title: '{i18n>Direction}';
  amount          @title: '{i18n>Amount}'           @Measures.ISOCurrency: currency_code;
  currency        @title: '{i18n>Currency}';
  paymentDate     @title: '{i18n>PaymentDate}';
  reference       @title: '{i18n>Reference}';
  source          @title: '{i18n>Source}';
  salesInvoice    @title: '{i18n>SalesInvoice}'     @Common.Text: salesInvoice.invoiceNumber;
  supplierInvoice @title: '{i18n>SupplierInvoice}'  @Common.Text: supplierInvoice.invoiceNumber;
  bankTransaction @title: '{i18n>BankTransaction}'  @UI.Hidden;
  organization    @UI.Hidden;
};

annotate swiver.BankImportBatches with @(title: '{i18n>BankImport}') {
  ID             @UI.Hidden;
  fileName       @title: '{i18n>FileName}';
  adapter        @title: '{i18n>Format}';
  importedCount  @title: '{i18n>ImportedCount}';
  duplicateCount @title: '{i18n>DuplicateCount}';
  organization   @UI.Hidden;
};

annotate swiver.BankTransactions with @(
  title                          : '{i18n>BankTransaction}',
  Capabilities.InsertRestrictions: {Insertable: false},
  Capabilities.UpdateRestrictions: {Updatable: false},
  Capabilities.DeleteRestrictions: {Deletable: false},
  cds.search                     : {
    counterpartyName,
    reference,
    counterpartyIBAN
  }
) {
  ID                       @UI.Hidden;
  bookingDate              @title: '{i18n>BookingDate}';
  valueDate                @title: '{i18n>ValueDate}';
  amount                   @title: '{i18n>Amount}'                   @Measures.ISOCurrency: currency_code;
  currency                 @title: '{i18n>Currency}';
  counterpartyName         @title: '{i18n>Counterparty}';
  counterpartyIBAN         @title: '{i18n>IBAN}';
  reference                @title: '{i18n>Reference}'                @UI.MultiLineText;
  externalReference        @title: '{i18n>ExternalReference}';
  importBatch              @title: '{i18n>BankImport}'               @Common.Text: importBatch.fileName;
  matchStatus              @title: '{i18n>MatchStatus}';
  fingerprint              @UI.Hidden;
  suggestedSalesInvoice    @title: '{i18n>SuggestedSalesInvoice}'    @Common.Text: suggestedSalesInvoice.invoiceNumber  @Common.TextArrangement: #TextOnly;
  suggestedSupplierInvoice @title: '{i18n>SuggestedSupplierInvoice}' @Common.Text: suggestedSupplierInvoice.invoiceNumber  @Common.TextArrangement: #TextOnly;
  suggestionReason         @title: '{i18n>SuggestionReason}';
  payment                  @title: '{i18n>Payment}'                  @UI.Hidden;
  direction                @title: '{i18n>Direction}';
  matchStatusCriticality   @UI.Hidden;
  organization             @UI.Hidden;
};

annotate swiver.BankMatchStatuses with {
  code @title: '{i18n>MatchStatus}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};

annotate swiver.ReminderRecords with @(title: '{i18n>Reminder}') {
  ID           @UI.Hidden;
  invoice      @title: '{i18n>SalesInvoice}';
  sentAt       @title: '{i18n>SentAt}';
  recipient    @title: '{i18n>Recipient}';
  level        @title: '{i18n>ReminderLevel}';
  subject      @title: '{i18n>Subject}';
  message      @title: '{i18n>Message}'  @UI.MultiLineText;
  organization @UI.Hidden;
};

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

annotate swiver.Organizations with @(
  title                          : '{i18n>Organization}',
  Capabilities.DeleteRestrictions: {Deletable: false}
) {
  ID     @UI.Hidden  @Common.Text: name;
  name   @title: '{i18n>Name}';
  slug   @title: '{i18n>Slug}'    @readonly;
  status @title: '{i18n>Status}'  @readonly;
};

annotate swiver.Memberships with @(title: '{i18n>Member}') {
  ID           @UI.Hidden;
  organization @UI.Hidden;
  userId       @title: '{i18n>User}';
  role         @title: '{i18n>Role}';
  createdAt    @title: '{i18n>Joined}';
  lastUsedAt   @UI.Hidden;
};

annotate swiver.Invitations with @(title: '{i18n>Invitation}') {
  ID           @UI.Hidden;
  organization @UI.Hidden;
  email        @title: '{i18n>Email}';
  role         @title: '{i18n>Role}';
  status       @UI.Hidden;
  state        @title: '{i18n>Status}';
  expiresAt    @title: '{i18n>ExpiresAt}';
  invitedBy    @title: '{i18n>InvitedBy}';
  acceptedBy   @title: '{i18n>AcceptedBy}';
  acceptedAt   @title: '{i18n>AcceptedAt}';
};

annotate swiver.AuditLogEntries with @(title: '{i18n>AuditLogEntry}') {
  ID           @UI.Hidden;
  organization @UI.Hidden;
  at           @title: '{i18n>Time}';
  actor        @title: '{i18n>User}';
  action       @title: '{i18n>Action}';
  targetType   @title: '{i18n>Record}';
  targetID     @title: '{i18n>RecordID}';
  details      @title: '{i18n>Details}';
};

// ---------------------------------------------------------------------------
// Comments on sales and supplier invoices, documents and bank transactions
// ---------------------------------------------------------------------------

annotate swiver.FinancialComments with @(title: '{i18n>Comment}') {
  ID               @UI.Hidden;
  organization     @UI.Hidden;
  salesInvoice     @UI.Hidden;
  supplierInvoice  @UI.Hidden;
  incomingDocument @UI.Hidden;
  bankTransaction  @UI.Hidden;
  text             @title: '{i18n>Comment}'  @UI.MultiLineText;
  createdBy        @title: '{i18n>Author}';
  authorRole       @title: '{i18n>Role}';
  createdAt        @title: '{i18n>Date}';
  resolved         @title: '{i18n>Resolved}';
  resolvedAt       @title: '{i18n>ResolvedAt}';
  resolvedBy       @title: '{i18n>ResolvedBy}';
};

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

annotate swiver.SupportTickets with @(
  title     : '{i18n>SupportTicket}',
  cds.search: {
    subject,
    description
  }
) {
  ID           @UI.Hidden;
  ticketNumber @title: '{i18n>TicketNumber}'  @readonly;
  subject      @title: '{i18n>Subject}';
  description  @title: '{i18n>Description}'  @UI.MultiLineText;
  category     @title: '{i18n>Category}'  @Common.Text: category.name  @Common.TextArrangement: #TextOnly  @Common.ValueListWithFixedValues;
  priority     @title: '{i18n>Priority}'  @Common.Text: priority.name  @Common.TextArrangement: #TextOnly  @Common.ValueListWithFixedValues;
  status       @title: '{i18n>Status}'  @Common.Text: status.name  @Common.TextArrangement: #TextOnly  @Common.ValueListWithFixedValues  @readonly;
  creatorEmail @title: '{i18n>Email}'  @readonly;
  resolvedAt   @title: '{i18n>ResolvedAt}'  @readonly;
  modifiedAt   @title: '{i18n>UpdatedAt}';
  organization @UI.Hidden;
};

annotate swiver.SupportMessages with {
  ID          @UI.Hidden;
  ticket      @UI.Hidden;
  message     @title: '{i18n>Message}'  @UI.MultiLineText;
  fromSupport @title: '{i18n>FromSupport}';
  createdAt   @title: '{i18n>Date}';
  createdBy   @title: '{i18n>Author}';
};

annotate swiver.SupportAttachments with {
  ID       @UI.Hidden;
  ticket   @UI.Hidden;
  fileName @title: '{i18n>FileName}';
  mimeType @UI.Hidden;
  content  @title: '{i18n>Attachment}';
};

annotate swiver.SupportCategories with {
  code @title: '{i18n>Category}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};

annotate swiver.SupportPriorities with {
  code @title: '{i18n>Priority}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};

annotate swiver.SupportStatuses with {
  code @title: '{i18n>Status}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};
