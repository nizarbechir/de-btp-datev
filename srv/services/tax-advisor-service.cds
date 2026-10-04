using {swiver as my} from '../../db/schema';
using from '../../db/sales';
using from '../../db/finance';
using from '../../db/collaboration';
using {FinanceService} from './finance-service';

/**
 * The tax advisor's workspace: everything needed for the bookkeeping of a period, read-only, with
 * what is missing or unclear. Open to tax advisors and to owners and admins.
 * TODO(feature): dedicated Steuerberater client cockpit across organizations
 */
@readonly
service TaxAdvisorService @(path: '/odata/v4/tax-advisor') {
  /** Comments and questions on financial records, with the record they belong to. */
  entity Questions        as
    projection on my.FinancialComments {
      ID,
      organization.ID as organization_ID : UUID,
      salesInvoice,
      supplierInvoice,
      incomingDocument,
      bankTransaction,
      text,
      authorRole,
      resolved,
      resolvedAt,
      resolvedBy,
      resolvedCriticality,
      createdAt,
      createdBy,
      case
        when salesInvoice.ID is not null
             then 'Sales invoice'
        when supplierInvoice.ID is not null
             then 'Supplier invoice'
        when incomingDocument.ID is not null
             then 'Receipt'
        else 'Bank transaction'
      end as recordType : String(30),
      coalesce(
        salesInvoice.invoiceNumber, supplierInvoice.invoiceNumber, incomingDocument.originalFileName, bankTransaction.counterpartyName
      )   as record     : String(255)
    };

  entity SupplierInvoices as
    projection on my.SupplierInvoices {
      ID,
      organization.ID as organization_ID : UUID,
      invoiceNumber,
      supplier,
      supplier.name     as supplierName,
      supplier.vatId    as supplierVatId,
      expenseCategory,
      invoiceDate,
      dueDate,
      currency,
      netAmount,
      taxAmount,
      grossAmount,
      paidAmount,
      outstandingAmount,
      paymentStatus,
      paymentDate,
      isOverdue,
      status,
      statusCriticality,
      notes,
      documentContent,
      documentMediaType,
      documentFileName,
      case
        when documentFileName is null
             then true
        else false
      end               as missingDocument : Boolean,
      case
        when expenseCategory.ID is null
             then true
        else false
      end               as uncategorized   : Boolean
    };

  /** Issued sales invoices; drafts are not part of the bookkeeping. */
  entity SalesInvoices    as
    projection on my.SalesInvoices {
      ID,
      organization.ID as organization_ID : UUID,
      invoiceNumber,
      customer,
      customer.displayName as customerName,
      customer.vatId       as customerVatId,
      invoiceDate,
      dueDate,
      servicePeriodStart,
      servicePeriodEnd,
      currency,
      netAmount,
      taxAmount,
      grossAmount,
      paidAmount,
      outstandingAmount,
      status,
      paymentStatus,
      paymentDate,
      isOverdue,
      subject
    }
    where
      status.code != 'DRAFT';

  /** Uploaded receipts and supplier documents (the purchase inbox). */
  entity Receipts         as
    projection on my.IncomingDocuments {
      ID,
      organization.ID as organization_ID : UUID,
      originalFileName,
      content,
      mediaType,
      uploadedAt,
      source,
      processingStatus,
      statusCriticality,
      detectedDocumentType,
      extractedSupplierName,
      extractedInvoiceNumber,
      extractedInvoiceDate,
      extractedGrossAmount,
      extractedCurrency,
      linkedSupplierInvoice,
      linkedSupplierInvoice.invoiceNumber as linkedInvoiceNumber,
      notes
    };

  entity BankTransactions as
    projection on my.BankTransactions {
      ID,
      organization.ID as organization_ID : UUID,
      bookingDate,
      valueDate,
      amount,
      currency,
      direction,
      counterpartyName,
      counterpartyIBAN,
      reference,
      matchStatus,
      matchStatusCriticality,
      payment.salesInvoice.invoiceNumber    as salesInvoiceNumber,
      payment.supplierInvoice.invoiceNumber as supplierInvoiceNumber
    };

  entity Payments         as
    projection on my.Payments {
      ID,
      organization.ID as organization_ID : UUID,
      paymentDate,
      direction,
      amount,
      currency,
      reference,
      source,
      salesInvoice,
      salesInvoice.invoiceNumber           as salesInvoiceNumber,
      salesInvoice.customer.displayName    as customerName,
      supplierInvoice,
      supplierInvoice.invoiceNumber        as supplierInvoiceNumber,
      supplierInvoice.supplier.name        as supplierName
    };

  // Value helps of the filters
  entity Suppliers                as projection on my.Suppliers {
    ID, organization.ID as organization_ID : UUID, name, supplierNumber
  };

  entity Customers                as projection on my.Customers {
    ID, organization.ID as organization_ID : UUID, companyName, name, displayName, customerNumber
  };

  entity ExpenseCategories        as projection on my.ExpenseCategories {
    ID, organization.ID as organization_ID : UUID, name
  };

  entity PaymentStatuses          as projection on my.PaymentStatuses;
  entity SalesInvoiceStatuses     as projection on my.SalesInvoiceStatuses;
  entity IncomingDocumentStatuses as projection on my.IncomingDocumentStatuses;
  entity BankMatchStatuses        as projection on my.BankMatchStatuses;

  /** Estimated VAT of a period, from the sales and supplier invoices. */
  function vatOverview(fromDate : Date, toDate : Date)      returns FinanceService.VatOverview;
  /** ZIP with the invoices, documents and CSV lists of a period. */
  function accountantExport(fromDate : Date, toDate : Date) returns LargeBinary @Core.MediaType: 'application/zip';
}
