using {swiver} from './schema';
using from './sales';
using from './finance';
using from './settings';

// Field-level history (@cap-js/change-tracking, database triggers) for financial records: who changed
// which field when. Complements the business audit log (AuditLogEntries) of actions such as finalize or
// payments. Not tracked: documents and logo (binary), payment totals derived from payments
// (paidAmount, paymentDate), timestamps and draft data.

annotate swiver.CompanySettings with @changelog: [companyName] {
  companyName            @changelog;
  ownerName              @changelog;
  street                 @changelog;
  postalCode             @changelog;
  city                   @changelog;
  country                @changelog;
  email                  @changelog;
  website                @changelog;
  taxNumber              @changelog;
  vatId                  @changelog;
  iban                   @changelog;
  bic                    @changelog;
  bankName               @changelog;
  managingDirectors      @changelog;
  registerCourt          @changelog;
  registerNumber         @changelog;
  defaultCurrency        @changelog;
  defaultTaxRate         @changelog;
  defaultPaymentTermDays @changelog;
  invoicePrefix          @changelog;
};

annotate swiver.SalesInvoices with @changelog: [invoiceNumber] {
  status        @changelog;
  customer      @changelog: [customer.customerNumber];
  invoiceDate   @changelog;
  dueDate       @changelog;
  currency      @changelog;
  netAmount     @changelog;
  taxAmount     @changelog;
  grossAmount   @changelog;
  paymentStatus @changelog;
};

annotate swiver.SupplierInvoices with @changelog: [invoiceNumber] {
  supplier        @changelog: [supplier.name];
  invoiceNumber   @changelog;
  invoiceDate     @changelog;
  dueDate         @changelog;
  currency        @changelog;
  netAmount       @changelog;
  taxAmount       @changelog;
  expenseCategory @changelog: [expenseCategory.name];
  paymentStatus   @changelog;
};

annotate swiver.Payments with @changelog: [reference] {
  amount          @changelog;
  paymentDate     @changelog;
  source          @changelog;
  salesInvoice    @changelog: [salesInvoice.invoiceNumber];
  supplierInvoice @changelog: [supplierInvoice.invoiceNumber];
};

annotate swiver.BankTransactions with @changelog: [reference] {
  matchStatus @changelog;
  payment     @changelog: [payment.reference];
};
