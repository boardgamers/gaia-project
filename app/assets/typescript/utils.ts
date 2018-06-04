export function showError(error: string) {
  $("#errors").html(`<div class='alert alert-danger'>${error}</div>`);
}

export function removeError() {
  $("#errors").html('');
}