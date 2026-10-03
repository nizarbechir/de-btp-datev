using {
  managed,
  Country,
  Currency
} from '@sap/cds/common';
using {swiver.TaxRate} from './sales';

namespace swiver;

/**
 * The seller details printed on sales invoices, and the defaults for new invoices.
 * There is exactly one record (ID 1), created on startup if it is missing.
 */
entity CompanySettings : managed {
  key ID                     : Integer default 1;
      companyName            : String(120);
      ownerName              : String(120);
      street                 : String(200);
      postalCode             : String(10);
      city                   : String(80);
      country                : Country default 'DE';
      email                  : String(120);
      phone                  : String(40);
      website                : String(120);
      taxNumber              : String(30);
      vatId                  : String(20);
      iban                   : String(34);
      bic                    : String(11);
      bankName               : String(80);
      defaultCurrency        : Currency default 'EUR';
      defaultTaxRate         : TaxRate default 19;
      defaultPaymentTermDays : Integer default 14  @assert.range: [
        0,
        365
      ];
      invoicePrefix          : String(10) default 'INV';
      // Shown at the top of the invoice PDF (PNG or JPEG).
      logo                   : LargeBinary @Core.MediaType: logoMediaType
                                           @Core.AcceptableMediaTypes: [
                                             'image/png',
                                             'image/jpeg'
                                           ];
      logoMediaType          : String(100) @Core.IsMediaType;
}
