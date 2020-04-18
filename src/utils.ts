import { Store } from "vuex";

export function handleError(store: Store<any>, err: Error | string | any) {
  if (!err) {
    return;
  }

  console.error(err);

  if (typeof err !== "object") {
    store.commit('error', err);
  } else if (err?.response?.data?.message || err?.message) {
    store.commit('error', err?.response?.data?.message || err?.message);
  } else {
    store.commit('error', 'Unknown error');
  }
}

export function handleInfo(store: Store<any>, info: string) {
  console.info(info);
  store.commit('info', info);
}
