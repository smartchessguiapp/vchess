<template lang="pug">
div
  input#modalContact.modal(
    type="checkbox"
    @change="trySetEnterTime($event)"
  )
  div#contactDiv(
    role="dialog"
    data-checkbox="modalContact"
  )
    .card
      label.modal-close(for="modalContact")
      fieldset
        label(for="userEmail") {{ st.tr["Email"] }}
        input#userEmail(type="email" :value="st.user.email")
      fieldset
        label(for="mailSubject") {{ st.tr["Subject"] }}
        input#mailSubject(type="text")
      fieldset
        textarea#mailContent(:placeholder="st.tr['Your message']")
      button(@click="trySendMessage()") {{ st.tr["Send"] }}
      #dialog.text-center {{ st.tr[infoMsg] }}
</template>

<script>
import { ajax } from "@/utils/ajax";
import { store } from "@/store";
import { checkNameEmail } from "@/data/userCheck";
import { processModalClick } from "@/utils/modalClick.js";
export default {
  name: "my-contact-form",
  data: function() {
    return {
      enterTime: Number.MAX_SAFE_INTEGER, //for a basic anti-bot strategy
      st: store.state,
      infoMsg: ""
    };
  },
  mounted: function() {
    document.getElementById("contactDiv")
      .addEventListener("click", processModalClick);
  },
  methods: {
    trySetEnterTime: function(event) {
      if (event.target.checked) {
        this.enterTime = Date.now();
        this.infoMsg = "";
      }
    },
    trySendMessage: function() {
      // Basic anti-bot strategy:
      const exitTime = Date.now();
      if (exitTime - this.enterTime < 5000) return;
      let email = document.getElementById("userEmail");
      let subject = document.getElementById("mailSubject");
      let content = document.getElementById("mailContent");
      let error = checkNameEmail({ email: email });
      if (!error && content.value.trim().length == 0)
        error = this.st.tr["Empty message"];
      if (error) {
        alert(error);
        return;
      }
      if (
        subject.value.trim().length == 0 &&
        !confirm(this.st.tr["No subject. Send anyway?"])
      )
        return;
      // Message sending:
      ajax(
        "/messages",
        "POST",
        {
          nocredentials: true,
          data: {
            email: email.value,
            subject: subject.value,
            content: content.value
          },
          success: () => {
            this.infoMsg = "Email sent!";
            subject.value = "";
            content.value = "";
          }
        }
      );
    }
  }
};
</script>

<style lang="sass" scoped>
[type="checkbox"].modal+div .card
  max-width: 767px
  max-height: 100%

textarea#mailContent
  width: 100%
  min-height: 100px

#dialog
  padding: 5px
  color: blue
</style>
