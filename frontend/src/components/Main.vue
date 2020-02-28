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
                    v-model="file"
                  ></v-file-input>
                </v-form>
                <v-progress-linear
                  v-model="valueDeterminate"
                ></v-progress-linear>
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn v-if="url" color="primary" @click="sendMessage()"
                  ><a style="color: white" :href="url">Download</a></v-btn
                >
                <v-btn color="primary" @click="sendMessage()">Submit</v-btn>
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
      valueDeterminate: 0,
      file: null,
      url: null,
      socket: io("localhost:3001")
    };
  },
  methods: {
    sendMessage() {
      this.socket.on(this.file.name, data => {
        if (this.file.name === data.filename) {
          this.valueDeterminate = data.progress;
        }
      });
      this.socket.on(`${this.file.name}-COMPLETE`, data => {
        console.log(data.url);
        this.url = data.url;
      });
      console.log(this.file);
      this.socket.emit("SEND_MESSAGE", {
        filename: this.file.name
      });
      const formData = new FormData();
      formData.append("pdf", this.file);
      fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
        mode: "no-cors"
      }).then(() => {});
    }
  },
  mounted() {}
};
</script>
