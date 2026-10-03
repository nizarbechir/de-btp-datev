using FinanceService from './finance-service';

/**
 * Business rules and labels of the FinanceService, independent of any UI.
 */
annotate FinanceService.Suppliers with @(
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
  address        @title: '{i18n>Address}';
  city           @title: '{i18n>City}';
  postalCode     @title: '{i18n>PostalCode}';
  country        @title: '{i18n>Country}';
  iban           @title: '{i18n>IBAN}';
  notes          @title: '{i18n>Notes}'  @UI.MultiLineText;
  active         @title: '{i18n>Active}';
};

annotate FinanceService.SupplierBalances with {
  invoiceCount @title: '{i18n>InvoiceCount}';
  openAmount   @title: '{i18n>OpenAmount}'  @Measures.ISOCurrency: currency_code;
};

annotate FinanceService.SupplierInvoices with @(
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
};

annotate FinanceService.SupplierInvoices actions {
  markInvoicePaid @title: '{i18n>MarkPaid}';
  markInvoiceOpen @title: '{i18n>MarkOpen}';
};

annotate FinanceService.PaymentStatuses with {
  code @title: '{i18n>PaymentStatus}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

annotate FinanceService.Customers with @(
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
  notes          @title: '{i18n>Notes}'           @UI.MultiLineText;
  active         @title: '{i18n>Active}';
};

annotate FinanceService.CustomerBalances with {
  invoiceCount  @title: '{i18n>InvoiceCount}';
  totalInvoiced @title: '{i18n>TotalInvoiced}'  @Measures.ISOCurrency: currency_code;
  outstanding   @title: '{i18n>Outstanding}'    @Measures.ISOCurrency: currency_code;
  overdue       @title: '{i18n>Overdue}'        @Measures.ISOCurrency: currency_code;
};

annotate FinanceService.SalesInvoices with @(
  title                          : '{i18n>SalesInvoice}',
  // Saved invoices keep their number: they are cancelled instead of deleted.
  Capabilities.DeleteRestrictions: {Deletable: false},
  // Paid and cancelled invoices must be reopened before they can be changed.
  Capabilities.UpdateRestrictions: {Updatable: isEditable},
  UI.UpdateHidden                : isClosed,
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
  introductionText         @title: '{i18n>IntroductionText}'  @UI.MultiLineText;
  footerText               @title: '{i18n>FooterText}'        @UI.MultiLineText;
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
  isClosed                 @UI.Hidden;
};

annotate FinanceService.SalesInvoices actions {
  markAsSent     @title: '{i18n>MarkAsSent}';
  markAsPaid     @title: '{i18n>MarkPaid}';
  cancelInvoice  @title: '{i18n>CancelInvoice}';
  reopen         @title: '{i18n>Reopen}';
  duplicate      @title: '{i18n>Duplicate}';
  createCustomer @title: '{i18n>NewCustomer}'  (
    companyName @title: '{i18n>CompanyName}',
    name        @title: '{i18n>ContactName}',
    email       @title: '{i18n>Email}',
    street      @title: '{i18n>Address}',
    postalCode  @title: '{i18n>PostalCode}',
    city        @title: '{i18n>City}',
    country     @title: '{i18n>Country}'
  );
  pdf            @title: '{i18n>DownloadPdf}';
};

annotate FinanceService.SalesInvoiceItems with @Capabilities.SearchRestrictions.Searchable: false {
  ID          @UI.Hidden;
  invoice     @UI.Hidden;
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

annotate FinanceService.SalesInvoiceTaxes with @readonly {
  ID        @UI.Hidden;
  invoice   @UI.Hidden;
  taxRate   @title: '{i18n>VatRate}'    @Measures.Unit: '%';
  netAmount @title: '{i18n>NetAmount}'  @Measures.ISOCurrency: invoice.currency_code;
  taxAmount @title: '{i18n>VatAmount}'  @Measures.ISOCurrency: invoice.currency_code;
};

annotate FinanceService.SalesInvoiceStatuses with {
  code @title: '{i18n>Status}'  @Common.Text: name  @Common.TextArrangement: #TextOnly;
};

annotate FinanceService.Units with {
  code @title: '{i18n>Unit}';
};

annotate FinanceService.CompanySettings with @(title: '{i18n>CompanySettings}') {
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
  defaultCurrency        @title: '{i18n>DefaultCurrency}';
  defaultTaxRate         @title: '{i18n>DefaultVatRate}'          @Measures.Unit: '%';
  defaultPaymentTermDays @title: '{i18n>DefaultPaymentTermDays}';
  invoicePrefix          @title: '{i18n>InvoicePrefix}';
  logo                   @title: '{i18n>Logo}';
  logoMediaType          @UI.Hidden;
};
