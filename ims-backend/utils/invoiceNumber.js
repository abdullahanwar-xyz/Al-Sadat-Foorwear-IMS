// Shared generator for the document numbers used across invoices, estimates
// and window invoices (INV-/EST-/WIN- respectively). Previously copy-pasted
// independently in each model's defaultValue and each controller's create
// method - centralized here so the scheme only needs to change in one place.
function generateDocumentNumber(prefix) {
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

module.exports = { generateDocumentNumber };
