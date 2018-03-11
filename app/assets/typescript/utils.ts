export function showError(error: string) {
  $("#errors").append(`<div class='alert alert-danger'>${error}</div>`);
}