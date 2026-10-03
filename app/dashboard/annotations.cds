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
