/**
 * XMP metadata that identifies a PDF/A-3 as ZUGFeRD 2.x / Factur-X invoice, including the
 * PDF/A extension schema description that PDF/A requires for the fx: properties.
 */
export const facturXNamespace = "urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#";

export function facturXXmp(fileName: string, conformanceLevel: string): string {
	return `
<rdf:Description xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#" rdf:about="">
  <pdfaExtension:schemas>
    <rdf:Bag>
      <rdf:li rdf:parseType="Resource">
        <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
        <pdfaSchema:namespaceURI>${facturXNamespace}</pdfaSchema:namespaceURI>
        <pdfaSchema:prefix>fx</pdfaSchema:prefix>
        <pdfaSchema:property>
          <rdf:Seq>
            ${property("DocumentFileName", "The name of the embedded XML document")}
            ${property("DocumentType", "The type of the hybrid document in capital letters, e.g. INVOICE or ORDER")}
            ${property("Version", "The actual version of the standard applying to the embedded XML document")}
            ${property("ConformanceLevel", "The conformance level of the embedded XML document")}
          </rdf:Seq>
        </pdfaSchema:property>
      </rdf:li>
    </rdf:Bag>
  </pdfaExtension:schemas>
</rdf:Description>
<rdf:Description xmlns:fx="${facturXNamespace}" rdf:about="">
  <fx:DocumentType>INVOICE</fx:DocumentType>
  <fx:DocumentFileName>${fileName}</fx:DocumentFileName>
  <fx:Version>1.0</fx:Version>
  <fx:ConformanceLevel>${conformanceLevel}</fx:ConformanceLevel>
</rdf:Description>`;
}

function property(name: string, description: string): string {
	return `<rdf:li rdf:parseType="Resource">
              <pdfaProperty:name>${name}</pdfaProperty:name>
              <pdfaProperty:valueType>Text</pdfaProperty:valueType>
              <pdfaProperty:category>external</pdfaProperty:category>
              <pdfaProperty:description>${description}</pdfaProperty:description>
            </rdf:li>`;
}
