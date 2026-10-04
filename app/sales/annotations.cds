using SalesService as service from '../../srv/services';


// ---------------------------------------------------------------------------
// Sales invoices
// ---------------------------------------------------------------------------

annotate service.SalesInvoices with @(
  UI.HeaderInfo                  : {
    TypeName      : '{i18n>SalesInvoice}',
    TypeNamePlural: '{i18n>SalesInvoices}',
    Title         : {Value: invoiceNumber},
    Description   : {Value: customer.displayName},
    TypeImageUrl  : 'sap-icon://sales-document'
  },
  UI.SelectionFields             : [
    customer_ID,
    status_code,
    paymentStatus_code,
    isOverdue,
    invoiceDate,
    dueDate
  ],
  UI.LineItem                    : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'SalesService.markAsSent',
      Label : '{i18n>MarkAsSent}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'SalesService.markAsPaid',
      Label : '{i18n>MarkPaid}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'SalesService.duplicate',
      Label : '{i18n>Duplicate}'
    },
    {
      Value         : invoiceNumber,
      @UI.Importance: #High
    },
    {
      Value         : customer_ID,
      @UI.Importance: #High
    },
    {Value: invoiceDate},
    {Value: dueDate},
    {
      Value         : grossAmount,
      @UI.Importance: #High
    },
    {Value: outstandingAmount},
    {
      Value         : displayStatus,
      Criticality   : displayStatusCriticality,
      @UI.Importance: #High
    }
  ],
  UI.PresentationVariant         : {
    SortOrder     : [{
      Property  : invoiceDate,
      Descending: true
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.SelectionVariant #All       : {
    Text         : '{i18n>All}',
    SelectOptions: []
  },
  UI.SelectionVariant #Draft     : {
    Text         : '{i18n>Draft}',
    SelectOptions: [{
      PropertyName: status_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'DRAFT'
      }]
    }]
  },
  // Issued and not fully paid
  UI.SelectionVariant #Sent      : {
    Text         : '{i18n>OpenSent}',
    SelectOptions: [
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
    ]
  },
  UI.SelectionVariant #Paid      : {
    Text         : '{i18n>Paid}',
    SelectOptions: [{
      PropertyName: paymentStatus_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'PAID'
      }]
    }]
  },
  // Object page: the invoice editor. Only the actions that fit the current status are shown.
  UI.Identification              : [
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'SalesService.finalize',
      Label      : '{i18n>Finalize}',
      Criticality: #Positive,
      @UI.Hidden : {$edmJson: {$Not: {$And: [{$Eq: [{$Path: 'status_code'}, 'DRAFT']}, {$Path: 'IsActiveEntity'}]}}}
    },
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'SalesService.sendByEmail',
      Label      : '{i18n>SendByEmail}',
      Criticality: #Positive,
      @UI.Hidden : {$edmJson: {$Not: {$And: [{$Or: [{$Eq: [{$Path: 'status_code'}, 'DRAFT']}, {$Eq: [{$Path: 'status_code'}, 'FINALIZED']}, {$Eq: [{$Path: 'status_code'}, 'SENT']}]}, {$Path: 'IsActiveEntity'}]}}}
    },
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'SalesService.markAsSent',
      Label      : '{i18n>MarkAsSent}',
      @UI.Hidden : {$edmJson: {$Not: {$And: [{$Or: [{$Eq: [{$Path: 'status_code'}, 'DRAFT']}, {$Eq: [{$Path: 'status_code'}, 'FINALIZED']}]}, {$Path: 'IsActiveEntity'}]}}}
    },
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'SalesService.recordPayment',
      Label      : '{i18n>RecordPayment}',
      @UI.Hidden : {$edmJson: {$Not: {$And: [{$And: [{$Path: 'isIssued'}, {$Ne: [{$Path: 'paymentStatus_code'}, 'PAID']}]}, {$Path: 'IsActiveEntity'}]}}}
    },
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'SalesService.markAsPaid',
      Label      : '{i18n>MarkPaid}',
      Criticality: #Positive,
      @UI.Hidden : {$edmJson: {$Not: {$And: [{$And: [{$Path: 'isIssued'}, {$Ne: [{$Path: 'paymentStatus_code'}, 'PAID']}]}, {$Path: 'IsActiveEntity'}]}}}
    },
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'SalesService.sendReminder',
      Label      : '{i18n>SendReminder}',
      @UI.Hidden : {$edmJson: {$Not: {$And: [{$Path: 'isOverdue'}, {$Path: 'IsActiveEntity'}]}}}
    },
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'SalesService.reopen',
      Label      : '{i18n>Reopen}',
      @UI.Hidden : {$edmJson: {$Not: {$And: [{$And: [{$Path: 'isIssued'}, {$Ne: [{$Path: 'paymentStatus_code'}, 'OPEN']}]}, {$Path: 'IsActiveEntity'}]}}}
    },
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'SalesService.cancelInvoice',
      Label      : '{i18n>CancelInvoice}',
      @UI.Hidden : {$edmJson: {$Not: {$And: [{$And: [{$Ne: [{$Path: 'status_code'}, 'CANCELLED']}, {$Eq: [{$Path: 'paymentStatus_code'}, 'OPEN']}]}, {$Path: 'IsActiveEntity'}]}}}
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'SalesService.addComment',
      Label : '{i18n>AddComment}'
    }
  ],
  UI.DataPoint #grossAmount      : {
    Value: grossAmount,
    Title: '{i18n>Total}'
  },
  UI.DataPoint #outstanding      : {
    Value: outstandingAmount,
    Title: '{i18n>OutstandingAmount}'
  },
  UI.DataPoint #status           : {
    Value      : displayStatus,
    Title      : '{i18n>Status}',
    Criticality: displayStatusCriticality
  },
  UI.DataPoint #dueDate          : {
    Value: dueDate,
    Title: '{i18n>DueDate}'
  },
  UI.HeaderFacets                : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#grossAmount'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#outstanding'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#status'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#dueDate'
    }
  ],
  UI.FieldGroup #Invoice         : {Data: [
    {Value: customer_ID},
    {
      $Type     : 'UI.DataFieldForAction',
      Action    : 'SalesService.createCustomer',
      Label     : '{i18n>NewCustomer}',
      @UI.Hidden: {$edmJson: {$Path: 'IsActiveEntity'}}
    },
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: currency_code},
    {Value: subject},
    {Value: servicePeriodStart},
    {Value: servicePeriodEnd}
  ]},
  UI.FieldGroup #Payment         : {Data: [
    {Value: paymentStatus_code},
    {Value: paidAmount},
    {Value: outstandingAmount},
    {Value: paymentDate}
  ]},
  UI.FieldGroup #History         : {Data: [
    {Value: status_code},
    {Value: sentAt},
    {Value: sentTo},
    {Value: quote_ID},
    {Value: replacesInvoice_ID}
  ]},
  UI.FieldGroup #Texts           : {Data: [
    {Value: introductionText},
    {Value: footerText},
    {Value: notes}
  ]},
  UI.Facets                      : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Invoice',
      Label : '{i18n>InvoiceDetails}',
      Target: '@UI.FieldGroup#Invoice'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Items',
      Label : '{i18n>Items}',
      Target: 'items/@UI.PresentationVariant'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Texts',
      Label : '{i18n>Texts}',
      Target: '@UI.FieldGroup#Texts'
    },
    {
      $Type        : 'UI.CollectionFacet',
      ID           : 'PaymentSection',
      Label        : '{i18n>Payment}',
      @UI.Hidden   : {$edmJson: {$Not: {$Path: 'IsActiveEntity'}}},
      Facets       : [
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Payment',
          Label : '{i18n>Payment}',
          Target: '@UI.FieldGroup#Payment'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Payments',
          Label : '{i18n>Payments}',
          Target: 'payments/@UI.LineItem#Invoice'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Reminders',
          Label : '{i18n>Reminders}',
          Target: 'reminders/@UI.LineItem'
        }
      ]
    },
    {
      $Type     : 'UI.ReferenceFacet',
      ID        : 'History',
      Label     : '{i18n>History}',
      Target    : '@UI.FieldGroup#History',
      @UI.Hidden: {$edmJson: {$Not: {$Path: 'IsActiveEntity'}}}
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Comments',
      Label : '{i18n>Comments}',
      Target: 'comments/@UI.LineItem'
    }
  ],
  // Recalculate while editing: items and totals, the due date, and the customer shown in the header
  Common.SideEffects #Items      : {
    SourceEntities  : [items],
    SourceProperties: [
      items.quantity,
      items.unitPrice,
      items.taxRate,
      items.productService_ID
    ],
    TargetProperties: [
      'netAmount',
      'taxAmount',
      'grossAmount'
    ],
    TargetEntities  : [
      items,
      taxes
    ]
  },
  Common.SideEffects #InvoiceDate: {
    SourceProperties: [invoiceDate],
    TargetProperties: [
      'dueDate',
      'displayStatus',
      'displayStatusCriticality'
    ]
  },
  Common.SideEffects #DueDate    : {
    SourceProperties: [dueDate],
    TargetProperties: [
      'displayStatus',
      'displayStatusCriticality'
    ]
  },
  Common.SideEffects #Customer   : {
    SourceProperties: [customer_ID],
    TargetEntities  : [customer]
  },
  // Invoices table on the customer page
  UI.LineItem #Customer          : [
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: grossAmount},
    {Value: outstandingAmount},
    {
      Value      : displayStatus,
      Criticality: displayStatusCriticality
    }
  ]
);

annotate service.SalesInvoices with {
  customer      @(
    Common.Text           : customer.displayName,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath : 'Customers',
      SearchSupported: true,
      Parameters     : [
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
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'city'
        },
        {
          $Type            : 'Common.ValueListParameterConstant',
          ValueListProperty: 'active',
          Constant         : true
        }
      ]
    }
  );
  status        @(
    Common.Text                    : status.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
  paymentStatus @(
    Common.Text                    : paymentStatus.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
  currency      @Common.ValueListWithFixedValues: false;
};

annotate service.SalesInvoices actions {
  // Comments and questions, also from the tax advisor
  addComment @(
    Core.OperationAvailable: {$edmJson: {$Path: 'in/IsActiveEntity'}},
    Common.SideEffects     : {TargetEntities: ['in/comments']}
  );
  finalize @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$Eq: [{$Path: 'in/status_code'}, 'DRAFT']}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments', 'in/reminders']
    }
  );
  markAsSent @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$Or: [{$Eq: [{$Path: 'in/status_code'}, 'DRAFT']}, {$Eq: [{$Path: 'in/status_code'}, 'FINALIZED']}]}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments', 'in/reminders']
    }
  );
  markAsPaid @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$And: [{$Path: 'in/isIssued'}, {$Ne: [{$Path: 'in/paymentStatus_code'}, 'PAID']}]}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments', 'in/reminders']
    }
  );
  reopen @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$And: [{$Path: 'in/isIssued'}, {$Ne: [{$Path: 'in/paymentStatus_code'}, 'OPEN']}]}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments', 'in/reminders']
    }
  );
  correct @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$Or: [{$Eq: [{$Path: 'in/status_code'}, 'FINALIZED']}, {$Eq: [{$Path: 'in/status_code'}, 'SENT']}, {$Eq: [{$Path: 'in/status_code'}, 'CANCELLED']}]}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.IsActionCritical: true,
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments', 'in/reminders']
    }
  );
  cancelInvoice @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$And: [{$Ne: [{$Path: 'in/status_code'}, 'CANCELLED']}, {$Eq: [{$Path: 'in/paymentStatus_code'}, 'OPEN']}]}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.IsActionCritical: true,
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments', 'in/reminders']
    }
  );
  duplicate      @(Core.OperationAvailable: {$edmJson: {$And: [{$Path: 'in/IsActiveEntity'}, {$Not: {$Path: 'in/readOnly'}}]}});
  createCustomer @(
    Core.OperationAvailable: {$edmJson: {$And: [{$Not: {$Path: 'in/IsActiveEntity'}}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/customer_ID'],
      TargetEntities  : ['in/customer']
    }
  )(
    country @(
      UI.ParameterDefaultValue: 'DE',
      Common.ValueListWithFixedValues,
      Common.ValueList        : {
        CollectionPath: 'Countries',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: country,
            ValueListProperty: 'code'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name'
          }
        ]
      }
    )
  );
  sendByEmail    @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$Or: [{$Eq: [{$Path: 'in/status_code'}, 'DRAFT']}, {$Eq: [{$Path: 'in/status_code'}, 'FINALIZED']}, {$Eq: [{$Path: 'in/status_code'}, 'SENT']}]}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  )(
    // Prefilled from the customer, still editable; empty and required if the customer has no e-mail.
    recipient @(
      UI.ParameterDefaultValue: in.customerEmail,
      Common.FieldControl     : #Mandatory
    ),
    subject   @UI.ParameterDefaultValue: in.emailSubject
  );
  sendReminder   @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$Path: 'in/isOverdue'}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/reminders']
    }
  )(recipient @(
    UI.ParameterDefaultValue: in.customerEmail,
    Common.FieldControl     : #Mandatory
  ));
  recordPayment  @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$And: [{$Path: 'in/isIssued'}, {$Ne: [{$Path: 'in/paymentStatus_code'}, 'PAID']}]}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments']
    }
  )(amount @UI.ParameterDefaultValue: in.outstandingAmount);
};

// Payments and reminders on the invoice page
annotate service.Payments with @(UI.LineItem #Invoice: [
  {Value: paymentDate},
  {Value: amount},
  {Value: source},
  {Value: reference}
]);

annotate service.ReminderRecords with @(UI.LineItem: [
  {Value: sentAt},
  {Value: level},
  {Value: recipient},
  {Value: subject}
]);

// Invoice items: an editable table with the amounts calculated by the backend
annotate service.SalesInvoiceItems with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>Item}',
    TypeNamePlural: '{i18n>Items}',
    Title         : {Value: description}
  },
  UI.LineItem           : [
    {
      Value                : productService_ID,
      @HTML5.CssDefaults   : {width: '12rem'}
    },
    {
      Value                : description,
      @UI.Importance       : #High,
      @HTML5.CssDefaults   : {width: '24rem'}
    },
    {
      Value                : quantity,
      @UI.Importance       : #High,
      @HTML5.CssDefaults   : {width: '6rem'}
    },
    {
      Value                : unit,
      @HTML5.CssDefaults   : {width: '7rem'}
    },
    {
      Value                : unitPrice,
      @UI.Importance       : #High,
      @HTML5.CssDefaults   : {width: '9rem'}
    },
    {
      Value                : taxRate,
      @HTML5.CssDefaults   : {width: '6rem'}
    },
    {
      Value                : netAmount,
      @HTML5.CssDefaults   : {width: '9rem'}
    },
    {
      Value                : grossAmount,
      @UI.Importance       : #High,
      @HTML5.CssDefaults   : {width: '9rem'}
    }
  ],
  UI.PresentationVariant: {
    SortOrder     : [{Property: position}],
    Visualizations: ['@UI.LineItem']
  }
);

annotate service.SalesInvoiceItems with {
  unit           @Common.ValueList: {
    CollectionPath: 'Units',
    Parameters    : [{
      $Type            : 'Common.ValueListParameterInOut',
      LocalDataProperty: unit,
      ValueListProperty: 'code'
    }]
  };
  productService @(
    Common.Text           : productService.name,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath : 'ProductServices',
      SearchSupported: true,
      Parameters     : [
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
          ValueListProperty: 'unit'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'defaultPrice'
        },
        {
          $Type            : 'Common.ValueListParameterConstant',
          ValueListProperty: 'active',
          Constant         : true
        }
      ]
    }
  );
};

// Picking a product or service fills description, unit, price and VAT rate of the line
annotate service.SalesInvoiceItems with @(Common.SideEffects #Product: {
  SourceProperties: [productService_ID],
  TargetProperties: [
    'description',
    'unit',
    'unitPrice',
    'taxRate',
    'netAmount',
    'grossAmount'
  ]
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

annotate service.Customers with @(
  UI.HeaderInfo              : {
    TypeName      : '{i18n>Customer}',
    TypeNamePlural: '{i18n>Customers}',
    Title         : {Value: displayName},
    Description   : {Value: customerNumber},
    TypeImageUrl  : 'sap-icon://customer'
  },
  UI.SelectionFields         : [
    active,
    city,
    country_code
  ],
  UI.LineItem                : [
    {
      Value         : displayName,
      @UI.Importance: #High
    },
    {Value: customerNumber},
    {Value: name},
    {Value: city},
    {Value: email},
    {
      Value         : balance.outstanding,
      @UI.Importance: #High
    },
    {
      Value         : active,
      @UI.Importance: #High
    }
  ],
  UI.PresentationVariant     : {
    SortOrder     : [{Property: displayName}],
    Visualizations: ['@UI.LineItem']
  },
  UI.DataPoint #totalInvoiced: {
    Value: balance.totalInvoiced,
    Title: '{i18n>TotalInvoiced}'
  },
  UI.DataPoint #outstanding  : {
    Value: balance.outstanding,
    Title: '{i18n>Outstanding}'
  },
  UI.DataPoint #overdue      : {
    Value      : balance.overdue,
    Title      : '{i18n>Overdue}',
    Criticality: #Negative
  },
  UI.HeaderFacets            : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#totalInvoiced'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#outstanding'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#overdue'
    }
  ],
  UI.FieldGroup #General     : {Data: [
    {Value: companyName},
    {Value: name},
    {Value: customerNumber},
    {Value: active}
  ]},
  UI.FieldGroup #Contact     : {Data: [
    {Value: email},
    {Value: phone},
    {Value: street},
    {Value: postalCode},
    {Value: city},
    {Value: country_code}
  ]},
  UI.FieldGroup #Tax         : {Data: [
    {Value: taxNumber},
    {Value: vatId},
    {Value: iban}
  ]},
  UI.FieldGroup #Notes       : {Data: [{Value: notes}]},
  UI.Facets                  : [
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'Details',
      Label : '{i18n>General}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'General',
          Label : '{i18n>General}',
          Target: '@UI.FieldGroup#General'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Contact',
          Label : '{i18n>Contact}',
          Target: '@UI.FieldGroup#Contact'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Tax',
          Label : '{i18n>TaxDetails}',
          Target: '@UI.FieldGroup#Tax'
        }
      ]
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Invoices',
      Label : '{i18n>SalesInvoices}',
      Target: 'invoices/@UI.LineItem#Customer'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Notes',
      Label : '{i18n>Notes}',
      Target: '@UI.FieldGroup#Notes'
    }
  ],
  Common.SideEffects #Name   : {
    SourceProperties: [
      companyName,
      name
    ],
    TargetProperties: ['displayName']
  }
);

annotate service.Customers with {
  country @(
    Common.Text                    : country.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

annotate service.Quotes with @(
  UI.HeaderInfo               : {
    TypeName      : '{i18n>Quote}',
    TypeNamePlural: '{i18n>Quotes}',
    Title         : {Value: quoteNumber},
    Description   : {Value: customer.displayName},
    TypeImageUrl  : 'sap-icon://sales-quote'
  },
  UI.SelectionFields          : [
    customer_ID,
    status_code,
    quoteDate
  ],
  UI.LineItem                 : [
    {
      Value         : quoteNumber,
      @UI.Importance: #High
    },
    {
      Value         : customer_ID,
      @UI.Importance: #High
    },
    {Value: subject},
    {Value: quoteDate},
    {Value: validUntil},
    {
      Value         : grossAmount,
      @UI.Importance: #High
    },
    {
      Value         : displayStatus,
      Criticality   : displayStatusCriticality,
      @UI.Importance: #High
    }
  ],
  UI.PresentationVariant      : {
    SortOrder     : [{
      Property  : quoteDate,
      Descending: true
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.Identification           : [
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'SalesService.sendByEmail',
      Label      : '{i18n>SendByEmail}',
      Criticality: #Positive
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'SalesService.markAsSent',
      Label : '{i18n>MarkAsSent}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'SalesService.accept',
      Label : '{i18n>Accept}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'SalesService.rejectQuote',
      Label : '{i18n>Reject}'
    }
  ],
  UI.DataPoint #grossAmount   : {
    Value: grossAmount,
    Title: '{i18n>Total}'
  },
  UI.DataPoint #status        : {
    Value      : displayStatus,
    Title      : '{i18n>Status}',
    Criticality: displayStatusCriticality
  },
  UI.DataPoint #validUntil    : {
    Value: validUntil,
    Title: '{i18n>ValidUntil}'
  },
  UI.HeaderFacets             : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#grossAmount'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#status'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#validUntil'
    }
  ],
  UI.FieldGroup #Quote        : {Data: [
    {Value: customer_ID},
    {Value: quoteDate},
    {Value: validUntil},
    {Value: currency_code},
    {Value: subject}
  ]},
  UI.FieldGroup #Totals       : {Data: [
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount}
  ]},
  UI.FieldGroup #History      : {Data: [
    {Value: status_code},
    {Value: sentAt},
    {Value: sentTo},
    {Value: convertedInvoice_ID}
  ]},
  UI.FieldGroup #Texts        : {Data: [
    {Value: introductionText},
    {Value: footerText},
    {Value: notes}
  ]},
  UI.Facets                   : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Quote',
      Label : '{i18n>QuoteDetails}',
      Target: '@UI.FieldGroup#Quote'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Items',
      Label : '{i18n>Items}',
      Target: 'items/@UI.PresentationVariant'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Totals',
      Label : '{i18n>Totals}',
      Target: '@UI.FieldGroup#Totals'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Texts',
      Label : '{i18n>Texts}',
      Target: '@UI.FieldGroup#Texts'
    },
    {
      $Type     : 'UI.ReferenceFacet',
      ID        : 'History',
      Label     : '{i18n>History}',
      Target    : '@UI.FieldGroup#History',
      @UI.Hidden: {$edmJson: {$Not: {$Path: 'IsActiveEntity'}}}
    }
  ],
  Common.SideEffects #Items   : {
    SourceEntities  : [items],
    SourceProperties: [
      items.quantity,
      items.unitPrice,
      items.taxRate,
      items.productService_ID
    ],
    TargetProperties: [
      'netAmount',
      'taxAmount',
      'grossAmount'
    ],
    TargetEntities  : [items]
  },
  Common.SideEffects #Customer: {
    SourceProperties: [customer_ID],
    TargetEntities  : [customer]
  }
);

annotate service.Quotes with {
  customer @(
    Common.Text           : customer.displayName,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath : 'Customers',
      SearchSupported: true,
      Parameters     : [
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
          ValueListProperty: 'city'
        },
        {
          $Type            : 'Common.ValueListParameterConstant',
          ValueListProperty: 'active',
          Constant         : true
        }
      ]
    }
  );
  status   @(
    Common.Text                    : status.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
  currency @Common.ValueListWithFixedValues: false;
};

annotate service.Quotes actions {
  markAsSent       @(
    Core.OperationAvailable: {$edmJson: {$And: [{$Eq: [{$Path: 'in/status_code'}, 'DRAFT']}, {$Path: 'in/IsActiveEntity'}]}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  accept           @(
    Core.OperationAvailable: {$edmJson: {$And: [{$Or: [{$Eq: [{$Path: 'in/status_code'}, 'DRAFT']}, {$Eq: [{$Path: 'in/status_code'}, 'SENT']}]}, {$Path: 'in/IsActiveEntity'}]}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  rejectQuote      @(
    Core.OperationAvailable: {$edmJson: {$And: [{$Or: [{$Eq: [{$Path: 'in/status_code'}, 'DRAFT']}, {$Eq: [{$Path: 'in/status_code'}, 'SENT']}]}, {$Path: 'in/IsActiveEntity'}]}},
    Common.IsActionCritical: true,
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  convertToInvoice @(
    Core.OperationAvailable: {$edmJson: {$And: [{$Ne: [{$Path: 'in/status_code'}, 'REJECTED']}, {$Path: 'in/IsActiveEntity'}]}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  sendByEmail      @(
    Core.OperationAvailable: {$edmJson: {$And: [{$Ne: [{$Path: 'in/status_code'}, 'REJECTED']}, {$Path: 'in/IsActiveEntity'}]}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  )(
    recipient @(
      UI.ParameterDefaultValue: in.customerEmail,
      Common.FieldControl     : #Mandatory
    ),
    subject   @UI.ParameterDefaultValue: in.emailSubject
  );
};

annotate service.QuoteItems with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>Item}',
    TypeNamePlural: '{i18n>Items}',
    Title         : {Value: description}
  },
  UI.LineItem           : [
    {
      Value             : productService_ID,
      @HTML5.CssDefaults: {width: '12rem'}
    },
    {
      Value             : description,
      @UI.Importance    : #High,
      @HTML5.CssDefaults: {width: '24rem'}
    },
    {
      Value             : quantity,
      @UI.Importance    : #High,
      @HTML5.CssDefaults: {width: '6rem'}
    },
    {
      Value             : unit,
      @HTML5.CssDefaults: {width: '7rem'}
    },
    {
      Value             : unitPrice,
      @UI.Importance    : #High,
      @HTML5.CssDefaults: {width: '9rem'}
    },
    {
      Value             : taxRate,
      @HTML5.CssDefaults: {width: '6rem'}
    },
    {
      Value             : grossAmount,
      @UI.Importance    : #High,
      @HTML5.CssDefaults: {width: '9rem'}
    }
  ],
  UI.PresentationVariant: {
    SortOrder     : [{Property: position}],
    Visualizations: ['@UI.LineItem']
  },
  Common.SideEffects #Product: {
    SourceProperties: [productService_ID],
    TargetProperties: [
      'description',
      'unit',
      'unitPrice',
      'taxRate',
      'netAmount',
      'grossAmount'
    ]
  }
);

annotate service.QuoteItems with {
  unit           @Common.ValueList: {
    CollectionPath: 'Units',
    Parameters    : [{
      $Type            : 'Common.ValueListParameterInOut',
      LocalDataProperty: unit,
      ValueListProperty: 'code'
    }]
  };
  productService @(
    Common.Text           : productService.name,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath : 'ProductServices',
      SearchSupported: true,
      Parameters     : [
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
          ValueListProperty: 'defaultPrice'
        },
        {
          $Type            : 'Common.ValueListParameterConstant',
          ValueListProperty: 'active',
          Constant         : true
        }
      ]
    }
  );
};

// ---------------------------------------------------------------------------
// Products and services
// ---------------------------------------------------------------------------

annotate service.ProductServices with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>ProductService}',
    TypeNamePlural: '{i18n>ProductServices}',
    Title         : {Value: name},
    Description   : {Value: code},
    TypeImageUrl  : 'sap-icon://product'
  },
  UI.SelectionFields    : [active],
  UI.LineItem           : [
    {Value: code},
    {
      Value         : name,
      @UI.Importance: #High
    },
    {Value: unit},
    {
      Value         : defaultPrice,
      @UI.Importance: #High
    },
    {Value: defaultTaxRate},
    {Value: active}
  ],
  UI.PresentationVariant: {
    SortOrder     : [{Property: name}],
    Visualizations: ['@UI.LineItem']
  },
  UI.FieldGroup #General: {Data: [
    {Value: code},
    {Value: name},
    {Value: description},
    {Value: unit},
    {Value: defaultPrice},
    {Value: defaultTaxRate},
    {Value: active}
  ]},
  UI.Facets             : [{
    $Type : 'UI.ReferenceFacet',
    ID    : 'General',
    Label : '{i18n>General}',
    Target: '@UI.FieldGroup#General'
  }]
);

annotate service.ProductServices with {
  unit @Common.ValueList: {
    CollectionPath: 'Units',
    Parameters    : [{
      $Type            : 'Common.ValueListParameterInOut',
      LocalDataProperty: unit,
      ValueListProperty: 'code'
    }]
  };
};

// ---------------------------------------------------------------------------
// Comments and questions (e.g. from the tax advisor), resolved by the team
// ---------------------------------------------------------------------------

annotate service.FinancialComments with @(UI.LineItem: [
  {
    $Type : 'UI.DataFieldForAction',
    Action: 'SalesService.resolve',
    Label : '{i18n>Resolve}'
  },
  {Value: text},
  {Value: createdBy},
  {Value: authorRole},
  {Value: createdAt},
  {
    Value      : resolved,
    Criticality: resolvedCriticality
  }
]);

annotate service.FinancialComments actions {
  resolve @(
    Core.OperationAvailable: {$edmJson: {$Not: {$Path: 'in/resolved'}}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
};

// ---------------------------------------------------------------------------
// Create, edit and delete are hidden for the read-only tax advisor (the backend enforces it)
// ---------------------------------------------------------------------------

annotate service.Customers with @(
  UI.CreateHidden: {$edmJson: {$Path: '/ReadOnlyUser/readOnly'}},
  UI.UpdateHidden: readOnly,
  UI.DeleteHidden: readOnly
);

annotate service.ProductServices with @(
  UI.CreateHidden: {$edmJson: {$Path: '/ReadOnlyUser/readOnly'}},
  UI.UpdateHidden: readOnly,
  UI.DeleteHidden: readOnly
);

annotate service.SalesInvoices with @(
  UI.CreateHidden: {$edmJson: {$Path: '/ReadOnlyUser/readOnly'}},
  UI.UpdateHidden: {$edmJson: {$Or: [{$Path: 'isLocked'}, {$Path: 'readOnly'}]}}
);
