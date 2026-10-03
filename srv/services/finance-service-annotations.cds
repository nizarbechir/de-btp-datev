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
