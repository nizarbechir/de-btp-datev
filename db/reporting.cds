using {
  swiver.SalesInvoices,
  swiver.SalesInvoiceItems
} from './sales';
using {swiver.SupplierInvoices} from './schema';

namespace swiver;

// Read-only views for the Sales, Purchase and Open Items reports. They only pick and group the
// amounts the backend already maintains (item and invoice totals, paid and outstanding amounts,
// overdue flags); nothing is recalculated here.

/**
 * Revenue per sales invoice line, so it can be grouped by month, customer and product or service.
 * Only issued invoices (finalized or sent) count; drafts and cancelled invoices are left out.
 * The invoice totals are the sum of these line amounts (srv/core/money.ts).
 */
@readonly
view SalesReport as
  select from SalesInvoiceItems {
    key ID,
        invoice.organization.ID                                             as organization_ID    : UUID,
        invoice.ID                                                          as invoice_ID         : UUID,
        invoice.invoiceNumber                                               as invoiceNumber,
        invoice.invoiceDate                                                 as invoiceDate,
        substring(invoice.invoiceDate, 0, 7)                                as month              : String(7),
        invoice.customer.ID                                                 as customer_ID        : UUID,
        coalesce(invoice.customer.companyName, invoice.customer.name)       as customerName       : String(120),
        productService.ID                                                   as productService_ID  : UUID,
        // Lines without a product or service are grouped by their description.
        coalesce(productService.name, description)                          as productServiceName : String(500),
        invoice.currency.code                                               as currency_code      : String(3),
        netAmount,
        taxAmount,
        grossAmount
  }
  where
       invoice.status.code = 'FINALIZED'
    or invoice.status.code = 'SENT';

/** Supplier invoices for the purchase report, with supplier and expense category. */
@readonly
view PurchaseReport as
  select from SupplierInvoices {
    key ID,
        organization.ID                     as organization_ID     : UUID,
        invoiceNumber,
        invoiceDate,
        substring(invoiceDate, 0, 7)        as month               : String(7),
        supplier.ID                         as supplier_ID         : UUID,
        supplier.name                       as supplierName        : String(120),
        expenseCategory.ID                  as expenseCategory_ID  : UUID,
        expenseCategory.name                as expenseCategoryName : String(80),
        currency.code                       as currency_code       : String(3),
        netAmount,
        taxAmount,
        grossAmount
  };

/**
 * Invoices not paid in full: issued sales invoices (receivables) and supplier invoices (payables),
 * with the outstanding amount and overdue flag of the invoice. Aging buckets: 0 not due, 1 up to 30,
 * 2 up to 60 and 3 more than 60 days overdue.
 */
@readonly
view OpenItems as
    select from SalesInvoices {
      key ID,
          organization.ID                                       as organization_ID   : UUID,
          'RECEIVABLE'                                          as kind              : String(10),
          invoiceNumber                                         as invoiceNumber     : String(50),
          coalesce(customer.companyName, customer.name)         as partnerName       : String(120),
          invoiceDate,
          dueDate,
          paymentStatus.code                                    as paymentStatus_code : String(10),
          currency.code                                         as currency_code     : String(3),
          grossAmount,
          paidAmount,
          outstandingAmount                                     as outstandingAmount : Decimal(15, 2),
          cast(
            case
              when isOverdue = true
                   then outstandingAmount
              else 0
            end as Decimal(15, 2)
          )                                                     as overdueAmount,
          cast(
            case
              when isOverdue = true
                   then days_between(dueDate, current_date)
              else 0
            end as Integer
          )                                                     as daysOverdue,
          cast(
            case
              when isOverdue = false
                   then 0
              when days_between(dueDate, current_date) <= 30
                   then 1
              when days_between(dueDate, current_date) <= 60
                   then 2
              else 3
            end as Integer
          )                                                     as agingBucket,
          cast(
            case
              when isOverdue = false
                   then 'Not due'
              when days_between(dueDate, current_date) <= 30
                   then '1-30 days overdue'
              when days_between(dueDate, current_date) <= 60
                   then '31-60 days overdue'
              else 'More than 60 days overdue'
            end as String(30)
          )                                                     as agingBucketText
    }
    where
          isIssued           = true
      and paymentStatus.code != 'PAID'
  union all
    select from SupplierInvoices {
      key ID,
          organization.ID                                       as organization_ID   : UUID,
          'PAYABLE'                                             as kind              : String(10),
          invoiceNumber                                         as invoiceNumber     : String(50),
          supplier.name                                         as partnerName       : String(120),
          invoiceDate,
          dueDate,
          paymentStatus.code                                    as paymentStatus_code : String(10),
          currency.code                                         as currency_code     : String(3),
          grossAmount,
          paidAmount,
          outstandingAmount                                     as outstandingAmount : Decimal(15, 2),
          cast(
            case
              when isOverdue = true
                   then outstandingAmount
              else 0
            end as Decimal(15, 2)
          )                                                     as overdueAmount,
          cast(
            case
              when isOverdue = true
                   then days_between(dueDate, current_date)
              else 0
            end as Integer
          )                                                     as daysOverdue,
          cast(
            case
              when isOverdue = false
                   then 0
              when days_between(dueDate, current_date) <= 30
                   then 1
              when days_between(dueDate, current_date) <= 60
                   then 2
              else 3
            end as Integer
          )                                                     as agingBucket,
          cast(
            case
              when isOverdue = false
                   then 'Not due'
              when days_between(dueDate, current_date) <= 30
                   then '1-30 days overdue'
              when days_between(dueDate, current_date) <= 60
                   then '31-60 days overdue'
              else 'More than 60 days overdue'
            end as String(30)
          )                                                     as agingBucketText
    }
    where
      paymentStatus.code != 'PAID';
