# ZUGFeRD validation (release check)

Swiver issues ZUGFeRD 2.x / Factur-X invoices, profile EN 16931 (PDF/A-3b with embedded `factur-x.xml`).
XRechnung is not in scope.

## Automated checks

- `npm run test:integration` runs `test/integration/zugferd.test.ts`: embedded CII XML, amounts and VAT breakdown
  (single 19 % rate and 19 % + 7 % with three items), PDF/A-3 identification, Factur-X XMP and the
  `AFRelationship /Alternative` link between PDF and XML.
- `npm run validate:zugferd` additionally validates the generated PDFs with the
  [Mustang](https://www.mustangproject.org/) validator: veraPDF (PDF/A-3), XSD and the Factur-X EN 16931
  Schematron. It needs Java 17+ (`brew install openjdk`) and downloads the pinned Mustang CLI from Maven
  Central once (checksum verified) into `~/.cache/swiver`.

Run `npm run validate:zugferd` before each release and after any change to `srv/integrations/einvoice`,
`srv/sales/einvoice-context.ts` or `srv/core/invoice-pdf.ts`. It must print `valid:` for every PDF.

## Validating a single invoice

Download the ZUGFeRD PDF from the invoice (or `GET .../SalesInvoices(ID=…,IsActiveEntity=true)/SalesService.zugferd(download=true)`) and run:

```sh
./scripts/validate-zugferd.sh invoice.pdf
```

Notices from the XRechnung rule set (buyer reference, seller contact, business process) are expected and
suppressed: they apply to XRechnung, not to ZUGFeRD EN 16931.
