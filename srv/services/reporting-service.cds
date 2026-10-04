using {swiver as my} from '../../db/reporting';
using from '../../db/sales';

/**
 * Sales, purchase and open item reports of the current organization. Read-only: the figures come
 * from the views in db/reporting.cds and are grouped and summed by the OData $apply aggregation.
 */
@readonly
service ReportingService {
  entity SalesReport       as projection on my.SalesReport;
  entity PurchaseReport    as projection on my.PurchaseReport;
  entity OpenItems         as projection on my.OpenItems;

  // Value helps of the filters
  entity Customers         as projection on my.Customers {
    ID, organization.ID as organization_ID : UUID, companyName, name, displayName, customerNumber
  };

  entity ProductServices   as projection on my.ProductServices {
    ID, organization.ID as organization_ID : UUID, name, code
  };

  entity Suppliers         as projection on my.Suppliers {
    ID, organization.ID as organization_ID : UUID, name, supplierNumber
  };

  entity ExpenseCategories as projection on my.ExpenseCategories {
    ID, organization.ID as organization_ID : UUID, name
  };
}

// Grouping and totals ($apply): the amounts are summed, the currency is the measures' unit.
// TODO(feature): reports per currency for organizations invoicing in several currencies
annotate ReportingService.SalesReport with @(
  Aggregation.ApplySupported            : {
    Transformations       : [
      'aggregate',
      'groupby',
      'filter',
      'orderby',
      'search',
      'top',
      'skip',
      'concat',
      'identity'
    ],
    Rollup                : #None,
    PropertyRestrictions  : true,
    GroupableProperties   : [
      invoice_ID,
      invoiceNumber,
      invoiceDate,
      month,
      customer_ID,
      customerName,
      productService_ID,
      productServiceName
    ],
    AggregatableProperties: [
      {Property: netAmount},
      {Property: taxAmount},
      {Property: grossAmount}
    ]
  },
  Aggregation.CustomAggregate #netAmount    : 'Edm.Decimal',
  Aggregation.CustomAggregate #taxAmount    : 'Edm.Decimal',
  Aggregation.CustomAggregate #grossAmount  : 'Edm.Decimal',
  Aggregation.CustomAggregate #currency_code: 'Edm.String'
) {
  netAmount     @Aggregation.default: #SUM;
  taxAmount     @Aggregation.default: #SUM;
  grossAmount   @Aggregation.default: #SUM;
  currency_code @Aggregation.default: #MAX;
};

annotate ReportingService.PurchaseReport with @(
  Aggregation.ApplySupported            : {
    Transformations       : [
      'aggregate',
      'groupby',
      'filter',
      'orderby',
      'search',
      'top',
      'skip',
      'concat',
      'identity'
    ],
    Rollup                : #None,
    PropertyRestrictions  : true,
    GroupableProperties   : [
      ID,
      invoiceNumber,
      invoiceDate,
      month,
      supplier_ID,
      supplierName,
      expenseCategory_ID,
      expenseCategoryName
    ],
    AggregatableProperties: [
      {Property: netAmount},
      {Property: taxAmount},
      {Property: grossAmount}
    ]
  },
  Aggregation.CustomAggregate #netAmount    : 'Edm.Decimal',
  Aggregation.CustomAggregate #taxAmount    : 'Edm.Decimal',
  Aggregation.CustomAggregate #grossAmount  : 'Edm.Decimal',
  Aggregation.CustomAggregate #currency_code: 'Edm.String'
) {
  netAmount     @Aggregation.default: #SUM;
  taxAmount     @Aggregation.default: #SUM;
  grossAmount   @Aggregation.default: #SUM;
  currency_code @Aggregation.default: #MAX;
};

annotate ReportingService.OpenItems with @(
  Aggregation.ApplySupported                : {
    Transformations       : [
      'aggregate',
      'groupby',
      'filter',
      'orderby',
      'search',
      'top',
      'skip',
      'concat',
      'identity'
    ],
    Rollup                : #None,
    PropertyRestrictions  : true,
    GroupableProperties   : [
      ID,
      kind,
      invoiceNumber,
      partnerName,
      invoiceDate,
      dueDate,
      daysOverdue,
      agingBucket,
      agingBucketText,
      paymentStatus_code
    ],
    AggregatableProperties: [
      {Property: grossAmount},
      {Property: paidAmount},
      {Property: outstandingAmount},
      {Property: overdueAmount}
    ]
  },
  Aggregation.CustomAggregate #grossAmount      : 'Edm.Decimal',
  Aggregation.CustomAggregate #paidAmount       : 'Edm.Decimal',
  Aggregation.CustomAggregate #outstandingAmount: 'Edm.Decimal',
  Aggregation.CustomAggregate #overdueAmount    : 'Edm.Decimal',
  Aggregation.CustomAggregate #currency_code    : 'Edm.String'
) {
  grossAmount       @Aggregation.default: #SUM;
  paidAmount        @Aggregation.default: #SUM;
  outstandingAmount @Aggregation.default: #SUM;
  overdueAmount     @Aggregation.default: #SUM;
  currency_code     @Aggregation.default: #MAX;
};
