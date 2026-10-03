using {
  managed,
  Country,
  Currency,
  sap.common.CodeList
} from '@sap/cds/common';
using {swiver.TaxRate} from './sales';
using {swiver.OrganizationOwned} from './organizations';

namespace swiver;

/** The languages sales invoices and quotes can be printed in. */
entity DocumentLanguages : CodeList {
  key code : String(2) enum {
        german  = 'DE';
        english = 'EN';
      };
}

/**
 * The seller details printed on sales invoices and quotes, and the defaults for new documents.
 * Every organization has exactly one record.
 */
entity CompanySettings : managed, OrganizationOwned {
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
      // Legal details for corporations (e.g. GmbH), printed in the invoice footer.
      managingDirectors      : String(200);
      registerCourt          : String(80);
      registerNumber         : String(40);
      // All labels, dates and amounts of a sales invoice or quote are printed in this language.
      documentLanguage       : Association to DocumentLanguages default 'DE';
      defaultCurrency        : Currency default 'EUR';
      defaultTaxRate         : TaxRate default 19;
      defaultPaymentTermDays : Integer default 14  @assert.range: [
        0,
        365
      ];
      invoicePrefix          : String(10) default 'INV';
      quotePrefix            : String(10) default 'QUO';
      // Shown at the top of the invoice PDF (PNG or JPEG).
      logo                   : LargeBinary @Core.MediaType: logoMediaType
                                           @Core.AcceptableMediaTypes: [
                                             'image/png',
                                             'image/jpeg'
                                           ];
      logoMediaType          : String(100) @Core.IsMediaType;
}
