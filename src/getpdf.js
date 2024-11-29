import { jsPDF } from "jspdf";
import "jspdf-autotable";

async function generatePdf(context, req) {
  const { id } = req.params;

  // Initialize PDF with A4 format
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Set theme colors
  const primaryColor = "#1a237e";
  const secondaryColor = "#534bae";
  const accentColor = "#ffffff";

  // Set margins and dimensions
  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;
  const usableWidth = pageWidth - 2 * margin;

  // Header with company brand
  doc.autoTable({
    body: [
      [
        {
          content: "Your Company Name",
          styles: {
            halign: "left",
            fontSize: 20,
            textColor: accentColor,
            cellPadding: 8,
          },
        },
        {
          content: "TAX INVOICE",
          styles: {
            halign: "right",
            fontSize: 20,
            textColor: accentColor,
            cellPadding: 8,
          },
        },
      ],
    ],
    theme: "plain",
    styles: { fillColor: primaryColor },
    margin: { left: margin, right: margin, top: margin },
    tableWidth: usableWidth,
  });

  // Invoice Details
  doc.autoTable({
    body: [
      [
        {
          content: `Invoice No: INV-${id}\nDate: ${new Date().toLocaleDateString()}\nGSTIN: 27AAAAA0000A1Z5`,
          styles: {
            halign: "right",
            fontSize: 11,
            cellPadding: 4,
          },
        },
      ],
    ],
    theme: "plain",
    margin: { left: margin, right: margin, top: 10 },
    tableWidth: usableWidth,
  });

  // Company and Client Details
  doc.autoTable({
    body: [
      [
        {
          content:
            "From:\nYour Company Name\n123 Business Street\nCity - 560066\nPhone: +91 9876543210",
          styles: {
            halign: "left",
            fontSize: 11,
            cellPadding: 4,
          },
        },
        {
          content:
            "Bill To:\nClient Name\nClient Address\nCity, State - PIN\nGSTIN: 29BBBBB1111B1Z4",
          styles: {
            halign: "right",
            fontSize: 11,
            cellPadding: 4,
          },
        },
      ],
    ],
    theme: "plain",
    margin: { left: margin, right: margin, top: 10 },
    tableWidth: usableWidth,
  });

  // Product Details Table
  doc.autoTable({
    head: [
      [
        {
          content: "Description",
          styles: { fillColor: secondaryColor, cellWidth: 60 },
        },
        {
          content: "Rate",
          styles: { fillColor: secondaryColor, cellWidth: 30, halign: "center" },
        },
        {
          content: "Qty",
          styles: {
            fillColor: secondaryColor,
            cellWidth: 20,
            halign: "center",
          },
        },
        {
          content: "Amount",
          styles: { fillColor: secondaryColor, cellWidth: 60, halign: "center" },
        },
      ],
    ],
    body: [["Product Name", "1,000.00", "1", "1,000.00"]],
    theme: "striped",
    styles: {
      fontSize: 11,
      cellPadding: 6,
    },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
    },
    headStyles: {
      textColor: accentColor,
      fillColor: secondaryColor,
      fontSize: 11,
      fontStyle: "bold",
    },
    margin: { left: margin, right: margin, top: 15 },
    tableWidth: usableWidth,
  });

// Calculations Table
const cellwith_1 = 60;
const cellwith_2 = 60;
const cellwith_3 = 40;
doc.autoTable({
  body: [
    [
      { content: '', styles: { cellWidth: cellwith_1 } },
      { content: 'Subtotal:', styles: { cellWidth: cellwith_2, halign: 'right', fontStyle: 'bold' } },
      { content: '1,000.00', styles: { cellWidth: cellwith_3, halign: 'right' } }
    ],
    [
      { content: '', styles: { cellWidth: cellwith_1 } },
      { content: 'CGST (9%):', styles: { cellWidth: cellwith_2, halign: 'right', fontStyle: 'bold' } },
      { content: '90.00', styles: { cellWidth: cellwith_3, halign: 'right' } }
    ],
    [
      { content: '', styles: { cellWidth: cellwith_1 } },
      { content: 'SGST (9%):', styles: { cellWidth: cellwith_2, halign: 'right', fontStyle: 'bold' } },
      { content: '90.00', styles: { cellWidth: cellwith_3, halign: 'right' } }
    ],
    [
      { content: '', styles: { cellWidth: cellwith_1 } },
      { content: 'Discount:', styles: { cellWidth: cellwith_2, halign: 'right', fontStyle: 'bold' } },
      { content: '100.00', styles: { cellWidth: cellwith_3, halign: 'right' } }
    ],
    [
      { content: '', styles: { cellWidth: cellwith_1 } },
      { content: 'Total:', styles: { cellWidth: cellwith_2, halign: 'right', fontStyle: 'bold' } },
      { content: '1,080.00', styles: { cellWidth: cellwith_3, halign: 'right', fontStyle: 'bold' } }
    ]
  ],
  theme: 'plain',
  styles: {
    fontSize: 11,
    cellPadding: 3
  },
  margin: { left: margin, right: margin, top: 2 },
  tableWidth: usableWidth
});

  return doc;
}

async function getPdf(context, req, res) {
  try {
    // Create new document
    const doc = await generatePdf(context, req);

    // Send the PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=generated-pdf.pdf"
    );

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    res.status(500).send("Error generating PDF");
  }
}

export default getPdf;
