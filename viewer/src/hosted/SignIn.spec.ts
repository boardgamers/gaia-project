import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import SignIn from "./SignIn.vue";

Vue.use(BootstrapVue);

describe("SignIn", () => {
  function makeClient() {
    let lastOtpArgs: any = null;
    const client = {
      auth: {
        signInWithOAuth: async () => ({ error: null }),
        signInWithOtp: async (args: any) => {
          lastOtpArgs = args;
          return { error: null };
        },
      },
    };
    return { client, lastOtpArgs: () => lastOtpArgs };
  }

  it("shows both Google and magic-link sign-in options", async () => {
    const { client } = makeClient();
    const wrapper = mount(SignIn, { propsData: { client } });
    await Vue.nextTick();

    expect(wrapper.text()).to.include("Sign in with Google");
    expect(wrapper.text()).to.include("Send sign-in link");
    expect(wrapper.find('input[type="email"]').exists()).to.equal(true);
    expect(wrapper.find('label[for="sign-in-email"]').text()).to.equal("Email address");
    expect(wrapper.find('a[href="?offline=1"]').exists()).to.equal(false);
  });

  it("sends a magic link to the entered email", async () => {
    const { client, lastOtpArgs } = makeClient();
    const wrapper = mount(SignIn, { propsData: { client } });
    await Vue.nextTick();

    const input = wrapper.find('input[type="email"]');
    await input.setValue("friend@example.com");
    await wrapper.find("form").trigger("submit.prevent");
    await Vue.nextTick();

    expect(lastOtpArgs()).to.deep.equal({
      email: "friend@example.com",
      options: { emailRedirectTo: window.location.href },
    });
    expect(wrapper.text()).to.include("Sign-in link sent to friend@example.com");
  });
});
