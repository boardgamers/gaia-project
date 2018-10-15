import { Store } from "vuex";

function isError(err: Error | JQuery.jqXHR): err is Error {
  return (<any> err).message;
}

function isJqXHR(err: Error | JQuery.jqXHR | {message: string}): err is JQuery.jqXHR {
  return 'responseText' in (<JQuery.jqXHR> err);
}

export function handleError(store: Store<any>, err: Error | JQuery.jqXHR | string) {
  if (!err) {
    return;
  }

  console.error(err);

  if (typeof err !== "object") {
    store.commit('error', err);
  } else if (isError(err)) {
    store.commit('error', err.message);
  } else if (isJqXHR(err)) {
    const resp = err.responseJSON;
    if (resp && resp instanceof Object && resp.message) {
      store.commit('error', resp.message);
    } else if (err.responseText) {
      store.commit('error', err.responseText);
    } else {
      store.commit('error', 'Server-side error');
    }
  } else {
    store.commit('error', 'Unknown error');
  }
}
