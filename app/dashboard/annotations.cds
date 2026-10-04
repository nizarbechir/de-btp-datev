using FinanceService as service from '../../srv/services';

// Dashboard tables: what customers still owe, and what is due to suppliers next.

annotate service.SalesInvoices with @(
  UI.LineItem #Receivables                    : [
    {Value: customer_ID},
    {Value: invoiceNumber},
    {Value: dueDate},
    {Value: outstandingAmount},
    {
      Value      : displayStatus,
      Criticality: displayStatusCriticality
    }
  ],
  UI.SelectionPresentationVariant #Receivables: {
    SelectionVariant   : {SelectOptions: [
      {
        PropertyName: isIssued,
        Ranges      : [{
          Sign  : #I,
          Option: #EQ,
          Low   : true
        }]
      },
      {
        PropertyName: paymentStatus_code,
        Ranges      : [{
          Sign  : #E,
          Option: #EQ,
          Low   : 'PAID'
        }]
      }
    ]},
    PresentationVariant: {
      SortOrder     : [{
        Property  : dueDate,
        Descending: false
      }],
      Visualizations: ['@UI.LineItem#Receivables']
    }
  }
) {
  customer @(
    Common.Text           : customer.displayName,
    Common.TextArrangement: #TextOnly
  );
};

annotate service.SupplierInvoices with @(
  UI.LineItem #Upcoming                    : [
    {Value: supplier_ID},
    {Value: invoiceNumber},
    {Value: dueDate},
    {Value: outstandingAmount},
    {
      Value      : status,
      Criticality: statusCriticality
    }
  ],
  UI.SelectionPresentationVariant #Upcoming: {
    SelectionVariant   : {SelectOptions: [{
      PropertyName: paymentStatus_code,
      Ranges      : [{
        Sign  : #E,
        Option: #EQ,
        Low   : 'PAID'
      }]
    }]},
    PresentationVariant: {
      SortOrder     : [{
        Property  : dueDate,
        Descending: false
      }],
      Visualizations: ['@UI.LineItem#Upcoming']
    }
  }
) {
  supplier @(
    Common.Text           : supplier.name,
    Common.TextArrangement: #TextOnly
  );
};

// Dashboard chart: money in and out per month.
annotate service.CashFlow with @(
  Aggregation.ApplySupported         : {
    GroupableProperties   : [month],
    AggregatableProperties: [
      {Property: moneyIn},
      {Property: moneyOut}
    ]
  },
  Analytics.AggregatedProperty #moneyIn : {
    Name                : 'totalIn',
    AggregationMethod   : 'sum',
    AggregatableProperty: moneyIn,
    @Common.Label       : '{i18n>MoneyIn}'
  },
  Analytics.AggregatedProperty #moneyOut: {
    Name                : 'totalOut',
    AggregationMethod   : 'sum',
    AggregatableProperty: moneyOut,
    @Common.Label       : '{i18n>MoneyOut}'
  },
  UI.Chart                           : {
    ChartType        : #Column,
    Dimensions       : [month],
    // Both measures on the same axis, so both render as bars
    MeasureAttributes: [
      {
        DynamicMeasure: '@Analytics.AggregatedProperty#moneyIn',
        Role          : #Axis1
      },
      {
        DynamicMeasure: '@Analytics.AggregatedProperty#moneyOut',
        Role          : #Axis1
      }
    ],
    DynamicMeasures: [
      '@Analytics.AggregatedProperty#moneyIn',
      '@Analytics.AggregatedProperty#moneyOut'
    ]
  },
  UI.PresentationVariant             : {
    SortOrder     : [{Property: month}],
    Visualizations: ['@UI.Chart']
  }
) {
  month @title: '{i18n>Month}';
};
