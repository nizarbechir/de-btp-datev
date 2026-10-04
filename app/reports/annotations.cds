using ReportingService as service from '../../srv/services';

// Reports: one list report per report, with one tab per grouping. The tables are analytical: they
// group and total the amounts in the backend ($apply), and expanding a group lists its invoices.

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

annotate service.SalesReport with @(
  UI.SelectionFields                         : [
    invoiceDate,
    customer_ID,
    productService_ID
  ],
  UI.LineItem #ByMonth                       : [
    {Value: month},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: customer_ID},
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount}
  ],
  UI.LineItem #ByCustomer                    : [
    {Value: customer_ID},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount}
  ],
  UI.LineItem #ByProductService              : [
    {Value: productServiceName},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: customer_ID},
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount}
  ],
  UI.SelectionPresentationVariant #ByMonth   : {
    Text               : '{i18n>ByMonth}',
    SelectionVariant   : {SelectOptions: []},
    PresentationVariant: {
      Visualizations: ['@UI.LineItem#ByMonth'],
      GroupBy       : [month],
      Total         : [
        netAmount,
        taxAmount,
        grossAmount
      ],
      SortOrder     : [{
        Property  : month,
        Descending: true
      }]
    }
  },
  UI.SelectionPresentationVariant #ByCustomer: {
    Text               : '{i18n>ByCustomer}',
    SelectionVariant   : {SelectOptions: []},
    PresentationVariant: {
      Visualizations: ['@UI.LineItem#ByCustomer'],
      GroupBy       : [customer_ID],
      Total         : [
        netAmount,
        taxAmount,
        grossAmount
      ]
    }
  },
  UI.SelectionPresentationVariant #ByProductService: {
    Text               : '{i18n>ByProductService}',
    SelectionVariant   : {SelectOptions: []},
    PresentationVariant: {
      Visualizations: ['@UI.LineItem#ByProductService'],
      GroupBy       : [productServiceName],
      Total         : [
        netAmount,
        taxAmount,
        grossAmount
      ]
    }
  }
) {
  ID                 @UI.Hidden;
  invoice_ID         @UI.Hidden;
  organization_ID    @UI.Hidden;
  invoiceNumber      @title: '{i18n>InvoiceNumber}';
  invoiceDate        @title: '{i18n>InvoiceDate}';
  month              @title: '{i18n>Month}';
  customer_ID        @title: '{i18n>Customer}'  @Common: {
    Text           : customerName,
    TextArrangement: #TextOnly,
    ValueList      : {
      CollectionPath: 'Customers',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: customer_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'displayName'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'customerNumber'
        }
      ]
    }
  };
  customerName       @title: '{i18n>Customer}';
  productService_ID  @title: '{i18n>ProductService}'  @Common: {
    Text           : productServiceName,
    TextArrangement: #TextOnly,
    ValueList      : {
      CollectionPath: 'ProductServices',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: productService_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'name'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'code'
        }
      ]
    }
  };
  productServiceName @title: '{i18n>ProductService}';
  currency_code      @title: '{i18n>Currency}';
  netAmount          @title: '{i18n>NetAmount}'    @Measures.ISOCurrency: currency_code;
  taxAmount          @title: '{i18n>TaxAmount}'    @Measures.ISOCurrency: currency_code;
  grossAmount        @title: '{i18n>GrossAmount}'  @Measures.ISOCurrency: currency_code;
};

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

annotate service.PurchaseReport with @(
  UI.SelectionFields                                : [
    invoiceDate,
    supplier_ID,
    expenseCategory_ID
  ],
  UI.LineItem #ByMonth                              : [
    {Value: month},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: supplier_ID},
    {Value: expenseCategory_ID},
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount}
  ],
  UI.LineItem #BySupplier                           : [
    {Value: supplier_ID},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: expenseCategory_ID},
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount}
  ],
  UI.LineItem #ByExpenseCategory                    : [
    {Value: expenseCategory_ID},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: supplier_ID},
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount}
  ],
  UI.SelectionPresentationVariant #ByMonth          : {
    Text               : '{i18n>ByMonth}',
    SelectionVariant   : {SelectOptions: []},
    PresentationVariant: {
      Visualizations: ['@UI.LineItem#ByMonth'],
      GroupBy       : [month],
      Total         : [
        netAmount,
        taxAmount,
        grossAmount
      ],
      SortOrder     : [{
        Property  : month,
        Descending: true
      }]
    }
  },
  UI.SelectionPresentationVariant #BySupplier       : {
    Text               : '{i18n>BySupplier}',
    SelectionVariant   : {SelectOptions: []},
    PresentationVariant: {
      Visualizations: ['@UI.LineItem#BySupplier'],
      GroupBy       : [supplier_ID],
      Total         : [
        netAmount,
        taxAmount,
        grossAmount
      ]
    }
  },
  UI.SelectionPresentationVariant #ByExpenseCategory: {
    Text               : '{i18n>ByExpenseCategory}',
    SelectionVariant   : {SelectOptions: []},
    PresentationVariant: {
      Visualizations: ['@UI.LineItem#ByExpenseCategory'],
      GroupBy       : [expenseCategory_ID],
      Total         : [
        netAmount,
        taxAmount,
        grossAmount
      ]
    }
  }
) {
  ID                  @UI.Hidden;
  organization_ID     @UI.Hidden;
  invoiceNumber       @title: '{i18n>InvoiceNumber}';
  invoiceDate         @title: '{i18n>InvoiceDate}';
  month               @title: '{i18n>Month}';
  supplier_ID         @title: '{i18n>Supplier}'  @Common: {
    Text           : supplierName,
    TextArrangement: #TextOnly,
    ValueList      : {
      CollectionPath: 'Suppliers',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: supplier_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'name'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'supplierNumber'
        }
      ]
    }
  };
  supplierName        @title: '{i18n>Supplier}';
  expenseCategory_ID  @title: '{i18n>ExpenseCategory}'  @Common: {
    Text           : expenseCategoryName,
    TextArrangement: #TextOnly,
    ValueList      : {
      CollectionPath: 'ExpenseCategories',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: expenseCategory_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'name'
        }
      ]
    }
  };
  expenseCategoryName @title: '{i18n>ExpenseCategory}';
  currency_code       @title: '{i18n>Currency}';
  netAmount           @title: '{i18n>NetAmount}'    @Measures.ISOCurrency: currency_code;
  taxAmount           @title: '{i18n>TaxAmount}'    @Measures.ISOCurrency: currency_code;
  grossAmount         @title: '{i18n>GrossAmount}'  @Measures.ISOCurrency: currency_code;
};

// ---------------------------------------------------------------------------
// Open items: receivables and payables in separate tabs, grouped by aging bucket
// ---------------------------------------------------------------------------

annotate service.OpenItems with @(
  UI.SelectionFields                          : [
    partnerName,
    dueDate,
    invoiceDate
  ],
  UI.LineItem                                 : [
    {Value: agingBucket},
    {Value: invoiceNumber},
    {Value: partnerName},
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: daysOverdue},
    {Value: grossAmount},
    {Value: paidAmount},
    {Value: outstandingAmount},
    {
      Value      : overdueAmount,
      Criticality: #Negative
    }
  ],
  UI.SelectionPresentationVariant #Receivables: {
    Text               : '{i18n>Receivables}',
    SelectionVariant   : {SelectOptions: [{
      PropertyName: kind,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'RECEIVABLE'
      }]
    }]},
    PresentationVariant: {
      Visualizations: ['@UI.LineItem'],
      GroupBy       : [agingBucket],
      Total         : [
        outstandingAmount,
        overdueAmount
      ],
      SortOrder     : [{Property: agingBucket}]
    }
  },
  UI.SelectionPresentationVariant #Payables   : {
    Text               : '{i18n>Payables}',
    SelectionVariant   : {SelectOptions: [{
      PropertyName: kind,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'PAYABLE'
      }]
    }]},
    PresentationVariant: {
      Visualizations: ['@UI.LineItem'],
      GroupBy       : [agingBucket],
      Total         : [
        outstandingAmount,
        overdueAmount
      ],
      SortOrder     : [{Property: agingBucket}]
    }
  }
) {
  ID                 @UI.Hidden;
  organization_ID    @UI.Hidden;
  kind               @UI.Hidden;
  paymentStatus_code @UI.Hidden;
  invoiceNumber      @title: '{i18n>InvoiceNumber}';
  partnerName        @title: '{i18n>CustomerOrSupplier}';
  invoiceDate        @title: '{i18n>InvoiceDate}';
  dueDate            @title: '{i18n>DueDate}';
  daysOverdue        @title: '{i18n>DaysOverdue}';
  agingBucket        @title: '{i18n>AgingBucket}'  @Common: {
    Text           : agingBucketText,
    TextArrangement: #TextOnly
  };
  agingBucketText    @title: '{i18n>AgingBucket}';
  currency_code      @title: '{i18n>Currency}';
  grossAmount        @title: '{i18n>GrossAmount}'        @Measures.ISOCurrency: currency_code;
  paidAmount         @title: '{i18n>PaidAmount}'         @Measures.ISOCurrency: currency_code;
  outstandingAmount  @title: '{i18n>OutstandingAmount}'  @Measures.ISOCurrency: currency_code;
  overdueAmount      @title: '{i18n>OverdueAmount}'      @Measures.ISOCurrency: currency_code;
};
