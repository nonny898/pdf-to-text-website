<template>
  <v-app id="inspire">
    <v-content>
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="4">
            <v-card class="elevation-12">
              <v-toolbar color="primary" dark flat>
                <v-toolbar-title>PDF to Text</v-toolbar-title>
                <v-spacer />
              </v-toolbar>
              <v-card-text>
                <v-form>
                  <v-file-input
                    accept=".tgz, .tar.gz"
                    label="File input"
                  ></v-file-input>
                </v-form>
                <v-progress-linear
                  v-model="valueDeterminate"
                ></v-progress-linear>
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn color="primary">Submit</v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-content>
  </v-app>
</template>

<script>
import io from "socket.io-client";
export default {
  data() {
    return {
      valueDeterminate: 50,
      user: "",
      message: "",
      messages: [],
      socket: io("localhost:3000")
    };
  },
  props: {
    source: String
  },
  mounted() {
    this.socket.on("MESSAGE", data => {
      this.messages = [...this.messages, data];
      // you can also do this.messages.push(data)
    });
  },
  methods: {
    sendMessage(e) {
      e.preventDefault();
      this.socket.emit("SEND_MESSAGE", {
        user: this.user,
        message: this.message
      });
      this.message = "";
    }
  }
};
</script>
